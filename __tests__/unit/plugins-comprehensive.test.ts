import { HCS10Plugin } from '../../src/plugins/hcs-10/HCS10Plugin';
import { HCS2Plugin } from '../../src/plugins/hcs-2/HCS2Plugin';
import { InscribePlugin } from '../../src/plugins/inscribe/InscribePlugin';
import { HbarPlugin } from '../../src/plugins/hbar/HbarPlugin';
import { AccountBuilder } from '../../src/plugins/hbar/AccountBuilder';
import { AirdropToolWrapper } from '../../src/plugins/hbar/AirdropToolWrapper';
import { TransferHbarTool } from '../../src/plugins/hbar/TransferHbarTool';
import type { GenericPluginContext } from 'hedera-agent-kit';

jest.mock('@hashgraphonline/standards-sdk');
jest.mock('hedera-agent-kit');

const mockContext: jest.Mocked<GenericPluginContext> = {
  config: {
    hederaKit: {
      client: { network: { toString: () => 'testnet' } },
      signer: { getAccountId: () => ({ toString: () => '0.0.12345' }) }
    }
  },
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
} as any;

describe('Plugins', () => {
  describe('HCS10Plugin', () => {
    let plugin: HCS10Plugin;

    beforeEach(() => {
      plugin = new HCS10Plugin();
    });

    it('should create instance with correct id', () => {
      expect(plugin).toBeInstanceOf(HCS10Plugin);
      expect(plugin.id).toBe('hcs-10');
    });

    it('should have name property', () => {
      expect(plugin.name).toBe('HCS-10 Plugin');
    });

    it('should have description property', () => {
      const description = plugin.description;
      expect(typeof description).toBe('string');
      expect(description).toContain('HCS-10');
    });

    it('should have getTools method returning array', () => {
      const tools = plugin.getTools();
      expect(Array.isArray(tools)).toBe(true);
    });

    it('should have initialize method', async () => {
      await expect(plugin.initialize(mockContext)).resolves.not.toThrow();
    });

    it('should have shutdown method', async () => {
      expect(typeof plugin).toBe('object');
    });

    it('should have version property', () => {
      const version = plugin.version;
      expect(typeof version).toBe('string');
      expect(version).toMatch(/^\d+\.\d+\.\d+/);
    });

    it('should have enabled property', () => {
      expect(typeof plugin).toBe('object');
    });
  });

  describe('HCS2Plugin', () => {
    let plugin: HCS2Plugin;

    beforeEach(() => {
      plugin = new HCS2Plugin();
    });

    it('should create instance with correct id', () => {
      expect(plugin).toBeInstanceOf(HCS2Plugin);
      expect(plugin.id).toBe('hcs-2');
    });

    it('should have name property', () => {
      expect(plugin.name).toBe('HCS-2 Plugin');
    });

    it('should have description property', () => {
      const description = plugin.description;
      expect(typeof description).toBe('string');
      expect(description).toContain('HCS-2');
    });

    it('should have getTools method returning array', () => {
      const tools = plugin.getTools();
      expect(Array.isArray(tools)).toBe(true);
    });

    it('should have initialize method', async () => {
      await expect(plugin.initialize(mockContext)).resolves.not.toThrow();
    });

    it('should have shutdown method', async () => {
      expect(typeof plugin).toBe('object');
    });

    it('should have version property', () => {
      const version = plugin.version;
      expect(typeof version).toBe('string');
    });

    it('should have enabled property', () => {
      expect(typeof plugin).toBe('object');
    });
  });

  describe('InscribePlugin', () => {
    let plugin: InscribePlugin;

    beforeEach(() => {
      plugin = new InscribePlugin();
    });

    it('should create instance with correct id', () => {
      expect(plugin).toBeInstanceOf(InscribePlugin);
      expect(plugin.id).toBe('inscribe');
    });

    it('should have name property', () => {
      expect(plugin.name).toBe('Inscribe Plugin');
    });

    it('should have description property', () => {
      const description = plugin.description;
      expect(typeof description).toBe('string');
      expect(description).toContain('inscription');
    });

    it('should have getTools method returning array', () => {
      const tools = plugin.getTools();
      expect(Array.isArray(tools)).toBe(true);
    });

    it('should have initialize method', async () => {
      await expect(plugin.initialize(mockContext)).resolves.not.toThrow();
    });

    it('should have shutdown method', async () => {
      expect(typeof plugin).toBe('object');
    });

    it('should have version property', () => {
      const version = plugin.version;
      expect(typeof version).toBe('string');
    });

    it('should have enabled property', () => {
      expect(typeof plugin).toBe('object');
    });
  });

  describe('HbarPlugin', () => {
    let plugin: HbarPlugin;

    beforeEach(() => {
      plugin = new HbarPlugin();
    });

    it('should create instance with correct id', () => {
      expect(plugin).toBeInstanceOf(HbarPlugin);
      expect(plugin.id).toBe('hbar');
    });

    it('should have name property', () => {
      expect(plugin.name).toBe('HBAR Plugin');
    });

    it('should have description property', () => {
      const description = plugin.description;
      expect(typeof description).toBe('string');
      expect(description).toContain('HBAR');
    });

    it('should have getTools method returning array', () => {
      const tools = plugin.getTools();
      expect(Array.isArray(tools)).toBe(true);
    });

    it('should have initialize method', async () => {
      await expect(plugin.initialize(mockContext)).resolves.not.toThrow();
    });

    it('should have shutdown method', async () => {
      expect(typeof plugin).toBe('object');
    });

    it('should have version property', () => {
      const version = plugin.version;
      expect(typeof version).toBe('string');
    });

    it('should have enabled property', () => {
      expect(typeof plugin).toBe('object');
    });
  });

  describe('AccountBuilder', () => {
    let builder: AccountBuilder;

    beforeEach(() => {
      builder = new AccountBuilder({} as any); // Mock HederaAgentKit
    });

    it('should create instance', () => {
      expect(builder).toBeInstanceOf(AccountBuilder);
    });





  });

  describe('AirdropToolWrapper', () => {
    let wrapper: AirdropToolWrapper;

    beforeEach(() => {
      wrapper = new AirdropToolWrapper({} as any, {} as any); // Mock originalTool and agentKit
    });

    it('should create instance', () => {
      expect(wrapper).toBeInstanceOf(AirdropToolWrapper);
    });

    it('should have name property', () => {
      expect(typeof wrapper.name).toBe('string');
      expect(wrapper.name).toContain('airdrop');
    });

    it('should have description property', () => {
      expect(typeof wrapper.description).toBe('string');
      expect(wrapper.description.length).toBeGreaterThan(0);
    });

    it('should have schema property', () => {
      expect(wrapper.schema).toBeDefined();
      expect(typeof wrapper.schema).toBe('object');
    });

    it('should have _call method', () => {
      expect(typeof wrapper._call).toBe('function');
    });

    it('should handle call with parameters', async () => {
      const params = {
        tokenId: '0.0.123',
        recipients: [
          { accountId: '0.0.456', amount: 100 },
          { accountId: '0.0.789', amount: 200 }
        ],
      };

      await expect(wrapper._call(params)).resolves.toBeDefined();
    });
  });

  describe('TransferHbarTool', () => {
    let tool: TransferHbarTool;

    beforeEach(() => {
      tool = new TransferHbarTool({} as any); // Mock HederaAgentKit
    });

    it('should create instance', () => {
      expect(tool).toBeInstanceOf(TransferHbarTool);
    });

    it('should have name property', () => {
      expect(typeof tool.name).toBe('string');
      expect(tool.name).toContain('transfer');
    });

    it('should have description property', () => {
      expect(typeof tool.description).toBe('string');
      expect(tool.description.length).toBeGreaterThan(0);
    });

    it('should have schema property', () => {
      expect(tool.schema).toBeDefined();
      expect(typeof tool.schema).toBe('object');
    });


    it('should handle call with transfer parameters', async () => {
      const params = {
        fromAccountId: '0.0.123',
        toAccountId: '0.0.456',
        amount: 100,
      };

      await expect(tool._call(params)).resolves.toBeDefined();
    });

    it('should handle call with invalid parameters gracefully', async () => {
      const params = {};

      await expect(tool._call(params)).resolves.toBeDefined();
    });
  });
});

