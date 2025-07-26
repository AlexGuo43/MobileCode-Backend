import { db } from './database';
import { encryption } from './encryption';
import { SyncFile, SyncFileRequest, SyncResponse, SyncSession } from '../types';

class SyncService {
  async uploadFile(
    userId: string, 
    deviceId: string, 
    data: SyncFileRequest
  ): Promise<{ success: boolean; file?: SyncFile; conflict?: any }> {
    try {
      const contentHash = encryption.hash(data.content);
    
      // Check if file already exists
      const existingFile = await db.get<SyncFile>(
        'SELECT * FROM sync_files WHERE user_id = $1 AND filename = $2',
        [userId, data.filename]
      );

      if (existingFile) {
        // Check for conflict (different content, newer or same timestamp)
        const existingModified = new Date(existingFile.last_modified);
        const newModified = new Date(data.last_modified);
        
        if (existingFile.content_hash !== contentHash) {
          // Content is different
          if (existingModified.getTime() >= newModified.getTime()) {
            // Existing file is newer or same age, return conflict
            return {
              success: false,
              conflict: {
                filename: data.filename,
                local_version: 1, // Client considers their version as local
                remote_version: existingFile.version,
                local_modified: data.last_modified,
                remote_modified: existingFile.last_modified,
                remote_content: encryption.decrypt(existingFile.content)
              }
            };
          }
        } else if (existingModified.getTime() >= newModified.getTime()) {
          // Same content, existing is newer or same - no update needed
          return { success: true, file: existingFile };
        }

        // Update existing file
        const encryptedContent = encryption.encrypt(data.content);
        await db.run(
          `UPDATE sync_files 
           SET content = $1, content_hash = $2, file_type = $3, size = $4, 
               last_modified = $5, device_id = $6, version = version + 1, 
               updated_at = CURRENT_TIMESTAMP
           WHERE user_id = $7 AND filename = $8`,
          [
            encryptedContent, contentHash, data.file_type, 
            data.content.length, data.last_modified, deviceId, 
            userId, data.filename
          ]
        );

        const updatedFile = await db.get<SyncFile>(
          'SELECT * FROM sync_files WHERE user_id = $1 AND filename = $2',
          [userId, data.filename]
        );

        return { success: true, file: updatedFile };
      } else {
        // Create new file
        const fileId = encryption.generateId();
        const encryptedContent = encryption.encrypt(data.content);

        await db.run(
          `INSERT INTO sync_files 
           (id, user_id, filename, content, content_hash, file_type, size, 
            last_modified, device_id, version) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 1)`,
          [
            fileId, userId, data.filename, encryptedContent, contentHash,
            data.file_type, data.content.length, data.last_modified, deviceId
          ]
        );

        const newFile = await db.get<SyncFile>(
          'SELECT * FROM sync_files WHERE id = $1',
          [fileId]
        );

        return { success: true, file: newFile };
      }
    } catch (error) {
      console.error('Error in uploadFile:', error);
      throw error;
    }
  }

  async downloadFile(userId: string, filename: string): Promise<SyncFile | null> {
    const file = await db.get<SyncFile>(
      'SELECT * FROM sync_files WHERE user_id = $1 AND filename = $2',
      [userId, filename]
    );

    if (!file) {
      return null;
    }

    // Decrypt content
    try {
      file.content = encryption.decrypt(file.content);
    } catch (error) {
      console.error('Failed to decrypt file content:', error);
      throw new Error('Failed to decrypt file content');
    }

    return file;
  }

  async getUserFiles(userId: string): Promise<SyncFile[]> {
    const files = await db.all<SyncFile>(
      `SELECT sf.*, d.name as device_name 
       FROM sync_files sf 
       LEFT JOIN devices d ON sf.device_id = d.id 
       WHERE sf.user_id = $1 
       ORDER BY sf.updated_at DESC`,
      [userId]
    );

    // Decrypt content for all files
    return files.map(file => {
      try {
        file.content = encryption.decrypt(file.content);
        return file;
      } catch (error) {
        console.error(`Failed to decrypt file ${file.filename}:`, error);
        // Return file with empty content if decryption fails
        file.content = '';
        return file;
      }
    });
  }

