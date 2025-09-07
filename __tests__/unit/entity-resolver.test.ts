jest.mock('@hashgraph/sdk', () => ({
  Hbar: {
    fromString: jest.fn(),
    fromTinybars: jest.fn(),
    MaxTransactionFee: { _asTinybars: BigInt(1000000) },
  },
  HbarUnit: {
    Tinybar: 'Tinybar',
    Microbar: 'Microbar',
    Millibar: 'Millibar', 
    Hbar: 'Hbar',
    Kilobar: 'Kilobar',
    Megabar: 'Megabar',
    Gigabar: 'Gigabar',
  },
  AccountId: {
    fromString: jest.fn(),
  },
  PublicKey: {
    fromString: jest.fn(),
  },
}));

jest.mock('@hashgraphonline/standards-sdk', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
  HederaMirrorNode: jest.fn().mockImplementation(() => ({
    requestAccount: jest.fn(),
  })),
  HCS10Client: jest.fn(),
}));

jest.mock('@hashgraphonline/standards-agent-kit', () => ({
  OpenConvaiState: jest.fn(),
  HCS10Builder: jest.fn(),
  RegisterAgentTool: jest.fn(),
  FindRegistrationsTool: jest.fn(),
  InitiateConnectionTool: jest.fn(),
  ListConnectionsTool: jest.fn(),
  SendMessageToConnectionTool: jest.fn(),
  CheckMessagesTool: jest.fn(),
  ConnectionMonitorTool: jest.fn(),
  ManageConnectionRequestsTool: jest.fn(),
  AcceptConnectionRequestTool: jest.fn(),
  RetrieveProfileTool: jest.fn(),
  ListUnapprovedConnectionRequestsTool: jest.fn(),
}));

jest.mock('hedera-agent-kit', () => ({
  BasePlugin: class MockBasePlugin {
    id = '';
    name = '';
    description = '';
    version = '';
    author = '';
    namespace = '';
    async initialize() {}
    async cleanup() {}
  },
  BaseServiceBuilder: class MockBaseServiceBuilder {
    constructor(_hederaKit: unknown) {}
  },
  BaseHederaTransactionTool: class MockBaseHederaTransactionTool {
    name = '';
    description = '';
    constructor() {}
  }
}));

import { EntityResolver, EntityResolverConfig } from '../../src/services/entity-resolver';
import type { EntityAssociation } from '../../src/memory/smart-memory-manager';
import { TEST_FORM_CONSTANTS, TEST_ENTITY_CONSTANTS } from '../test-constants';

