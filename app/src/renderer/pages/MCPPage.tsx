import React, { useState, useEffect } from 'react';
import { FiAlertCircle, FiX, FiGrid, FiList, FiPlus, FiInfo, FiTool, FiZap, FiShield, FiDatabase } from 'react-icons/fi';
import Typography from '../components/ui/Typography';
import { Button } from '../components/ui/Button';
import { MCPServerList } from '../components/mcp/MCPServerList';
import { MCPSetupWizard } from '../components/mcp/MCPSetupWizard';
import { MCPConnectionTester } from '../components/mcp/MCPConnectionTester';
import { MCPServerCatalog } from '../components/mcp/MCPServerCatalog';
import { MCPRegistry } from '../components/mcp/MCPRegistry';
import { AddMCPServer } from '../components/mcp/AddMCPServer';
import { MCPInfoPanel } from '../components/mcp/MCPInfoPanel';
import { useMCPStore } from '../stores/mcpStore';
import { MCPServerConfig, MCPServerFormData } from '../types/mcp';

type ViewMode = 'servers' | 'browse';

/**
 * Main page for MCP server management
 * @returns Complete MCP management interface with server list and configuration
 */
const MCPPage: React.FC = () => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<MCPServerConfig | null>(
    null
  );
  const [testingServerId, setTestingServerId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('servers');
  const [serverTemplate, setServerTemplate] = useState<any>(null);

  const {
    servers,
    isLoading,
    error,
    connectionTests,
    addServer,
    updateServer,
    deleteServer,
    toggleServer,
    testConnection,
    loadServers,
    reloadServers,
    clearError,
  } = useMCPStore();

  useEffect(() => {
    loadServers();
  }, [loadServers]);

  useEffect(() => {
    if (serverTemplate) {
      setIsAddModalOpen(true);
    }
  }, [serverTemplate]);

  // Periodic reload to catch tools updated asynchronously
  useEffect(() => {
    const interval = setInterval(() => {
      console.log('[MCPPage] Reloading servers to check for tools updates...');
      reloadServers();
    }, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, [reloadServers]);

  const handleAddServer = async (data: MCPServerFormData) => {
    try {
      if (editingServer) {
        await updateServer(editingServer.id, {
          name: data.name,
          type: data.type,
          config: data.config,
        });
      } else {
        await addServer(data);
      }
      setIsAddModalOpen(false);
      setEditingServer(null);
      setServerTemplate(null);
    } catch (error) {
    }
  };

  const handleEditServer = (serverId: string) => {
    const server = servers.find((s) => s.id === serverId);
    if (server) {
      setEditingServer(server);
      setIsAddModalOpen(true);
    }
  };

  const handleDeleteServer = async (serverId: string) => {
    if (
      window.confirm(
        'Are you sure you want to delete this server? This action cannot be undone.'
      )
    ) {
      try {
        await deleteServer(serverId);
      } catch (error) {
      }
    }
  };

  const handleToggleServer = async (serverId: string, enabled: boolean) => {
    try {
      await toggleServer(serverId, enabled);
    } catch (error) {
    }
  };

  const handleTestConnection = async (serverId: string) => {
    setTestingServerId(serverId);
    try {
      await testConnection(serverId);
    } catch (error) {
    } finally {
      setTestingServerId(null);
    }
  };

  const handleCloseModal = () => {
    setIsAddModalOpen(false);
    setEditingServer(null);
    setServerTemplate(null);
  };

  const handleQuickInstall = (server: any) => {
    setServerTemplate({
      name: server.name,
      type: server.template.type,
      config: server.template.config,
      requirements: server.requirements,
    });
    setViewMode('servers');
  };

  const handleRegistryInstall = async (server: any) => {
    await loadServers();
    setViewMode('servers');
  };

  return (
    <div className='min-h-screen'>
      <div className='sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
          <div className='flex items-center justify-between h-16'>
            <Typography variant='h4' className='font-semibold'>
              MCP Servers
            </Typography>

            <div className='flex items-center gap-2'>
              <div className='bg-gray-100 dark:bg-gray-800 rounded-lg p-1 flex'>
                <Button
                  variant={viewMode === 'servers' ? 'default' : 'ghost'}
                  size='sm'
                  onClick={() => setViewMode('servers')}
                  className='text-sm'
                >
                  <FiList className='w-4 h-4 mr-1.5' />
                  My Servers
                </Button>
                <Button
                  variant={viewMode === 'browse' ? 'default' : 'ghost'}
                  size='sm'
                  onClick={() => setViewMode('browse')}
                  className='text-sm'
                >
                  <FiGrid className='w-4 h-4 mr-1.5' />
                  Browse
                </Button>
              </div>

              {viewMode === 'servers' && (
                <Button
                  variant='default'
                  size='sm'
                  onClick={() => setIsAddModalOpen(true)}
                  className='ml-2'
                >
                  <FiPlus className='w-4 h-4 mr-1.5' />
                  Add Server
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6'>
        {/* Educational Section for New Users - Simplified */}
        {servers.length === 0 && !isLoading && (
          <div className='mb-6 bg-blue-50 dark:bg-blue-900/10 rounded-lg p-4 border border-blue-200 dark:border-blue-800'>
            <div className='flex items-start gap-3'>
              <FiInfo className='w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0' />
              <div className='flex-1'>
                <Typography variant='body2' className='font-medium mb-2 text-gray-900 dark:text-white'>
                  What are MCP Servers?
                </Typography>
                <Typography variant='caption' className='text-gray-600 dark:text-gray-400 mb-3 block'>
                  MCP servers are extensions that give your AI agent new abilities like reading files, browsing the web, or executing code. 
                  Think of them as "plugins" that transform your AI from a chatbot into a powerful assistant.
                </Typography>
                
                <div className='flex gap-2'>
                  <Button
                    variant='default'
                    size='sm'
                    onClick={() => setIsAddModalOpen(true)}
                  >
                    <FiPlus className='w-3 h-3 mr-1' />
                    Add Server
                  </Button>
                  <Button
                    variant='secondary'
                    size='sm'
                    onClick={() => setViewMode('browse')}
                  >
                    <FiGrid className='w-3 h-3 mr-1' />
                    Browse
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className='mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3'>
            <FiAlertCircle className='w-5 h-5 text-red-500 mt-0.5 flex-shrink-0' />
            <div className='flex-1'>
              <Typography
                variant='body1'
                className='text-red-700 dark:text-red-300'
              >
                {error}
              </Typography>
            </div>
            <button
              onClick={clearError}
              className='text-red-500 hover:text-red-700 p-1'
            >
              <FiX className='w-4 h-4' />
            </button>
          </div>
        )}

        {viewMode === 'servers' ? (
          <div className='grid gap-6 xl:grid-cols-4 lg:grid-cols-3'>
            <div className='xl:col-span-3 lg:col-span-2'>
              {/* Mini help text for users with servers - Simplified */}
              {servers.length > 0 && (
                <div className='mb-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg'>
                  <Typography variant='caption' className='text-gray-600 dark:text-gray-400'>
                    💡 Enable servers to give your AI new abilities. Click on any server to see its tools.
                  </Typography>
                </div>
              )}
              
              <MCPServerList
                servers={servers}
                loading={isLoading}
                onToggle={handleToggleServer}
                onEdit={handleEditServer}
                onDelete={handleDeleteServer}
                onTest={handleTestConnection}
              />
            </div>

            <div className='xl:col-span-1 lg:col-span-1'>
              {testingServerId && (
                <div className='mb-4'>
                  <MCPConnectionTester
                    serverId={testingServerId}
                    serverName={
                      servers.find((s) => s.id === testingServerId)?.name ||
                      'Server'
                    }
                    onTest={() => handleTestConnection(testingServerId)}
                    result={connectionTests[testingServerId]?.result}
                    loading={false}
                  />
                </div>
              )}

              <MCPInfoPanel
                serverCount={servers.length}
                activeCount={servers.filter((s) => s.status === 'connected' || s.status === 'ready').length}
                totalTools={servers.reduce((acc, s) => acc + (s.tools?.length || 0), 0)}
              />
            </div>
          </div>
        ) : (
          <MCPRegistry onInstall={handleRegistryInstall} />
        )}
      </div>

      <AddMCPServer
        isOpen={isAddModalOpen}
        onClose={handleCloseModal}
        onSubmit={handleAddServer}
        editingServer={editingServer}
        template={serverTemplate}
      />
    </div>
  );
};

export default MCPPage;
