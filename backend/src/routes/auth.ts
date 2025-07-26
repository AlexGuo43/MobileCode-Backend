import { Router } from 'express';
import { authService } from '../services/auth';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { validate, schemas } from '../middleware/validation';

const router = Router();

// Register new user
router.post('/register', validate(schemas.createUser), async (req, res, next) => {
  try {
    const user = await authService.createUser(req.body);
    res.status(201).json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
});

// Login with email/password
router.post('/login', validate(schemas.login), async (req, res, next) => {
  try {
    const result = await authService.login(req.body);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Generate pairing code for current user
router.post('/pairing-code', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const code = await authService.generatePairingCode(req.user!.userId);
    res.json({
      success: true,
      data: { code }
    });
  } catch (error) {
    next(error);
  }
});

// Pair new device using code
router.post('/pair-device', validate(schemas.pairDevice), async (req, res, next) => {
  try {
    const result = await authService.pairDevice(req.body);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Get current user info
router.get('/me', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const devices = await authService.getUserDevices(req.user!.userId);
    res.json({
      success: true,
      data: {
        userId: req.user!.userId,
        deviceId: req.user!.deviceId,
        devices
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get user's devices
router.get('/devices', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const devices = await authService.getUserDevices(req.user!.userId);
    res.json({
      success: true,
      data: devices
    });
  } catch (error) {
    next(error);
  }
});

// Remove a device
router.delete('/devices/:deviceId', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    await authService.removeDevice(req.user!.userId, req.params.deviceId);
    res.json({
      success: true,
      message: 'Device removed successfully'
    });
  } catch (error) {
    next(error);
  }
});

// Logout (invalidate current token)
router.post('/logout', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      await authService.logout(token);
    }
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    next(error);
  }
});

export default router;