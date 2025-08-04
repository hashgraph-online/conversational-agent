import { getDatabase } from '../db/connection'
import { Logger } from '../utils/logger'

/**
 * Clear the MCP registry cache and force a re-sync
 */
export async function clearMCPCache(): Promise<{ success: boolean; message: string }> {
  const logger = new Logger({ module: 'ClearCache' })
  
  try {
    const db = getDatabase()
    
    if (!db) {
      return { success: false, message: 'Database not available' }
    }
    
    // Clear all MCP servers
    const deleteServers = db.prepare('DELETE FROM mcp_servers').run()
    logger.info(`Cleared ${deleteServers.changes} servers from cache`)
    
    // Clear search cache
    const deleteCache = db.prepare('DELETE FROM search_cache').run()
    logger.info(`Cleared ${deleteCache.changes} search cache entries`)
    
    // Reset registry sync status
    const resetSync = db.prepare(`UPDATE registry_sync SET status = 'pending', last_sync_at = NULL, last_success_at = NULL`).run()
    logger.info(`Reset ${resetSync.changes} registry sync records`)
    
    return {
      success: true,
      message: `Cleared ${deleteServers.changes} servers and ${deleteCache.changes} cache entries. Registry will re-sync on next search.`
    }
  } catch (error) {
    logger.error('Failed to clear cache:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}