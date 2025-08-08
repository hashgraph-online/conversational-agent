/**
 * Content Reference System Types
 * 
 * Shared interfaces for the Reference-Based Content System that handles
 * large content storage with unique reference IDs to optimize context window usage.
 */

/**
 * Unique identifier for stored content references
 * Format: Cryptographically secure 32-byte identifier with base64url encoding
 */
export type ReferenceId = string;

/**
 * Lifecycle state of a content reference
 */
export type ReferenceLifecycleState = 'active' | 'expired' | 'cleanup_pending' | 'invalid';

/**
 * Content types supported by the reference system
 */
export type ContentType = 'text' | 'json' | 'html' | 'markdown' | 'binary' | 'unknown';

/**
 * Sources that created the content reference
 */
export type ContentSource = 'mcp_tool' | 'user_upload' | 'agent_generated' | 'system';

/**
 * Metadata associated with stored content
 */
export interface ContentMetadata {
  /** Content type classification */
  contentType: ContentType;
  
  /** MIME type of the original content */
  mimeType?: string;
  
  /** Size in bytes of the stored content */
  sizeBytes: number;
  
  /** When the content was originally stored */
  createdAt: Date;
  
  /** Last time the content was accessed via reference resolution */
  lastAccessedAt: Date;
  
  /** Source that created this content reference */
  source: ContentSource;
  
  /** Name of the MCP tool that generated the content (if applicable) */
  mcpToolName?: string;
  
  /** Original filename or suggested name for the content */
  fileName?: string;
  
  /** Number of times this reference has been resolved */
  accessCount: number;
  
  /** Tags for categorization and cleanup policies */
  tags?: string[];
  
  /** Custom metadata from the source */
  customMetadata?: Record<string, unknown>;
}

/**
 * Core content reference object passed through agent context
 * Designed to be lightweight (<100 tokens) while providing enough 
 * information for agent decision-making
 */
export interface ContentReference {
  /** Unique identifier for resolving the content */
  referenceId: ReferenceId;
  
  /** Current lifecycle state */
  state: ReferenceLifecycleState;
  
  /** Brief description or preview of the content (max 200 chars) */
  preview: string;
  
  /** Essential metadata for agent decision-making */
  metadata: Pick<ContentMetadata, 'contentType' | 'sizeBytes' | 'source' | 'fileName' | 'mimeType'>;
  
  /** When this reference was created */
  createdAt: Date;
  
  /** Special format indicator for reference IDs in content */
  readonly format: 'ref://{id}';
}

/**
 * Result of attempting to resolve a content reference
 */
export interface ReferenceResolutionResult {
  /** Whether the resolution was successful */
  success: boolean;
  
  /** The resolved content if successful */
  content?: Buffer;
  
  /** Complete metadata if successful */
  metadata?: ContentMetadata;
  
  /** Error message if resolution failed */
  error?: string;
  
  /** Specific error type for targeted error handling */
  errorType?: 'not_found' | 'expired' | 'corrupted' | 'access_denied' | 'system_error';
  
  /** Suggested actions for recovery */
  suggestedActions?: string[];
}

/**
 * Configuration for content reference storage and lifecycle
 */
export interface ContentReferenceConfig {
  /** Size threshold above which content should be stored as references (default: 10KB) */
  sizeThresholdBytes: number;
  
  /** Maximum age for unused references before cleanup (default: 1 hour) */
  maxAgeMs: number;
  
  /** Maximum number of references to store simultaneously */
  maxReferences: number;
  
  /** Maximum total storage size for all references */
  maxTotalStorageBytes: number;
  
  /** Whether to enable automatic cleanup */
  enableAutoCleanup: boolean;
  
  /** Interval for cleanup checks in milliseconds */
  cleanupIntervalMs: number;
  
  /** Whether to persist references across restarts */
  enablePersistence: boolean;
  
  /** Storage backend configuration */
  storageBackend: 'memory' | 'filesystem' | 'hybrid';
  
