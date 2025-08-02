import { Logger } from '../utils/logger'
import { spawn, ChildProcess } from 'child_process'
import * as path from 'path'
import * as fs from 'fs'
import { app } from 'electron'
import { MCPServerValidator } from '../validators/MCPServerValidator'
import type { ValidationResult } from '../validators/MCPServerValidator'

export interface MCPServerConfig {
  id: string
  name: string
  type: 'filesystem' | 'github' | 'postgres' | 'sqlite' | 'custom'
  status: 'connected' | 'disconnected' | 'connecting' | 'handshaking' | 'ready' | 'error'
  enabled: boolean
  config: Record<string, any>
  tools?: MCPServerTool[]
  lastConnected?: Date
  errorMessage?: string
  createdAt: Date
  updatedAt: Date
  connectionHealth?: MCPConnectionHealth
}

export interface MCPConnectionHealth {
  connectionAttempts: number
  lastAttemptTime?: Date
  averageLatency?: number
  uptime?: number
  errorRate?: number
  lastError?: string
  lastErrorTime?: Date
}

export interface MCPServerTool {
  name: string
  description: string
  inputSchema: Record<string, any>
}

export interface MCPConnectionResult {
  success: boolean
  tools?: MCPServerTool[]
  error?: string
}

/**
 * Service for managing MCP server instances in the main process
 */
export class MCPService {
  private static instance: MCPService
  private logger: Logger
  private servers: Map<string, ChildProcess> = new Map()
  private serverConfigs: MCPServerConfig[] = []
  private configPath: string
  private validator: MCPServerValidator
  private connectionHealthMap: Map<string, MCPConnectionHealth> = new Map()
  private connectionStartTimes: Map<string, Date> = new Map()

  private constructor() {
    this.logger = new Logger({ module: 'MCPService' })
    this.configPath = path.join(app.getPath('userData'), 'mcp-servers.json')
    this.validator = new MCPServerValidator()
  }

  /**
   * Get singleton instance
   */
  static getInstance(): MCPService {
    if (!MCPService.instance) {
      MCPService.instance = new MCPService()
    }
    return MCPService.instance
  }

