import crypto from 'crypto';

class EncryptionService {
  private readonly algorithm = 'aes-256-cbc';
  private readonly keyLength = 32;
  private readonly ivLength = 16;

  private getEncryptionKey(): Buffer {
    const key = process.env.ENCRYPTION_KEY;
    if (!key) {
      throw new Error('ENCRYPTION_KEY environment variable is required');
    }
    
    // Hash the key to get proper length
    return crypto.createHash('sha256').update(key).digest();
  }

  encrypt(text: string): string {
    try {
      const key = this.getEncryptionKey();
      const iv = crypto.randomBytes(this.ivLength);
      
      const cipher = crypto.createCipheriv(this.algorithm, key, iv);
      
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Combine IV + encrypted data
      const combined = Buffer.concat([
        iv,
        Buffer.from(encrypted, 'hex')
      ]);
      
      return combined.toString('base64');
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  decrypt(encryptedData: string): string {
    try {
      const key = this.getEncryptionKey();
      const combined = Buffer.from(encryptedData, 'base64');
      
      // Extract IV and encrypted data
      const iv = combined.slice(0, this.ivLength);
      const encrypted = combined.slice(this.ivLength);
      
      const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
      
      let decrypted = decipher.update(encrypted, undefined, 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  hash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  generateId(): string {
    return crypto.randomUUID();
  }

  generatePairingCode(): string {
    // Generate 6-digit numeric code
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  compareHash(data: string, hash: string): boolean {
    const dataHash = this.hash(data);
    return crypto.timingSafeEqual(
      Buffer.from(dataHash, 'hex'),
      Buffer.from(hash, 'hex')
    );
  }
}

export const encryption = new EncryptionService();