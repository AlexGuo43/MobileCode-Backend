import { Pool, PoolClient } from 'pg';
import path from 'path';

class PostgreSQLDatabaseService {
  private pool: Pool | null = null;

  async connect(): Promise<void> {
    const connectionString = process.env.DATABASE_URL || 
      `postgresql://${process.env.PGUSER}:${process.env.PGPASSWORD}@${process.env.PGHOST}:${process.env.PGPORT}/${process.env.PGDATABASE}`;

    this.pool = new Pool({
      connectionString,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // Test connection
    try {
      const client = await this.pool.connect();
      console.log('Connected to PostgreSQL database');
      client.release();
    } catch (err) {
      console.error('Error connecting to database:', err);
      throw err;
    }

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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      
      `CREATE TABLE IF NOT EXISTS devices (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('mobile', 'desktop')),
        platform TEXT NOT NULL,
        last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      )`,
      
      `CREATE TABLE IF NOT EXISTS pairing_codes (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        code TEXT UNIQUE NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        used BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
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
        last_modified TIMESTAMP NOT NULL,
        device_id TEXT NOT NULL,
        version INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
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
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (device_id) REFERENCES devices (id) ON DELETE CASCADE
      )`,
      
      `CREATE TABLE IF NOT EXISTS auth_tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        device_id TEXT NOT NULL,
        token TEXT UNIQUE NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
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

  async run(sql: string, params: any[] = []): Promise<{ changes: number; lastID?: string }> {
    if (!this.pool) throw new Error('Database not connected');
    
    const client = await this.pool.connect();
    try {
      const result = await client.query(sql, params);
      return { changes: result.rowCount || 0, lastID: result.rows[0]?.id };
    } finally {
      client.release();
    }
  }

  async get<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
    if (!this.pool) throw new Error('Database not connected');
    
    const client = await this.pool.connect();
    try {
      const result = await client.query(sql, params);
      return result.rows[0] as T;
    } finally {
      client.release();
    }
  }

  async all<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    if (!this.pool) throw new Error('Database not connected');
    
    const client = await this.pool.connect();
    try {
      const result = await client.query(sql, params);
      return result.rows as T[];
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    if (!this.pool) return;
    
    await this.pool.end();
    this.pool = null;
    console.log('Database connection closed');
  }

  async beginTransaction(): Promise<PoolClient> {
    if (!this.pool) throw new Error('Database not connected');
    
    const client = await this.pool.connect();
    await client.query('BEGIN');
    return client;
  }

  async commit(client: PoolClient): Promise<void> {
    await client.query('COMMIT');
    client.release();
  }

  async rollback(client: PoolClient): Promise<void> {
    await client.query('ROLLBACK');
    client.release();
  }
}

export const db = new PostgreSQLDatabaseService();