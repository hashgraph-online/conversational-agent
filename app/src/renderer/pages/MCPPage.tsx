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
    <div className='min-h-screen bg-background'>
      <div className='container mx-auto px-6 py-8 max-w-6xl'>
        {/* Header */}
        <div className='mb-8'>
          <div className='flex items-center justify-between mb-4'>
            <Typography variant='h1' className='text-3xl font-bold bg-gradient-to-r from-[#a679f0] via-[#5599fe] to-[#48df7b] bg-clip-text text-transparent'>
              MCP Servers
            </Typography>

            <div className='flex items-center gap-2'>
              <div className='bg-muted rounded-lg p-0.5 flex'>
                <Button
                  variant={viewMode === 'servers' ? 'default' : 'ghost'}
                  size='sm'
                  onClick={() => setViewMode('servers')}
                  className='text-xs'
                >
                  <FiList className='w-4 h-4 mr-1.5' />
                  My Servers
                </Button>
                <Button
                  variant={viewMode === 'browse' ? 'default' : 'ghost'}
                  size='sm'
                  onClick={() => setViewMode('browse')}
                  className='text-xs'
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
                  className='text-xs bg-[#5599fe] text-white hover:bg-[#4488ed]'
                >
                  <FiPlus className='w-4 h-4 mr-1.5' />
                  Add Server
                </Button>
              )}
            </div>
          </div>
          <Typography variant='body1' className='text-muted-foreground'>
            Extend your agent's capabilities with Model Context Protocol servers
          </Typography>
        </div>
        {/* Educational Section for New Users */}
        {servers.length === 0 && !isLoading && (
          <div className='mb-6 p-3 bg-gradient-to-br from-[#5599fe]/10 to-[#5599fe]/5 rounded-lg border border-[#5599fe]/20'>
            <div className='flex items-center gap-2'>
              <FiInfo className='h-4 w-4 text-[#5599fe]' />
              <Typography variant='body2' className='text-sm'>
                <span className='font-medium'>Get Started:</span> MCP servers extend your agent with new capabilities like file access, web browsing, and code execution.
              </Typography>
            </div>
          </div>
        )}

        {error && (
          <div className='mb-6 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2'>
            <FiAlertCircle className='h-4 w-4 text-red-500 flex-shrink-0' />
            <Typography variant='body2' className='text-sm text-red-700 dark:text-red-300 flex-1'>
              {error}
            </Typography>
            <button
              onClick={clearError}
              className='text-red-500 hover:text-red-700 p-1'
            >
              <FiX className='h-4 w-4' />
            </button>
          </div>
        )}

        {viewMode === 'servers' ? (
          <div className='grid gap-6 lg:grid-cols-3'>
            <div className='lg:col-span-2'>
              <MCPServerList
                servers={servers}
                loading={isLoading}
                onToggle={handleToggleServer}
                onEdit={handleEditServer}
                onDelete={handleDeleteServer}
                onTest={handleTestConnection}
              />
            </div>

            <div className='space-y-4'>
              {testingServerId && (
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
