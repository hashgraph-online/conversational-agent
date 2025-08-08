import { contextBridge, ipcRenderer } from 'electron';

// Define the API that will be exposed to the renderer process
const electronAPI = {
  // IPC invoke methods
  invoke: (channel: string, ...args: any[]) => {
    return ipcRenderer.invoke(channel, ...args);
  },

  // IPC send methods
  send: (channel: string, ...args: any[]) => {
    ipcRenderer.send(channel, ...args);
  },

  // IPC on methods for listening to events
  on: (channel: string, listener: (...args: any[]) => void) => {
    const wrappedListener = (event: any, ...args: any[]) => {
      listener(...args);
    };
    ipcRenderer.on(channel, wrappedListener);
    return () => ipcRenderer.removeListener(channel, wrappedListener);
  },

  // IPC once methods for one-time listeners
  once: (channel: string, listener: (...args: any[]) => void) => {
    ipcRenderer.once(channel, listener);
  },

  // Remove all listeners for a channel
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  }
};

// Create the electron-compatible API
const electronBridge = {
  // Config operations
  saveConfig: (config: any) => ipcRenderer.invoke('config:save', config),
  loadConfig: () => ipcRenderer.invoke('config:load'),
  
  // Connection tests
  testHederaConnection: (credentials: any) => ipcRenderer.invoke('connection:test-hedera', credentials),
  testOpenAIConnection: (credentials: any) => ipcRenderer.invoke('connection:test-openai', credentials),
  testAnthropicConnection: (credentials: any) => ipcRenderer.invoke('connection:test-anthropic', credentials),
  
  // Theme and settings
  setTheme: (theme: 'light' | 'dark') => ipcRenderer.invoke('theme:set', theme),
  setAutoStart: (enabled: boolean) => ipcRenderer.invoke('settings:auto-start', enabled),
  setLogLevel: (level: string) => ipcRenderer.invoke('settings:log-level', level),
  
  // Agent operations
  initializeAgent: (config: any) => ipcRenderer.invoke('agent:initialize', config),
  preloadAgent: (config: any) => ipcRenderer.invoke('agent:preload', config),
  disconnectAgent: () => ipcRenderer.invoke('agent:disconnect'),
  sendAgentMessage: (data: any) => ipcRenderer.invoke('agent:send-message', data),
  
  // MCP operations
  loadMCPServers: () => ipcRenderer.invoke('mcp:loadServers'),
  saveMCPServers: (servers: any[]) => ipcRenderer.invoke('mcp:saveServers', servers),
  testMCPConnection: (server: any) => ipcRenderer.invoke('mcp:testConnection', server),
  connectMCPServer: (serverId: string) => ipcRenderer.invoke('mcp:connectServer', serverId),
  disconnectMCPServer: (serverId: string) => ipcRenderer.invoke('mcp:disconnectServer', serverId),
  getMCPServerTools: (serverId: string) => ipcRenderer.invoke('mcp:getServerTools', serverId),
  refreshMCPServerTools: (serverId: string) => ipcRenderer.invoke('mcp:refreshServerTools', serverId),
  searchMCPRegistry: (options: any) => ipcRenderer.invoke('mcp:searchRegistry', options),
  getMCPRegistryServerDetails: (serverId: string, packageName?: string) => ipcRenderer.invoke('mcp:getRegistryServerDetails', { serverId, packageName }),
  installMCPFromRegistry: (serverId: string, packageName?: string) => ipcRenderer.invoke('mcp:installFromRegistry', { serverId, packageName }),
  clearMCPRegistryCache: () => ipcRenderer.invoke('mcp:clearRegistryCache'),
  getMCPCacheStats: () => ipcRenderer.invoke('mcp:getCacheStats'),
  triggerMCPBackgroundSync: () => ipcRenderer.invoke('mcp:triggerBackgroundSync'),
  
  // Plugin operations
  searchPlugins: (query: string, registry?: string) => ipcRenderer.invoke('plugin:search', { query, registry }),
  installPlugin: (packageName: string, options?: any) => ipcRenderer.invoke('plugin:install', { packageName, options }),
  uninstallPlugin: (pluginId: string) => ipcRenderer.invoke('plugin:uninstall', pluginId),
  updatePlugin: (pluginId: string) => ipcRenderer.invoke('plugin:update', pluginId),
  enablePlugin: (pluginId: string) => ipcRenderer.invoke('plugin:enable', pluginId),
  disablePlugin: (pluginId: string) => ipcRenderer.invoke('plugin:disable', pluginId),
  configurePlugin: (pluginId: string, config: Record<string, any>) => ipcRenderer.invoke('plugin:configure', { pluginId, config }),
  grantPluginPermissions: (pluginId: string, permissions: any) => ipcRenderer.invoke('plugin:grantPermissions', { pluginId, permissions }),
  revokePluginPermissions: (pluginId: string, permissions: any) => ipcRenderer.invoke('plugin:revokePermissions', { pluginId, permissions }),
  getInstalledPlugins: () => ipcRenderer.invoke('plugin:getInstalled'),
  checkPluginUpdates: () => ipcRenderer.invoke('plugin:checkUpdates'),
  validatePluginConfig: (pluginId: string, config: Record<string, any>) => ipcRenderer.invoke('plugin:validateConfig', { pluginId, config }),
  validatePluginSecurity: (packageName: string, version?: string) => ipcRenderer.invoke('plugin:validateSecurity', { packageName, version }),
  clearPluginCache: () => ipcRenderer.invoke('plugin:clearCache'),
  // Note: Local plugin loading and custom registry features are not yet implemented
  
  // Window controls
  minimizeWindow: () => ipcRenderer.send('window-control', 'minimize'),
  maximizeWindow: () => ipcRenderer.send('window-control', 'maximize'),
  closeWindow: () => ipcRenderer.send('window-control', 'close'),
  
  // Event listeners
  on: (channel: string, listener: (...args: any[]) => void) => {
    const wrappedListener = (event: any, ...args: any[]) => {
      listener(...args);
    };
    ipcRenderer.on(channel, wrappedListener);
    return () => ipcRenderer.removeListener(channel, wrappedListener);
  },
  removeListener: (channel: string, listener: (...args: any[]) => void) => {
    ipcRenderer.removeListener(channel, listener);
  },
  
  // External links
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
  
  // Update operations
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  openRepositoryUrl: () => ipcRenderer.invoke('open-repository-url'),
  getUpdateInfo: () => ipcRenderer.invoke('get-update-info'),
  setUpdateChannel: (channel: 'stable' | 'beta') => ipcRenderer.invoke('set-update-channel', channel),
  setAutoDownload: (enabled: boolean) => ipcRenderer.invoke('set-auto-download', enabled),
  
  // OpenRouter operations
  getOpenRouterModels: (forceRefresh?: boolean) => ipcRenderer.invoke('openrouter:getModels', forceRefresh),
  getOpenRouterModelsByProvider: (provider: string) => ipcRenderer.invoke('openrouter:getModelsByProvider', provider),
  getOpenRouterModel: (modelId: string) => ipcRenderer.invoke('openrouter:getModel', modelId),
  
  // Transaction operations
  executeScheduledTransaction: (scheduleId: string) => ipcRenderer.invoke('execute-scheduled-transaction', scheduleId),
  deleteScheduledTransaction: (scheduleId: string) => ipcRenderer.invoke('delete-scheduled-transaction', scheduleId),
  getScheduledTransaction: (scheduleId: string) => ipcRenderer.invoke('get-scheduled-transaction', scheduleId),
  executeTransactionBytes: (transactionBytes: string) => ipcRenderer.invoke('execute-transaction-bytes', transactionBytes),
  
  // Mirror node operations
  mirrorNode: {
    getScheduleInfo: (scheduleId: string, network?: 'mainnet' | 'testnet') => 
      ipcRenderer.invoke('mirrorNode:getScheduleInfo', scheduleId, network),
    getTransactionByTimestamp: (timestamp: string, network?: 'mainnet' | 'testnet') => 
      ipcRenderer.invoke('mirrorNode:getTransactionByTimestamp', timestamp, network)
  },

  // General IPC methods
  invoke: (channel: string, ...args: any[]) => {
    return ipcRenderer.invoke(channel, ...args);
  },
  send: (channel: string, ...args: any[]) => {
    ipcRenderer.send(channel, ...args);
  }
};

// Expose both APIs to the renderer process
contextBridge.exposeInMainWorld('api', electronAPI);
contextBridge.exposeInMainWorld('electron', electronBridge);

// Type definitions for the exposed API
declare global {
  interface Window {
    api: typeof electronAPI;
    electron: typeof electronBridge;
  }
}