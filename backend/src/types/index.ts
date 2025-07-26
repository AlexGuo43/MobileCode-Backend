export interface User {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  created_at: Date;
  updated_at: Date;
}

export interface Device {
  id: string;
  user_id: string;
  name: string;
  type: 'mobile' | 'desktop';
  platform: string; // 'ios', 'android', 'vscode', etc.
  last_active: Date;
  created_at: Date;
}

export interface PairingCode {
  id: string;
  user_id: string;
  code: string;
  expires_at: Date;
  used: boolean;
  created_at: Date;
}

export interface SyncFile {
  id: string;
  user_id: string;
  filename: string;
  content: string; // encrypted
  content_hash: string;
  file_type: string;
  size: number;
  last_modified: Date;
  device_id: string; // which device last modified this
  version: number;
  created_at: Date;
  updated_at: Date;
}

export interface SyncSession {
  id: string;
  user_id: string;
  device_id: string;
  status: 'active' | 'completed' | 'failed';
  files_synced: number;
  files_failed: number;
  started_at: Date;
  completed_at?: Date;
}

export interface AuthToken {
  id: string;
  user_id: string;
  device_id: string;
  token: string;
  expires_at: Date;
  created_at: Date;
}

// API Types
export interface CreateUserRequest {
  email: string;
  password: string;
  name: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  device_name: string;
  device_type: 'mobile' | 'desktop';
  platform: string;
}

export interface LoginResponse {
  user: Omit<User, 'password_hash'>;
  device: Device;
  token: string;
  expires_at: string;
}

export interface PairDeviceRequest {
  code: string;
  device_name: string;
  device_type: 'mobile' | 'desktop';
  platform: string;
}

export interface SyncFileRequest {
  filename: string;
  content: string;
  file_type: string;
  last_modified: string;
}

export interface SyncResponse {
  files: Array<{
    id: string;
    filename: string;
    content: string;
    last_modified: string;
    version: number;
    device_name: string;
  }>;
  conflicts: Array<{
    filename: string;
    local_version: number;
    remote_version: number;
    local_modified: string;
    remote_modified: string;
  }>;
}

export interface ApiError {
  error: string;
  message: string;
  code?: string;
}