  /** Cleanup policies for different content types */
  cleanupPolicies: {
    /** Policy for content marked as "recent" from MCP tools */
    recent: { maxAgeMs: number; priority: number };
    
    /** Policy for user-uploaded content */
    userContent: { maxAgeMs: number; priority: number };
    
    /** Policy for agent-generated content */
    agentGenerated: { maxAgeMs: number; priority: number };
    
    /** Default policy for other content */
    default: { maxAgeMs: number; priority: number };
  };
}

/**
 * Default configuration values
 */
export const DEFAULT_CONTENT_REFERENCE_CONFIG: ContentReferenceConfig = {
  sizeThresholdBytes: 10 * 1024, // 10KB
  maxAgeMs: 60 * 60 * 1000, // 1 hour
  maxReferences: 100,
  maxTotalStorageBytes: 100 * 1024 * 1024, // 100MB
  enableAutoCleanup: true,
  cleanupIntervalMs: 5 * 60 * 1000, // 5 minutes
  enablePersistence: false,
  storageBackend: 'memory',
  cleanupPolicies: {
    recent: { maxAgeMs: 30 * 60 * 1000, priority: 1 }, // 30 minutes, highest priority
    userContent: { maxAgeMs: 2 * 60 * 60 * 1000, priority: 2 }, // 2 hours
    agentGenerated: { maxAgeMs: 60 * 60 * 1000, priority: 3 }, // 1 hour
    default: { maxAgeMs: 60 * 60 * 1000, priority: 4 } // 1 hour, lowest priority
  }
};

/**
 * Statistics about content reference usage and storage
 */
export interface ContentReferenceStats {
  /** Total number of active references */
  activeReferences: number;
  
  /** Total storage used by all references in bytes */
  totalStorageBytes: number;
  
  /** Number of references cleaned up in last cleanup cycle */
  recentlyCleanedUp: number;
  
  /** Number of successful reference resolutions since startup */
  totalResolutions: number;
  
  /** Number of failed resolution attempts */
  failedResolutions: number;
  
  /** Average content size in bytes */
  averageContentSize: number;
  
  /** Most frequently accessed reference ID */
  mostAccessedReferenceId?: ReferenceId;
  
  /** Storage utilization percentage */
  storageUtilization: number;
  
  /** Performance metrics */
  performanceMetrics: {
    /** Average time to create a reference in milliseconds */
    averageCreationTimeMs: number;
    
    /** Average time to resolve a reference in milliseconds */
    averageResolutionTimeMs: number;
    
    /** Average cleanup time in milliseconds */
    averageCleanupTimeMs: number;
  };
}

/**
 * Error types for content reference operations
 */
export class ContentReferenceError extends Error {
  constructor(
    message: string,
    public readonly type: ReferenceResolutionResult['errorType'],
    public readonly referenceId?: ReferenceId,
    public readonly suggestedActions?: string[]
  ) {
    super(message);
    this.name = 'ContentReferenceError';
  }
}

/**
 * Interface for content reference storage implementations
 */
export interface ContentReferenceStore {
  /**
   * Store content and return a reference
   */
  storeContent(
    content: Buffer,
    metadata: Omit<ContentMetadata, 'createdAt' | 'lastAccessedAt' | 'accessCount'>
  ): Promise<ContentReference>;
  
  /**
   * Resolve a reference to its content
   */
  resolveReference(referenceId: ReferenceId): Promise<ReferenceResolutionResult>;
  
  /**
   * Check if a reference exists and is valid
   */
  hasReference(referenceId: ReferenceId): Promise<boolean>;
  
  /**
   * Mark a reference for cleanup
   */
  cleanupReference(referenceId: ReferenceId): Promise<boolean>;
  
  /**
   * Get current storage statistics
   */
  getStats(): Promise<ContentReferenceStats>;
  
  /**
   * Update configuration
   */
  updateConfig(config: Partial<ContentReferenceConfig>): Promise<void>;
  
  /**
   * Perform cleanup based on current policies
   */
  performCleanup(): Promise<{ cleanedUp: number; errors: string[] }>;
  
  /**
   * Dispose of resources
   */
  dispose(): Promise<void>;
}