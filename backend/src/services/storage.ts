import { db } from './database';

export interface StorageInfo {
  used: number;
  limit: number;
  available: number;
  percentUsed: number;
}

export interface StorageError extends Error {
  type: 'STORAGE_LIMIT_EXCEEDED' | 'STORAGE_CALCULATION_ERROR';
  storageInfo?: StorageInfo;
}

class StorageService {
  private readonly STORAGE_LIMIT = 10 * 1024 * 1024; // 10MB in bytes

  async getUserStorageInfo(userId: string): Promise<StorageInfo> {
    try {
      const user = await db.get<{ storage_used: string; storage_limit: string }>(
        'SELECT storage_used, storage_limit FROM users WHERE id = $1',
        [userId]
      );

      if (!user) {
        throw new Error('User not found');
      }

      const used = parseInt(user.storage_used);
      const limit = parseInt(user.storage_limit);
      const available = Math.max(0, limit - used);
      const percentUsed = Math.round((used / limit) * 100);

      return {
        used,
        limit,
        available,
        percentUsed
      };
    } catch (error) {
      const storageError = new Error('Failed to get storage info') as StorageError;
      storageError.type = 'STORAGE_CALCULATION_ERROR';
      throw storageError;
    }
  }

  async calculateUserStorageUsage(userId: string): Promise<number> {
    try {
      const result = await db.get<{ total_size: string }>(
        'SELECT COALESCE(SUM(size), 0) as total_size FROM sync_files WHERE user_id = $1',
        [userId]
      );

      return parseInt(result?.total_size || '0');
    } catch (error) {
      const storageError = new Error('Failed to calculate storage usage') as StorageError;
      storageError.type = 'STORAGE_CALCULATION_ERROR';
      throw storageError;
    }
  }

  async updateUserStorageUsage(userId: string): Promise<void> {
    try {
      const actualUsage = await this.calculateUserStorageUsage(userId);
      
      await db.run(
        'UPDATE users SET storage_used = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [actualUsage, userId]
      );
    } catch (error) {
      const storageError = new Error('Failed to update storage usage') as StorageError;
      storageError.type = 'STORAGE_CALCULATION_ERROR';
      throw storageError;
    }
  }

  async checkStorageLimit(userId: string, additionalBytes: number): Promise<{ allowed: boolean; storageInfo: StorageInfo }> {
    const storageInfo = await this.getUserStorageInfo(userId);
    const wouldExceed = storageInfo.used + additionalBytes > storageInfo.limit;
    
    return {
      allowed: !wouldExceed,
      storageInfo: {
        ...storageInfo,
        used: storageInfo.used + additionalBytes
      }
    };
  }

  async validateStorageForFiles(userId: string, files: Array<{ content: string }>): Promise<void> {
    const totalSize = files.reduce((sum, file) => {
      return sum + Buffer.byteLength(file.content, 'utf8');
    }, 0);

    const { allowed, storageInfo } = await this.checkStorageLimit(userId, totalSize);
    
    if (!allowed) {
      const error = new Error('Storage limit exceeded') as StorageError;
      error.type = 'STORAGE_LIMIT_EXCEEDED';
      error.storageInfo = storageInfo;
      throw error;
    }
  }

  async validateStorageForFile(userId: string, content: string, existingFileSize: number = 0): Promise<void> {
    const newSize = Buffer.byteLength(content, 'utf8');
    const sizeChange = newSize - existingFileSize;
    
    if (sizeChange <= 0) {
      return;
    }

    const { allowed, storageInfo } = await this.checkStorageLimit(userId, sizeChange);
    
    if (!allowed) {
      const error = new Error('Storage limit exceeded') as StorageError;
      error.type = 'STORAGE_LIMIT_EXCEEDED';
      error.storageInfo = storageInfo;
      throw error;
    }
  }

  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }
}

export const storageService = new StorageService();