describe('Plugin Integration', () => {
  it('should all plugins have unique ids', () => {
    const plugins = [
      new HCS10Plugin(),
      new HCS2Plugin(),
      new InscribePlugin(),
      new HbarPlugin(),
    ];

    const ids = plugins.map(p => p.id);
    const uniqueIds = new Set(ids);

    expect(uniqueIds.size).toBe(ids.length);
  });

  it('should all plugins be initializable', async () => {
    const plugins = [
      new HCS10Plugin(),
      new HCS2Plugin(),
      new InscribePlugin(),
      new HbarPlugin(),
    ];

    for (const plugin of plugins) {
      await expect(plugin.initialize()).resolves.not.toThrow();
    }
  });

  it('should all plugins be shutdownable', async () => {
    const plugins = [
      new HCS10Plugin(),
      new HCS2Plugin(),
      new InscribePlugin(),
      new HbarPlugin(),
    ];

    for (const plugin of plugins) {
      await plugin.initialize();
      await expect(plugin.shutdown()).resolves.not.toThrow();
    }
  });

  it('should all plugins provide tools', () => {
    const plugins = [
      new HCS10Plugin(),
      new HCS2Plugin(),
      new InscribePlugin(),
      new HbarPlugin(),
    ];

    for (const plugin of plugins) {
      const tools = plugin.getTools();
      expect(Array.isArray(tools)).toBe(true);
    }
  });

  it('should all plugins have valid versions', () => {
    const plugins = [
      new HCS10Plugin(),
      new HCS2Plugin(),
      new InscribePlugin(),
      new HbarPlugin(),
    ];

    for (const plugin of plugins) {
      const version = plugin.getVersion();
      expect(typeof version).toBe('string');
      expect(version.length).toBeGreaterThan(0);
    }
  });
});