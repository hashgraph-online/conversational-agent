import { describe, test, expect } from '@jest/globals';
import { ReferenceIdGenerator } from '../../../src/memory/reference-id-generator';
import { TEST_MEMORY_CONTENT } from '../../test-constants';

describe('ReferenceIdGenerator', () => {
  describe('generateId', () => {
    test('should generate a valid reference ID', () => {
      const content = Buffer.from(TEST_MEMORY_CONTENT.TEST_CONTENT);
      const id = ReferenceIdGenerator.generateId(content);

      expect(typeof id).toBe('string');
      expect(id.length).toBe(64);
      expect(ReferenceIdGenerator.isValidReferenceId(id)).toBe(true);
    });

    test('should generate deterministic IDs for same content', () => {
      const content = Buffer.from(TEST_MEMORY_CONTENT.TEST_CONTENT);
      const id1 = ReferenceIdGenerator.generateId(content);
      const id2 = ReferenceIdGenerator.generateId(content);

      expect(id1).toBe(id2);
    });

    test('should generate different IDs for different content', () => {
      const content1 = Buffer.from('test content 1');
      const content2 = Buffer.from('test content 2');
      const id1 = ReferenceIdGenerator.generateId(content1);
      const id2 = ReferenceIdGenerator.generateId(content2);

      expect(id1).not.toBe(id2);
    });
  });

  describe('isValidReferenceId', () => {
    test('should return true for valid reference IDs', () => {
      const content = Buffer.from(TEST_MEMORY_CONTENT.TEST_CONTENT);
      const validId = ReferenceIdGenerator.generateId(content);
      expect(ReferenceIdGenerator.isValidReferenceId(validId)).toBe(true);
    });

    test('should return false for invalid formats', () => {
      expect(ReferenceIdGenerator.isValidReferenceId('')).toBe(false);
      expect(ReferenceIdGenerator.isValidReferenceId('too-short')).toBe(false);
      expect(ReferenceIdGenerator.isValidReferenceId('a'.repeat(65))).toBe(
        false
      );
      expect(
        ReferenceIdGenerator.isValidReferenceId('invalid+chars/here=')
      ).toBe(false);
      expect(ReferenceIdGenerator.isValidReferenceId(null as unknown as string)).toBe(false);
      expect(ReferenceIdGenerator.isValidReferenceId(undefined as unknown as string)).toBe(
        false
      );
    });
  });

  describe('extractReferenceId', () => {
    test('should extract ID from ref:// format', () => {
      const content = Buffer.from(TEST_MEMORY_CONTENT.TEST_CONTENT);
      const id = ReferenceIdGenerator.generateId(content);
      const refFormat = `ref://${id}`;

      const extracted = ReferenceIdGenerator.extractReferenceId(refFormat);
      expect(extracted).toBe(id);
    });

    test('should extract ID from bare format', () => {
      const content = Buffer.from(TEST_MEMORY_CONTENT.TEST_CONTENT);
      const id = ReferenceIdGenerator.generateId(content);

      const extracted = ReferenceIdGenerator.extractReferenceId(id);
      expect(extracted).toBe(id);
    });

    test('should return null for invalid formats', () => {
      expect(ReferenceIdGenerator.extractReferenceId('')).toBeNull();
      expect(
        ReferenceIdGenerator.extractReferenceId('not-a-reference')
      ).toBeNull();
      expect(
        ReferenceIdGenerator.extractReferenceId('ref://invalid-id')
      ).toBeNull();
      expect(ReferenceIdGenerator.extractReferenceId(null as unknown as string)).toBeNull();
    });
  });

  describe('formatReference', () => {
    test('should format valid ID correctly', () => {
      const content = Buffer.from(TEST_MEMORY_CONTENT.TEST_CONTENT);
      const id = ReferenceIdGenerator.generateId(content);
      const formatted = ReferenceIdGenerator.formatReference(id);

      expect(formatted).toBe(`ref://${id}`);
    });
  });
});