  async syncFiles(
    userId: string, 
    deviceId: string, 
    clientFiles: SyncFileRequest[]
  ): Promise<SyncResponse> {
    const sessionId = encryption.generateId();
    
    // Start sync session
    await db.run(
      'INSERT INTO sync_sessions (id, user_id, device_id, status) VALUES ($1, $2, $3, $4)',
      [sessionId, userId, deviceId, 'active']
    );

    const response: SyncResponse = {
      files: [],
      conflicts: []
    };

    let filesSucceeded = 0;
    let filesFailed = 0;

    try {
      // Get all server files for this user
      const serverFiles = await db.all<SyncFile>(
        'SELECT * FROM sync_files WHERE user_id = $1',
        [userId]
      );

      const serverFileMap = new Map<string, SyncFile>();
      serverFiles.forEach(file => {
        serverFileMap.set(file.filename, file);
      });

      // Process each client file
      for (const clientFile of clientFiles) {
        try {
          const result = await this.uploadFile(userId, deviceId, clientFile);
          
          if (result.conflict) {
            response.conflicts.push(result.conflict);
            filesFailed++;
          } else if (result.success && result.file) {
            filesSucceeded++;
          }
        } catch (error) {
          console.error(`Failed to sync file ${clientFile.filename}:`, error);
          filesFailed++;
        }
      }

      // Return all server files that aren't in conflict
      for (const serverFile of serverFiles) {
        const hasConflict = response.conflicts.some(c => c.filename === serverFile.filename);
        
        if (!hasConflict) {
          try {
            const decryptedContent = encryption.decrypt(serverFile.content);
            const deviceName = await this.getDeviceName(serverFile.device_id);
            
            response.files.push({
              id: serverFile.id,
              filename: serverFile.filename,
              content: decryptedContent,
              last_modified: serverFile.last_modified.toString(),
              version: serverFile.version,
              device_name: deviceName
            });
          } catch (error) {
            console.error(`Failed to decrypt file ${serverFile.filename}:`, error);
            filesFailed++;
          }
        }
      }

      // Complete sync session
      await db.run(
        `UPDATE sync_sessions 
         SET status = 'completed', files_synced = $1, files_failed = $2, 
             completed_at = CURRENT_TIMESTAMP 
         WHERE id = $3`,
        [filesSucceeded, filesFailed, sessionId]
      );

    } catch (error) {
      console.error('Sync error:', error);
      
      // Mark session as failed
      await db.run(
        `UPDATE sync_sessions 
         SET status = 'failed', files_failed = $1, completed_at = CURRENT_TIMESTAMP 
         WHERE id = $2`,
        [filesFailed, sessionId]
      );
      
      throw error;
    }

    return response;
  }

  async deleteFile(userId: string, filename: string): Promise<boolean> {
    const result = await db.run(
      'DELETE FROM sync_files WHERE user_id = $1 AND filename = $2',
      [userId, filename]
    );

    return result.changes > 0;
  }

  async getUserSyncStats(userId: string): Promise<{
    totalFiles: number;
    totalSize: number;
    lastSync: string | null;
    devices: Array<{ name: string; lastActive: string; fileCount: number }>;
  }> {
    // Get total files and size
    const stats = await db.get<{ totalFiles: number; totalSize: number }>(
      'SELECT COUNT(*) as totalFiles, SUM(size) as totalSize FROM sync_files WHERE user_id = $1',
      [userId]
    );

    // Get last sync
    const lastSyncSession = await db.get<{ completed_at: string }>(
      `SELECT completed_at FROM sync_sessions 
       WHERE user_id = $1 AND status = 'completed' 
       ORDER BY completed_at DESC LIMIT 1`,
      [userId]
    );

    // Get device stats
    const deviceStats = await db.all<any>(
      `SELECT d.name, d.last_active, COUNT(sf.id) as fileCount
       FROM devices d
       LEFT JOIN sync_files sf ON d.id = sf.device_id
       WHERE d.user_id = $1
       GROUP BY d.id, d.name, d.last_active
       ORDER BY d.last_active DESC`,
      [userId]
    );

    return {
      totalFiles: stats?.totalFiles || 0,
      totalSize: stats?.totalSize || 0,
      lastSync: lastSyncSession?.completed_at || null,
      devices: deviceStats.map(d => ({
        name: d.name,
        lastActive: d.last_active,
        fileCount: d.fileCount
      }))
    };
  }

  private async getDeviceName(deviceId: string): Promise<string> {
    const device = await db.get<{ name: string }>(
      'SELECT name FROM devices WHERE id = $1',
      [deviceId]
    );
    return device?.name || 'Unknown Device';
  }
}

export const syncService = new SyncService();