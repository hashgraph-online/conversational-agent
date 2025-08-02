import { Logger } from '../utils/logger'
import { MCPServerConfig } from './MCPService'

export interface MCPRegistryServer {
  id: string
  name: string
  description: string
  author?: string
  version?: string
  url?: string
  packageName?: string
  repository?: {
    type: string
    url: string
  }
  config?: {
    command?: string
    args?: string[]
    env?: Record<string, string>
  }
  tags?: string[]
  license?: string
  createdAt?: string
  updatedAt?: string
  installCount?: number
  rating?: number
}

export interface MCPRegistryResponse {
  servers: MCPRegistryServer[]
  total?: number
  cursor?: string
  hasMore?: boolean
}

export interface MCPRegistrySearchOptions {
  query?: string
  limit?: number
  offset?: number
  cursor?: string
  tags?: string[]
  author?: string
}

/**
 * Service for discovering MCP servers from various registries
 */
export class MCPRegistryService {
  private static instance: MCPRegistryService
  private logger: Logger
  private cache: Map<string, { data: MCPRegistryResponse; timestamp: number }> = new Map()
  private readonly CACHE_TTL = 5 * 60 * 1000

  private constructor() {
    this.logger = new Logger({ module: 'MCPRegistryService' })
  }

  /**
   * Get singleton instance
   */
  static getInstance(): MCPRegistryService {
    if (!MCPRegistryService.instance) {
      MCPRegistryService.instance = new MCPRegistryService()
    }
    return MCPRegistryService.instance
  }

  /**
   * Search for MCP servers across multiple registries
   */
  async searchServers(options: MCPRegistrySearchOptions = {}): Promise<MCPRegistryResponse> {
    const cacheKey = JSON.stringify(options)
    const cached = this.cache.get(cacheKey)
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      this.logger.info('Returning cached registry results')
      return cached.data
    }

