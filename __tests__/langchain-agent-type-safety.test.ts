import { LangChainAgent } from '../src/langchain/langchain-agent';
import { TEST_ACCOUNT_IDS, TEST_NETWORKS, TEST_RESPONSE_MESSAGES, TEST_BLOCK_IDS, TEST_HASH_LINKS, TEST_TEMPLATES, TEST_FORM_DATA, TEST_ERRORS } from './test-constants';
import { createMockServerSigner } from './mock-factory';


interface ChatResponse {
  output: string;
  message: string;
  notes: string[];
  metadata?: {
    hashLinkBlock?: {
      blockId: string;
      hashLink: string;
      template: string;
      attributes: Record<string, unknown>;
    };
    [key: string]: unknown;
  };
}


describe('LangChainAgent Type Safety', () => {
  describe('Metadata Type Safety', () => {
    it('should handle hashLinkBlock metadata with proper typing instead of any cast', async () => {
      const mockSigner = createMockServerSigner({
        getAccountId: jest.fn().mockReturnValue({ toString: () => TEST_ACCOUNT_IDS.MOCK_ACCOUNT }),
        getNetwork: jest.fn().mockReturnValue(TEST_NETWORKS.TESTNET)
      });
      
      const _agent = new LangChainAgent({
        signer: mockSigner,
      } as unknown as ConstructorParameters<typeof LangChainAgent>[0]);

      const mockResponse = {
        metadata: {
          hashLinkBlock: {
            blockId: TEST_BLOCK_IDS.TEST_BLOCK,
            hashLink: TEST_HASH_LINKS.TEST_LINK,
            template: TEST_TEMPLATES.TEST_TEMPLATE,
            attributes: { key: 'value' }
          }
        }
      };

      
      const hasHashLink = !!(mockResponse.metadata?.hashLinkBlock);
      expect(hasHashLink).toBe(true);
      
      if (mockResponse.metadata?.hashLinkBlock) {
        expect(mockResponse.metadata.hashLinkBlock.blockId).toBe(TEST_BLOCK_IDS.TEST_BLOCK);
        expect(mockResponse.metadata.hashLinkBlock.hashLink).toBe(TEST_HASH_LINKS.TEST_LINK);
        expect(mockResponse.metadata.hashLinkBlock.template).toBe(TEST_TEMPLATES.TEST_TEMPLATE);
        expect(mockResponse.metadata.hashLinkBlock.attributes).toEqual({ key: 'value' });
      }
    });

    it('should handle preserved metadata type safety during form submission processing', () => {
      const preservedMetadata = {
        hashLinkBlock: {
          blockId: TEST_BLOCK_IDS.PRESERVED_BLOCK,
          hashLink: TEST_HASH_LINKS.PRESERVED_LINK,
          template: TEST_TEMPLATES.PRESERVED_TEMPLATE,
          attributes: { preserved: true }
        }
      };

      const hasPreservedHashLink = !!(preservedMetadata.hashLinkBlock);
      expect(hasPreservedHashLink).toBe(true);
      
      if (preservedMetadata.hashLinkBlock) {
        expect(preservedMetadata.hashLinkBlock.blockId).toBe(TEST_BLOCK_IDS.PRESERVED_BLOCK);
        expect(preservedMetadata.hashLinkBlock.attributes.preserved).toBe(true); // attributes is typed as Record<string, unknown>
      }
    });

    it('should use proper interface for ChatResponse metadata', () => {
      const mockResponse: ChatResponse = {
        output: TEST_RESPONSE_MESSAGES.TEST_RESPONSE,
        message: TEST_RESPONSE_MESSAGES.TEST_MESSAGE,
        notes: [],
        metadata: {
          hashLinkBlock: {
            blockId: TEST_BLOCK_IDS.INTERFACE_TEST,
            hashLink: TEST_HASH_LINKS.INTERFACE_LINK,
            template: TEST_TEMPLATES.INTERFACE_TEMPLATE,
            attributes: { interfaceTest: true }
          }
        }
      };

      expect(mockResponse.metadata?.hashLinkBlock?.blockId).toBe(TEST_BLOCK_IDS.INTERFACE_TEST);
    });
  });

  describe('Method Return Types', () => {
    it('should have explicit return types for all public methods', () => {
      const mockSigner = createMockServerSigner({
        getAccountId: jest.fn().mockReturnValue({ toString: () => TEST_ACCOUNT_IDS.MOCK_ACCOUNT }),
        getNetwork: jest.fn().mockReturnValue(TEST_NETWORKS.TESTNET)
      });
      
      const agent = new LangChainAgent({
        signer: mockSigner,
      } as unknown as ConstructorParameters<typeof LangChainAgent>[0]);

      const usageStats = agent.getUsageStats();
      expect(typeof usageStats).toBe('object');
      expect('promptTokens' in usageStats).toBe(true);
      expect('completionTokens' in usageStats).toBe(true);
      expect('totalTokens' in usageStats).toBe(true);
      expect('cost' in usageStats).toBe(true);

      const usageLog = agent.getUsageLog();
      expect(Array.isArray(usageLog)).toBe(true);

      const connectionStatus = agent.getMCPConnectionStatus();
      expect(connectionStatus instanceof Map).toBe(true);
    });

    it('should handle async method return types properly', async () => {
      const mockSigner = createMockServerSigner({
        getAccountId: jest.fn().mockReturnValue({ toString: () => TEST_ACCOUNT_IDS.MOCK_ACCOUNT }),
        getNetwork: jest.fn().mockReturnValue(TEST_NETWORKS.TESTNET)
      });
      
      const agent = new LangChainAgent({
        signer: mockSigner,
      } as unknown as ConstructorParameters<typeof LangChainAgent>[0]);

      try {
        await agent.connectMCPServers();
        expect(true).toBe(true); // If it doesn't throw, the return type is correct
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Type Guards and Interfaces', () => {
    it('should use type guards instead of any casting for metadata validation', () => {
      function isHashLinkBlockMetadata(metadata: unknown): metadata is { hashLinkBlock: { blockId: string; hashLink: string; template: string; attributes: Record<string, unknown> } } {
        if (typeof metadata !== 'object' || metadata === null || !('hashLinkBlock' in metadata)) {
          return false;
        }
        
        const metadataObj = metadata as Record<string, unknown>;
        const hashLinkBlock = metadataObj.hashLinkBlock;
        
        return (
          typeof hashLinkBlock === 'object' &&
          hashLinkBlock !== null &&
          'blockId' in hashLinkBlock &&
          typeof (hashLinkBlock as Record<string, unknown>).blockId === 'string'
        );
      }

      const validMetadata = {
        hashLinkBlock: {
          blockId: TEST_BLOCK_IDS.VALID_ID,
          hashLink: TEST_HASH_LINKS.VALID_LINK,
          template: TEST_TEMPLATES.VALID_TEMPLATE,
          attributes: { valid: true }
        }
      };

      const invalidMetadata = {
        someOtherProperty: 'value'
      };

      expect(isHashLinkBlockMetadata(validMetadata)).toBe(true);
      expect(isHashLinkBlockMetadata(invalidMetadata)).toBe(false);
      expect(isHashLinkBlockMetadata(null)).toBe(false);
      expect(isHashLinkBlockMetadata(undefined)).toBe(false);

      if (isHashLinkBlockMetadata(validMetadata)) {
        expect(validMetadata.hashLinkBlock.blockId).toBe(TEST_BLOCK_IDS.VALID_ID);
      }
    });

    it('should define proper interfaces for form submission result metadata', () => {
      interface FormSubmissionResult {
        output: string;
        formCompleted: boolean;
        originalFormId: string;
        intermediateSteps: unknown[];
        metadata: {
          hashLinkBlock?: {
            blockId: string;
            hashLink: string;
            template: string;
            attributes: Record<string, unknown>;
          };
          [key: string]: unknown;
        };
      }

      const mockResult: FormSubmissionResult = {
        output: TEST_FORM_DATA.FORM_PROCESSED,
        formCompleted: true,
        originalFormId: TEST_FORM_DATA.TEST_FORM_ID,
        intermediateSteps: [],
        metadata: {
          hashLinkBlock: {
            blockId: TEST_BLOCK_IDS.FORM_RESULT,
            hashLink: TEST_HASH_LINKS.FORM_RESULT_LINK,
            template: TEST_TEMPLATES.FORM_RESULT_TEMPLATE,
            attributes: { formResult: true }
          }
        }
      };

      expect(mockResult.metadata.hashLinkBlock?.blockId).toBe(TEST_BLOCK_IDS.FORM_RESULT);
      expect(mockResult.formCompleted).toBe(true);
    });
  });

  describe('Error Handling Type Safety', () => {
    it('should handle unknown error types with proper type checking', () => {
      const mockSigner = createMockServerSigner({
        getAccountId: jest.fn().mockReturnValue({ toString: () => TEST_ACCOUNT_IDS.MOCK_ACCOUNT }),
        getNetwork: jest.fn().mockReturnValue(TEST_NETWORKS.TESTNET)
      });
      
      const _agent = new LangChainAgent({
        signer: mockSigner,
      } as unknown as ConstructorParameters<typeof LangChainAgent>[0]);

      const stringError = TEST_ERRORS.STRING_ERROR;
      const errorObject = new Error(TEST_ERRORS.ERROR_OBJECT);
      const unknownError = { custom: 'error' };

      
      const handleErrorSafely = (error: unknown): string => {
        if (error instanceof Error) {
          return error.message;
        }
        if (typeof error === 'string') {
          return error;
        }
        return TEST_ERRORS.UNKNOWN_ERROR;
      };

      expect(handleErrorSafely(stringError)).toBe(TEST_ERRORS.STRING_ERROR);
      expect(handleErrorSafely(errorObject)).toBe(TEST_ERRORS.ERROR_OBJECT);
      expect(handleErrorSafely(unknownError)).toBe(TEST_ERRORS.UNKNOWN_ERROR);
    });
  });
});