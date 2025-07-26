import dotenv from 'dotenv';
dotenv.config();

import { db } from '../services/database';

describe('Database Service', () => {
  beforeAll(async () => {
    await db.connect();
  });

  afterAll(async () => {
    await db.close();
  });

  it('should connect to the database', async () => {
    const result = await db.get('SELECT 1');
    expect(result).toBeDefined();
  });
});