  /**
   * Load MCP server configurations from disk
   */
  async loadServers(): Promise<MCPServerConfig[]> {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = await fs.promises.readFile(this.configPath, 'utf8')
        this.serverConfigs = JSON.parse(data)
        this.logger.info(`Loaded ${this.serverConfigs.length} MCP server configurations`)
      } else {
        this.serverConfigs = this.getDefaultServers()
        this.logger.info('No MCP server configurations found, creating default filesystem server')
        try {
          await this.saveServers(this.serverConfigs)
        } catch (saveError) {
          this.logger.warn('Failed to save default server configuration:', saveError)
        }
      }
      return this.serverConfigs
    } catch (error) {
      this.logger.error('Failed to load MCP server configurations:', error)
      this.serverConfigs = this.getDefaultServers()
      this.logger.info('Using default MCP server configuration as fallback')
      return this.serverConfigs
    }
  }

  /**
   * Save MCP server configurations to disk
   */
  async saveServers(servers: MCPServerConfig[]): Promise<void> {
    try {
      this.serverConfigs = servers
      await fs.promises.writeFile(this.configPath, JSON.stringify(servers, null, 2))
      this.logger.info(`Saved ${servers.length} MCP server configurations`)
    } catch (error) {
      this.logger.error('Failed to save MCP server configurations:', error)
      throw error
    }
  }

  /**
   * Test connection to an MCP server
   */
  async testConnection(serverConfig: MCPServerConfig): Promise<MCPConnectionResult> {
    try {
      this.logger.info(`Testing connection to MCP server: ${serverConfig.name}`)
      
      const validationResult = await this.validator.validate(serverConfig)
      
      if (!validationResult.valid) {
        const errorMessages = this.validator.getErrorMessages(validationResult.errors)
        const detailedError = errorMessages.join('; ')
        
        this.logger.error(`Validation failed for ${serverConfig.name}: ${detailedError}`)
        
        return {
          success: false,
          error: `Configuration validation failed: ${detailedError}`
        }
      }
      
      if (validationResult.warnings.length > 0) {
        const warningMessages = this.validator.getWarningMessages(validationResult.warnings)
        warningMessages.forEach(warning => {
          this.logger.warn(`Validation warning for ${serverConfig.name}: ${warning}`)
        })
      }
      
      const { command, args, env } = this.buildServerCommand(serverConfig)
      
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          resolve({
            success: false,
            error: 'Connection test timed out'
          })
        }, 10000)

        const childProcess = spawn(command, args, {
          env: { ...process.env, ...env },
          stdio: ['pipe', 'pipe', 'pipe']
        })

        let stdoutData = ''
        let stderrData = ''

        childProcess.stdout?.on('data', (data: Buffer) => {
          stdoutData += data.toString()
        })

        childProcess.stderr?.on('data', (data: Buffer) => {
          stderrData += data.toString()
        })

        childProcess.on('close', (code: number | null) => {
          clearTimeout(timeout)
          
          if (code === 0) {
            try {
              const tools = this.parseServerTools(stdoutData)
              resolve({
                success: true,
                tools
              })
            } catch (parseError) {
              resolve({
                success: true,
                tools: []
              })
            }
          } else {
            resolve({
              success: false,
              error: `Process exited with code ${code}: ${stderrData}`
            })
          }
        })

        childProcess.on('error', (error: Error) => {
          clearTimeout(timeout)
          resolve({
            success: false,
            error: error.message
          })
        })

        try {
          childProcess.stdin?.write(JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'tools/list'
          }) + '\n')
          childProcess.stdin?.end()
        } catch (error) {
          clearTimeout(timeout)
          resolve({
            success: false,
            error: `Failed to send test request: ${error}`
          })
        }
      })
    } catch (error) {
      this.logger.error(`Connection test failed for ${serverConfig.name}:`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection test failed'
      }
    }
  }

  /**
   * Update connection health metrics
   */
  private updateConnectionHealth(serverId: string, event: 'attempt' | 'success' | 'error', error?: string): void {
    let health = this.connectionHealthMap.get(serverId)
    
    if (!health) {
      health = {
        connectionAttempts: 0,
        errorRate: 0
      }
      this.connectionHealthMap.set(serverId, health)
    }
    
    const now = new Date()
    
    switch (event) {
      case 'attempt':
        health.connectionAttempts++
        health.lastAttemptTime = now
        break
        
      case 'success':
        const startTime = this.connectionStartTimes.get(serverId)
        if (startTime) {
          const latency = now.getTime() - startTime.getTime()
          health.averageLatency = health.averageLatency 
            ? (health.averageLatency + latency) / 2 
            : latency
        }
        health.uptime = now.getTime()
        break
        
      case 'error':
        health.lastError = error
        health.lastErrorTime = now
        health.errorRate = health.connectionAttempts > 0 
          ? ((health.errorRate || 0) * (health.connectionAttempts - 1) + 1) / health.connectionAttempts
          : 1
        break
    }
    
    const serverConfig = this.serverConfigs.find(s => s.id === serverId)
    if (serverConfig) {
      serverConfig.connectionHealth = { ...health }
    }
  }

  /**
   * Connect to an MCP server
   */
  async connectServer(serverId: string): Promise<MCPConnectionResult> {
    try {
      const serverConfig = this.serverConfigs.find(s => s.id === serverId)
      if (!serverConfig) {
        return {
          success: false,
          error: 'Server configuration not found'
        }
      }

      const validationResult = await this.validator.validate(serverConfig)
      
      if (!validationResult.valid) {
        const errorMessages = this.validator.getErrorMessages(validationResult.errors)
        const detailedError = errorMessages.join('; ')
        
        this.logger.error(`Validation failed for ${serverConfig.name}: ${detailedError}`)
        
        return {
          success: false,
          error: `Configuration validation failed: ${detailedError}`
        }
      }
      
      if (validationResult.warnings.length > 0) {
        const warningMessages = this.validator.getWarningMessages(validationResult.warnings)
        warningMessages.forEach(warning => {
          this.logger.warn(`Validation warning for ${serverConfig.name}: ${warning}`)
        })
      }

      if (this.servers.has(serverId)) {
        try {
          await this.disconnectServer(serverId)
        } catch (disconnectError) {
          this.logger.warn(`Failed to disconnect existing connection for ${serverId}:`, disconnectError)
        }
      }

      this.logger.info(`Connecting to MCP server: ${serverConfig.name}`)
      
      serverConfig.status = 'connecting'
      this.connectionStartTimes.set(serverId, new Date())
      this.updateConnectionHealth(serverId, 'attempt')
      
      let command: string, args: string[], env: Record<string, string>
      try {
        ({ command, args, env } = this.buildServerCommand(serverConfig))
      } catch (buildError) {
        this.logger.error(`Failed to build command for server ${serverConfig.name}:`, buildError)
        return {
          success: false,
          error: `Invalid server configuration: ${buildError instanceof Error ? buildError.message : 'Unknown error'}`
        }
      }
      
      const childProcess = spawn(command, args, {
        env: { ...process.env, ...env },
        stdio: ['pipe', 'pipe', 'pipe']
      })

      this.servers.set(serverId, childProcess)

      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          this.servers.delete(serverId)
          childProcess.kill()
          resolve({
            success: false,
            error: 'Connection timed out'
          })
        }, 30000)

        let connected = false

        childProcess.on('spawn', () => {
          if (!connected) {
            connected = true
            clearTimeout(timeout)
            this.logger.info(`Successfully connected to MCP server: ${serverConfig.name}`)
            
            serverConfig.status = 'handshaking'
            
            this.getServerTools(serverId).then(tools => {
              serverConfig.status = 'ready'
              this.updateConnectionHealth(serverId, 'success')
              
              resolve({
                success: true,
                tools
              })
            }).catch(() => {
              serverConfig.status = 'connected'
              this.updateConnectionHealth(serverId, 'success')
              
              resolve({
                success: true,
                tools: []
              })
            })
          }
        })

        childProcess.on('error', (error: Error) => {
          if (!connected) {
            connected = true
            clearTimeout(timeout)
            this.servers.delete(serverId)
            serverConfig.status = 'error'
            serverConfig.errorMessage = error.message
            this.updateConnectionHealth(serverId, 'error', error.message)
            
            this.logger.error(`Connection error for ${serverConfig.name}:`, {
              serverId,
              serverName: serverConfig.name,
              serverType: serverConfig.type,
              error: error.message,
              config: serverConfig.config
            })
            
            resolve({
              success: false,
              error: error.message
            })
          }
        })

        childProcess.on('close', (code: number | null) => {
          this.servers.delete(serverId)
          if (!connected) {
            connected = true
            clearTimeout(timeout)
            resolve({
              success: false,
              error: `Process exited with code ${code}`
            })
          }
        })
      })
    } catch (error) {
      this.logger.error(`Failed to connect to server ${serverId}:`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection failed'
      }
    }
  }

  /**
   * Disconnect from an MCP server
   */
  async disconnectServer(serverId: string): Promise<void> {
    try {
      const process = this.servers.get(serverId)
      if (process) {
        process.kill('SIGTERM')
        this.servers.delete(serverId)
        this.logger.info(`Disconnected from MCP server: ${serverId}`)
      }
    } catch (error) {
      this.logger.error(`Failed to disconnect from server ${serverId}:`, error)
      throw error
    }
  }

  /**
   * Get tools from a connected MCP server
   */
  async getServerTools(serverId: string): Promise<MCPServerTool[]> {
    try {
      const process = this.servers.get(serverId)
      if (!process) {
        throw new Error('Server not connected')
      }

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Tools request timed out'))
        }, 5000)

        let responseData = ''

        const onData = (data: Buffer) => {
          responseData += data.toString()
          try {
            const response = JSON.parse(responseData)
            if (response.result && Array.isArray(response.result.tools)) {
              clearTimeout(timeout)
              process.stdout?.off('data', onData)
              resolve(response.result.tools)
            }
          } catch {
          }
        }

        process.stdout?.on('data', onData)

        const request = {
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'tools/list'
        }

        process.stdin?.write(JSON.stringify(request) + '\n')
      })
    } catch (error) {
      this.logger.error(`Failed to get tools from server ${serverId}:`, error)
      return []
    }
  }

  /**
   * Disconnect all servers
   */
  async disconnectAll(): Promise<void> {
    const disconnectPromises = Array.from(this.servers.keys()).map(serverId =>
      this.disconnectServer(serverId)
    )
    
    await Promise.allSettled(disconnectPromises)
    this.logger.info('Disconnected from all MCP servers')
  }

  /**
   * Build command and arguments for starting an MCP server
   */
  private buildServerCommand(serverConfig: MCPServerConfig): {
    command: string
    args: string[]
    env: Record<string, string>
  } {
    const env: Record<string, string> = {}

    switch (serverConfig.type) {
      case 'filesystem':
        return {
          command: 'npx',
          args: [
            '-y',
            '@modelcontextprotocol/server-filesystem',
            serverConfig.config.rootPath || process.cwd()
          ],
          env
        }

      case 'github':
        env.GITHUB_PERSONAL_ACCESS_TOKEN = serverConfig.config.token
        return {
          command: 'npx',
          args: [
            '-y',
            '@modelcontextprotocol/server-github'
          ],
          env
        }

      case 'postgres':
        env.POSTGRES_CONNECTION_STRING = `postgresql://${serverConfig.config.username}:${serverConfig.config.password}@${serverConfig.config.host}:${serverConfig.config.port}/${serverConfig.config.database}`
        return {
          command: 'npx',
          args: [
            '@modelcontextprotocol/server-postgres'
          ],
          env
        }

      case 'sqlite':
        return {
          command: 'npx',
          args: [
            '@modelcontextprotocol/server-sqlite',
            serverConfig.config.path
          ],
          env
        }

      case 'custom':
        const isNpmPackage = serverConfig.config.command.startsWith('@') || 
                           !serverConfig.config.command.includes('/') && 
                           !serverConfig.config.command.includes('\\')
        
        if (isNpmPackage) {
          return {
            command: 'npx',
            args: [serverConfig.config.command, ...(serverConfig.config.args || [])],
            env: { ...env, ...serverConfig.config.env }
          }
        }
        
        return {
          command: serverConfig.config.command,
          args: serverConfig.config.args || [],
          env: { ...env, ...serverConfig.config.env }
        }

      default:
        throw new Error(`Unsupported server type: ${serverConfig.type}`)
    }
  }

  /**
   * Parse tools from server output
   */
  private parseServerTools(output: string): MCPServerTool[] {
    try {
      const lines = output.split('\n')
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line)
          if (parsed.result && Array.isArray(parsed.result.tools)) {
            return parsed.result.tools
          }
        } catch {
          continue
        }
      }
      return []
    } catch {
      return []
    }
  }

  /**
   * Get all server configurations
   */
  getServerConfigs(): MCPServerConfig[] {
    return this.serverConfigs
  }
  
  /**
   * Get connection health for a server
   */
  getConnectionHealth(serverId: string): MCPConnectionHealth | undefined {
    return this.connectionHealthMap.get(serverId)
  }

  /**
   * Get connected server IDs
   */
  getConnectedServerIds(): string[] {
    return Array.from(this.servers.keys())
  }

  /**
   * Get default server configurations
   */
  private getDefaultServers(): MCPServerConfig[] {
    return [
      {
        id: 'default-filesystem',
        name: 'Local Filesystem',
        type: 'filesystem',
        status: 'disconnected',
        enabled: true,
        config: {
          rootPath: app.getPath('home')
        },
        tools: [],
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]
  }

  /**
   * Validate server configuration without attempting connection
   */
  async validateServerConfig(serverConfig: MCPServerConfig): Promise<ValidationResult> {
    return this.validator.validate(serverConfig)
  }

  /**
   * Clear validation cache
   */
  clearValidationCache(): void {
    this.validator.clearCache()
  }
}