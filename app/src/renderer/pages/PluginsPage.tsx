import React, { useState, useEffect, useMemo } from 'react'
import { 
  FiAlertCircle, 
  FiX, 
  FiGrid, 
  FiList, 
  FiPlus,
  FiPackage,
  FiSearch,
  FiDownload,
  FiToggleLeft,
  FiToggleRight,
  FiTrash2,
  FiRefreshCw,
  FiCheckCircle,
  FiLoader,
  FiInfo
} from 'react-icons/fi'
import Typography from '../components/ui/Typography'
import { Button } from '../components/ui/Button'
import { Card, CardContent } from '../components/ui/Card'
import { Input } from '../components/ui/input'
import { usePluginStore } from '../stores/pluginStore'
import type { PluginConfig, PluginSearchResult } from '../../shared/types/plugin'

type ViewMode = 'installed' | 'catalog'

interface PluginsPageProps {}

/**
 * Main page for plugin management with discovery, installation, and configuration
 */
const PluginsPage: React.FC<PluginsPageProps> = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('installed')
  const [searchQuery, setSearchQuery] = useState('')
  const [installingPlugins, setInstallingPlugins] = useState<Set<string>>(new Set())
  
  const {
    plugins,
    searchResults,
    isSearching,
    isInstalling,
    isLoading,
    error,
    searchError,
    installError,
    installProgress,
    updateInfo,
    searchPlugins,
    installPlugin,
    uninstallPlugin,
    updatePlugin,
    enablePlugin,
    disablePlugin,
    loadInstalledPlugins,
    checkForUpdates,
    clearError,
    getEnabledPlugins
  } = usePluginStore()

  useEffect(() => {
    loadInstalledPlugins()
  }, [loadInstalledPlugins])

  useEffect(() => {
    const checkUpdates = () => checkForUpdates().catch(() => {})
    checkUpdates()
    const interval = setInterval(checkUpdates, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [checkForUpdates])

  useEffect(() => {
    if (viewMode === 'catalog' && searchQuery) {
      const debounceTimer = setTimeout(() => {
        searchPlugins(searchQuery).catch(() => {})
      }, 500)
      return () => clearTimeout(debounceTimer)
    }
  }, [searchQuery, viewMode, searchPlugins])

  const installedPluginsList = useMemo(() => {
    const pluginsList = Object.values(plugins)
    if (!searchQuery) return pluginsList
    
    const query = searchQuery.toLowerCase()
    return pluginsList.filter(plugin => 
      plugin.name.toLowerCase().includes(query) ||
      plugin.metadata.description?.toLowerCase().includes(query) ||
      plugin.metadata.keywords?.some(k => k.toLowerCase().includes(query))
    )
  }, [plugins, searchQuery])

  const isPluginInstalled = (name: string) => {
    return Object.values(plugins).some(p => p.name === name)
  }

  const handleInstallPlugin = async (name: string) => {
    setInstallingPlugins(prev => new Set(prev).add(name))
    try {
      await installPlugin(name)
    } catch (error) {
    } finally {
      setInstallingPlugins(prev => {
        const next = new Set(prev)
        next.delete(name)
        return next
      })
    }
  }

  const handleUninstallPlugin = async (pluginId: string) => {
    const plugin = plugins[pluginId]
    if (!plugin) return
    
    if (window.confirm(`Are you sure you want to uninstall "${plugin.name}"? This action cannot be undone.`)) {
      try {
        await uninstallPlugin(pluginId)
      } catch (error) {
      }
    }
  }

  const handleTogglePlugin = async (pluginId: string, enabled: boolean) => {
    try {
      if (enabled) {
        await enablePlugin(pluginId)
      } else {
        await disablePlugin(pluginId)
      }
    } catch (error) {
    }
  }

  const handleUpdatePlugin = async (pluginId: string) => {
    try {
      await updatePlugin(pluginId)
    } catch (error) {
    }
  }

  const renderPluginCard = (plugin: PluginConfig) => {
    const updateAvailable = updateInfo[plugin.id]
    const progress = installProgress[plugin.id]
    
    return (
      <Card key={plugin.id} className="hover:shadow-lg transition-shadow">
        <CardContent className="p-6">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <div className="mb-1">
                <Typography variant="h6">
                  {plugin.name}
                </Typography>
              </div>
              <div className="mb-2">
                <Typography variant="body2" color="muted">
                  v{plugin.version}
                  {updateAvailable && (
                    <span className="ml-2 text-blue-600 dark:text-blue-400">
                      → v{updateAvailable.availableVersion}
                    </span>
                  )}
                </Typography>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {plugin.enabled ? (
                <FiToggleRight 
                  className="w-6 h-6 text-green-600 cursor-pointer"
                  onClick={() => handleTogglePlugin(plugin.id, false)}
                />
              ) : (
                <FiToggleLeft 
                  className="w-6 h-6 text-gray-400 cursor-pointer"
                  onClick={() => handleTogglePlugin(plugin.id, true)}
                />
              )}
            </div>
          </div>
          
          <div className="mb-4 line-clamp-2">
            <Typography variant="body2" color="muted">
              {plugin.metadata.description}
            </Typography>
          </div>
          
          {progress && (
            <div className="mb-4">
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-gray-600 dark:text-gray-400">{progress.phase}</span>
                {progress.progress && <span>{progress.progress}%</span>}
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{ width: `${progress.progress || 0}%` }}
                />
              </div>
            </div>
          )}
          
          <div className="flex items-center gap-2">
            {updateAvailable && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleUpdatePlugin(plugin.id)}
                disabled={isInstalling}
                className="flex items-center gap-2"
              >
                <FiRefreshCw className="w-3 h-3" />
                Update
              </Button>
            )}
            <Button
              size="sm"
              variant="destructive"
              onClick={() => handleUninstallPlugin(plugin.id)}
              disabled={isInstalling}
              className="flex items-center gap-2"
            >
              <FiTrash2 className="w-3 h-3" />
              Uninstall
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  const renderSearchResultCard = (result: PluginSearchResult) => {
    const installed = isPluginInstalled(result.name)
    const installing = installingPlugins.has(result.name)
    
    return (
      <Card key={result.name} className="hover:shadow-lg transition-shadow">
        <CardContent className="p-6">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <div className="mb-1">
                <Typography variant="h6">
                  {result.name}
                </Typography>
              </div>
              <Typography variant="body2" color="muted">
                v{result.version}
              </Typography>
            </div>
            {installed && (
              <div className="flex items-center gap-1 text-green-600">
                <FiCheckCircle className="w-4 h-4" />
                <span className="text-sm">Installed</span>
              </div>
            )}
          </div>
          
          <div className="mb-4 line-clamp-2">
            <Typography variant="body2" color="muted">
              {result.description}
            </Typography>
          </div>
          
          {result.score && (
            <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mb-4">
              <span>Quality: {Math.round(result.score.detail.quality * 100)}%</span>
              <span>Popularity: {Math.round(result.score.detail.popularity * 100)}%</span>
            </div>
          )}
          
          <div className="flex items-center gap-2">
            {!installed && (
              <Button
                size="sm"
                variant="default"
                onClick={() => handleInstallPlugin(result.name)}
                disabled={installing || isInstalling}
                className="flex items-center gap-2"
              >
                {installing ? (
                  <FiLoader className="w-3 h-3 animate-spin" />
                ) : (
                  <FiDownload className="w-3 h-3" />
                )}
                Install
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <Typography variant="h3">
            Plugin Management
          </Typography>
          
          <div className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-lg p-1 shadow-sm">
            <Button
              variant={viewMode === 'installed' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('installed')}
              className="flex items-center gap-2"
            >
              <FiList className="w-4 h-4" />
              Installed
            </Button>
            <Button
              variant={viewMode === 'catalog' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('catalog')}
              className="flex items-center gap-2"
            >
              <FiGrid className="w-4 h-4" />
              Discover
            </Button>
          </div>
        </div>
        
        <Typography variant="body1" color="muted" className="max-w-3xl">
          {viewMode === 'installed' 
            ? 'Manage your installed plugins and their configurations'
            : 'Discover and install plugins from the NPM registry'
          }
        </Typography>
        
        <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg max-w-3xl">
          <div className="flex items-start gap-3">
            <FiInfo className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
            <div>
              <Typography variant="body1" className="font-medium text-yellow-800 dark:text-yellow-200">
                Plugin System Coming Soon
              </Typography>
              <div className="mt-1">
                <Typography variant="body2" className="text-yellow-700 dark:text-yellow-300">
                  The plugin system is currently in development. Soon you'll be able to browse, install, and manage plugins from NPM to extend your agent's capabilities. Check back for updates!
                </Typography>
              </div>
            </div>
          </div>
        </div>
      </div>

      {(error || searchError || installError) && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
          <FiAlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <Typography variant="body1" color="muted" className="font-medium">
              Error
            </Typography>
            <Typography variant="body1" color="muted">
              {error || searchError || installError}
            </Typography>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearError}
            className="text-red-500 hover:text-red-700 p-1"
          >
            <FiX className="w-4 h-4" />
          </Button>
        </div>
      )}

      <div className="mb-6">
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            type="text"
            placeholder={viewMode === 'installed' ? 'Search installed plugins...' : 'Search NPM registry...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {viewMode === 'installed' ? (
            <>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <FiLoader className="w-8 h-8 animate-spin text-gray-400" />
                </div>
              ) : installedPluginsList.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="p-12 text-center">
                    <div className="flex justify-center mb-4">
                      <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                        <FiPackage className="w-8 h-8 text-gray-400" />
                      </div>
                    </div>
                    <div className="mb-2">
                      <Typography variant="h5">
                        No Plugins Installed
                      </Typography>
                    </div>
                    <div className="max-w-md mx-auto mb-4">
                      <Typography variant="body1" color="muted">
                        Browse the catalog to discover and install plugins that extend your agent's capabilities.
                      </Typography>
                    </div>
                    <Button
                      variant="default"
                      onClick={() => setViewMode('catalog')}
                      className="flex items-center gap-2"
                    >
                      <FiGrid className="w-4 h-4" />
                      Browse Catalog
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {installedPluginsList.map(plugin => renderPluginCard(plugin))}
                </div>
              )}
            </>
          ) : (
            <>
              {isSearching ? (
                <div className="flex items-center justify-center py-12">
                  <FiLoader className="w-8 h-8 animate-spin text-gray-400" />
                </div>
              ) : searchResults.length === 0 && searchQuery ? (
                <Card className="border-dashed">
                  <CardContent className="p-12 text-center">
                    <div className="mb-2">
                      <Typography variant="h5">
                        No Results Found
                      </Typography>
                    </div>
                    <Typography variant="body1" color="muted">
                      Try searching with different keywords
                    </Typography>
                  </CardContent>
                </Card>
              ) : searchResults.length > 0 ? (
                <div className="grid gap-4">
                  {searchResults.map(result => renderSearchResultCard(result))}
                </div>
              ) : (
                <Card className="border-dashed">
                  <CardContent className="p-12 text-center">
                    <Typography variant="body1" color="muted">
                      Enter a search term to discover plugins
                    </Typography>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="mb-4">
              <Typography variant="h6">
                Plugin Statistics
              </Typography>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Typography variant="body1" color="muted">
                  Total Installed
                </Typography>
                <Typography variant="body1" className="font-semibold">
                  {Object.keys(plugins).length}
                </Typography>
              </div>
              <div className="flex justify-between items-center">
                <Typography variant="body1" color="muted">
                  Enabled
                </Typography>
                <Typography variant="body1" className="font-semibold text-green-600">
                  {getEnabledPlugins().length}
                </Typography>
              </div>
              <div className="flex justify-between items-center">
                <Typography variant="body1" color="muted">
                  Updates Available
                </Typography>
                <Typography variant="body1" className="font-semibold text-blue-600">
                  {Object.keys(updateInfo).length}
                </Typography>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="mb-4">
              <Typography variant="h6">
                Quick Actions
              </Typography>
            </div>
            <div className="space-y-3">
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start"
                onClick={() => checkForUpdates()}
                disabled={isLoading}
              >
                <FiRefreshCw className="w-4 h-4 mr-2" />
                Check for Updates
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start"
                onClick={() => setViewMode('catalog')}
              >
                <FiSearch className="w-4 h-4 mr-2" />
                Discover Plugins
              </Button>
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="mb-4">
              <Typography variant="h6">
                Coming Soon
              </Typography>
            </div>
            <div className="space-y-2 text-sm">
              <Typography variant="body2" color="muted">
                • Local plugin development
              </Typography>
              <Typography variant="body2" color="muted">
                • Custom registry support
              </Typography>
              <Typography variant="body2" color="muted">
                • Plugin permissions manager
              </Typography>
              <Typography variant="body2" color="muted">
                • Advanced configuration UI
              </Typography>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PluginsPage