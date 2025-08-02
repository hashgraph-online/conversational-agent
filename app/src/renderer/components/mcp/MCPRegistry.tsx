import React, { useState, useEffect, useCallback, useRef } from 'react'
import { FiSearch, FiDownload, FiExternalLink, FiStar, FiCalendar, FiUser, FiTag, FiRefreshCw } from 'react-icons/fi'
import Typography from '../ui/Typography'
import { Button } from '../ui/Button'
import { Input } from '../ui/input'
import { cn } from '../../lib/utils'

interface MCPRegistryServer {
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
  tags?: string[]
  license?: string
  createdAt?: string
  updatedAt?: string
  installCount?: number
  rating?: number
}

interface MCPRegistryResponse {
  servers: MCPRegistryServer[]
  total?: number
  hasMore?: boolean
  page?: number
  limit?: number
}

interface MCPRegistryProps {
  onInstall?: (server: MCPRegistryServer) => void
  className?: string
}

/**
 * MCP Registry component for discovering and installing servers from public registries
 */
export const MCPRegistry: React.FC<MCPRegistryProps> = ({ 
  onInstall,
  className 
}) => {
  const [servers, setServers] = useState<MCPRegistryServer[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [total, setTotal] = useState(0)
  const [installingIds, setInstallingIds] = useState<Set<string>>(new Set())
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const pageSize = 50
  const loadMoreRef = useRef<HTMLDivElement>(null)

  const searchRegistries = useCallback(async (query: string = '', tags: string[] = [], pageNum: number = 0, append: boolean = false) => {
    if (!window.electron?.searchMCPRegistry) {
      setError('Registry search not available')
      return
    }

    if (pageNum === 0) {
      setIsLoading(true)
    } else {
      setIsLoadingMore(true)
    }
    setError(null)

    try {
      const result = await window.electron.searchMCPRegistry({
        query: query.trim() || undefined,
        tags: tags.length > 0 ? tags : undefined,
        limit: pageSize,
        offset: pageNum * pageSize
      })

      if (result.success && result.data) {
        if (append) {
          setServers(prev => [...prev, ...(result.data.servers || [])])
        } else {
          setServers(result.data.servers || [])
        }
        setTotal(result.data.total || 0)
        setHasMore((result.data.servers?.length || 0) >= pageSize && ((pageNum + 1) * pageSize) < (result.data.total || 0))
        setPage(pageNum)
      } else {
        setError(result.error || 'Failed to search registries')
        if (!append) {
          setServers([])
          setTotal(0)
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search registries')
      if (!append) {
        setServers([])
        setTotal(0)
      }
    } finally {
      setIsLoading(false)
      setIsLoadingMore(false)
    }
  }, [pageSize])

  useEffect(() => {
    searchRegistries('', [], 0, false)
  }, [])


  const categories = [
    { value: '', label: 'All Categories' },
    { value: 'ai', label: 'AI/ML' },
    { value: 'database', label: 'Database' },
    { value: 'development', label: 'Development' },
    { value: 'devops', label: 'DevOps' },
    { value: 'communication', label: 'Communication' },
    { value: 'filesystem', label: 'File System' },
    { value: 'api', label: 'API/Integration' },
    { value: 'security', label: 'Security' },
    { value: 'analytics', label: 'Analytics' },
    { value: 'cloud', label: 'Cloud' }
  ]

  const getCategoryKeywords = (category: string): string[] => {
    const keywordMap: Record<string, string[]> = {
      'ai': ['ai', 'ml', 'llm', 'gpt', 'claude', 'model', 'neural', 'artificial', 'intelligence'],
      'database': ['database', 'sql', 'postgres', 'mysql', 'mongodb', 'db', 'sqlite', 'redis'],
      'development': ['code', 'developer', 'programming', 'ide', 'editor', 'debug', 'lint'],
      'devops': ['docker', 'kubernetes', 'ci/cd', 'deployment', 'monitoring', 'jenkins', 'terraform'],
      'communication': ['slack', 'discord', 'email', 'chat', 'messaging', 'notification'],
      'filesystem': ['file', 'filesystem', 'directory', 'folder', 'storage'],
      'api': ['api', 'rest', 'graphql', 'webhook', 'integration', 'http'],
      'security': ['security', 'auth', 'encryption', 'password', 'ssl', 'oauth', 'jwt'],
      'analytics': ['analytics', 'metrics', 'monitoring', 'logging', 'tracking', 'telemetry'],
      'cloud': ['aws', 'azure', 'gcp', 'cloud', 's3', 'lambda', 'ec2']
    }
    return keywordMap[category] || []
  }

  const filterServersByCategory = (servers: MCPRegistryServer[], category: string) => {
    if (!category) return servers
    
    const keywords = getCategoryKeywords(category)
    return servers.filter(server => {
      const text = (server.name + ' ' + server.description).toLowerCase()
      return keywords.some(keyword => text.includes(keyword))
    })
  }

  const handleSearch = (query: string) => {
    setSearchQuery(query)
    setPage(0)
    searchRegistries(query, selectedTags, 0, false)
  }

  const handleTagToggle = (tag: string) => {
    const newTags = selectedTags.includes(tag)
      ? selectedTags.filter(t => t !== tag)
      : [...selectedTags, tag]
    
    setSelectedTags(newTags)
    setPage(0)
    searchRegistries(searchQuery, newTags, 0, false)
  }

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category)
    setPage(0)
  }

  const loadMore = useCallback(() => {
    const nextPage = page + 1
    searchRegistries(searchQuery, selectedTags, nextPage, true)
  }, [page, searchQuery, selectedTags, searchRegistries])

  useEffect(() => {
    const currentRef = loadMoreRef.current
    if (!currentRef || !hasMore || isLoadingMore) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoadingMore && hasMore) {
          loadMore()
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    )

    observer.observe(currentRef)

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef)
      }
    }
  }, [hasMore, isLoadingMore, loadMore, servers.length])

  const handleInstall = async (server: MCPRegistryServer) => {
    if (!window.electron?.installMCPFromRegistry) {
      setError('Installation not available')
      return
    }

    setInstallingIds(prev => new Set(prev).add(server.id))
    
    try {
      const result = await window.electron.installMCPFromRegistry(
        server.id,
        server.packageName
      )

      if (result.success) {
        onInstall?.(server)
      } else {
        setError(result.error || 'Failed to install server')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to install server')
    } finally {
      setInstallingIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(server.id)
        return newSet
      })
    }
  }

  const availableTags = React.useMemo(() => {
    const tags = new Set<string>()
    servers.forEach(server => {
      server.tags?.forEach(tag => tags.add(tag))
    })
    return Array.from(tags).sort()
  }, [servers])

  const filteredServers = React.useMemo(() => {
    return filterServersByCategory(servers, selectedCategory)
  }, [servers, selectedCategory])

  return (
    <div className={cn('space-y-6', className)}>
      {/* Search and Filters */}
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search MCP servers..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <select
            value={selectedCategory}
            onChange={(e) => handleCategoryChange(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {categories.map(cat => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            onClick={async () => {
              if (window.electron?.clearMCPRegistryCache) {
                await window.electron.clearMCPRegistryCache()
              }
              setPage(0)
              searchRegistries(searchQuery, selectedTags, 0, false)
            }}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            <FiRefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
            Refresh
          </Button>
        </div>

        {/* Tag filters */}
        {availableTags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Typography variant="body1" color="muted" className="text-sm font-medium mr-2">
              Filter by tags:
            </Typography>
            {availableTags.slice(0, 10).map(tag => (
              <button
                key={tag}
                onClick={() => handleTagToggle(tag)}
                className={cn(
                  'px-2 py-1 text-xs rounded-full border transition-colors',
                  selectedTags.includes(tag)
                    ? 'bg-primary-100 border-primary-300 text-primary-700 dark:bg-primary-900 dark:border-primary-700 dark:text-primary-300'
                    : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700'
                )}
              >
                <FiTag className="inline w-3 h-3 mr-1" />
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Results Summary */}
      <div className="flex items-center justify-between">
        <Typography variant="body1" color="muted">
          {(() => {
            if (isLoading) return 'Searching...'
            if (selectedCategory && filteredServers.length < servers.length) {
              return `Showing ${filteredServers.length} of ${total} servers`
            }
            return `Found ${total} server${total !== 1 ? 's' : ''}`
          })()}
        </Typography>
        {(selectedTags.length > 0 || selectedCategory) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedTags([])
              setSelectedCategory('')
              setPage(0)
              searchRegistries(searchQuery, [], 0, false)
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <Typography variant="body1" className="text-red-700 dark:text-red-300">
            {error}
          </Typography>
        </div>
      )}

      {/* Server List */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg animate-pulse">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded mb-4" />
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
          ))}
        </div>
      ) : filteredServers.length === 0 ? (
        <div className="text-center py-12">
          <Typography variant="body1" color="muted">
            {(() => {
              if (selectedCategory) {
                const categoryLabel = categories.find(c => c.value === selectedCategory)?.label
                return `No servers found in the ${categoryLabel} category`
              }
              if (searchQuery || selectedTags.length > 0) {
                return 'No servers found matching your search criteria'
              }
              return 'No servers available in the registry'
            })()}
          </Typography>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredServers.map(server => (
              <ServerCard
                key={server.id}
                server={server}
                onInstall={() => handleInstall(server)}
                isInstalling={installingIds.has(server.id)}
              />
            ))}
          </div>
          
          {/* Load More Button */}
          {hasMore && (
            <div className="mt-8 text-center" ref={loadMoreRef}>
              <Button
                variant="outline"
                onClick={loadMore}
                disabled={isLoadingMore}
                className="min-w-[200px]"
              >
                {isLoadingMore ? (
                  <>
                    <FiRefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    Load More Servers
                    <span className="ml-2 text-sm text-gray-500">
                      ({servers.length} of {total})
                    </span>
                  </>
                )}
              </Button>
            </div>
          )}
          
          {/* Loading indicator for auto-scroll */}
          {isLoadingMore && (
            <div className="mt-4 text-center">
              <Typography variant="body1" color="muted" className="flex items-center justify-center gap-2">
                <FiRefreshCw className="w-4 h-4 animate-spin" />
                Loading more servers...
              </Typography>
            </div>
          )}
        </>
      )}
    </div>
  )
}

