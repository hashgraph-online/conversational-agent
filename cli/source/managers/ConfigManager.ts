import fs from 'fs';
import path from 'path';
import { Logger } from '@hashgraphonline/standards-sdk';
import {MCPServers, type MCPServerConfig} from '@hashgraphonline/conversational-agent';
import {type Config} from '../types';

export class ConfigManager {
  private static instance: ConfigManager;
  private _config: Config & {mcpServers: MCPServerConfig[]} | null = null;
  private _mcpServers: MCPServerConfig[] | null = null;
  private logger: Logger;

  private constructor() {
    this.logger = new Logger({ module: 'ConfigManager' });
  }

  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  /**
   * Get MCP config file path
   */
  private getMCPConfigPath(): string {
    const projectRoot = process.env['CONVERSATIONAL_AGENT_ROOT'] || path.resolve('./../../');
    return path.join(projectRoot, 'mcp-config.json');
  }

  /**
   * Load MCP configuration from file
   */
  private loadMCPConfig(): MCPServerConfig[] {
    if (this._mcpServers) return this._mcpServers;

    const configPath = this.getMCPConfigPath();
    try {
      if (fs.existsSync(configPath)) {
        const configContent = fs.readFileSync(configPath, 'utf-8');
        const config = JSON.parse(configContent);
        this._mcpServers = Object.values(config.mcpServers || {});
        return this._mcpServers;
      }
    } catch (err) {
      this.logger.error('Failed to load MCP config', {
        configPath,
        error: err instanceof Error ? err.message : String(err)
      });
    }

    const defaultServers = [MCPServers.filesystem(process.cwd())];
    this.saveMCPConfig(defaultServers);
    this._mcpServers = defaultServers;
    return defaultServers;
  }

  /**
   * Save MCP configuration to file
   */
  saveMCPConfig(servers: MCPServerConfig[]): void {
    const configPath = this.getMCPConfigPath();
    try {
      const mcpServers: {[key: string]: MCPServerConfig} = {};
      servers.forEach(server => {
        mcpServers[server.name] = server;
      });

      const config = {mcpServers};
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      this._mcpServers = servers;
    } catch (err) {
      this.logger.error('Failed to save MCP config', {
        configPath,
        serversCount: servers.length,
        error: err instanceof Error ? err.message : String(err)
      });
    }
  }

  /**
   * Load config from .env file
   */
  private loadConfigFromEnv(): Config {
    const projectRoot = process.env['CONVERSATIONAL_AGENT_ROOT'] || path.resolve('./../../');
    const envPath = path.join(projectRoot, '.env');

    try {
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf-8');
        const envVars: Record<string, string> = {};

        envContent.split('\n').forEach(line => {
          const trimmedLine = line.trim();
          if (trimmedLine && !trimmedLine.startsWith('#')) {
            const [key, ...valueParts] = trimmedLine.split('=');
            if (key && valueParts.length > 0) {
              envVars[key] = valueParts.join('=');
            }
          }
        });

        return {
          accountId: envVars['HEDERA_ACCOUNT_ID'] || '',
          privateKey: envVars['HEDERA_PRIVATE_KEY'] || '',
          network: (envVars['HEDERA_NETWORK'] as 'testnet' | 'mainnet') || 'testnet',
          openAIApiKey: envVars['OPENAI_API_KEY'] || '',
        };
      }
    } catch (err) {}

    return {
      accountId: '',
      privateKey: '',
      network: 'testnet',
      openAIApiKey: '',
    };
  }

  /**
   * Save config to .env file
   */
  saveConfig(configToSave: Config): void {
    const projectRoot = process.env['CONVERSATIONAL_AGENT_ROOT'] || path.resolve('./../../');
    const envPath = path.join(projectRoot, '.env');

    try {
      let envContent = '';
      if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf-8');
      }

      const updateEnvVar = (key: string, value: string) => {
        const regex = new RegExp(`^${key}=.*$`, 'gm');
        if (regex.test(envContent)) {
          envContent = envContent.replace(regex, `${key}=${value}`);
        } else {
          envContent += `${envContent ? '\n' : ''}${key}=${value}`;
        }
      };

      updateEnvVar('HEDERA_ACCOUNT_ID', configToSave.accountId);
      updateEnvVar('HEDERA_PRIVATE_KEY', configToSave.privateKey);
      updateEnvVar('HEDERA_NETWORK', configToSave.network);
      updateEnvVar('OPENAI_API_KEY', configToSave.openAIApiKey);

      fs.writeFileSync(envPath, envContent);
      this._config = null;
    } catch (err) {}
  }

  /**
   * Get complete config (cached)
   */
  getConfig(props: Partial<Config> = {}): Config & {mcpServers: MCPServerConfig[]} {
    if (!this._config) {
      const envConfig = this.loadConfigFromEnv();
      const mcpServers = this.loadMCPConfig();
      
      this._config = {
        accountId: props.accountId || envConfig.accountId,
        privateKey: props.privateKey || envConfig.privateKey,
        network: props.network || envConfig.network,
        openAIApiKey: props.openAIApiKey || envConfig.openAIApiKey,
        mcpServers,
      };
    }
    return this._config;
  }

  /**
   * Update config and save
   */
  updateConfig(updates: Partial<Config>): Config & {mcpServers: MCPServerConfig[]} {
    const current = this.getConfig();
    const updated = {...current, ...updates};
    this.saveConfig(updated);
    this._config = updated;
    return updated;
  }

  /**
   * Get MCP servers
   */
  getMCPServers(): MCPServerConfig[] {
    return this.loadMCPConfig();
  }

  /**
   * Get MCP config path for display
   */
  getMCPConfigPathForDisplay(): string {
    return this.getMCPConfigPath();
  }

  /**
   * Reset cache (for testing)
   */
  resetCache(): void {
    this._config = null;
    this._mcpServers = null;
  }
}