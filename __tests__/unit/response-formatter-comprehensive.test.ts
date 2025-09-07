import { ResponseFormatter } from '../../src/utils/response-formatter';

describe('ResponseFormatter', () => {
  describe('formatOutput', () => {
    it('should format string output directly', () => {
      const result = ResponseFormatter.formatOutput('Simple string output');

      expect(result).toBe('Simple string output');
    });

    it('should format object with output property', () => {
      const output = { output: 'Response message' };
      const result = ResponseFormatter.formatOutput(output);

      expect(result).toBe('Response message');
    });

    it('should format object with message property', () => {
      const output = { message: 'Status message' };
      const result = ResponseFormatter.formatOutput(output);

      expect(result).toBe('Status message');
    });

    it('should format object with result property', () => {
      const output = { result: 'Operation result' };
      const result = ResponseFormatter.formatOutput(output);

      expect(result).toBe('Operation result');
    });

    it('should prefer output over message when both present', () => {
      const output = {
        output: 'Primary output',
        message: 'Secondary message',
      };
      const result = ResponseFormatter.formatOutput(output);

      expect(result).toBe('Primary output');
    });

    it('should prefer output over result when both present', () => {
      const output = {
        output: 'Primary output',
        result: 'Secondary result',
      };
      const result = ResponseFormatter.formatOutput(output);

      expect(result).toBe('Primary output');
    });

    it('should prefer message over result when both present', () => {
      const output = {
        message: 'Primary message',
        result: 'Secondary result',
      };
      const result = ResponseFormatter.formatOutput(output);

      expect(result).toBe('Primary message');
    });

    it('should stringify object without special properties', () => {
      const output = {
        data: 'test data',
        count: 42,
        nested: { value: true },
      };
      const result = ResponseFormatter.formatOutput(output);

      expect(result).toBe(
        '{"data":"test data","count":42,"nested":{"value":true}}'
      );
    });

    it('should handle null input', () => {
      const result = ResponseFormatter.formatOutput(null);

      expect(result).toBe('null');
    });

    it('should handle undefined input', () => {
      const result = ResponseFormatter.formatOutput(undefined);

      expect(result).toBe('undefined');
    });

    it('should handle number input', () => {
      const result = ResponseFormatter.formatOutput(42);

      expect(result).toBe('42');
    });

    it('should handle boolean input', () => {
      expect(ResponseFormatter.formatOutput(true)).toBe('true');
      expect(ResponseFormatter.formatOutput(false)).toBe('false');
    });

    it('should handle array input', () => {
      const result = ResponseFormatter.formatOutput([1, 2, 3]);

      expect(result).toBe('[1,2,3]');
    });

    it('should handle nested object with output property', () => {
      const output = {
        status: 'success',
        output: {
          data: 'nested data',
          count: 5,
        },
      };
      const result = ResponseFormatter.formatOutput(output);

      expect(result).toBe('{"data":"nested data","count":5}');
    });

    it('should handle object with null output property', () => {
      const output = { output: null };
      const result = ResponseFormatter.formatOutput(output);

      expect(result).toBe('null');
    });

    it('should handle object with empty string output', () => {
      const output = { output: '' };
      const result = ResponseFormatter.formatOutput(output);

      expect(result).toBe('');
    });

    it('should handle circular reference gracefully', () => {
      const output: any = { data: 'test' };
      output.circular = output;

      const result = ResponseFormatter.formatOutput(output);

      expect(typeof result).toBe('string');
      expect(result).toContain('test');
    });
  });

  describe('extractTransactionId', () => {
    it('should extract transaction ID from object property', () => {
      const response = { transactionId: '0.0.123@123456789' };
      const result = ResponseFormatter.extractTransactionId(response);

      expect(result).toBe('0.0.123@123456789');
    });

    it('should extract transaction ID from nested object', () => {
      const response = {
        data: {
          transactionId: '0.0.456@987654321',
        },
      };
      const result = ResponseFormatter.extractTransactionId(response);

      expect(result).toBe('0.0.456@987654321');
    });

    it('should extract transaction ID from string with pattern', () => {
      const response = 'Transaction submitted with ID: 0.0.789@123123123';
      const result = ResponseFormatter.extractTransactionId(response);

      expect(result).toBe('0.0.789@123123123');
    });

    it('should extract transaction ID from formatted string', () => {
      const response = 'Transaction ID: 0.0.111@555555555 was successful';
      const result = ResponseFormatter.extractTransactionId(response);

      expect(result).toBe('0.0.111@555555555');
    });

    it('should return null for no transaction ID found', () => {
      const response = { status: 'success', data: 'test' };
      const result = ResponseFormatter.extractTransactionId(response);

      expect(result).toBeNull();
    });

    it('should return null for null input', () => {
      const result = ResponseFormatter.extractTransactionId(null);

      expect(result).toBeNull();
    });

    it('should return null for undefined input', () => {
      const result = ResponseFormatter.extractTransactionId(undefined);

      expect(result).toBeNull();
    });

    it('should return null for string without transaction ID pattern', () => {
      const response = 'This is just a regular message without transaction ID';
      const result = ResponseFormatter.extractTransactionId(response);

      expect(result).toBeNull();
    });

    it('should handle array input', () => {
      const response = ['0.0.123@123456789'];
      const result = ResponseFormatter.extractTransactionId(response);

      expect(result).toBeNull();
    });

    it('should extract from complex nested structure', () => {
      const response = {
        status: 'success',
        results: {
          transactions: [
            { id: 'first' },
            { transactionId: '0.0.999@111111111' },
          ],
        },
      };
      const result = ResponseFormatter.extractTransactionId(response);

      expect(result).toBe('0.0.999@111111111');
    });
  });

  describe('isValidJson', () => {
    it('should validate correct JSON string', () => {
      const result = ResponseFormatter.isValidJson('{"key": "value"}');

      expect(result).toBe(true);
    });

    it('should validate correct JSON array string', () => {
      const result = ResponseFormatter.isValidJson('[1, 2, 3]');

      expect(result).toBe(true);
    });

    it('should validate JSON with nested objects', () => {
      const jsonString = '{"outer": {"inner": {"value": 42}}}';
      const result = ResponseFormatter.isValidJson(jsonString);

      expect(result).toBe(true);
    });

    it('should reject invalid JSON string', () => {
      const result = ResponseFormatter.isValidJson('{key: value}');

      expect(result).toBe(false);
    });

    it('should reject malformed JSON', () => {
      const result = ResponseFormatter.isValidJson('{"key": value}');

      expect(result).toBe(false);
    });

    it('should reject incomplete JSON', () => {
      const result = ResponseFormatter.isValidJson('{"key": ');

      expect(result).toBe(false);
    });

    it('should reject non-string input', () => {
      expect(ResponseFormatter.isValidJson(null as any)).toBe(false);
      expect(ResponseFormatter.isValidJson(undefined as any)).toBe(false);
      expect(ResponseFormatter.isValidJson(42 as any)).toBe(false);
      expect(ResponseFormatter.isValidJson({} as any)).toBe(false);
    });

    it('should reject empty string', () => {
      const result = ResponseFormatter.isValidJson('');

      expect(result).toBe(false);
    });

    it('should validate string with whitespace', () => {
      const result = ResponseFormatter.isValidJson('  {"key": "value"}  ');

      expect(result).toBe(true);
    });
  });

  describe('formatError', () => {
    it('should format Error object', () => {
      const error = new Error('Test error message');
      const result = ResponseFormatter.formatError(error);

      expect(result).toBe('Test error message');
    });

    it('should format string error', () => {
      const result = ResponseFormatter.formatError('String error message');

      expect(result).toBe('String error message');
    });

    it('should format object with message property', () => {
      const error = { message: 'Object error message' };
      const result = ResponseFormatter.formatError(error);

      expect(result).toBe('Object error message');
    });

    it('should format object with error property', () => {
      const error = { error: 'Error property message' };
      const result = ResponseFormatter.formatError(error);

      expect(result).toBe('Error property message');
    });

    it('should stringify object without message/error properties', () => {
      const error = { code: 500, details: 'Server error' };
      const result = ResponseFormatter.formatError(error);

      expect(result).toBe('{"code":500,"details":"Server error"}');
    });

    it('should handle null error', () => {
      const result = ResponseFormatter.formatError(null);

      expect(result).toBe('Unknown error');
    });

    it('should handle undefined error', () => {
      const result = ResponseFormatter.formatError(undefined);

      expect(result).toBe('Unknown error');
    });

    it('should prefer message over error property', () => {
      const error = {
        message: 'Primary message',
        error: 'Secondary error',
      };
      const result = ResponseFormatter.formatError(error);

      expect(result).toBe('Primary message');
    });

    it('should handle nested error objects', () => {
      const error = {
        details: {
          message: 'Nested error message',
        },
      };
      const result = ResponseFormatter.formatError(error);

      expect(result).toBe('{"details":{"message":"Nested error message"}}');
    });
  });
});
