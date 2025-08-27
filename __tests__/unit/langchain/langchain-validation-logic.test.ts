import { z } from 'zod';

describe('LangChain Validation Logic Tests', () => {
  describe('ZodObject Schema Detection', () => {
    it('should correctly identify ZodObject types', () => {
      const isZodObject = (schema: unknown): schema is z.ZodObject<z.ZodRawShape> => {
        return schema instanceof z.ZodObject;
      };

      expect(isZodObject(z.object({ field: z.string() }))).toBe(true);
      expect(isZodObject(z.string())).toBe(false);
      expect(isZodObject(z.array(z.string()))).toBe(false);
      expect(isZodObject(null)).toBe(false);
      expect(isZodObject(undefined)).toBe(false);
    });

    it('should extract schema shape from ZodObject', () => {
      const getSchemaShape = (schema: unknown): string[] => {
        if (schema instanceof z.ZodObject) {
          return Object.keys(schema.shape);
        }
        return [];
      };

      const schema = z.object({
        name: z.string(),
        age: z.number(),
        active: z.boolean(),
      });

      expect(getSchemaShape(schema)).toEqual(['name', 'age', 'active']);
      expect(getSchemaShape(z.string())).toEqual([]);
    });
  });

  describe('Field Emptiness Detection', () => {
    it('should detect empty fields correctly', () => {
      const isFieldEmpty = (fieldName: string, value: unknown): boolean => {
        if (value === undefined || value === null || value === '') {
          return true;
        }
        if (Array.isArray(value) && value.length === 0) {
          return true;
        }
        return false;
      };

      expect(isFieldEmpty('test', undefined)).toBe(true);
      expect(isFieldEmpty('test', null)).toBe(true);
      expect(isFieldEmpty('test', '')).toBe(true);
      expect(isFieldEmpty('test', [])).toBe(true);
      expect(isFieldEmpty('test', 'value')).toBe(false);
      expect(isFieldEmpty('test', 0)).toBe(false);
      expect(isFieldEmpty('test', false)).toBe(false);
      expect(isFieldEmpty('test', ['item'])).toBe(false);
    });
  });

  describe('Form Bypass Flag Detection', () => {
    it('should detect bypass flags in input', () => {
      const hasFormBypassFlags = (input: Record<string, unknown>): boolean => {
        return (
          (input.__fromForm === true) ||
          (input.renderForm === false)
        );
      };

      expect(hasFormBypassFlags({ __fromForm: true })).toBe(true);
      expect(hasFormBypassFlags({ renderForm: false })).toBe(true);
      expect(hasFormBypassFlags({ __fromForm: false })).toBe(false);
      expect(hasFormBypassFlags({ renderForm: true })).toBe(false);
      expect(hasFormBypassFlags({})).toBe(false);
      expect(hasFormBypassFlags({ otherField: 'value' })).toBe(false);
    });
  });

  describe('HashLink Block Detection', () => {
    it('should detect HashLink blocks in metadata', () => {
      const hasHashLinkBlock = (metadata: unknown): boolean => {
        return (
          typeof metadata === 'object' &&
          metadata !== null &&
          'hashLinkBlock' in metadata &&
          typeof (metadata as Record<string, unknown>).hashLinkBlock === 'object' &&
          (metadata as Record<string, unknown>).hashLinkBlock !== null
        );
      };

      const validMetadata = {
        hashLinkBlock: {
          blockId: 'block-123',
          hashLink: 'hrl://example.com',
          template: 'template',
          attributes: {},
        },
      };

      expect(hasHashLinkBlock(validMetadata)).toBe(true);
      expect(hasHashLinkBlock({})).toBe(false);
      expect(hasHashLinkBlock({ hashLinkBlock: null })).toBe(false);
      expect(hasHashLinkBlock(null)).toBe(false);
      expect(hasHashLinkBlock(undefined)).toBe(false);
    });
  });

  describe('JSON Validation', () => {
    it('should validate JSON strings correctly', () => {
      const isJSON = (str: string): boolean => {
        if (typeof str !== 'string' || str.trim() === '') {
          return false;
        }
        try {
          JSON.parse(str);
          return true;
        } catch {
          return false;
        }
      };

      expect(isJSON('{"valid": true}')).toBe(true);
      expect(isJSON('{"nested": {"data": [1, 2, 3]}}')).toBe(true);
      expect(isJSON('[]')).toBe(true);
      expect(isJSON('null')).toBe(true);
      expect(isJSON('true')).toBe(true);
      expect(isJSON('123')).toBe(true);
      expect(isJSON('"string"')).toBe(true);
      
      expect(isJSON('{"invalid": }')).toBe(false);
      expect(isJSON('not json')).toBe(false);
      expect(isJSON('')).toBe(false);
      expect(isJSON('undefined')).toBe(false);
    });
  });

  describe('Tool Keyword Extraction', () => {
    it('should extract keywords from tool names', () => {
      const extractToolKeywords = (toolName: string): string[] => {
        return toolName
          .split(/[-_]/)
          .map(word => word.toLowerCase())
          .filter(word => word.length > 0);
      };

      expect(extractToolKeywords('transfer-hbar-tool')).toEqual(['transfer', 'hbar', 'tool']);
      expect(extractToolKeywords('inscribe_content')).toEqual(['inscribe', 'content']);
      expect(extractToolKeywords('createRegistry')).toEqual(['createregistry']);
      expect(extractToolKeywords('query-dynamic-registry-tool')).toEqual(['query', 'dynamic', 'registry', 'tool']);
      expect(extractToolKeywords('')).toEqual([]);
    });
  });

  describe('Schema Path Matching', () => {
    it('should check if schema matches error paths', () => {
      const schemaMatchesErrorPaths = (
        schema: z.ZodObject<z.ZodRawShape>,
        errorPaths: string[][]
      ): boolean => {
        const flattenSchema = (obj: z.ZodRawShape, prefix = ''): string[] => {
          const paths: string[] = [];
          for (const [key, value] of Object.entries(obj)) {
            const path = prefix ? `${prefix}.${key}` : key;
            paths.push(path);
            
            if (value instanceof z.ZodObject) {
              paths.push(...flattenSchema(value.shape, path));
            }
          }
          return paths;
        };

        const schemaPaths = flattenSchema(schema.shape);
        const errorPathStrings = errorPaths.map(path => path.join('.'));
        
        return errorPathStrings.some(errorPath => 
          schemaPaths.includes(errorPath)
        );
      };

      const schema = z.object({
        user: z.object({
          name: z.string(),
          email: z.string(),
        }),
        settings: z.object({
          theme: z.string(),
        }),
      });

      const matchingPaths = [['user', 'name'], ['settings', 'theme']];
      const nonMatchingPaths = [['user', 'age'], ['config', 'lang']];
      
      expect(schemaMatchesErrorPaths(schema, matchingPaths)).toBe(true);
      expect(schemaMatchesErrorPaths(schema, nonMatchingPaths)).toBe(false);
    });
  });

  describe('Required Field Detection', () => {
    it('should detect required fields in Zod schema', () => {
      const isFieldRequired = (schema: z.ZodTypeAny): boolean => {
        const def = (schema as z.ZodType)._def as { typeName?: string };
        
        if (def.typeName === 'ZodOptional' || def.typeName === 'ZodNullable') {
          return false;
        }
        
        if (def.typeName === 'ZodDefault') {
          return false;
        }
        
        return true;
      };

      expect(isFieldRequired(z.string())).toBe(true);
      expect(isFieldRequired(z.number())).toBe(true);
      expect(isFieldRequired(z.string().optional())).toBe(false);
      expect(isFieldRequired(z.number().nullable())).toBe(false);
      expect(isFieldRequired(z.string().default('default'))).toBe(false);
    });
  });

  describe('Tool Context Matching', () => {
    it('should find tools from context using keywords', () => {
      const findToolFromContext = (
        nameToolMap: Record<string, { name: string }>,
        context: string
      ): string | null => {
        const contextLower = context.toLowerCase();
        const extractKeywords = (name: string) => name.split(/[-_]/).map(w => w.toLowerCase());
        
        for (const [toolName, tool] of Object.entries(nameToolMap)) {
          const keywords = extractKeywords(tool.name);
          if (keywords.some(keyword => contextLower.includes(keyword))) {
            return toolName;
          }
        }
        return null;
      };

      const tools = {
        'inscribe-tool': { name: 'inscribe-content' },
        'transfer-tool': { name: 'transfer-hbar' },
        'query-tool': { name: 'query-registry' },
      };

      expect(findToolFromContext(tools, 'I want to inscribe some data')).toBe('inscribe-tool');
      expect(findToolFromContext(tools, 'Transfer HBAR to another account')).toBe('transfer-tool');
      expect(findToolFromContext(tools, 'Query the registry for information')).toBe('query-tool');
      expect(findToolFromContext(tools, 'Do something unrelated')).toBeNull();
    });
  });

  describe('Error Info Extraction', () => {
    it('should extract tool info from error messages', () => {
      const extractToolInfoFromError = (errorMessage: string): string[] => {
        const toolPatterns = [
          /Tool\s+"([^"]+)"/g,
          /tool:\s*([^\s,]+)/gi,
          /using\s+tool\s+([^\s,]+)/gi,
        ];
        
        const matches: string[] = [];
        for (const pattern of toolPatterns) {
          let match;
          while ((match = pattern.exec(errorMessage)) !== null) {
            matches.push(match[1]);
          }
        }
        
        return matches;
      };

      expect(extractToolInfoFromError('Tool "transfer-hbar" failed')).toContain('transfer-hbar');
      expect(extractToolInfoFromError('Error with tool: inscribe-content')).toContain('inscribe-content');
      expect(extractToolInfoFromError('Failed using tool query-registry')).toContain('query-registry');
      expect(extractToolInfoFromError('Generic error message')).toEqual([]);
    });
  });

  describe('Missing Fields Calculation', () => {
    it('should calculate missing required fields', () => {
      const calculateMissingFields = (
        input: Record<string, unknown>,
        essentialFields: string[],
        isFieldEmpty: (field: string, value: unknown) => boolean
      ): Set<string> => {
        const missing = new Set<string>();
        
        for (const field of essentialFields) {
          const value = input[field];
          if (isFieldEmpty(field, value)) {
            missing.add(field);
          }
        }
        
        return missing;
      };

      const isFieldEmpty = (field: string, value: unknown) => {
        return value === undefined || value === null || value === '';
      };

      const essentialFields = ['name', 'email', 'age'];
      const partialInput = { name: 'John', email: '', age: 25 };
      
      const missing = calculateMissingFields(partialInput, essentialFields, isFieldEmpty);
      
      expect(missing).toEqual(new Set(['email']));
    });
  });
});