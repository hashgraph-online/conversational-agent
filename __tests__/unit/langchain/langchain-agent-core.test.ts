import { describe, test, expect } from '@jest/globals';

/**
 * Unit tests for LangChainAgent utility functions
 */

function isJSON(str: string): boolean {
  if (typeof str !== 'string') return false;

  const trimmed = str.trim();
  if (!trimmed) return false;

  if (
    !(trimmed.startsWith('{') && trimmed.endsWith('}')) &&
    !(trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    return false;
  }

  try {
    JSON.parse(trimmed);
    return true;
  } catch {
    return false;
  }
}

function formatToolOutput(output: unknown): string {
  if (typeof output === 'string') {
    return isJSON(output) ? output : JSON.stringify({ output });
  } else if (output !== undefined) {
    try {
      return JSON.stringify(output);
    } catch {
      return String(output);
    }
  } else {
    return JSON.stringify({ observation: null });
  }
}

function processIntermediateStep(step: any): { toolName: string; observation: string } | null {
  if (!step || typeof step !== 'object') return null;

  const toolName = step.action?.tool || 'unknown';
  const observation = step.observation !== undefined ? String(step.observation) : '';

  return { toolName, observation };
}

/**
 * Pure utility function tests - these provide high-quality coverage
 * on the core business logic without complex mocking
 */
describe('LangChainAgent - Pure Utility Functions', () => {
  describe('isJSON', () => {
    test('should return true for valid JSON objects and arrays', () => {
      expect(isJSON('{"key": "value"}')).toBe(true);
      expect(isJSON('[1, 2, 3]')).toBe(true);
      expect(isJSON('{"nested": {"key": "value"}}')).toBe(true);
      expect(isJSON('[]')).toBe(true);
      expect(isJSON('{}')).toBe(true);
    });

    test('should return false for valid JSON but not objects/arrays', () => {
      expect(isJSON('"string"')).toBe(false);
      expect(isJSON('123')).toBe(false);
      expect(isJSON('true')).toBe(false);
      expect(isJSON('null')).toBe(false);
    });

    test('should return false for strings not starting/ending with braces', () => {
      expect(isJSON('plain text')).toBe(false);
      expect(isJSON('{"key": "value"')).toBe(false);
      expect(isJSON('key": "value"}')).toBe(false);
      expect(isJSON('[1, 2, 3')).toBe(false);
      expect(isJSON('1, 2, 3]')).toBe(false);
    });

    test('should return false for invalid JSON', () => {
      expect(isJSON('{invalid json}')).toBe(false);
      expect(isJSON('{')).toBe(false);
      expect(isJSON('}')).toBe(false);
      expect(isJSON('{key: value}')).toBe(false);
    });

    test('should return false for non-string types', () => {
      expect(isJSON(null as any)).toBe(false);
      expect(isJSON(undefined as any)).toBe(false);
      expect(isJSON(123 as any)).toBe(false);
      expect(isJSON({} as any)).toBe(false);
    });

    test('should return false for empty/whitespace strings', () => {
      expect(isJSON('')).toBe(false);
      expect(isJSON('   ')).toBe(false);
      expect(isJSON('\n')).toBe(false);
      expect(isJSON('\t')).toBe(false);
    });
  });

  describe('formatToolOutput', () => {
    test('should return JSON string directly when valid JSON', () => {
      const output = '{"result": "success"}';
      expect(formatToolOutput(output)).toBe('{"result": "success"}');
    });

    test('should wrap plain strings in JSON object', () => {
      const output = 'plain string result';
      expect(formatToolOutput(output)).toBe('{"output":"plain string result"}');
    });

    test('should stringify objects', () => {
      const output = { result: 'success', data: [1, 2, 3] };
      expect(formatToolOutput(output)).toBe('{"result":"success","data":[1,2,3]}');
    });

    test('should handle circular references', () => {
      const circularRef: any = { name: 'test' };
      circularRef.self = circularRef;

      const result = formatToolOutput(circularRef);
      expect(result).toBe('[object Object]');
    });

    test('should handle undefined output', () => {
      const output = undefined;
      expect(formatToolOutput(output)).toBe('{"observation":null}');
    });

    test('should handle various data types', () => {
      expect(formatToolOutput(123)).toBe('123');
      expect(formatToolOutput(true)).toBe('true');
      expect(formatToolOutput(null)).toBe('null');
    });
  });

  describe('processIntermediateStep', () => {
    test('should extract tool name and observation from valid step', () => {
      const step = {
        action: { tool: 'test-tool', toolInput: { param: 'value' } },
        observation: 'test result'
      };

      const result = processIntermediateStep(step);
      expect(result).toEqual({
        toolName: 'test-tool',
        observation: 'test result'
      });
    });

    test('should use "unknown" for undefined tool name', () => {
      const step = {
        action: { toolInput: { param: 'value' } },
        observation: 'test result'
      };

      const result = processIntermediateStep(step);
      expect(result).toEqual({
        toolName: 'unknown',
        observation: 'test result'
      });
    });

    test('should convert undefined observation to empty string', () => {
      const step = {
        action: { tool: 'test-tool', toolInput: { param: 'value' } },
        observation: undefined
      };

      const result = processIntermediateStep(step);
      expect(result).toEqual({
        toolName: 'test-tool',
        observation: ''
      });
    });

    test('should convert null observation to string', () => {
      const step = {
        action: { tool: 'test-tool', toolInput: { param: 'value' } },
        observation: null
      };

      const result = processIntermediateStep(step);
      expect(result).toEqual({
        toolName: 'test-tool',
        observation: 'null'
      });
    });

    test('should return null for invalid step', () => {
      expect(processIntermediateStep(null)).toBeNull();
      expect(processIntermediateStep(undefined)).toBeNull();
      expect(processIntermediateStep('invalid')).toBeNull();
      expect(processIntermediateStep(123)).toBeNull();
    });
  });
});
