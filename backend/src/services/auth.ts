import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { db } from './database';
import { encryption } from './encryption';
import { User, Device, AuthToken, CreateUserRequest, LoginRequest, LoginResponse, PairDeviceRequest } from '../types';

class AuthService {
  private readonly jwtSecret: string;
  private readonly tokenExpiry = '7d'; // 7 days
  
  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'default-secret-key';
    if (this.jwtSecret === 'default-secret-key') {
      console.warn('Warning: Using default JWT secret. Set JWT_SECRET environment variable in production.');
    }
  }

  async createUser(data: CreateUserRequest): Promise<Omit<User, 'password_hash'>> {
    // Check if user already exists
    const existingUser = await db.get<User>(
      'SELECT id FROM users WHERE email = $1',
      [data.email]
    );

    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(data.password, saltRounds);

    // Create user
    const userId = encryption.generateId();
    await db.run(
      'INSERT INTO users (id, email, password_hash, name) VALUES ($1, $2, $3, $4)',
      [userId, data.email, passwordHash, data.name]
    );

    const user = await db.get<User>(
      'SELECT id, email, name, created_at, updated_at FROM users WHERE id = $1',
      [userId]
    );

    if (!user) {
      throw new Error('Failed to create user');
    }

    return user;
  }

  async login(data: LoginRequest): Promise<LoginResponse> {
    // Find user
    const user = await db.get<User>(
      'SELECT * FROM users WHERE email = $1',
      [data.email]
    );

    if (!user || !await bcrypt.compare(data.password, user.password_hash)) {
      throw new Error('Invalid email or password');
    }

    // Create or update device
    const device = await this.createOrUpdateDevice(user.id, data);

    // Generate auth token
    const token = await this.generateAuthToken(user.id, device.id);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        created_at: user.created_at,
        updated_at: user.updated_at
      },
      device,
      token: token.token,
      expires_at: token.expires_at.toISOString()
    };
  }

  async generatePairingCode(userId: string): Promise<string> {
    // Invalidate existing unused codes
    await db.run(
      'UPDATE pairing_codes SET used = TRUE WHERE user_id = $1 AND used = FALSE',
      [userId]
    );

    // Generate new code
    const code = encryption.generatePairingCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await db.run(
      'INSERT INTO pairing_codes (id, user_id, code, expires_at) VALUES ($1, $2, $3, $4)',
      [encryption.generateId(), userId, code, expiresAt.toISOString()]
    );

    return code;
  }

  async pairDevice(data: PairDeviceRequest): Promise<LoginResponse> {
    // Find valid pairing code
    const pairingCode = await db.get<any>(
      `SELECT pc.*, u.* FROM pairing_codes pc 
       JOIN users u ON pc.user_id = u.id 
       WHERE pc.code = $1 AND pc.used = FALSE AND pc.expires_at > now()`,
      [data.code]
    );

    if (!pairingCode) {
      throw new Error('Invalid or expired pairing code');
    }

    // Mark code as used
    await db.run(
      'UPDATE pairing_codes SET used = TRUE WHERE code = $1',
      [data.code]
    );

    // Create device
    const device = await this.createOrUpdateDevice(pairingCode.user_id, {
      device_name: data.device_name,
      device_type: data.device_type,
      platform: data.platform
    });

    // Generate auth token
    const token = await this.generateAuthToken(pairingCode.user_id, device.id);

    return {
      user: {
        id: pairingCode.user_id,
        email: pairingCode.email,
        name: pairingCode.name,
        created_at: pairingCode.created_at,
        updated_at: pairingCode.updated_at
      },
      device,
      token: token.token,
      expires_at: token.expires_at.toISOString()
    };
  }

  async verifyToken(token: string): Promise<{ userId: string; deviceId: string } | null> {
    try {
      // Check if token exists in database and is not expired
      const authToken = await db.get<AuthToken>(
        'SELECT * FROM auth_tokens WHERE token = $1 AND expires_at > CURRENT_TIMESTAMP',
        [token]
      );

      if (!authToken) {
        return null;
      }

      // Verify JWT signature
      const decoded = jwt.verify(token, this.jwtSecret) as any;
      
      if (decoded.userId !== authToken.user_id || decoded.deviceId !== authToken.device_id) {
        return null;
      }

      // Update device last active
      await db.run(
        'UPDATE devices SET last_active = CURRENT_TIMESTAMP WHERE id = $1',
        [authToken.device_id]
      );

      return {
        userId: authToken.user_id,
        deviceId: authToken.device_id
      };
    } catch (error) {
      console.error('Token verification error:', error);
      return null;
    }
  }

  async logout(token: string): Promise<void> {
    await db.run('DELETE FROM auth_tokens WHERE token = $1', [token]);
  }

  async getUserDevices(userId: string): Promise<Device[]> {
    return await db.all<Device>(
      'SELECT * FROM devices WHERE user_id = $1 ORDER BY last_active DESC',
      [userId]
    );
  }

  async removeDevice(userId: string, deviceId: string): Promise<void> {
    // Remove device and its auth tokens
    await db.run('DELETE FROM auth_tokens WHERE device_id = $1', [deviceId]);
    await db.run('DELETE FROM devices WHERE id = $1 AND user_id = $2', [deviceId, userId]);
  }

  private async createOrUpdateDevice(userId: string, data: any): Promise<Device> {
    const deviceId = encryption.generateId();
    
    // Check if device with same name already exists
    const existingDevice = await db.get<Device>(
      'SELECT * FROM devices WHERE user_id = $1 AND name = $2',
      [userId, data.device_name]
    );

    if (existingDevice) {
      // Update existing device
      await db.run(
        'UPDATE devices SET type = $1, platform = $2, last_active = CURRENT_TIMESTAMP WHERE id = $3',
        [data.device_type, data.platform, existingDevice.id]
      );
      
      return await db.get<Device>('SELECT * FROM devices WHERE id = $1', [existingDevice.id]) as Device;
    } else {
      // Create new device
      await db.run(
        'INSERT INTO devices (id, user_id, name, type, platform) VALUES ($1, $2, $3, $4, $5)',
        [deviceId, userId, data.device_name, data.device_type, data.platform]
      );

      return await db.get<Device>('SELECT * FROM devices WHERE id = $1', [deviceId]) as Device;
    }
  }

  private async generateAuthToken(userId: string, deviceId: string): Promise<AuthToken> {
    const tokenString = jwt.sign(
      { userId, deviceId },
      this.jwtSecret,
      { expiresIn: this.tokenExpiry }
    );

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    const tokenId = encryption.generateId();

    // Clean up old tokens for this device
    await db.run(
      'DELETE FROM auth_tokens WHERE device_id = $1',
      [deviceId]
    );

    // Store new token
    await db.run(
      'INSERT INTO auth_tokens (id, user_id, device_id, token, expires_at) VALUES ($1, $2, $3, $4, $5)',
      [tokenId, userId, deviceId, tokenString, expiresAt.toISOString()]
    );

    return {
      id: tokenId,
      user_id: userId,
      device_id: deviceId,
      token: tokenString,
      expires_at: expiresAt,
      created_at: new Date()
    };
  }
}

export const authService = new AuthService();