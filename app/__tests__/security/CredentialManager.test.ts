import { CredentialManager } from '../../src/main/services/CredentialManager';
import * as keytar from 'keytar';

jest.mock('keytar');

describe('CredentialManager', () => {
  let credentialManager: CredentialManager;
  const mockKeytar = keytar as jest.Mocked<typeof keytar>;

  beforeEach(() => {
    jest.clearAllMocks();
    credentialManager = new CredentialManager('test-master-password');
  });

  describe('store', () => {
    it('should store encrypted credentials', async () => {
      const service = 'test-service';
      const account = 'test-account';
      const password = 'test-password';

      mockKeytar.setPassword.mockResolvedValue(undefined);

      const result = await credentialManager.store(service, account, password);

      expect(result).toBe(true);
      expect(mockKeytar.setPassword).toHaveBeenCalledWith(
        service,
        account,
        expect.any(String)
      );
      
      const storedValue = mockKeytar.setPassword.mock.calls[0][2];
      expect(storedValue).not.toBe(password);
      expect(storedValue.length).toBeGreaterThan(0);
    });

    it('should handle storage failure', async () => {
      const service = 'test-service';
      const account = 'test-account';
      const password = 'test-password';

      mockKeytar.setPassword.mockRejectedValue(new Error('Storage failed'));

      const result = await credentialManager.store(service, account, password);

      expect(result).toBe(false);
    });

    it('should handle empty password', async () => {
      const service = 'test-service';
      const account = 'test-account';
      const password = '';

      mockKeytar.setPassword.mockResolvedValue(undefined);

      const result = await credentialManager.store(service, account, password);

      expect(result).toBe(true);
      expect(mockKeytar.setPassword).toHaveBeenCalled();
    });

    it('should validate service and account parameters', async () => {
      await expect(credentialManager.store('', 'account', 'password')).rejects.toThrow();
      await expect(credentialManager.store('service', '', 'password')).rejects.toThrow();
    });
  });

  describe('get', () => {
    it('should retrieve and decrypt credentials', async () => {
      const service = 'test-service';
      const account = 'test-account';
      const originalPassword = 'test-password';

      const tempManager = new CredentialManager('test-master-password');
      const encryptionService = (tempManager as any).encryptionService;
      const encryptedPassword = await encryptionService.encrypt(originalPassword, 'test-master-password');

      mockKeytar.getPassword.mockResolvedValue(encryptedPassword);

      const result = await credentialManager.get(service, account);

      expect(result).toBe(originalPassword);
      expect(mockKeytar.getPassword).toHaveBeenCalledWith(service, account);
    });

    it('should return null for non-existent credentials', async () => {
      const service = 'test-service';
      const account = 'test-account';

      mockKeytar.getPassword.mockResolvedValue(null);

      const result = await credentialManager.get(service, account);

      expect(result).toBeNull();
    });

    it('should handle decryption failure gracefully', async () => {
      const service = 'test-service';
      const account = 'test-account';

      mockKeytar.getPassword.mockResolvedValue('invalid-encrypted-data');

      const result = await credentialManager.get(service, account);

      expect(result).toBeNull();
    });

    it('should validate service and account parameters', async () => {
      await expect(credentialManager.get('', 'account')).rejects.toThrow();
      await expect(credentialManager.get('service', '')).rejects.toThrow();
    });
  });

  describe('delete', () => {
    it('should delete credentials', async () => {
      const service = 'test-service';
      const account = 'test-account';

      mockKeytar.deletePassword.mockResolvedValue(true);

      const result = await credentialManager.delete(service, account);

      expect(result).toBe(true);
      expect(mockKeytar.deletePassword).toHaveBeenCalledWith(service, account);
    });

    it('should return false when deletion fails', async () => {
      const service = 'test-service';
      const account = 'test-account';

      mockKeytar.deletePassword.mockResolvedValue(false);

      const result = await credentialManager.delete(service, account);

      expect(result).toBe(false);
    });

    it('should handle deletion errors', async () => {
      const service = 'test-service';
      const account = 'test-account';

      mockKeytar.deletePassword.mockRejectedValue(new Error('Deletion failed'));

      const result = await credentialManager.delete(service, account);

      expect(result).toBe(false);
    });

    it('should validate service and account parameters', async () => {
      await expect(credentialManager.delete('', 'account')).rejects.toThrow();
      await expect(credentialManager.delete('service', '')).rejects.toThrow();
    });
  });

  describe('clear', () => {
    it('should clear all credentials for a service', async () => {
      const service = 'test-service';
      const credentials = [
        { account: 'account1', password: 'pass1' },
        { account: 'account2', password: 'pass2' },
      ];

      mockKeytar.findCredentials.mockResolvedValue(credentials);
      mockKeytar.deletePassword.mockResolvedValue(true);

      const result = await credentialManager.clear(service);

      expect(result).toBe(2);
      expect(mockKeytar.findCredentials).toHaveBeenCalledWith(service);
      expect(mockKeytar.deletePassword).toHaveBeenCalledTimes(2);
      expect(mockKeytar.deletePassword).toHaveBeenCalledWith(service, 'account1');
      expect(mockKeytar.deletePassword).toHaveBeenCalledWith(service, 'account2');
    });

    it('should handle empty service', async () => {
      mockKeytar.findCredentials.mockResolvedValue([]);

      const result = await credentialManager.clear('empty-service');

      expect(result).toBe(0);
      expect(mockKeytar.deletePassword).not.toHaveBeenCalled();
    });

    it('should count only successful deletions', async () => {
      const service = 'test-service';
      const credentials = [
        { account: 'account1', password: 'pass1' },
        { account: 'account2', password: 'pass2' },
        { account: 'account3', password: 'pass3' },
      ];

      mockKeytar.findCredentials.mockResolvedValue(credentials);
      mockKeytar.deletePassword
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      const result = await credentialManager.clear(service);

      expect(result).toBe(2);
    });

    it('should validate service parameter', async () => {
      await expect(credentialManager.clear('')).rejects.toThrow();
    });
  });

  describe('changeMasterPassword', () => {
    it('should re-encrypt all credentials with new master password', async () => {
      const service = 'test-service';
      const credentials = [
        { account: 'account1', password: 'encrypted1' },
        { account: 'account2', password: 'encrypted2' },
      ];

      const tempManager = new CredentialManager('old-password');
      const encryptionService = (tempManager as any).encryptionService;
      
      credentials[0].password = await encryptionService.encrypt('pass1', 'old-password');
      credentials[1].password = await encryptionService.encrypt('pass2', 'old-password');

      mockKeytar.findCredentials.mockResolvedValue(credentials);
      mockKeytar.getPassword
        .mockResolvedValueOnce(credentials[0].password)
        .mockResolvedValueOnce(credentials[1].password);
      mockKeytar.setPassword.mockResolvedValue(undefined);

      const result = await credentialManager.changeMasterPassword(
        'old-password',
        'new-password',
        service
      );

      expect(result).toBe(true);
      expect(mockKeytar.setPassword).toHaveBeenCalledTimes(2);
    });

    it('should return false if old password is incorrect', async () => {
      const service = 'test-service';
      const credentials = [{ account: 'account1', password: 'encrypted1' }];

      mockKeytar.findCredentials.mockResolvedValue(credentials);
      mockKeytar.getPassword.mockResolvedValue('invalid-encrypted-data');

      const result = await credentialManager.changeMasterPassword(
        'wrong-old-password',
        'new-password',
        service
      );

      expect(result).toBe(false);
    });
  });
});