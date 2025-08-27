import { FIELD_PRIORITIES, FORM_FIELD_TYPES } from '../../../src/constants/form-priorities';
import { ERROR_MESSAGES, STATUS_MESSAGES } from '../../../src/constants/messages';
import { ENTITY_PATTERNS, ENTITY_TYPES } from '../../../src/constants/entity-references';
import { 
  TEST_ACCOUNT_IDS, 
  TEST_NETWORK_CONFIGS, 
  TEST_MESSAGES, 
  TEST_TOOL_NAMES, 
  TEST_KEYS, 
  TEST_ERRORS, 
  MOCK_FORM_DATA 
} from '../../../src/constants/test-constants';
import { TEST_PRIORITY_CONSTANTS, TEST_DESCRIPTIONS } from '../../test-constants';
import { EntityFormat } from '../../../src/services/formatters/types';
import * as allConstants from '../../../src/constants';

describe('Constants', () => {
  describe('FIELD_PRIORITIES', () => {
    it('should have all required priority levels', () => {
      expect(FIELD_PRIORITIES.ESSENTIAL).toBe(TEST_PRIORITY_CONSTANTS.ESSENTIAL);
      expect(FIELD_PRIORITIES.COMMON).toBe('common');
      expect(FIELD_PRIORITIES.ADVANCED).toBe('advanced');
      expect(FIELD_PRIORITIES.EXPERT).toBe('expert');
    });

    it(TEST_DESCRIPTIONS.READONLY_COMPILE_TIME, () => {
      const priorities = FIELD_PRIORITIES;
      expect(Object.keys(priorities)).toHaveLength(4);
      expect(priorities.ESSENTIAL).toBe(TEST_PRIORITY_CONSTANTS.ESSENTIAL);
    });
  });

  describe('FORM_FIELD_TYPES', () => {
    it('should have all required field types', () => {
      expect(FORM_FIELD_TYPES.TEXT).toBe('text');
      expect(FORM_FIELD_TYPES.NUMBER).toBe('number');
      expect(FORM_FIELD_TYPES.SELECT).toBe('select');
      expect(FORM_FIELD_TYPES.CHECKBOX).toBe('checkbox');
      expect(FORM_FIELD_TYPES.TEXTAREA).toBe('textarea');
      expect(FORM_FIELD_TYPES.FILE).toBe('file');
      expect(FORM_FIELD_TYPES.ARRAY).toBe('array');
      expect(FORM_FIELD_TYPES.OBJECT).toBe('object');
      expect(FORM_FIELD_TYPES.CURRENCY).toBe('currency');
      expect(FORM_FIELD_TYPES.PERCENTAGE).toBe('percentage');
    });

    it(TEST_DESCRIPTIONS.READONLY_COMPILE_TIME, () => {
      const types = FORM_FIELD_TYPES;
      expect(Object.keys(types)).toHaveLength(10);
      expect(types.TEXT).toBe('text');
    });
  });

  describe('ERROR_MESSAGES', () => {
    it('should have all required error messages', () => {
      expect(ERROR_MESSAGES.TOO_MANY_REQUESTS).toBe('Too many requests. Please wait a moment and try again.');
      expect(ERROR_MESSAGES.RATE_LIMITED).toBe("I'm receiving too many requests right now. Please wait a moment and try again.");
      expect(ERROR_MESSAGES.SYSTEM_ERROR).toBe(TEST_DESCRIPTIONS.SYSTEM_ERROR_OCCURRED);
      expect(ERROR_MESSAGES.INVALID_INPUT).toBe('Invalid input provided');
      expect(ERROR_MESSAGES.NETWORK_ERROR).toBe('Network error occurred');
    });

    it(TEST_DESCRIPTIONS.READONLY_COMPILE_TIME, () => {
      const messages = ERROR_MESSAGES;
      expect(Object.keys(messages)).toHaveLength(5);
      expect(messages.SYSTEM_ERROR).toBe(TEST_DESCRIPTIONS.SYSTEM_ERROR_OCCURRED);
    });
  });

  describe('STATUS_MESSAGES', () => {
    it('should have all required status messages', () => {
      expect(STATUS_MESSAGES.OPERATION_SUCCESSFUL).toBe('Operation completed successfully');
      expect(STATUS_MESSAGES.PROCESSING).toBe('Processing your request...');
      expect(STATUS_MESSAGES.READY).toBe('Ready to process requests');
      expect(STATUS_MESSAGES.INITIALIZING).toBe('Initializing...');
    });

    it(TEST_DESCRIPTIONS.READONLY_COMPILE_TIME, () => {
      const messages = STATUS_MESSAGES;
      expect(Object.keys(messages)).toHaveLength(4);
      expect(messages.READY).toBe('Ready to process requests');
    });
  });

  describe('ENTITY_PATTERNS', () => {
    it('should have all required entity patterns', () => {
      expect(ENTITY_PATTERNS.TOPIC_REFERENCE).toBe('the topic');
      expect(ENTITY_PATTERNS.TOKEN_REFERENCE).toBe('the token');
      expect(ENTITY_PATTERNS.ACCOUNT_REFERENCE).toBe('the account');
      expect(ENTITY_PATTERNS.TRANSACTION_REFERENCE).toBe('the transaction');
      expect(ENTITY_PATTERNS.CONTRACT_REFERENCE).toBe('the contract');
    });

    it(TEST_DESCRIPTIONS.READONLY_COMPILE_TIME, () => {
      const patterns = ENTITY_PATTERNS;
      expect(Object.keys(patterns)).toHaveLength(5);
      expect(patterns.TOPIC_REFERENCE).toBe('the topic');
    });
  });

  describe('ENTITY_TYPES', () => {
    it('should have all required entity types', () => {
      expect(ENTITY_TYPES.TOPIC).toBe(EntityFormat.TOPIC_ID);
      expect(ENTITY_TYPES.TOKEN).toBe(EntityFormat.TOKEN_ID);
      expect(ENTITY_TYPES.ACCOUNT).toBe(EntityFormat.ACCOUNT_ID);
      expect(ENTITY_TYPES.TRANSACTION).toBe('transaction');
      expect(ENTITY_TYPES.CONTRACT).toBe(EntityFormat.CONTRACT_ID);
    });

    it(TEST_DESCRIPTIONS.READONLY_COMPILE_TIME, () => {
      const types = ENTITY_TYPES;
      expect(Object.keys(types)).toHaveLength(5);
      expect(types.TOPIC).toBe(EntityFormat.TOPIC_ID);
    });

    it('should map to correct EntityFormat values', () => {
      expect(typeof EntityFormat.TOPIC_ID).toBe('string');
      expect(typeof EntityFormat.TOKEN_ID).toBe('string');
      expect(typeof EntityFormat.ACCOUNT_ID).toBe('string');
      expect(typeof EntityFormat.CONTRACT_ID).toBe('string');
    });
  });

  describe('TEST_ACCOUNT_IDS', () => {
    it('should have all required test account IDs', () => {
      expect(TEST_ACCOUNT_IDS.OPERATOR).toBe('0.0.12345');
      expect(TEST_ACCOUNT_IDS.TARGET).toBe('0.0.67890');
      expect(TEST_ACCOUNT_IDS.SENDER).toBe('0.0.800');
      expect(TEST_ACCOUNT_IDS.RECEIVER).toBe('0.0.801');
    });

    it(TEST_DESCRIPTIONS.READONLY_COMPILE_TIME, () => {
      const accounts = TEST_ACCOUNT_IDS;
      expect(Object.keys(accounts)).toHaveLength(4);
      expect(accounts.OPERATOR).toBe('0.0.12345');
    });
  });

  describe('TEST_NETWORK_CONFIGS', () => {
    it('should have all required network configs', () => {
      expect(TEST_NETWORK_CONFIGS.TESTNET).toBe('testnet');
      expect(TEST_NETWORK_CONFIGS.MAINNET).toBe('mainnet');
      expect(TEST_NETWORK_CONFIGS.PREVIEWNET).toBe('previewnet');
    });

    it(TEST_DESCRIPTIONS.READONLY_COMPILE_TIME, () => {
      const configs = TEST_NETWORK_CONFIGS;
      expect(Object.keys(configs)).toHaveLength(3);
      expect(configs.TESTNET).toBe('testnet');
    });
  });

  describe('TEST_MESSAGES', () => {
    it('should have all required test messages', () => {
      expect(TEST_MESSAGES.SIMPLE_QUERY).toBe('test message');
      expect(TEST_MESSAGES.AGENT_NOT_INITIALIZED).toBe('Agent not initialized. Call boot() first.');
      expect(TEST_MESSAGES.PROCESSING_ERROR).toBe('Error processing message');
      expect(TEST_MESSAGES.TEST_RESPONSE).toBe('Test response');
    });

    it(TEST_DESCRIPTIONS.READONLY_COMPILE_TIME, () => {
      const messages = TEST_MESSAGES;
      expect(Object.keys(messages)).toHaveLength(4);
      expect(messages.SIMPLE_QUERY).toBe('test message');
    });
  });

  describe('TEST_TOOL_NAMES', () => {
    it('should have all required test tool names', () => {
      expect(TEST_TOOL_NAMES.MOCK_TOOL).toBe('mock-tool');
      expect(TEST_TOOL_NAMES.HEDERA_GET_ACCOUNT).toBe('hedera_get_account_info');
      expect(TEST_TOOL_NAMES.HEDERA_TRANSFER).toBe('hedera-account-transfer-hbar');
      expect(TEST_TOOL_NAMES.INSCRIBE_HASHINAL).toBe('inscribeHashinal');
    });

    it(TEST_DESCRIPTIONS.READONLY_COMPILE_TIME, () => {
      const tools = TEST_TOOL_NAMES;
      expect(Object.keys(tools)).toHaveLength(4);
      expect(tools.MOCK_TOOL).toBe('mock-tool');
    });
  });

  describe('TEST_KEYS', () => {
    it('should have all required test keys', () => {
      expect(TEST_KEYS.OPENAI_API_KEY).toBe('test-openai-key');
      expect(TEST_KEYS.PRIVATE_KEY).toBe('mock-private-key');
      expect(TEST_KEYS.OPERATOR_KEY).toBe('test-operator-key');
    });

    it(TEST_DESCRIPTIONS.READONLY_COMPILE_TIME, () => {
      const keys = TEST_KEYS;
      expect(Object.keys(keys)).toHaveLength(3);
      expect(keys.OPENAI_API_KEY).toBe('test-openai-key');
    });
  });

  describe('TEST_ERRORS', () => {
    it('should have all required test errors', () => {
      expect(TEST_ERRORS.INITIALIZATION_ERROR).toBe('Initialization error');
      expect(TEST_ERRORS.NETWORK_ERROR).toBe('Network error');
      expect(TEST_ERRORS.VALIDATION_ERROR).toBe('Validation error');
    });

    it(TEST_DESCRIPTIONS.READONLY_COMPILE_TIME, () => {
      const errors = TEST_ERRORS;
      expect(Object.keys(errors)).toHaveLength(3);
      expect(errors.INITIALIZATION_ERROR).toBe('Initialization error');
    });
  });

  describe('MOCK_FORM_DATA', () => {
    it('should have all required mock form data', () => {
      expect(MOCK_FORM_DATA.FORM_ID).toBe('mock-form-id');
      expect(MOCK_FORM_DATA.TOOL_NAME).toBe('mock-tool');
      expect(MOCK_FORM_DATA.FIELD_NAME).toBe('test-field');
      expect(MOCK_FORM_DATA.FIELD_TYPE).toBe('text');
    });

    it(TEST_DESCRIPTIONS.READONLY_COMPILE_TIME, () => {
      const data = MOCK_FORM_DATA;
      expect(Object.keys(data)).toHaveLength(4);
      expect(data.FORM_ID).toBe('mock-form-id');
    });
  });

  describe('Index exports', () => {
    it('should export all constants from index', () => {
      expect(allConstants.ERROR_MESSAGES).toBeDefined();
      expect(allConstants.STATUS_MESSAGES).toBeDefined();
      expect(allConstants.ENTITY_PATTERNS).toBeDefined();
      expect(allConstants.ENTITY_TYPES).toBeDefined();
      expect(allConstants.FIELD_PRIORITIES).toBeDefined();
      expect(allConstants.FORM_FIELD_TYPES).toBeDefined();
      expect(allConstants.TEST_ACCOUNT_IDS).toBeDefined();
      expect(allConstants.TEST_NETWORK_CONFIGS).toBeDefined();
      expect(allConstants.TEST_MESSAGES).toBeDefined();
      expect(allConstants.TEST_TOOL_NAMES).toBeDefined();
      expect(allConstants.TEST_KEYS).toBeDefined();
      expect(allConstants.TEST_ERRORS).toBeDefined();
      expect(allConstants.MOCK_FORM_DATA).toBeDefined();
    });

    it('should export correct constant values from index', () => {
      expect(allConstants.ERROR_MESSAGES.SYSTEM_ERROR).toBe('System error occurred');
      expect(allConstants.ENTITY_PATTERNS.TOPIC_REFERENCE).toBe('the topic');
      expect(allConstants.FIELD_PRIORITIES.ESSENTIAL).toBe(TEST_PRIORITY_CONSTANTS.ESSENTIAL);
      expect(allConstants.TEST_ACCOUNT_IDS.OPERATOR).toBe('0.0.12345');
    });
  });
});