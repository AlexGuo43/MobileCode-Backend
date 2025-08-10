import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import client from 'prom-client';

// Load environment variables
dotenv.config();
import { db } from './services/database';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

// Import routes
import authRoutes from './routes/auth';
import syncRoutes from './routes/sync';

const app = express();
const port = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});
app.use(limiter);

// Body parsing middleware
app.use(compression());
app.use(express.json({ limit: '10mb' })); // Allow larger payloads for file content
app.use(express.urlencoded({ extended: true }));

// Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

// Start collecting default metrics (CPU, memory, etc)
client.collectDefaultMetrics();

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/sync', syncRoutes);

// API info endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'MobileCoder Sync API',
    version: '1.0.0',
    description: 'Backend service for MobileCoder cross-device file synchronization',
    endpoints: {
      auth: {
        'POST /api/auth/register': 'Register new user',
        'POST /api/auth/login': 'Login with email/password',
        'POST /api/auth/pairing-code': 'Generate device pairing code',
        'POST /api/auth/pair-device': 'Pair new device with code',
        'GET /api/auth/me': 'Get current user info',
        'GET /api/auth/devices': 'Get user devices',
        'DELETE /api/auth/devices/:id': 'Remove device',
        'POST /api/auth/logout': 'Logout current session'
      },
      sync: {
        'POST /api/sync/files': 'Upload/update single file',
        'GET /api/sync/files': 'Get all user files',
        'GET /api/sync/files/:filename': 'Download specific file',
        'POST /api/sync/sync': 'Sync multiple files',
        'DELETE /api/sync/files/:filename': 'Delete file',
        'GET /api/sync/stats': 'Get sync statistics'
      }
    }
  });
});

// Error handling middleware (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
async function startServer() {
  try {
    // Connect to database
    await db.connect();
    console.log('Database connected successfully');

    // Start HTTP server
    app.listen(port, () => {
      console.log(`MobileCoder Sync API server running on port ${port}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`Health check: http://localhost:${port}/health`);
      console.log(`API info: http://localhost:${port}/api`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...');
  try {
    await db.close();
    console.log('Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
});

process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  try {
    await db.close();
    console.log('Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
});

// Start the server
startServer();