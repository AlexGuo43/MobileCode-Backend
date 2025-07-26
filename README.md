# MobileCoder Sync Backend

Production-ready backend service for cross-device file synchronization between MobileCoder mobile app and VSCode extension.

## Features

- **User Authentication**: Email/password registration and login
- **Device Pairing**: Simple 6-digit codes for pairing devices
- **Encrypted File Sync**: AES-256-GCM encryption for all file content
- **Conflict Resolution**: Intelligent handling of concurrent file edits
- **Real-time Sync**: Fast synchronization with timestamp-based conflict detection
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

2. **Using Node.js**:
   ```bash
   npm run build
   npm start
   ```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login with email/password
- `POST /api/auth/pairing-code` - Generate device pairing code
- `POST /api/auth/pair-device` - Pair new device with code
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

⚠️ **Important**: Change `JWT_SECRET` and `ENCRYPTION_KEY` in production!

Generate secure keys:
```bash
# JWT Secret (256-bit)
openssl rand -hex 32

# Encryption Key (256-bit)
openssl rand -hex 32
```

## Database

The backend uses SQLite for development and small deployments. For production at scale, consider:

- **PostgreSQL**: Best for most production use cases
- **MySQL**: Alternative relational database
- **MongoDB**: If you prefer NoSQL

To migrate to PostgreSQL:
1. Replace `sqlite3` with `pg` in package.json
2. Update database service to use PostgreSQL connection
3. Adjust SQL queries for PostgreSQL syntax

## Architecture

```
Mobile App ←→ Backend API ←→ VSCode Extension
               ↓
           SQLite/PostgreSQL
               ↓
         Encrypted File Storage
```

### Security Features

- **Encryption**: All file content encrypted with AES-256-GCM
- **Authentication**: JWT tokens with device binding
- **Rate Limiting**: Per-IP request limiting
- **Input Validation**: Zod schema validation
- **CORS Protection**: Configurable origin restrictions
- **Helmet**: Security headers middleware

### Sync Algorithm

1. **Upload**: Client sends file with timestamp
2. **Conflict Detection**: Server compares timestamps and content hashes
3. **Resolution**: Newer files win, conflicts returned for manual resolution
4. **Storage**: Files encrypted and stored with version numbers
5. **Distribution**: Other devices get updated files on next sync

## Deployment

### Docker (Recommended)

```bash
# Build and run
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

### Manual Deployment

```bash
# Build
npm run build

# Start with PM2
npm install -g pm2
pm2 start dist/index.js --name mobilecoder-api

# Or with systemd service
sudo systemctl enable mobilecoder-api
sudo systemctl start mobilecoder-api
```

### Nginx Configuration

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
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

### Adding Features

1. **New API endpoints**: Add to appropriate route file
2. **Database changes**: Update database service and types
3. **Business logic**: Add to service files
4. **Validation**: Update schemas in validation middleware

### Testing

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage
```

## Monitoring

### Health Check

```bash
curl http://localhost:3000/health
```

### Logs

The application uses structured logging with different levels:
- `error`: Error conditions
- `warn`: Warning conditions  
- `info`: Informational messages
- `debug`: Debug messages (development only)

### Metrics

For production monitoring, consider integrating:
- **Prometheus**: Metrics collection
- **Grafana**: Metrics visualization
- **Sentry**: Error tracking
- **New Relic**: Application performance monitoring

## License

This backend service is part of the MobileCoder project.