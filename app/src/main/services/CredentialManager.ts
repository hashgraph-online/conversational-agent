import * as keytar from 'keytar';
import { EncryptionService } from './EncryptionService';
import { Logger } from '@hashgraphonline/standards-sdk';

/**
 * Manages credentials using the OS keychain with an additional encryption layer
 */
export class CredentialManager {
  private encryptionService: EncryptionService;
  private masterPassword: string;
  private logger: Logger;

  /**
   * Creates a new CredentialManager instance
   * @param masterPassword - The master password used for encrypting credentials
   */
  constructor(masterPassword: string) {
    this.encryptionService = new EncryptionService();
    this.masterPassword = masterPassword;
    this.logger = new Logger({ module: 'CredentialManager' });
  }

  /**
   * Stores a credential in the OS keychain with encryption
   * @param service - The service name
   * @param account - The account name
   * @param password - The password to store
   * @returns True if successful, false otherwise
   */
  async store(service: string, account: string, password: string): Promise<boolean> {
    if (!service || !account) {
      throw new Error('Service and account must not be empty');
    }

    try {
      const encryptedPassword = await this.encryptionService.encrypt(password, this.masterPassword);
      await keytar.setPassword(service, account, encryptedPassword);
      return true;
    } catch (error) {
      this.logger.error('Failed to store credential:', error);
      return false;
    }
  }

  /**
   * Retrieves a credential from the OS keychain and decrypts it
   * @param service - The service name
   * @param account - The account name
   * @returns The decrypted password or null if not found
   */
  async get(service: string, account: string): Promise<string | null> {
    if (!service || !account) {
      throw new Error('Service and account must not be empty');
    }

    try {
      const encryptedPassword = await keytar.getPassword(service, account);
      
      if (!encryptedPassword) {
        return null;
      }

      return await this.encryptionService.decrypt(encryptedPassword, this.masterPassword);
    } catch (error) {
      this.logger.error('Failed to retrieve credential:', error);
      return null;
    }
  }

  /**
   * Deletes a credential from the OS keychain
   * @param service - The service name
   * @param account - The account name
   * @returns True if successful, false otherwise
   */
  async delete(service: string, account: string): Promise<boolean> {
    if (!service || !account) {
      throw new Error('Service and account must not be empty');
    }

    try {
      return await keytar.deletePassword(service, account);
    } catch (error) {
      this.logger.error('Failed to delete credential:', error);
      return false;
    }
  }

  /**
   * Clears all credentials for a given service
   * @param service - The service name
   * @returns The number of credentials deleted
   */
  async clear(service: string): Promise<number> {
    if (!service) {
      throw new Error('Service must not be empty');
    }

    try {
      const credentials = await keytar.findCredentials(service);
      let deletedCount = 0;

      for (const credential of credentials) {
        const deleted = await keytar.deletePassword(service, credential.account);
        if (deleted) {
          deletedCount++;
        }
      }

      return deletedCount;
    } catch (error) {
      this.logger.error('Failed to clear credentials:', error);
      return 0;
    }
  }

  /**
   * Changes the master password and re-encrypts all credentials
   * @param oldPassword - The current master password
   * @param newPassword - The new master password
   * @param service - The service name to update credentials for
   * @returns True if successful, false otherwise
   */
  async changeMasterPassword(
    oldPassword: string,
    newPassword: string,
    service: string
  ): Promise<boolean> {
    try {
      const credentials = await keytar.findCredentials(service);
      const decryptedCredentials: Array<{ account: string; password: string }> = [];

      for (const credential of credentials) {
        try {
          const encryptedPassword = await keytar.getPassword(service, credential.account);
          if (encryptedPassword) {
            const decryptedPassword = await this.encryptionService.decrypt(
              encryptedPassword,
              oldPassword
            );
            decryptedCredentials.push({
              account: credential.account,
              password: decryptedPassword,
            });
          }
        } catch (error) {
          this.logger.error('Failed to decrypt credential with old password:', error);
          return false;
        }
      }

      this.masterPassword = newPassword;

      for (const credential of decryptedCredentials) {
        const encryptedPassword = await this.encryptionService.encrypt(
          credential.password,
          newPassword
        );
        await keytar.setPassword(service, credential.account, encryptedPassword);
      }

      return true;
    } catch (error) {
      this.logger.error('Failed to change master password:', error);
      return false;
    }
  }
}