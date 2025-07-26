# Use Node.js 18 LTS
FROM node:18-alpine

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Create data directory for SQLite database
RUN mkdir -p /app/data

# Expose port
EXPOSE 3000

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S mobilecoder -u 1001 -G nodejs

# Change ownership of app directory
RUN chown -R mobilecoder:nodejs /app

# Switch to non-root user
USER mobilecoder

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1))"

# Start the application
CMD ["npm", "start"]