interface ServerCardProps {
  server: MCPRegistryServer
  onInstall: () => void
  isInstalling: boolean
}

const ServerCard: React.FC<ServerCardProps> = ({ server, onInstall, isInstalling }) => {
  const formatDate = (dateString?: string) => {
    if (!dateString) return null
    try {
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }).format(new Date(dateString))
    } catch {
      return null
    }
  }

  return (
    <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition-shadow bg-white dark:bg-gray-800">
      {/* Header */}
      <div className="mb-3">
        <div className="flex items-start justify-between mb-2">
          <Typography variant="h6" className="line-clamp-1">
            {server.name}
          </Typography>
          {server.rating && (
            <div className="flex items-center gap-1 text-yellow-500">
              <FiStar className="w-3 h-3 fill-current" />
              <Typography variant="caption">
                {server.rating.toFixed(1)}
              </Typography>
            </div>
          )}
        </div>
        
        <Typography variant="body1" color="muted" className="line-clamp-2 mb-2">
          {server.description}
        </Typography>

        {/* Metadata */}
        <div className="flex flex-wrap gap-3 text-xs text-gray-500 dark:text-gray-400">
          {server.author && (
            <div className="flex items-center gap-1">
              <FiUser className="w-3 h-3" />
              <span>{server.author}</span>
            </div>
          )}
          {server.version && (
            <div className="flex items-center gap-1">
              <span>v{server.version}</span>
            </div>
          )}
          {server.installCount && (
            <div className="flex items-center gap-1">
              <FiDownload className="w-3 h-3" />
              <span>{server.installCount.toLocaleString()} installs</span>
            </div>
          )}
          {formatDate(server.updatedAt) && (
            <div className="flex items-center gap-1">
              <FiCalendar className="w-3 h-3" />
              <span>{formatDate(server.updatedAt)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Tags */}
      {server.tags && server.tags.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1">
          {server.tags.slice(0, 3).map(tag => (
            <span
              key={tag}
              className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded"
            >
              {tag}
            </span>
          ))}
          {server.tags.length > 3 && (
            <span className="px-2 py-1 text-xs text-gray-500 dark:text-gray-400">
              +{server.tags.length - 3} more
            </span>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button
          variant="default"
          size="sm"
          onClick={onInstall}
          disabled={isInstalling}
          className="flex-1 flex items-center justify-center gap-2"
        >
          <FiDownload className={cn('w-4 h-4', isInstalling && 'animate-spin')} />
          {isInstalling ? 'Installing...' : 'Install'}
        </Button>
        {(server.repository?.url || server.url) && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const url = server.repository?.url || server.url
              if (url) window.open(url, '_blank')
            }}
            className="flex items-center gap-1"
          >
            <FiExternalLink className="w-3 h-3" />
          </Button>
        )}
      </div>
    </div>
  )
}