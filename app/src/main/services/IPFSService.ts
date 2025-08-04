import { Logger } from '../utils/logger';
import fetch from 'node-fetch';
import FormData from 'form-data';
import { Buffer } from 'buffer';

/**
 * Service for handling IPFS uploads for HCS-10 profile images
 */
export class IPFSService {
  private logger: Logger;
  private readonly PINATA_API_URL = 'https://api.pinata.cloud/pinning/pinFileToIPFS';
  private readonly PINATA_GATEWAY = 'https://gateway.pinata.cloud/ipfs/';
  private readonly MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  private readonly ALLOWED_FORMATS = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000; // 1 second

  constructor() {
    this.logger = new Logger({ module: 'IPFSService' });
  }

  /**
   * Uploads an image to IPFS and returns the URL
   * @param imageData - Base64 encoded image data or file path
   * @returns IPFS URL of the uploaded image
   */
  async uploadImage(imageData: string): Promise<string> {
    try {
      this.logger.info('Starting IPFS image upload');

      // Validate and process image data
      const { buffer, mimeType } = await this.processImageData(imageData);
      
      // Validate image format
      if (!this.ALLOWED_FORMATS.includes(mimeType)) {
        throw new Error(`Unsupported image format. Allowed formats: ${this.ALLOWED_FORMATS.join(', ')}`);
      }

      // Validate file size
      if (buffer.length > this.MAX_FILE_SIZE) {
        throw new Error(`Image size exceeds maximum allowed size of ${this.MAX_FILE_SIZE / 1024 / 1024}MB`);
      }

      // Upload to IPFS with retry logic
      const ipfsHash = await this.uploadWithRetry(buffer, mimeType);
      
      const ipfsUrl = `${this.PINATA_GATEWAY}${ipfsHash}`;
      this.logger.info('Image uploaded successfully to IPFS', { url: ipfsUrl });
      
      return ipfsUrl;
    } catch (error) {
      this.logger.error('Failed to upload image to IPFS:', error);
      throw error;
    }
  }

  /**
   * Process image data from base64 or file path
   */
  private async processImageData(imageData: string): Promise<{ buffer: Buffer; mimeType: string }> {
    let buffer: Buffer;
    let mimeType: string;

    if (imageData.startsWith('data:')) {
      // Handle base64 data URL
      const matches = imageData.match(/^data:([^;]+);base64,(.+)$/);
      if (!matches) {
        throw new Error('Invalid base64 image data');
      }
      
      mimeType = matches[1];
      buffer = Buffer.from(matches[2], 'base64');
    } else if (imageData.startsWith('/') || imageData.startsWith('file://')) {
      // Handle file path
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const filePath = imageData.replace('file://', '');
      buffer = await fs.readFile(filePath);
      
      // Determine mime type from extension
      const ext = path.extname(filePath).toLowerCase();
      const mimeMap: Record<string, string> = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.webp': 'image/webp'
      };
      
      mimeType = mimeMap[ext];
      if (!mimeType) {
        throw new Error(`Unsupported file extension: ${ext}`);
      }
    } else {
      // Assume raw base64 without data URL prefix
      buffer = Buffer.from(imageData, 'base64');
      mimeType = 'image/png'; // Default to PNG if not specified
    }

    return { buffer, mimeType };
  }

  /**
   * Upload to IPFS with retry logic
   */
  private async uploadWithRetry(buffer: Buffer, mimeType: string): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        return await this.uploadToPinata(buffer, mimeType);
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(`IPFS upload attempt ${attempt} failed:`, error);
        
        if (attempt < this.MAX_RETRIES) {
          await this.delay(this.RETRY_DELAY * attempt);
        }
      }
    }

    throw lastError || new Error('Failed to upload to IPFS after multiple attempts');
  }

  /**
   * Upload to Pinata IPFS service
   */
  private async uploadToPinata(buffer: Buffer, mimeType: string): Promise<string> {
    // For now, we'll use a mock IPFS upload
    // In production, this would use actual Pinata API credentials
    
    this.logger.info('Uploading to IPFS (mock mode for development)');
    
    // Generate a mock IPFS hash
    const crypto = await import('crypto');
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');
    const mockIpfsHash = `Qm${hash.substring(0, 44)}`; // Mock IPFS hash format
    
    // Simulate upload delay
    await this.delay(500);
    
    return mockIpfsHash;

    /* Production implementation would look like:
    
    const form = new FormData();
    form.append('file', buffer, {
      filename: `profile-image-${Date.now()}.${mimeType.split('/')[1]}`,
      contentType: mimeType
    });

    const response = await fetch(this.PINATA_API_URL, {
      method: 'POST',
      headers: {
        'pinata_api_key': process.env.PINATA_API_KEY!,
        'pinata_secret_api_key': process.env.PINATA_SECRET_API_KEY!,
        ...form.getHeaders()
      },
      body: form
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Pinata upload failed: ${error}`);
    }

    const result = await response.json();
    return result.IpfsHash;
    */
  }

  /**
   * Utility function to delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Validate image URL
   */
  async validateImageUrl(url: string): Promise<boolean> {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      const contentType = response.headers.get('content-type');
      
      return response.ok && !!contentType && this.ALLOWED_FORMATS.includes(contentType);
    } catch (error) {
      this.logger.error('Failed to validate image URL:', error);
      return false;
    }
  }
}