describe('EntityResolver Type Safety', () => {
  let resolver: EntityResolver;
  const mockConfig: EntityResolverConfig = {
    apiKey: TEST_FORM_CONSTANTS.TEST_KEY,
    modelName: 'gpt-4o-mini'
  };

  beforeEach(() => {
    resolver = new EntityResolver(mockConfig);
  });

  describe('extractEntities return type validation', () => {
    it('should return properly typed array with all required properties', async () => {
      const mockResponse = {
        success: true,
        receipt: {
          tokenId: TEST_ENTITY_CONSTANTS.TOKEN_ID_123456
        },
        transactionId: TEST_ENTITY_CONSTANTS.TEST_TX_ID
      };

      const result = await resolver.extractEntities(mockResponse, TEST_ENTITY_CONSTANTS.CREATE_TOKEN_TEST_TOKEN);
      
      expect(Array.isArray(result)).toBe(true);
      if (result.length > 0) {
        const entity = result[0];
        expect(typeof entity.id).toBe('string');
        expect(typeof entity.name).toBe('string');
        expect(typeof entity.type).toBe('string');
        expect(entity.transactionId === undefined || typeof entity.transactionId === 'string').toBe(true);
      }
    });

    it('should handle response with missing receipt gracefully', async () => {
      const mockResponse = {
        success: true
      };

      const result = await resolver.extractEntities(mockResponse, TEST_ENTITY_CONSTANTS.CREATE_TOKEN_TEST_TOKEN);
      
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });

    it('should handle response with null/undefined values correctly', async () => {
      const mockResponse = null;

      const result = await resolver.extractEntities(mockResponse, TEST_ENTITY_CONSTANTS.CREATE_TOKEN_TEST_TOKEN);
      
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('extractFromReceipt type safety', () => {
    it('should handle various receipt data types safely', async () => {
      const objectResponse = {
        success: true,
        receipt: {
          tokenId: { toString: () => TEST_ENTITY_CONSTANTS.TOKEN_ID_123456 }
        }
      };

      const result1 = await resolver.extractEntities(objectResponse, TEST_ENTITY_CONSTANTS.CREATE_TOKEN_TEST);
      expect(result1).toHaveLength(1);
      expect(result1[0].id).toBe(TEST_ENTITY_CONSTANTS.TOKEN_ID_123456);

      const stringIdResponse = {
        success: true,
        receipt: {
          tokenId: TEST_ENTITY_CONSTANTS.TOKEN_ID_789012
        }
      };

      const result2 = await resolver.extractEntities(stringIdResponse, TEST_ENTITY_CONSTANTS.CREATE_TOKEN_TEST);
      expect(result2).toHaveLength(1);
      expect(result2[0].id).toBe(TEST_ENTITY_CONSTANTS.TOKEN_ID_789012);

      const jsonStringResponse = JSON.stringify(stringIdResponse);
      const result3 = await resolver.extractEntities(jsonStringResponse, TEST_ENTITY_CONSTANTS.CREATE_TOKEN_TEST);
      expect(result3).toHaveLength(1);
      expect(result3[0].id).toBe(TEST_ENTITY_CONSTANTS.TOKEN_ID_789012);
    });

    it('should handle malformed JSON gracefully', async () => {
      const malformedJson = '{"success": true, "receipt": {"tokenId"';
      
      const result = await resolver.extractEntities(malformedJson, 'Create token "Test"');
      
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('resolveReferences type safety', () => {
    it('should always return string, never undefined or null', async () => {
      const entities: EntityAssociation[] = [
        {
          entityId: TEST_ENTITY_CONSTANTS.TOKEN_ID_123456,
          entityName: TEST_ENTITY_CONSTANTS.TEST_TOKEN_NAME,
          entityType: TEST_ENTITY_CONSTANTS.TOKEN_ENTITY_TYPE,
          createdAt: new Date(),
          confidence: 0.9
        }
      ];

      const result = await resolver.resolveReferences(TEST_ENTITY_CONSTANTS.SEND_THE_TOKEN, entities);
      
      expect(typeof result).toBe('string');
      expect(result).toBeTruthy();
    });

    it('should handle empty entities array without error', async () => {
      const result = await resolver.resolveReferences(TEST_ENTITY_CONSTANTS.SEND_THE_TOKEN, []);
      
      expect(typeof result).toBe('string');
      expect(result).toBe('Send the token');
    });
  });

  describe('entity type validation methods', () => {
    const mockEntities: EntityAssociation[] = [
      {
        entityId: TEST_ENTITY_CONSTANTS.TOKEN_ID_123456,
        entityName: 'TestToken',
        entityType: 'token',
        createdAt: new Date('2023-01-01'),
        confidence: 0.9
      },
      {
        entityId: '0.0.789012',
        entityName: 'TestTopic',
        entityType: 'topic',
        createdAt: new Date('2023-01-02'),
        confidence: 0.8
      }
    ];

    it('should validate entity type correctly', () => {
      const isValid = resolver.validateEntityType(TEST_ENTITY_CONSTANTS.TOKEN_ID_123456, 'token', mockEntities);
      expect(typeof isValid).toBe('boolean');
      expect(isValid).toBe(true);

      const isInvalid = resolver.validateEntityType(TEST_ENTITY_CONSTANTS.TOKEN_ID_123456, 'topic', mockEntities);
      expect(isInvalid).toBe(false);
    });

    it('should filter entities by type correctly', () => {
      const tokens = resolver.getEntitiesByType(mockEntities, 'token');
      expect(Array.isArray(tokens)).toBe(true);
      expect(tokens).toHaveLength(1);
      expect(tokens[0].entityType).toBe('token');
    });

    it('should find most recent entity by type', () => {
      const mostRecent = resolver.getMostRecentEntityByType(mockEntities, 'topic');
      expect(mostRecent).not.toBeNull();
      expect(mostRecent?.entityType).toBe('topic');
      expect(mostRecent?.entityId).toBe('0.0.789012');
    });

    it('should return null when no entity of type exists', () => {
      const result = resolver.getMostRecentEntityByType(mockEntities, 'nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('resolveWithTypeValidation type safety', () => {
    it('should return properly typed array of EntityAssociation', async () => {
      const entities: EntityAssociation[] = [
        {
          entityId: TEST_ENTITY_CONSTANTS.TOKEN_ID_123456,
          entityName: TEST_ENTITY_CONSTANTS.TEST_TOKEN_NAME,
          entityType: TEST_ENTITY_CONSTANTS.TOKEN_ENTITY_TYPE,
          createdAt: new Date(),
          confidence: 0.9
        }
      ];

      const result = await resolver.resolveWithTypeValidation('Send the token', entities, 'token');
      
      expect(Array.isArray(result)).toBe(true);
      result.forEach(entity => {
        expect(typeof entity.entityId).toBe('string');
        expect(typeof entity.entityName).toBe('string');
        expect(typeof entity.entityType).toBe('string');
        expect(entity.createdAt instanceof Date).toBe(true);
        expect(typeof entity.confidence).toBe('number');
      });
    });
  });
});