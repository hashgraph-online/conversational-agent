/**
 * @jest-environment node
 */

import { z } from 'zod';
import type { EntityResolutionPreferences, ToolMetadata } from '../../src/core/tool-registry';

describe('EntityResolutionPreferences Interface', () => {
  describe('type validation', () => {
    it('should accept valid entity resolution preferences', () => {
      const preferences: EntityResolutionPreferences = {
        inscription: 'hrl',
        token: 'tokenId',
        nft: 'serialNumber',
        account: 'accountId'
      };

      expect(preferences.inscription).toBe('hrl');
      expect(preferences.token).toBe('tokenId');
      expect(preferences.nft).toBe('serialNumber');
      expect(preferences.account).toBe('accountId');
    });

    it('should handle partial entity resolution preferences', () => {
      const preferences: EntityResolutionPreferences = {
        inscription: 'hrl'
      };

      expect(preferences.inscription).toBe('hrl');
      expect(preferences.token).toBeUndefined();
      expect(preferences.nft).toBeUndefined();
      expect(preferences.account).toBeUndefined();
    });

    it('should accept all valid inscription formats', () => {
      const validFormats = [
        'hrl', 'topicId', 'metadata', 'any'
      ] as const;

      validFormats.forEach(format => {
        const preferences: EntityResolutionPreferences = {
          inscription: format
        };
        expect(preferences.inscription).toBe(format);
      });
    });

    it('should accept all valid token formats', () => {
      const validFormats = [
        'tokenId', 'address', 'symbol', 'any'
      ] as const;

      validFormats.forEach(format => {
        const preferences: EntityResolutionPreferences = {
          token: format
        };
        expect(preferences.token).toBe(format);
      });
    });

    it('should accept all valid nft formats', () => {
      const validFormats = [
        'serialNumber', 'metadata', 'hrl', 'any'
      ] as const;

      validFormats.forEach(format => {
        const preferences: EntityResolutionPreferences = {
          nft: format
        };
        expect(preferences.nft).toBe(format);
      });
    });

    it('should accept all valid account formats', () => {
      const validFormats = [
        'accountId', 'alias', 'evmAddress', 'any'
      ] as const;

      validFormats.forEach(format => {
        const preferences: EntityResolutionPreferences = {
          account: format
        };
        expect(preferences.account).toBe(format);
      });
    });
  });

  describe('ToolMetadata integration', () => {
    it('should include entityResolutionPreferences in ToolMetadata', () => {
      const preferences: EntityResolutionPreferences = {
        inscription: 'hrl',
        token: 'tokenId'
      };

      const metadata: ToolMetadata = {
        name: 'test-tool',
        version: '1.0.0',
        category: 'core',
        description: 'Test tool for entity resolution',
        capabilities: {
          supportsFormValidation: false,
          requiresWrapper: false,
          priority: 'medium',
          category: 'core'
        },
        dependencies: [],
        schema: z.object({ input: z.string() }),
        entityResolutionPreferences: preferences
      };

      expect(metadata.entityResolutionPreferences).toEqual(preferences);
      expect(metadata.entityResolutionPreferences?.inscription).toBe('hrl');
      expect(metadata.entityResolutionPreferences?.token).toBe('tokenId');
    });

    it('should handle ToolMetadata without entityResolutionPreferences', () => {
      const metadata: ToolMetadata = {
        name: 'simple-tool',
        version: '1.0.0',
        category: 'core',
        description: 'Simple tool without preferences',
        capabilities: {
          supportsFormValidation: false,
          requiresWrapper: false,
          priority: 'medium',
          category: 'core'
        },
        dependencies: [],
        schema: z.object({ input: z.string() })
      };

      expect(metadata.entityResolutionPreferences).toBeUndefined();
    });
  });

  describe('format compatibility', () => {
    it('should ensure format strings are compatible with expected values', () => {
      const inscriptionFormats = ['hrl', 'topicId', 'metadata', 'any'] as const;
      const tokenFormats = ['tokenId', 'address', 'symbol', 'any'] as const;
      const nftFormats = ['serialNumber', 'metadata', 'hrl', 'any'] as const;
      const accountFormats = ['accountId', 'alias', 'evmAddress', 'any'] as const;

      inscriptionFormats.forEach(format => {
        const prefs: EntityResolutionPreferences = { inscription: format };
        expect(prefs.inscription).toBe(format);
      });

      tokenFormats.forEach(format => {
        const prefs: EntityResolutionPreferences = { token: format };
        expect(prefs.token).toBe(format);
      });

      nftFormats.forEach(format => {
        const prefs: EntityResolutionPreferences = { nft: format };
        expect(prefs.nft).toBe(format);
      });

      accountFormats.forEach(format => {
        const prefs: EntityResolutionPreferences = { account: format };
        expect(prefs.account).toBe(format);
      });
    });
  });
});