    try {
      this.logger.info('Searching MCP registries with options:', options)
      
      const registryPromises = [
        this.searchPulseMCP(options)
      ]

      const results = await Promise.allSettled(registryPromises)
      const allServers: MCPRegistryServer[] = []
      let totalCount = 0

      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          allServers.push(...result.value.servers)
          totalCount += result.value.total || result.value.servers.length
        } else {
          const registryNames = ['PulseMCP', 'Official Registry', 'Smithery Registry']
          this.logger.warn(`Failed to fetch from ${registryNames[index]}:`, 
            result.status === 'rejected' ? result.reason : 'Unknown error')
        }
      })

      const uniqueServers = this.deduplicateServers(allServers)
      
      const filteredServers = this.filterServers(uniqueServers, options)
      
      const sortedServers = this.sortServers(filteredServers, options.query)

      let aggregatedTotal = 0
      let aggregatedHasMore = false
      
      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          aggregatedTotal += result.value.total || 0
          aggregatedHasMore = aggregatedHasMore || result.value.hasMore || false
        }
      })

      const response: MCPRegistryResponse = {
        servers: sortedServers,
        total: aggregatedTotal,
        hasMore: aggregatedHasMore
      }

      this.cache.set(cacheKey, { data: response, timestamp: Date.now() })
      
      this.logger.info(`Found ${response.servers.length} unique MCP servers from registries`)
      return response

    } catch (error) {
      this.logger.error('Failed to search MCP registries:', error)
      return { servers: [], total: 0, hasMore: false }
    }
  }

  /**
   * Get detailed information about a specific server
   */
  async getServerDetails(serverId: string, packageName?: string): Promise<MCPRegistryServer | null> {
    try {
      const detailPromises = [
        this.getServerDetailsFromPulseMCP(serverId, packageName),
        this.getServerDetailsFromOfficialRegistry(serverId),
        this.getServerDetailsFromSmitheryRegistry(serverId, packageName)
      ]

      const results = await Promise.allSettled(detailPromises)
      
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          return result.value
        }
      }

      this.logger.warn(`No details found for server: ${serverId}`)
      return null

    } catch (error) {
      this.logger.error(`Failed to get server details for ${serverId}:`, error)
      return null
    }
  }

  /**
   * Convert registry server to MCP server config for installation
   */
  convertToMCPConfig(registryServer: MCPRegistryServer): Partial<MCPServerConfig> {
    const config: Partial<MCPServerConfig> = {
      name: registryServer.name,
      type: 'custom',
      enabled: true,
      config: {}
    }

    if (registryServer.packageName) {
      config.config!.command = registryServer.packageName
      config.config!.args = registryServer.config?.args || []
      config.config!.env = registryServer.config?.env || {}
    } else if (registryServer.repository?.url) {
      if (registryServer.repository.url.includes('github.com')) {
        const repoMatch = registryServer.repository.url.match(/github\.com\/([^/]+\/[^/]+)/)
        if (repoMatch) {
          config.config!.command = `npx github:${repoMatch[1]}`
        }
      }
    } else if (registryServer.config?.command) {
      config.config!.command = registryServer.config.command
      config.config!.args = registryServer.config.args || []
      config.config!.env = registryServer.config.env || {}
    }

    return config
  }


  private async searchPulseMCP(options: MCPRegistrySearchOptions): Promise<MCPRegistryResponse> {
    const baseUrl = 'https://api.pulsemcp.com/v0beta'
    const params = new URLSearchParams()
    
    if (options.query) params.append('query', options.query)
    
    const limit = options.limit || 50
    params.append('count_per_page', limit.toString())
    
    if (options.offset) {
      params.append('offset', options.offset.toString())
    }
    
    const url = `${baseUrl}/servers?${params.toString()}`
    
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'ConversationalAgent/1.0 (https://hashgraphonline.com)',
          'Accept': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`PulseMCP API error: ${response.status}`)
      }

      const data = await response.json()
      
      const totalServers = data.total_count || 0
      const hasNext = data.next !== null && data.next !== undefined
      
      return {
        servers: (data.servers || []).map(this.normalizePulseMCPServer),
        total: totalServers,
        hasMore: hasNext
      }
    } catch (error) {
      this.logger.warn('PulseMCP error:', error)
      throw error
    }
  }

  private async searchOfficialRegistry(options: MCPRegistrySearchOptions): Promise<MCPRegistryResponse> {
    const baseUrl = 'https://registry.modelcontextprotocol.io/v0'
    const params = new URLSearchParams()
    
    if (options.limit) params.append('limit', options.limit.toString())
    if (options.cursor) params.append('cursor', options.cursor)
    
    const url = `${baseUrl}/servers?${params.toString()}`
    
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)
      
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json'
        },
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`Official Registry API error: ${response.status}`)
      }

      const data = await response.json()
      
      return {
        servers: (data.servers || []).map(this.normalizeOfficialRegistryServer),
        total: data.total,
        cursor: data.cursor,
        hasMore: !!data.cursor
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        this.logger.warn('Official Registry request timed out after 5 seconds')
      } else if (error.cause?.code === 'ENOTFOUND') {
        this.logger.warn('Official Registry domain not found - registry may be temporarily unavailable')
      } else {
        this.logger.warn('Official Registry error:', error.message)
      }
      
      return { servers: [], total: 0, hasMore: false }
    }
  }

  private async searchSmitheryRegistry(options: MCPRegistrySearchOptions): Promise<MCPRegistryResponse> {
    this.logger.info('Smithery Registry search skipped (requires authentication)')
    return { servers: [], total: 0, hasMore: false }
  }

  private async getServerDetailsFromPulseMCP(serverId: string, packageName?: string): Promise<MCPRegistryServer | null> {
    if (!packageName) return null
    
    const baseUrl = 'https://api.pulsemcp.com/v0beta'
    const url = `${baseUrl}/servers/${encodeURIComponent(packageName)}`
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'ConversationalAgent/1.0 (https://hashgraphonline.com)',
        'Accept': 'application/json'
      }
    })

    if (!response.ok) return null

    const data = await response.json()
    return this.normalizePulseMCPServer(data)
  }

  private async getServerDetailsFromOfficialRegistry(serverId: string): Promise<MCPRegistryServer | null> {
    const baseUrl = 'https://registry.modelcontextprotocol.io/v0'
    const url = `${baseUrl}/servers/${encodeURIComponent(serverId)}`
    
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)
      
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json'
        },
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)

      if (!response.ok) return null

      const data = await response.json()
      return this.normalizeOfficialRegistryServer(data)
    } catch (error: any) {
      if (error.name === 'AbortError') {
        this.logger.debug('Official Registry detail request timed out')
      } else if (error.cause?.code === 'ENOTFOUND') {
        this.logger.debug('Official Registry domain not found')
      } else {
        this.logger.debug('Official Registry detail error:', error.message)
      }
      return null
    }
  }

  private async getServerDetailsFromSmitheryRegistry(serverId: string, packageName?: string): Promise<MCPRegistryServer | null> {
    return null
  }


  private normalizePulseMCPServer = (server: any): MCPRegistryServer => {
    return {
      id: server.id || server.name || server.package_name,
      name: server.name || server.package_name,
      description: server.description || '',
      author: server.author,
      version: server.version,
      packageName: server.package_name,
      repository: server.repository ? {
        type: 'git',
        url: server.repository.url || server.repository
      } : undefined,
      tags: server.tags || server.keywords || [],
      license: server.license,
      createdAt: server.created_at,
      updatedAt: server.updated_at,
      installCount: server.downloads || server.install_count,
      rating: server.rating
    }
  }

  private normalizeOfficialRegistryServer = (server: any): MCPRegistryServer => {
    return {
      id: server.id,
      name: server.name,
      description: server.description || '',
      author: server.author,
      version: server.version,
      url: server.url,
      repository: server.repository,
      config: server.config,
      tags: server.tags || [],
      license: server.license,
      createdAt: server.created_at,
      updatedAt: server.updated_at
    }
  }

  private deduplicateServers(servers: MCPRegistryServer[]): MCPRegistryServer[] {
    const seen = new Set<string>()
    const unique: MCPRegistryServer[] = []

    for (const server of servers) {
      const key = server.packageName || server.repository?.url || server.name
      if (!seen.has(key)) {
        seen.add(key)
        unique.push(server)
      }
    }

    return unique
  }

  private filterServers(servers: MCPRegistryServer[], options: MCPRegistrySearchOptions): MCPRegistryServer[] {
    let filtered = servers

    if (options.query) {
      const query = options.query.toLowerCase()
      filtered = filtered.filter(server => 
        server.name.toLowerCase().includes(query) ||
        server.description.toLowerCase().includes(query) ||
        (server.tags && server.tags.some(tag => tag.toLowerCase().includes(query)))
      )
    }

    if (options.tags && options.tags.length > 0) {
      filtered = filtered.filter(server =>
        server.tags && options.tags!.some(tag => server.tags!.includes(tag))
      )
    }

    if (options.author) {
      filtered = filtered.filter(server =>
        server.author && server.author.toLowerCase().includes(options.author!.toLowerCase())
      )
    }

    return filtered
  }

  private sortServers(servers: MCPRegistryServer[], query?: string): MCPRegistryServer[] {
    return servers.sort((a, b) => {
      if (query) {
        const aExact = a.name.toLowerCase() === query.toLowerCase() ? 1 : 0
        const bExact = b.name.toLowerCase() === query.toLowerCase() ? 1 : 0
        if (aExact !== bExact) return bExact - aExact
      }

      const aInstalls = a.installCount || 0
      const bInstalls = b.installCount || 0
      if (aInstalls !== bInstalls) return bInstalls - aInstalls

      const aRating = a.rating || 0
      const bRating = b.rating || 0
      if (aRating !== bRating) return bRating - aRating

      return a.name.localeCompare(b.name)
    })
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear()
    this.logger.info('Registry cache cleared')
  }
}