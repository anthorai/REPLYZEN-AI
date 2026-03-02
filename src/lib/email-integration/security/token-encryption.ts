import crypto from 'crypto';
import { TokenEncryptionError } from '../types';

export class TokenEncryption {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32; // 256 bits
  private readonly ivLength = 16; // 128 bits
  private readonly tagLength = 16; // 128 bits
  private encryptionKey: Buffer;

  constructor(encryptionKey: string) {
    if (!encryptionKey) {
      throw new TokenEncryptionError('Encryption key is required');
    }

    // Ensure key is exactly 32 bytes for AES-256
    this.encryptionKey = crypto.scryptSync(encryptionKey, 'salt', this.keyLength);
  }

  /**
   * Encrypts sensitive data (tokens, etc.)
   */
  encrypt(data: string): string {
    try {
      const iv = crypto.randomBytes(this.ivLength);
      const cipher = crypto.createCipher(this.algorithm, this.encryptionKey);
      cipher.setAAD(Buffer.from('replyzen-email-integration')); // Additional authenticated data

      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const tag = cipher.getAuthTag();

      // Combine IV, tag, and encrypted data
      const combined = Buffer.concat([
        iv,
        tag,
        Buffer.from(encrypted, 'hex')
      ]);

      return combined.toString('base64');
    } catch (error) {
      throw new TokenEncryptionError(
        `Failed to encrypt data: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Decrypts sensitive data
   */
  decrypt(encryptedData: string): string {
    try {
      const combined = Buffer.from(encryptedData, 'base64');

      if (combined.length < this.ivLength + this.tagLength) {
        throw new TokenEncryptionError('Invalid encrypted data format');
      }

      const iv = combined.slice(0, this.ivLength);
      const tag = combined.slice(this.ivLength, this.ivLength + this.tagLength);
      const encrypted = combined.slice(this.ivLength + this.tagLength);

      const decipher = crypto.createDecipher(this.algorithm, this.encryptionKey);
      decipher.setAAD(Buffer.from('replyzen-email-integration'));
      decipher.setAuthTag(tag);

      let decrypted = decipher.update(encrypted, undefined, 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      throw new TokenEncryptionError(
        `Failed to decrypt data: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Encrypts OAuth token response
   */
  encryptTokenResponse(tokenResponse: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    scope: string;
  }): {
    encryptedAccessToken: string;
    encryptedRefreshToken: string;
    tokenExpiry: Date;
    scopes: string[];
  } {
    const tokenExpiry = new Date(Date.now() + tokenResponse.expiresIn * 1000);
    const scopes = tokenResponse.scope.split(' ').filter(Boolean);

    return {
      encryptedAccessToken: this.encrypt(tokenResponse.accessToken),
      encryptedRefreshToken: this.encrypt(tokenResponse.refreshToken),
      tokenExpiry,
      scopes
    };
  }

  /**
   * Decrypts OAuth tokens for API usage
   */
  decryptTokens(encryptedAccessToken: string, encryptedRefreshToken: string): {
    accessToken: string;
    refreshToken: string;
  } {
    return {
      accessToken: this.decrypt(encryptedAccessToken),
      refreshToken: this.decrypt(encryptedRefreshToken)
    };
  }

  /**
   * Validates encryption key integrity
   */
  validateKey(): boolean {
    try {
      // Test encryption/decryption with sample data
      const testData = 'test-encryption-validation';
      const encrypted = this.encrypt(testData);
      const decrypted = this.decrypt(encrypted);
      return testData === decrypted;
    } catch (error) {
      return false;
    }
  }

  /**
   * Generates a secure random string for OAuth state
   */
  generateSecureState(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Hashes sensitive identifiers for logging
   */
  hashForLogging(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 8);
  }

  /**
   * Rotates encryption key (for security maintenance)
   */
  rotateKey(newKey: string): TokenEncryption {
    return new TokenEncryption(newKey);
  }

  /**
   * securely compares two strings to prevent timing attacks
   */
  timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  }

  /**
   * Creates a secure hash for webhook validation
   */
  createWebhookSignature(payload: string, secret: string): string {
    return crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
  }

  /**
   * Validates webhook signature
   */
  validateWebhookSignature(
    payload: string,
    signature: string,
    secret: string
  ): boolean {
    const expectedSignature = this.createWebhookSignature(payload, secret);
    return this.timingSafeEqual(signature, expectedSignature);
  }

  /**
   * Generates a secure API key for webhook subscriptions
   */
  generateApiKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Sanitizes sensitive data for logging
   */
  sanitizeForLogging(data: any): any {
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    const sanitized = { ...data };
    
    // Remove or hash sensitive fields
    const sensitiveFields = [
      'accessToken',
      'refreshToken',
      'encryptedAccessToken',
      'encryptedRefreshToken',
      'password',
      'secret',
      'key'
    ];

    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = this.hashForLogging(String(sanitized[field]));
      }
    }

    return sanitized;
  }

  /**
   * Gets encryption algorithm info for audit
   */
  getAlgorithmInfo(): {
    algorithm: string;
    keyLength: number;
    ivLength: number;
    tagLength: number;
  } {
    return {
      algorithm: this.algorithm,
      keyLength: this.keyLength,
      ivLength: this.ivLength,
      tagLength: this.tagLength
    };
  }
}
