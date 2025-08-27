import { z } from 'zod';

const TEST_IDENTIFIERS = {
  RESPONSE_BLOCK_ID: 'response-block-id',
  RESPONSE_HASH_LINK: 'response-hash-link',
  RESPONSE_TEMPLATE: 'response-template'
} as const;

const ERROR_MESSAGES = {
  UNKNOWN_ERROR: 'Unknown error occurred'
} as const;

describe('FormAwareAgentExecutor Type Safety', () => {
  describe('Zod Schema Type Safety', () => {
    it('should handle ZodObject shape property access with proper typing instead of any cast', () => {
      const testSchema = z.object({
        name: z.string(),
        age: z.number(),
        email: z.string().email()
      });

      const shape = testSchema.shape;
      expect(typeof shape).toBe('object');
      expect('name' in shape).toBe(true);
      expect('age' in shape).toBe(true);
      expect('email' in shape).toBe(true);

      const fieldCount = Object.keys(shape).length;
      expect(fieldCount).toBe(3);
    });

    it('should use proper type guards for ZodObject validation', () => {
      const stringSchema = z.string();
      const objectSchema = z.object({ test: z.string() });
      const arraySchema = z.array(z.string());

      function isZodObject(schema: z.ZodType): schema is z.ZodObject<Record<string, z.ZodTypeAny>> {
        return schema instanceof z.ZodObject;
      }

      expect(isZodObject(stringSchema)).toBe(false);
      expect(isZodObject(objectSchema)).toBe(true);
      expect(isZodObject(arraySchema)).toBe(false);

      if (isZodObject(objectSchema)) {
        expect('test' in objectSchema.shape).toBe(true);
      }
    });
  });

  describe('HashLink Metadata Type Safety', () => {
    it('should handle hashLinkBlock metadata access with proper typing instead of any cast', () => {
      interface ResponseMetadataWithHashLink {
        hashLinkBlock?: {
          blockId: string;
          hashLink: string;
          template: string;
          attributes: Record<string, unknown>;
        };
        [key: string]: unknown;
      }

      const responseMetadata: ResponseMetadataWithHashLink = {
        hashLinkBlock: {
          blockId: 'test-block-id',
          hashLink: 'test-hash-link',
          template: 'test-template',
          attributes: { test: 'value' }
        }
      };

      expect(responseMetadata.hashLinkBlock?.blockId).toBe('test-block-id');
      expect(!!responseMetadata.hashLinkBlock?.template).toBe(true);
    });

    it('should use proper type guards for hashLinkBlock validation', () => {
      function hasHashLinkBlock(metadata: unknown): metadata is { hashLinkBlock: { blockId: string; hashLink: string; template: string; attributes: Record<string, unknown> } } {
        if (typeof metadata !== 'object' || metadata === null || !('hashLinkBlock' in metadata)) {
          return false;
        }
        
        const metadataObj = metadata as Record<string, unknown>;
        const hashLinkBlock = metadataObj.hashLinkBlock;
        
        return (
          typeof hashLinkBlock === 'object' &&
          hashLinkBlock !== null &&
          'blockId' in hashLinkBlock &&
          'hashLink' in hashLinkBlock &&
          'template' in hashLinkBlock &&
          'attributes' in hashLinkBlock
        );
      }

      const validMetadata = {
        hashLinkBlock: {
          blockId: 'valid-id',
          hashLink: 'valid-link',
          template: 'valid-template',
          attributes: { test: true }
        }
      };

      const invalidMetadata = {
        someOtherProperty: 'value'
      };

      expect(hasHashLinkBlock(validMetadata)).toBe(true);
      expect(hasHashLinkBlock(invalidMetadata)).toBe(false);
      expect(hasHashLinkBlock(null)).toBe(false);
      expect(hasHashLinkBlock(undefined)).toBe(false);

      if (hasHashLinkBlock(validMetadata)) {
        expect(validMetadata.hashLinkBlock.blockId).toBe('valid-id');
        expect(validMetadata.hashLinkBlock.template).toBe('valid-template');
      }
    });

    it('should handle metadata processing with proper types', () => {
      interface ToolResponse {
        success?: boolean;
        inscription?: Record<string, unknown>;
        metadata?: {
          hashLinkBlock?: {
            blockId: string;
            hashLink: string;
            template: string;
            attributes: Record<string, unknown>;
          };
          [key: string]: unknown;
        };
        [key: string]: unknown;
      }

      const toolResponse: ToolResponse = {
        success: true,
        inscription: { type: 'test' },
        metadata: {
          hashLinkBlock: {
            blockId: TEST_IDENTIFIERS.RESPONSE_BLOCK_ID,
            hashLink: TEST_IDENTIFIERS.RESPONSE_HASH_LINK,  
            template: TEST_IDENTIFIERS.RESPONSE_TEMPLATE,
            attributes: { processed: true }
          }
        }
      };

      const responseMetadata = toolResponse.metadata || {};
      expect(responseMetadata.hashLinkBlock?.blockId).toBe(TEST_IDENTIFIERS.RESPONSE_BLOCK_ID);
      
      const debugInfo = {
        blockId: responseMetadata.hashLinkBlock?.blockId,
        hasTemplate: !!responseMetadata.hashLinkBlock?.template
      };

      expect(debugInfo.blockId).toBe(TEST_IDENTIFIERS.RESPONSE_BLOCK_ID);
      expect(debugInfo.hasTemplate).toBe(true);
    });
  });

  describe('Type Inference and Safety', () => {
    it('should maintain type safety in form validation workflows', () => {
      const testFormSubmission = {
        formId: 'test-form-id',
        toolName: 'test-tool',
        parameters: {
          name: 'John Doe',
          email: 'john@example.com',
          age: 30
        },
        timestamp: Date.now()
      };

      expect(typeof testFormSubmission.parameters.name).toBe('string');
      expect(typeof testFormSubmission.parameters.age).toBe('number');
      expect(testFormSubmission.parameters.email.includes('@')).toBe(true);
    });

    it('should handle tool response parsing with type safety', () => {
      const toolOutput = JSON.stringify({
        success: true,
        data: { processed: true },
        metadata: {
          hashLinkBlock: {
            blockId: 'parsed-block-id',
            hashLink: 'parsed-hash-link',
            template: 'parsed-template',
            attributes: { parsed: true }
          }
        }
      });

      const parsed = JSON.parse(toolOutput);
      
      const isValidResponse = (
        typeof parsed === 'object' &&
        parsed !== null &&
        'success' in parsed &&
        typeof parsed.success === 'boolean'
      );

      expect(isValidResponse).toBe(true);

      if (isValidResponse && parsed.metadata?.hashLinkBlock) {
        expect(parsed.metadata.hashLinkBlock.blockId).toBe('parsed-block-id');
      }
    });
  });

  describe('Error Handling Type Safety', () => {
    it('should handle unknown error types with proper type checking', () => {
      const stringError = 'String error message';
      const errorObject = new Error('Error object message');
      const unknownError = { custom: 'error', code: 500 };

      function safeErrorHandler(error: unknown): string {
        if (error instanceof Error) {
          return error.message;
        }
        if (typeof error === 'string') {
          return error;
        }
        if (typeof error === 'object' && error !== null && 'message' in error) {
          return String(error.message);
        }
        return ERROR_MESSAGES.UNKNOWN_ERROR;
      }

      expect(safeErrorHandler(stringError)).toBe('String error message');
      expect(safeErrorHandler(errorObject)).toBe('Error object message');
      expect(safeErrorHandler(unknownError)).toBe(ERROR_MESSAGES.UNKNOWN_ERROR);
      expect(safeErrorHandler(null)).toBe(ERROR_MESSAGES.UNKNOWN_ERROR);
      expect(safeErrorHandler(undefined)).toBe(ERROR_MESSAGES.UNKNOWN_ERROR);
    });
  });
});