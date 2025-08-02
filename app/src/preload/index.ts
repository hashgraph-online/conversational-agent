
import { contextBridge, ipcRenderer } from 'electron';
import type { PluginInstallProgress } from '../shared/types/plugin';

contextBridge.exposeInMainWorld('electron', {
  loadMCPServers: () => {
    return ipcRenderer.invoke('mcp:loadServers');
  },
  saveMCPServers: (servers: any) => ipcRenderer.invoke('mcp:saveServers', servers),
  testMCPConnection: (server: any) => ipcRenderer.invoke('mcp:testConnection', server),
  connectMCPServer: (serverId: string) => ipcRenderer.invoke('mcp:connectServer', serverId),
  disconnectMCPServer: (serverId: string) => ipcRenderer.invoke('mcp:disconnectServer', serverId),
  getMCPServerTools: (serverId: string) => ipcRenderer.invoke('mcp:getServerTools', serverId),
  
  searchMCPRegistry: (options?: any) => ipcRenderer.invoke('mcp:searchRegistry', options),
  getMCPRegistryServerDetails: (serverId: string, packageName?: string) => ipcRenderer.invoke('mcp:getRegistryServerDetails', { serverId, packageName }),
  installMCPFromRegistry: (serverId: string, packageName?: string) => ipcRenderer.invoke('mcp:installFromRegistry', { serverId, packageName }),
  clearMCPRegistryCache: () => ipcRenderer.invoke('mcp:clearRegistryCache'),
  
  saveConfig: (config: any) => ipcRenderer.invoke('config:save', config),
  loadConfig: () => ipcRenderer.invoke('config:load'),
  
  testHederaConnection: (credentials: any) => ipcRenderer.invoke('hedera:testConnection', credentials),
  
  testOpenAIConnection: (credentials: any) => ipcRenderer.invoke('openai:test', credentials),
  testAnthropicConnection: (credentials: any) => ipcRenderer.invoke('anthropic:test', credentials),
  
  initializeAgent: (config: any) => ipcRenderer.invoke('agent:initialize', config),
  sendAgentMessage: (data: any) => ipcRenderer.invoke('agent:sendMessage', data),
  disconnectAgent: () => ipcRenderer.invoke('agent:disconnect'),
  getAgentStatus: () => ipcRenderer.invoke('agent:getStatus'),
  
  send: (channel: string, data?: any) => {
    const validChannels = ['window-control'];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
  
  searchPlugins: (query: string, options?: any) => ipcRenderer.invoke('plugin:search', { query, options }),
  installPlugin: (packageName: string, options?: any) => ipcRenderer.invoke('plugin:install', { packageName, options }),
  uninstallPlugin: (pluginId: string) => ipcRenderer.invoke('plugin:uninstall', pluginId),
  updatePlugin: (pluginId: string, version?: string) => ipcRenderer.invoke('plugin:update', { pluginId, version }),
  enablePlugin: (pluginId: string) => ipcRenderer.invoke('plugin:enable', pluginId),
  disablePlugin: (pluginId: string) => ipcRenderer.invoke('plugin:disable', pluginId),
  configurePlugin: (pluginId: string, config: any) => ipcRenderer.invoke('plugin:configure', { pluginId, config }),
  getPluginPermissions: (pluginId: string) => ipcRenderer.invoke('plugin:getPermissions', pluginId),
  grantPluginPermissions: (pluginId: string, permissions: any) => ipcRenderer.invoke('plugin:grantPermissions', { pluginId, permissions }),
  getInstalledPlugins: () => ipcRenderer.invoke('plugin:getInstalled'),
  checkPluginUpdates: () => ipcRenderer.invoke('plugin:checkUpdates'),
  validatePluginConfig: (pluginId: string, config: any) => ipcRenderer.invoke('plugin:validateConfig', { pluginId, config }),
  validatePluginSecurity: (packageName: string) => ipcRenderer.invoke('plugin:validateSecurity', packageName),
  clearPluginCache: () => ipcRenderer.invoke('plugin:clearCache'),
  
  mirrorNode: {
    getScheduleInfo: (scheduleId: string, network?: 'mainnet' | 'testnet') => ipcRenderer.invoke('mirrorNode:getScheduleInfo', scheduleId, network),
    getTransactionByTimestamp: (timestamp: string, network?: 'mainnet' | 'testnet') => ipcRenderer.invoke('mirrorNode:getTransactionByTimestamp', timestamp, network)
  },
  
  executeScheduledTransaction: (scheduleId: string) => ipcRenderer.invoke('execute-scheduled-transaction', scheduleId),
  deleteScheduledTransaction: (scheduleId: string) => ipcRenderer.invoke('delete-scheduled-transaction', scheduleId),
  getScheduledTransaction: (scheduleId: string) => ipcRenderer.invoke('get-scheduled-transaction', scheduleId),
  
  onPluginInstallProgress: (callback: (progress: any) => void) => {
    ipcRenderer.on('plugin:installProgress', (event, progress) => callback(progress));
  },
  onPluginUpdateProgress: (callback: (progress: any) => void) => {
    ipcRenderer.on('plugin:updateProgress', (event, progress) => callback(progress));
  }
});