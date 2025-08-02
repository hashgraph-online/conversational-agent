import { ConfigService } from './services/ConfigService';
import { app } from 'electron';

/**
 * Test config service
 */
export async function testConfigService() {
  console.log('\n=== TESTING CONFIG PERSISTENCE ===');
  
  const configService = ConfigService.getInstance();
  
  const testConfig = {
    hedera: {
      accountId: "0.0.2659396",
      privateKey: "302e020100300506032b657004220420" + "a".repeat(64),
      network: "testnet" as const
    },
    openai: {
      apiKey: "sk-proj-" + "b".repeat(48),
      model: "gpt-4o"
    },
    anthropic: {
      apiKey: "",
      model: "claude-3-5-sonnet-20241022"
    },
    advanced: {
      theme: "light" as const,
      autoStart: false,
      logLevel: "info" as const
    },
    llmProvider: "openai" as const
  };
  
  try {
    console.log('1. Saving test config...');
    await configService.save(testConfig);
    console.log('   ✅ Config saved');
    
    console.log('\n2. Loading config back...');
    const loadedConfig = await configService.load();
    
    console.log('\n3. Verifying values:');
    const checks = {
      accountId: loadedConfig.hedera?.accountId === testConfig.hedera.accountId,
      privateKey: loadedConfig.hedera?.privateKey === testConfig.hedera.privateKey,
      apiKey: loadedConfig.openai?.apiKey === testConfig.openai.apiKey,
      network: loadedConfig.hedera?.network === testConfig.hedera.network,
      provider: loadedConfig.llmProvider === testConfig.llmProvider
    };
    
    console.log('   Account ID:', checks.accountId ? '✅' : '❌', 
      `(${loadedConfig.hedera?.accountId})`);
    console.log('   Private key:', checks.privateKey ? '✅' : '❌',
      `(length: saved=${testConfig.hedera.privateKey.length}, loaded=${loadedConfig.hedera?.privateKey?.length})`);
    console.log('   API key:', checks.apiKey ? '✅' : '❌',
      `(length: saved=${testConfig.openai.apiKey.length}, loaded=${loadedConfig.openai?.apiKey?.length})`);
    console.log('   Network:', checks.network ? '✅' : '❌',
      `(${loadedConfig.hedera?.network})`);
    console.log('   Provider:', checks.provider ? '✅' : '❌',
      `(${loadedConfig.llmProvider})`);
    
    const allPassed = Object.values(checks).every(v => v);
    console.log('\n4. Overall result:', allPassed ? '✅ PASSED' : '❌ FAILED');
    
    if (!allPassed) {
      console.log('\nDebug - loaded values:');
      console.log('  Private key: [REDACTED]');
      console.log('  API key: [REDACTED]');
    }
    
  } catch (error) {
    console.error('❌ Config service test failed:', error);
  }
  
  console.log('=== TEST COMPLETE ===\n');
}