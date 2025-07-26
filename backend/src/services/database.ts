import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import path from 'path';

// Import PostgreSQL service for production
import { db as pgDb } from './database-pg';

class DatabaseService {
  private db: sqlite3.Database | null = null;

  async connect(): Promise<void> {
    const dbPath = process.env.NODE_ENV === 'production' 
      ? path.join(__dirname, '../../data/mobilecoder.db')
      : path.join(__dirname, '../../mobilecoder.db');

    this.db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Error opening database:', err);
        throw err;
      }
      console.log('Connected to SQLite database');
    });

    // Enable foreign keys
    await this.run('PRAGMA foreign_keys = ON');
    
    // Initialize tables
    await this.initializeTables();
  }

  private async initializeTables(): Promise<void> {
    const tables = [
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      `CREATE TABLE IF NOT EXISTS devices (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('mobile', 'desktop')),
        platform TEXT NOT NULL,
        last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      )`,
      
      `CREATE TABLE IF NOT EXISTS pairing_codes (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        code TEXT UNIQUE NOT NULL,
        expires_at DATETIME NOT NULL,
        used BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      )`,
      
      `CREATE TABLE IF NOT EXISTS sync_files (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        filename TEXT NOT NULL,
        content TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        file_type TEXT NOT NULL,
        size INTEGER NOT NULL,
        last_modified DATETIME NOT NULL,
        device_id TEXT NOT NULL,
        version INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (device_id) REFERENCES devices (id) ON DELETE CASCADE,
        UNIQUE(user_id, filename)
      )`,
      
      `CREATE TABLE IF NOT EXISTS sync_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        device_id TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('active', 'completed', 'failed')),
        files_synced INTEGER DEFAULT 0,
        files_failed INTEGER DEFAULT 0,
        started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (device_id) REFERENCES devices (id) ON DELETE CASCADE
      )`,
      
      `CREATE TABLE IF NOT EXISTS auth_tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        device_id TEXT NOT NULL,
        token TEXT UNIQUE NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (device_id) REFERENCES devices (id) ON DELETE CASCADE
      )`
    ];

    for (const table of tables) {
      await this.run(table);
    }

    // Create indexes for performance
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_devices_user_id ON devices(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_sync_files_user_id ON sync_files(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_sync_files_filename ON sync_files(user_id, filename)',
      'CREATE INDEX IF NOT EXISTS idx_pairing_codes_code ON pairing_codes(code)',
      'CREATE INDEX IF NOT EXISTS idx_auth_tokens_token ON auth_tokens(token)',
      'CREATE INDEX IF NOT EXISTS idx_sync_sessions_user_device ON sync_sessions(user_id, device_id)'
    ];

    for (const index of indexes) {
      await this.run(index);
    }
  }

  async run(sql: string, params: any[] = []): Promise<sqlite3.RunResult> {
    if (!this.db) throw new Error('Database not connected');
    
    return new Promise((resolve, reject) => {
      this.db!.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve(this);
      });
    });
  }

  async get<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
    if (!this.db) throw new Error('Database not connected');
    
    return new Promise((resolve, reject) => {
      this.db!.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row as T);
      });
    });
  }

  async all<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    if (!this.db) throw new Error('Database not connected');
    
    return new Promise((resolve, reject) => {
      this.db!.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows as T[]);
      });
    });
  }

  async close(): Promise<void> {
    if (!this.db) return;
    
    return new Promise((resolve, reject) => {
      this.db!.close((err) => {
        if (err) reject(err);
        else {
          this.db = null;
          console.log('Database connection closed');
          resolve();
        }
      });
    });
  }

  async beginTransaction(): Promise<void> {
    await this.run('BEGIN TRANSACTION');
  }

  async commit(): Promise<void> {
    await this.run('COMMIT');
  }

  async rollback(): Promise<void> {
    await this.run('ROLLBACK');
  }
}

// Export the appropriate database service based on environment
export const db = process.env.NODE_ENV === 'production' && process.env.DATABASE_URL 
  ? pgDb 
  : new DatabaseService();