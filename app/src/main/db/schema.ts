import { sqliteTable, text, integer, real, index, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

/**
 * MCP servers cached from registries with enhanced indexing
 */
export const mcpServers = sqliteTable('mcp_servers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  author: text('author'),
  version: text('version'),
  url: text('url'),
  packageName: text('package_name'),
  repositoryType: text('repository_type'),
  repositoryUrl: text('repository_url'),
  configCommand: text('config_command'),
  configArgs: text('config_args'),
  configEnv: text('config_env'),
  tags: text('tags'),
  license: text('license'),
  createdAt: text('created_at'),
  updatedAt: text('updated_at'),
  installCount: integer('install_count').default(0),
  rating: real('rating'),
  registry: text('registry').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  lastFetched: integer('last_fetched', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  searchVector: text('search_vector'),
}, (table) => {
  return {
    nameIdx: index('idx_mcp_servers_name').on(table.name),
    authorIdx: index('idx_mcp_servers_author').on(table.author),
    registryIdx: index('idx_mcp_servers_registry').on(table.registry),
    installCountIdx: index('idx_mcp_servers_install_count').on(table.installCount),
    ratingIdx: index('idx_mcp_servers_rating').on(table.rating),
    lastFetchedIdx: index('idx_mcp_servers_last_fetched').on(table.lastFetched),
    activeIdx: index('idx_mcp_servers_active').on(table.isActive),
    packageNameIdx: uniqueIndex('idx_mcp_servers_package_name').on(table.packageName),
  }
})

/**
 * Server categories for enhanced filtering and organization
 */
export const serverCategories = sqliteTable('server_categories', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  serverId: text('server_id').notNull().references(() => mcpServers.id, { onDelete: 'cascade' }),
  category: text('category').notNull(),
  confidence: real('confidence').default(1.0),
  source: text('source').default('manual'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`)
}, (table) => {
  return {
    serverCategoryIdx: index('idx_server_categories_server_category').on(table.serverId, table.category),
    categoryIdx: index('idx_server_categories_category').on(table.category),
    confidenceIdx: index('idx_server_categories_confidence').on(table.confidence),
  }
})

/**
 * Search query cache for faster repeat searches
 */
export const searchCache = sqliteTable('search_cache', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  queryHash: text('query_hash').notNull().unique(),
  queryText: text('query_text'),
  tags: text('tags'),
  category: text('category'),
  searchOffset: integer('search_offset').default(0),
  pageLimit: integer('page_limit').default(50),
  resultIds: text('result_ids').notNull(),
  totalCount: integer('total_count').notNull(),
  hasMore: integer('has_more', { mode: 'boolean' }).default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  hitCount: integer('hit_count').default(1),
}, (table) => {
  return {
    queryHashIdx: uniqueIndex('idx_search_cache_query_hash').on(table.queryHash),
    expiresAtIdx: index('idx_search_cache_expires_at').on(table.expiresAt),
    createdAtIdx: index('idx_search_cache_created_at').on(table.createdAt),
    hitCountIdx: index('idx_search_cache_hit_count').on(table.hitCount),
  }
})

/**
 * Registry sync status tracking
 */
export const registrySync = sqliteTable('registry_sync', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  registry: text('registry').notNull().unique(),
  lastSyncAt: integer('last_sync_at', { mode: 'timestamp' }),
  lastSuccessAt: integer('last_success_at', { mode: 'timestamp' }),
  serverCount: integer('server_count').default(0),
  status: text('status').default('pending'),
  errorMessage: text('error_message'),
  syncDurationMs: integer('sync_duration_ms'),
  nextSyncAt: integer('next_sync_at', { mode: 'timestamp' }),
}, (table) => {
  return {
    registryIdx: uniqueIndex('idx_registry_sync_registry').on(table.registry),
    lastSyncIdx: index('idx_registry_sync_last_sync').on(table.lastSyncAt),
    statusIdx: index('idx_registry_sync_status').on(table.status),
    nextSyncIdx: index('idx_registry_sync_next_sync').on(table.nextSyncAt),
  }
})

/**
 * Performance metrics for monitoring
 */
export const performanceMetrics = sqliteTable('performance_metrics', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  operation: text('operation').notNull(),
  durationMs: integer('duration_ms').notNull(),
  cacheHit: integer('cache_hit', { mode: 'boolean' }).default(false),
  resultCount: integer('result_count'),
  errorCount: integer('error_count').default(0),
  memoryUsageMb: real('memory_usage_mb'),
  timestamp: integer('timestamp', { mode: 'timestamp' }).default(sql`(unixepoch())`),
}, (table) => {
  return {
    operationIdx: index('idx_performance_metrics_operation').on(table.operation),
    timestampIdx: index('idx_performance_metrics_timestamp').on(table.timestamp),
    durationIdx: index('idx_performance_metrics_duration').on(table.durationMs),
    cacheHitIdx: index('idx_performance_metrics_cache_hit').on(table.cacheHit),
  }
})

export type MCPServer = typeof mcpServers.$inferSelect
export type NewMCPServer = typeof mcpServers.$inferInsert
export type ServerCategory = typeof serverCategories.$inferSelect
export type NewServerCategory = typeof serverCategories.$inferInsert
export type SearchCacheEntry = typeof searchCache.$inferSelect
export type NewSearchCacheEntry = typeof searchCache.$inferInsert
export type RegistrySync = typeof registrySync.$inferSelect
export type NewRegistrySync = typeof registrySync.$inferInsert
export type PerformanceMetric = typeof performanceMetrics.$inferSelect
export type NewPerformanceMetric = typeof performanceMetrics.$inferInsert