import React, { useState, useEffect } from 'react';
import { FiAlertCircle, FiX, FiGrid, FiList, FiPlus } from 'react-icons/fi';
import Typography from '../components/ui/Typography';
import { Button } from '../components/ui/Button';
import { MCPServerList } from '../components/mcp/MCPServerList';
import { MCPSetupWizard } from '../components/mcp/MCPSetupWizard';
import { MCPConnectionTester } from '../components/mcp/MCPConnectionTester';
import { MCPServerCatalog } from '../components/mcp/MCPServerCatalog';
import { MCPRegistry } from '../components/mcp/MCPRegistry';
import { AddMCPServer } from '../components/mcp/AddMCPServer';
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

              <div className='bg-gray-50 dark:bg-gray-800 rounded-lg p-4'>
                <div className='grid grid-cols-2 gap-4'>
                  <div className='text-center'>
                    <div className='text-2xl font-bold text-gray-900 dark:text-gray-100'>
                      {servers.length}
                    </div>
                    <div className='text-sm text-gray-500 dark:text-gray-400'>
                      Total
                    </div>
                  </div>
                  <div className='text-center'>
                    <div className='text-2xl font-bold text-green-600 dark:text-green-400'>
                      {servers.filter((s) => s.status === 'connected').length}
                    </div>
                    <div className='text-sm text-gray-500 dark:text-gray-400'>
                      Connected
                    </div>
                  </div>
                </div>
                <div className='mt-4 pt-4 border-t border-gray-200 dark:border-gray-700'>
                  <div className='text-center'>
                    <div className='text-2xl font-bold text-blue-600 dark:text-blue-400'>
                      {servers
                        .filter((s) => s.status === 'connected' && s.enabled)
                        .reduce((acc, s) => acc + (s.tools?.length || 0), 0)}
                    </div>
                    <div className='text-sm text-gray-500 dark:text-gray-400'>
                      Available Tools
                    </div>
                  </div>
                </div>
              </div>
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
