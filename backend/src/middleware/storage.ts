import { Request, Response, NextFunction } from 'express';
import { storageService, StorageError } from '../services/storage';
import { AuthRequest } from './auth';

export const validateStorage = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'User not authenticated'
      });
    }

    // Handle single file upload
    if (req.body.content && !req.body.files) {
      const existingFileSize = await getExistingFileSize(userId, req.body.filename);
      await storageService.validateStorageForFile(userId, req.body.content, existingFileSize);
    }

    // Handle multiple files upload
    if (req.body.files && Array.isArray(req.body.files)) {
      await storageService.validateStorageForFiles(userId, req.body.files);
    }

    return next();
  } catch (error) {
    if (error instanceof Error && (error as StorageError).type === 'STORAGE_LIMIT_EXCEEDED') {
      const storageError = error as StorageError;
      return res.status(413).json({
        success: false,
        error: 'Storage Limit Exceeded',
        message: 'Upload would exceed your storage limit',
        storageInfo: storageError.storageInfo
      });
    }

    return next(error);
  }
};

async function getExistingFileSize(userId: string, filename: string): Promise<number> {
  const { db } = await import('../services/database');
  
  try {
    const file = await db.get<{ size: number }>(
      'SELECT size FROM sync_files WHERE user_id = $1 AND filename = $2',
      [userId, filename]
    );
    
    return file?.size || 0;
  } catch (error) {
    return 0;
  }
}