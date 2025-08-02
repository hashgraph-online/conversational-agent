import React from 'react'
import { FiPlus, FiServer } from 'react-icons/fi'
import { Button } from '../ui/Button'
import { Spinner } from '../ui/Spinner'
import Typography from '../ui/Typography'
import { MCPServerCard } from './MCPServerCard'
import { MCPServerListProps } from '../../types/mcp'

/**
 * List component for displaying all MCP servers
 * @param props - Server list props including servers array and handlers
 * @returns List of server cards with add button and loading states
 */
export const MCPServerList: React.FC<MCPServerListProps> = ({
  servers,
  loading = false,
  onToggle,
  onEdit,
  onDelete,
  onTest,
  onAdd
}) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Spinner size="lg" className="mb-4" />
          <Typography variant="body1" color="secondary">
            Loading MCP servers...
          </Typography>
        </div>
      </div>
    )
  }

  if (servers.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-hedera-smoke-100 dark:bg-hedera-smoke-700 rounded-full flex items-center justify-center mx-auto mb-4">
          <FiServer className="w-8 h-8 text-hedera-smoke-400" />
        </div>
        <div className="mb-2">
          <Typography variant="h6">
            No MCP servers configured
          </Typography>
        </div>
        <div className="mb-6 max-w-md mx-auto">
          <Typography variant="body1" color="secondary">
            Model Context Protocol (MCP) servers extend your agent's capabilities with external tools and data sources.
          </Typography>
        </div>
        <Button onClick={onAdd} className="inline-flex items-center gap-2">
          <FiPlus className="w-4 h-4" />
          Add Your First Server
        </Button>
      </div>
    )
  }

  const connectedServers = servers.filter(server => server.status === 'connected' && server.enabled)
  const totalTools = connectedServers.reduce((acc, server) => acc + (server.tools?.length || 0), 0)

  return (
    <div className="grid gap-4">
      {servers.map(server => (
        <MCPServerCard
          key={server.id}
          server={server}
          onToggle={onToggle}
          onEdit={onEdit}
          onDelete={onDelete}
          onTest={onTest}
        />
      ))}
    </div>
  )
}