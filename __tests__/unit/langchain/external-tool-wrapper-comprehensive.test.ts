import { z } from 'zod';
import { 
  ExternalToolWrapper, 
  wrapExternalToolWithRenderConfig, 
  renderConfigs, 
  hederaToolConfigs 
} from '../../../src/langchain/external-tool-wrapper';

describe('ExternalToolWrapper Comprehensive Tests', () => {
  describe('ExternalToolWrapper Interface', () => {
    it('should define the correct interface structure', () => {
      const mockWrapper: ExternalToolWrapper<z.ZodString> = {
        name: 'test-tool',
        description: 'Test tool description',
        schema: z.string(),
      };

      expect(mockWrapper).toHaveProperty('name');
      expect(mockWrapper).toHaveProperty('description');
      expect(mockWrapper).toHaveProperty('schema');
      expect(mockWrapper.name).toBe('test-tool');
      expect(mockWrapper.description).toBe('Test tool description');
      expect((mockWrapper.schema as any)._def.typeName).toBe('ZodString');
    });
  });

  describe('wrapExternalToolWithRenderConfig Function', () => {
    it('should wrap tool with basic config', () => {
      const originalTool = {
        name: 'basic-tool',
        description: 'Basic tool description',
        schema: z.object({ input: z.string() }),
      };

      const config = {
        ui: {
          label: 'Basic Tool',
          description: 'Enhanced basic tool description',
        },
      };

      const wrappedTool = wrapExternalToolWithRenderConfig(originalTool, config);

      expect(wrappedTool.name).toBe('basic-tool');
      expect(wrappedTool.description).toBe('Enhanced basic tool description');
      expect(wrappedTool.schema).toBe(originalTool.schema);
    });

    it('should wrap tool with field configurations', () => {
      const originalTool = {
        name: 'field-config-tool',
        description: 'Tool with field configs',
        schema: z.object({ 
          name: z.string(),
          age: z.number(),
        }),
      };

      const config = {
        ui: {
          label: 'Field Config Tool',
          description: 'Tool with custom field configurations',
        },
        fieldConfigs: {
          name: { type: 'text', label: 'Full Name' },
          age: { type: 'number', label: 'Age', min: 0, max: 150 },
        },
      };

      const wrappedTool = wrapExternalToolWithRenderConfig(originalTool, config);

      expect(wrappedTool.name).toBe('field-config-tool');
      expect(wrappedTool.description).toBe('Tool with custom field configurations');
      expect(wrappedTool.schema).toBe(originalTool.schema);
    });

    it('should use original description when UI description is not provided', () => {
      const originalTool = {
        name: 'original-desc-tool',
        description: 'Original description',
        schema: z.string(),
      };

      const config = {
        ui: {
          label: 'Tool Label',
        },
      };

      const wrappedTool = wrapExternalToolWithRenderConfig(originalTool, config);

      expect(wrappedTool.description).toBe('Original description');
    });

    it('should handle empty config', () => {
      const originalTool = {
        name: 'empty-config-tool',
        description: 'Empty config tool',
        schema: z.boolean(),
      };

      const wrappedTool = wrapExternalToolWithRenderConfig(originalTool, {});

      expect(wrappedTool.name).toBe('empty-config-tool');
      expect(wrappedTool.description).toBe('Empty config tool');
      expect(wrappedTool.schema).toBe(originalTool.schema);
    });

    it('should handle tool with complex schema', () => {
      const complexSchema = z.object({
        user: z.object({
          name: z.string(),
          email: z.string().email(),
        }),
        preferences: z.object({
          theme: z.enum(['light', 'dark']),
          notifications: z.boolean(),
        }),
        tags: z.array(z.string()),
      });

      const originalTool = {
        name: 'complex-tool',
        description: 'Complex schema tool',
        schema: complexSchema,
      };

      const config = {
        ui: {
          description: 'Enhanced complex tool',
        },
        fieldConfigs: {
          'user.name': { type: 'text', label: 'User Name' },
          'user.email': { type: 'email', label: 'Email Address' },
          'preferences.theme': { type: 'select', options: ['light', 'dark'] },
        },
      };

      const wrappedTool = wrapExternalToolWithRenderConfig(originalTool, config);

      expect(wrappedTool.name).toBe('complex-tool');
      expect(wrappedTool.description).toBe('Enhanced complex tool');
      expect(wrappedTool.schema).toBe(complexSchema);
    });
  });

  describe('renderConfigs Object', () => {
    describe('text renderer', () => {
      it('should create text config with all parameters', () => {
        const config = renderConfigs.text('Full Name', 'Enter your full name', 'This will be displayed publicly');

        expect(config).toEqual({
          type: 'text',
          label: 'Full Name',
          placeholder: 'Enter your full name',
          help: 'This will be displayed publicly',
        });
      });

      it('should create text config with minimal parameters', () => {
        const config = renderConfigs.text('Name');

        expect(config).toEqual({
          type: 'text',
          label: 'Name',
          placeholder: undefined,
          help: undefined,
        });
      });

      it('should create text config with placeholder only', () => {
        const config = renderConfigs.text('Email', 'user@example.com');

        expect(config).toEqual({
          type: 'text',
          label: 'Email',
          placeholder: 'user@example.com',
          help: undefined,
        });
      });
    });

    describe('number renderer', () => {
      it('should create number config with all parameters', () => {
        const config = renderConfigs.number('Age', 0, 150, 'Your age in years');

        expect(config).toEqual({
          type: 'number',
          label: 'Age',
          min: 0,
          max: 150,
          help: 'Your age in years',
        });
      });

      it('should create number config with minimal parameters', () => {
        const config = renderConfigs.number('Count');

        expect(config).toEqual({
          type: 'number',
          label: 'Count',
          min: undefined,
          max: undefined,
          help: undefined,
        });
      });

      it('should create number config with min only', () => {
        const config = renderConfigs.number('Score', 0);

        expect(config).toEqual({
          type: 'number',
          label: 'Score',
          min: 0,
          max: undefined,
          help: undefined,
        });
      });
    });

    describe('accountId renderer', () => {
      it('should create accountId config', () => {
        const config = renderConfigs.accountId('Account ID');

        expect(config).toEqual({
          type: 'accountId',
          label: 'Account ID',
          placeholder: '0.0.12345',
        });
      });

      it('should create accountId config for different account types', () => {
        const fromConfig = renderConfigs.accountId('From Account');
        const toConfig = renderConfigs.accountId('To Account');

        expect(fromConfig.label).toBe('From Account');
        expect(toConfig.label).toBe('To Account');
        expect(fromConfig.placeholder).toBe('0.0.12345');
        expect(toConfig.placeholder).toBe('0.0.12345');
      });
    });

    describe('checkbox renderer', () => {
      it('should create checkbox config with help text', () => {
        const config = renderConfigs.checkbox('Enable notifications', 'Receive email notifications');

        expect(config).toEqual({
          type: 'checkbox',
          label: 'Enable notifications',
          help: 'Receive email notifications',
        });
      });

      it('should create checkbox config without help text', () => {
        const config = renderConfigs.checkbox('Agree to terms');

        expect(config).toEqual({
          type: 'checkbox',
          label: 'Agree to terms',
          help: undefined,
        });
      });
    });

    describe('currency renderer', () => {
      it('should create currency config with all parameters', () => {
        const config = renderConfigs.currency('Transfer Amount', 'HBAR', 0.00000001, 1000);

        expect(config).toEqual({
          type: 'currency',
          label: 'Transfer Amount',
          currency: 'HBAR',
          min: 0.00000001,
          max: 1000,
        });
      });

      it('should create currency config with minimal parameters', () => {
        const config = renderConfigs.currency('Price', 'USD');

        expect(config).toEqual({
          type: 'currency',
          label: 'Price',
          currency: 'USD',
          min: undefined,
          max: undefined,
        });
      });

      it('should create currency config for different currencies', () => {
        const hbarConfig = renderConfigs.currency('HBAR Amount', 'HBAR', 0.00000001, 1000);
        const usdConfig = renderConfigs.currency('USD Amount', 'USD', 0.01, 10000);

        expect(hbarConfig.currency).toBe('HBAR');
        expect(hbarConfig.min).toBe(0.00000001);
        expect(usdConfig.currency).toBe('USD');
        expect(usdConfig.min).toBe(0.01);
      });
    });

    describe('tokenId renderer', () => {
      it('should create tokenId config', () => {
        const config = renderConfigs.tokenId('Token ID');

        expect(config).toEqual({
          type: 'tokenId',
          label: 'Token ID',
          placeholder: '0.0.12345',
        });
      });

      it('should create tokenId config for different token types', () => {
        const nftConfig = renderConfigs.tokenId('NFT Token ID');
        const ftConfig = renderConfigs.tokenId('Fungible Token ID');

        expect(nftConfig.label).toBe('NFT Token ID');
        expect(ftConfig.label).toBe('Fungible Token ID');
        expect(nftConfig.placeholder).toBe('0.0.12345');
        expect(ftConfig.placeholder).toBe('0.0.12345');
      });
    });

    describe('select renderer', () => {
      it('should create select config with options', () => {
        const options = [
          { value: 'light', label: 'Light Theme' },
          { value: 'dark', label: 'Dark Theme' },
        ];

        const config = renderConfigs.select('Theme', options);

        expect(config).toEqual({
          type: 'select',
          label: 'Theme',
          options,
        });
      });

      it('should create select config for network selection', () => {
        const networkOptions = [
          { value: 'mainnet', label: 'Mainnet' },
          { value: 'testnet', label: 'Testnet' },
          { value: 'previewnet', label: 'Previewnet' },
        ];

        const config = renderConfigs.select('Network', networkOptions);

        expect(config.type).toBe('select');
        expect(config.label).toBe('Network');
        expect(config.options).toEqual(networkOptions);
      });

      it('should handle empty options array', () => {
        const config = renderConfigs.select('Empty Select', []);

        expect(config.options).toEqual([]);
      });

      it('should handle single option', () => {
        const options = [{ value: 'only', label: 'Only Option' }];
        const config = renderConfigs.select('Single Select', options);

        expect(config.options).toEqual(options);
        expect(config.options).toHaveLength(1);
      });
    });
  });

  describe('hederaToolConfigs Object', () => {
    describe('hbarTransfer config', () => {
      it('should create HBAR transfer configuration', () => {
        const config = hederaToolConfigs.hbarTransfer();

        expect(config).toHaveProperty('ui');
        expect(config).toHaveProperty('fieldConfigs');
        
        expect(config.ui).toEqual({
          label: 'HBAR Transfer',
          description: 'Transfer HBAR between accounts',
        });

        expect(config.fieldConfigs).toHaveProperty('fromAccountId');
        expect(config.fieldConfigs).toHaveProperty('toAccountId');
        expect(config.fieldConfigs).toHaveProperty('amount');
        expect(config.fieldConfigs).toHaveProperty('memo');
      });

      it('should have correct field configurations', () => {
        const config = hederaToolConfigs.hbarTransfer();

        expect(config.fieldConfigs.fromAccountId).toEqual({
          type: 'accountId',
          label: 'From Account',
          placeholder: '0.0.12345',
        });

        expect(config.fieldConfigs.toAccountId).toEqual({
          type: 'accountId',
          label: 'To Account',
          placeholder: '0.0.12345',
        });

        expect(config.fieldConfigs.amount).toEqual({
          type: 'currency',
          label: 'Amount',
          currency: 'HBAR',
          min: 0.00000001,
          max: 1000,
        });

        expect(config.fieldConfigs.memo).toEqual({
          type: 'text',
          label: 'Memo',
          placeholder: 'Optional memo',
          help: undefined,
        });
      });
    });
  });

  describe('Integration Tests', () => {
    it('should integrate wrapper with renderConfigs', () => {
      const originalTool = {
        name: 'integrated-tool',
        description: 'Integration test tool',
        schema: z.object({
          name: z.string(),
          age: z.number(),
          theme: z.enum(['light', 'dark']),
        }),
      };

      const config = {
        ui: {
          label: 'Integrated Tool',
          description: 'Enhanced integration tool',
        },
        fieldConfigs: {
          name: renderConfigs.text('Full Name', 'Enter your name'),
          age: renderConfigs.number('Age', 0, 150),
          theme: renderConfigs.select('Theme', [
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]),
        },
      };

      const wrappedTool = wrapExternalToolWithRenderConfig(originalTool, config);

      expect(wrappedTool.name).toBe('integrated-tool');
      expect(wrappedTool.description).toBe('Enhanced integration tool');
      expect(wrappedTool.schema).toBe(originalTool.schema);
    });

    it('should integrate wrapper with hederaToolConfigs', () => {
      const hbarTransferTool = {
        name: 'hbar-transfer',
        description: 'Transfer HBAR',
        schema: z.object({
          fromAccountId: z.string(),
          toAccountId: z.string(),
          amount: z.number(),
          memo: z.string().optional(),
        }),
      };

      const config = hederaToolConfigs.hbarTransfer();
      const wrappedTool = wrapExternalToolWithRenderConfig(hbarTransferTool, config);

      expect(wrappedTool.name).toBe('hbar-transfer');
      expect(wrappedTool.description).toBe('Transfer HBAR between accounts');
      expect(wrappedTool.schema).toBe(hbarTransferTool.schema);
    });
  });

  describe('Type Safety and Generics', () => {
    it('should maintain type safety with string schema', () => {
      const tool = {
        name: 'string-tool',
        description: 'String tool',
        schema: z.string(),
      };

      const wrapper: ExternalToolWrapper<z.ZodString> = wrapExternalToolWithRenderConfig(tool, {});

      expect((wrapper.schema as any)._def.typeName).toBe('ZodString');
    });

    it('should maintain type safety with object schema', () => {
      const objectSchema = z.object({
        id: z.string(),
        count: z.number(),
      });

      const tool = {
        name: 'object-tool',
        description: 'Object tool',
        schema: objectSchema,
      };

      const wrapper: ExternalToolWrapper<typeof objectSchema> = wrapExternalToolWithRenderConfig(tool, {});

      expect(wrapper.schema).toBe(objectSchema);
    });

    it('should maintain type safety with array schema', () => {
      const arraySchema = z.array(z.string());

      const tool = {
        name: 'array-tool',
        description: 'Array tool',
        schema: arraySchema,
      };

      const wrapper: ExternalToolWrapper<typeof arraySchema> = wrapExternalToolWithRenderConfig(tool, {});

      expect(wrapper.schema).toBe(arraySchema);
    });

    it('should maintain type safety with union schema', () => {
      const unionSchema = z.union([z.string(), z.number()]);

      const tool = {
        name: 'union-tool',
        description: 'Union tool',
        schema: unionSchema,
      };

      const wrapper: ExternalToolWrapper<typeof unionSchema> = wrapExternalToolWithRenderConfig(tool, {});

      expect(wrapper.schema).toBe(unionSchema);
    });
  });

  describe('Edge Cases and Error Conditions', () => {
    it('should handle undefined config properties', () => {
      const tool = {
        name: 'undefined-props-tool',
        description: 'Tool with undefined props',
        schema: z.any(),
      };

      const config = {
        ui: {
          label: undefined,
          description: undefined,
        },
        fieldConfigs: undefined,
      };

      const wrapper = wrapExternalToolWithRenderConfig(tool, config);

      expect(wrapper.name).toBe('undefined-props-tool');
      expect(wrapper.description).toBe('Tool with undefined props');
    });

    it('should handle null values in render configs', () => {
      const textConfig = renderConfigs.text('Label', null as any, null as any);
      const numberConfig = renderConfigs.number('Number', null as any, null as any, null as any);

      expect(textConfig.placeholder).toBeNull();
      expect(textConfig.help).toBeNull();
      expect(numberConfig.min).toBeNull();
      expect(numberConfig.max).toBeNull();
      expect(numberConfig.help).toBeNull();
    });

    it('should handle empty strings in render configs', () => {
      const textConfig = renderConfigs.text('', '', '');
      const accountConfig = renderConfigs.accountId('');

      expect(textConfig.label).toBe('');
      expect(textConfig.placeholder).toBe('');
      expect(textConfig.help).toBe('');
      expect(accountConfig.label).toBe('');
    });

    it('should handle special characters in labels', () => {
      const config = renderConfigs.text('Special @#$%^&*() Label', 'Unicode 🚀 placeholder');

      expect(config.label).toBe('Special @#$%^&*() Label');
      expect(config.placeholder).toBe('Unicode 🚀 placeholder');
    });

    it('should handle very long strings', () => {
      const longLabel = 'A'.repeat(1000);
      const longPlaceholder = 'B'.repeat(1000);

      const config = renderConfigs.text(longLabel, longPlaceholder);

      expect(config.label).toBe(longLabel);
      expect(config.placeholder).toBe(longPlaceholder);
    });
  });

  describe('Configuration Variations', () => {
    it('should handle multiple tool configurations', () => {
      const tools = [
        {
          name: 'tool1',
          description: 'First tool',
          schema: z.string(),
        },
        {
          name: 'tool2',
          description: 'Second tool',
          schema: z.number(),
        },
        {
          name: 'tool3',
          description: 'Third tool',
          schema: z.boolean(),
        },
      ];

      const configs = [
        { ui: { description: 'Enhanced first tool' } },
        { ui: { description: 'Enhanced second tool' } },
        { ui: { description: 'Enhanced third tool' } },
      ];

      const wrappedTools = tools.map((tool, index) => 
        wrapExternalToolWithRenderConfig(tool, configs[index])
      );

      expect(wrappedTools).toHaveLength(3);
      expect(wrappedTools[0].name).toBe('tool1');
      expect(wrappedTools[1].name).toBe('tool2');
      expect(wrappedTools[2].name).toBe('tool3');
      expect(wrappedTools[0].description).toBe('Enhanced first tool');
      expect(wrappedTools[1].description).toBe('Enhanced second tool');
      expect(wrappedTools[2].description).toBe('Enhanced third tool');
    });

    it('should handle nested configurations', () => {
      const tool = {
        name: 'nested-config-tool',
        description: 'Nested configuration tool',
        schema: z.object({
          level1: z.object({
            level2: z.object({
              value: z.string(),
            }),
          }),
        }),
      };

      const config = {
        ui: { description: 'Tool with nested configurations' },
        fieldConfigs: {
          'level1.level2.value': renderConfigs.text('Nested Value'),
        },
      };

      const wrapper = wrapExternalToolWithRenderConfig(tool, config);

      expect(wrapper.description).toBe('Tool with nested configurations');
    });
  });

  describe('Performance and Memory', () => {
    it('should handle large numbers of render configs efficiently', () => {
      const start = performance.now();
      
      const configs = Array.from({ length: 1000 }, (_, i) => 
        renderConfigs.text(`Field ${i}`, `Placeholder ${i}`, `Help ${i}`)
      );
      
      const end = performance.now();
      
      expect(configs).toHaveLength(1000);
      expect(end - start).toBeLessThan(100);
    });

    it('should handle large tool wrapping efficiently', () => {
      const start = performance.now();
      
      const largeSchema = z.object(
        Object.fromEntries(
          Array.from({ length: 100 }, (_, i) => [`field${i}`, z.string()])
        )
      );
      
      const tool = {
        name: 'large-tool',
        description: 'Large schema tool',
        schema: largeSchema,
      };
      
      const config = {
        ui: { description: 'Large tool with many fields' },
        fieldConfigs: Object.fromEntries(
          Array.from({ length: 100 }, (_, i) => 
            [`field${i}`, renderConfigs.text(`Field ${i}`)]
          )
        ),
      };
      
      const wrapper = wrapExternalToolWithRenderConfig(tool, config);
      
      const end = performance.now();
      
      expect(wrapper.name).toBe('large-tool');
      expect(end - start).toBeLessThan(50);
    });
  });
});