import { ResponseFormatter } from '../../src/utils/response-formatter';

describe('ResponseFormatter', () => {
  describe('formatResponse', () => {
    it('should format string output directly', () => {
      const result = ResponseFormatter.formatResponse('Simple string output');

      expect(result).toBe('Simple string output');
    });

    it('should format object with output property', () => {
      const output = { output: 'Response message' };
      const result = ResponseFormatter.formatResponse(JSON.stringify(output));

      expect(result).toBe('Response message');
    });

    it('should format object with message property', () => {
      const output = { message: 'Status message' };
      const result = ResponseFormatter.formatResponse(JSON.stringify(output));

      expect(result).toBe('Status message');
    });

    it('should format object with result property', () => {
      const output = { result: 'Operation result' };
      const result = ResponseFormatter.formatResponse(JSON.stringify(output));

      expect(result).toBe('Operation result');
    });

    it('should prefer output over message when both present', () => {
      const output = {
        output: 'Primary output',
        message: 'Secondary message',
      };
      const result = ResponseFormatter.formatResponse(JSON.stringify(output));

      expect(result).toBe('Primary output');
    });

    it('should prefer output over result when both present', () => {
      const output = {
        output: 'Primary output',
        result: 'Secondary result',
      };
      const result = ResponseFormatter.formatResponse(JSON.stringify(output));

      expect(result).toBe('Primary output');
    });

    it('should prefer message over result when both present', () => {
      const output = {
        message: 'Primary message',
        result: 'Secondary result',
      };
      const result = ResponseFormatter.formatResponse(JSON.stringify(output));

      expect(result).toBe('Primary message');
    });

    it('should stringify object without special properties', () => {
      const output = {
        data: 'test data',
        count: 42,
        nested: { value: true },
      };
      const result = ResponseFormatter.formatResponse(JSON.stringify(output));

      expect(result).toBe(
        '{"data":"test data","count":42,"nested":{"value":true}}'
      );
    });

    it('should handle null input', () => {
      const result = ResponseFormatter.formatResponse(JSON.stringify(null));

      expect(result).toBe('null');
    });

    it('should handle undefined input', () => {
      const result = ResponseFormatter.formatResponse(JSON.stringify(undefined));

      expect(result).toBe('undefined');
    });

    it('should handle number input', () => {
      const result = ResponseFormatter.formatResponse(JSON.stringify(42));

      expect(result).toBe('42');
    });

    it('should handle boolean input', () => {
      expect(ResponseFormatter.formatResponse(JSON.stringify(true))).toBe('true');
      expect(ResponseFormatter.formatResponse(JSON.stringify(false))).toBe('false');
    });

      const result = ResponseFormatter.formatResponse(JSON.stringify([1, 2, 3]));

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
      const result = ResponseFormatter.formatResponse(JSON.stringify(output));

      expect(result).toBe('{"data":"nested data","count":5}');
    });

    it('should handle object with null output property', () => {
      const output = { output: null };
      const result = ResponseFormatter.formatResponse(JSON.stringify(output));

      expect(result).toBe('null');
    });

    it('should handle object with empty string output', () => {
      const output = { output: '' };
      const result = ResponseFormatter.formatResponse(JSON.stringify(output));

      expect(result).toBe('');
    });

    it('should handle circular reference gracefully', () => {
      const output: any = { data: 'test' };
      output.circular = output;

      const result = ResponseFormatter.formatResponse(output);

      expect(typeof result).toBe('string');
      expect(result).toContain('test');
    });
  });


    it('should validate correct JSON array string', () => {

    });

    it('should validate JSON with nested objects', () => {
      const jsonString = '{"outer": {"inner": {"value": 42}}}';

    });

    it('should reject invalid JSON string', () => {

    });

    it('should reject malformed JSON', () => {

    });

    it('should reject incomplete JSON', () => {

    });

    it('should reject non-string input', () => {
    });

    it('should reject empty string', () => {

    });

    it('should validate string with whitespace', () => {

    });

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
