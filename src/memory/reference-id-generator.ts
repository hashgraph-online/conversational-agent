import { createHash } from 'crypto';
import { ReferenceId } from '../types/content-reference';

/**
 * Content-based reference ID generator using SHA-256 (HCS-1 style)
 * 
 * Generates deterministic reference IDs based on content hashing.
 * Same content always produces the same reference ID.
 */
export class ReferenceIdGenerator {
  /**
   * Generate a content-based reference ID using SHA-256 hashing
   * 
   * @param content The content to generate a reference ID for
   * @returns Deterministic reference ID based on content hash
   */
  static generateId(content: Buffer): ReferenceId {
    const hash = createHash('sha256');
    hash.update(content);
    return hash.digest('hex');
  }
  
  /**
   * Validate that a string is a properly formatted reference ID
   * 
   * @param id The ID to validate
   * @returns true if the ID is valid format
   */
  static isValidReferenceId(id: string): id is ReferenceId {
    if (!id || typeof id !== 'string') {
      return false;
    }
    
    if (id.length !== 64) {
      return false;
    }
    
    return /^[a-f0-9]+$/.test(id);
  }
  
  /**
   * Extract reference ID from ref:// format
   * 
   * @param input Input string that may contain a reference ID
   * @returns Extracted reference ID or null if not found
   */
  static extractReferenceId(input: string): ReferenceId | null {
    if (!input || typeof input !== 'string') {
      return null;
    }
    
    const refFormatMatch = input.match(/^ref:\/\/([a-f0-9]{64})$/);
    if (refFormatMatch) {
      return refFormatMatch[1] as ReferenceId;
    }
    
    return this.isValidReferenceId(input) ? input : null;
  }
  
  /**
   * Format a reference ID in the standard ref:// format
   * 
   * @param referenceId The reference ID to format
   * @returns Formatted reference string
   */
  static formatReference(referenceId: ReferenceId): string {
    return `ref://${referenceId}`;
  }
  
  /**
   * Generate a test reference ID (for testing purposes only)
   * 
   * @param testSeed A test seed to generate a fake but valid ID format
   * @returns A valid format reference ID for testing
   */
  static generateTestId(testSeed: string): ReferenceId {
    const content = Buffer.from(`test-${testSeed}-${Date.now()}`);
    return this.generateId(content);
  }
}