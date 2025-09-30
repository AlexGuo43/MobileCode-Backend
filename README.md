# MobileCoder Sync Backend

Backend service for cross-device file synchronization between MobileCoder mobile app and VSCode extension.

## Features

- **User Authentication**: Email/password registration and login
- **Encrypted File Sync**: AES-256-GCM encryption for all file content
- **RESTful API**: Clean, documented API endpoints
- **Production Ready**: Docker support, rate limiting, security middleware

## Quick Start

### Development

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start development server**:
   ```bash
   npm run dev
   ```

The server will start on `http://localhost:3000`

### Production

1. **Using Docker**:
   ```bash
   docker-compose up -d
   ```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login with email/password
- `GET /api/auth/me` - Get current user info
- `GET /api/auth/devices` - List user devices
- `DELETE /api/auth/devices/:id` - Remove device
- `POST /api/auth/logout` - Logout current session

### File Sync
- `POST /api/sync/files` - Upload/update single file
- `GET /api/sync/files` - Get all user files
- `GET /api/sync/files/:filename` - Download specific file
- `POST /api/sync/sync` - Sync multiple files (main endpoint)
- `DELETE /api/sync/files/:filename` - Delete file
- `GET /api/sync/stats` - Get sync statistics

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment | `development` |
| `JWT_SECRET` | JWT signing secret | **Required** |
| `ENCRYPTION_KEY` | File encryption key | **Required** |
| `CORS_ORIGIN` | CORS allowed origins | `*` |
| `DATABASE_PATH` | SQLite database path | `./mobilecoder.db` |

### Security

**Important**: Change `JWT_SECRET` and `ENCRYPTION_KEY` in production!

Generate secure keys:
```bash
# JWT Secret (256-bit)
openssl rand -hex 32

# Encryption Key (256-bit)
openssl rand -hex 32
```

## Development

### Project Structure

```
backend/
├── src/
│   ├── routes/          # API route handlers
│   ├── services/        # Business logic
│   ├── middleware/      # Express middleware
│   ├── types/          # TypeScript types
│   └── index.ts        # Main application
├── Dockerfile          # Docker configuration
├── docker-compose.yml  # Docker Compose setup
└── package.json        # Dependencies
```

## License

This backend service is part of the MobileCoder project.
