import { Router } from 'express';
import { syncService } from '../services/sync';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { validate, schemas } from '../middleware/validation';

const router = Router();


// Upload/update a single file
router.post('/files', authenticateToken, validate(schemas.syncFile), async (req: AuthRequest, res, next) => {
  try {
    const result = await syncService.uploadFile(
      req.user!.userId,
      req.user!.deviceId,
      req.body
    );

    if (result.conflict) {
      return res.status(409).json({
        success: false,
        conflict: true,
        data: result.conflict
      });
    }

    return res.json({
      success: true,
      data: result.file
    });
  } catch (error) {
    return next(error);
  }
});

// Download a specific file
router.get('/files/:filename', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const file = await syncService.downloadFile(req.user!.userId, req.params.filename);
    
    if (!file) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'File not found'
      });
    }

    return res.json({
      success: true,
      data: file
    });
  } catch (error) {
    return next(error);
  }
});

// Get all user files
router.get('/files', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const files = await syncService.getUserFiles(req.user!.userId);
    return res.json({
      success: true,
      data: files
    });
  } catch (error) {
    return next(error);
  }
});

// Sync multiple files (main sync endpoint)
router.post('/sync', authenticateToken, validate(schemas.syncFiles), async (req: AuthRequest, res, next) => {
  try {
    const result = await syncService.syncFiles(
      req.user!.userId,
      req.user!.deviceId,
      req.body.files
    );

    return res.json({
      success: true,
      data: result
    });
  } catch (error) {
    return next(error);
  }
});

// Delete a file
router.delete('/files/:filename', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const success = await syncService.deleteFile(req.user!.userId, req.params.filename);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'File not found'
      });
    }

    return res.json({
      success: true,
      message: 'File deleted successfully'
    });
  } catch (error) {
    return next(error);
  }
});

// Get sync statistics
router.get('/stats', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const stats = await syncService.getUserSyncStats(req.user!.userId);
    return res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    return next(error);
  }
});

export default router;