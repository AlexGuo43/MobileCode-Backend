# MobileCoder Backend Deployment Guide

## Railway Deployment (Recommended)

Railway is the easiest way to deploy your Node.js backend with PostgreSQL.

### Step 1: Install Railway CLI

```bash
npm install -g @railway/cli
railway login
```

### Step 2: Initialize Railway Project

```bash
# From your project root directory
cd /Users/joeberson/Developer/MobileCode
railway init
```

When prompted:
- Choose "Deploy from existing code"
- Select your GitHub repository (or create new)
- Choose the `backend` directory as the root

### Step 3: Add PostgreSQL Database

```bash
railway add postgresql
```

This creates a PostgreSQL database and sets the `DATABASE_URL` environment variable automatically.

### Step 4: Set Environment Variables

```bash
# Generate secure keys (run these commands to get random keys)
openssl rand -hex 32  # Use this for ENCRYPTION_KEY
openssl rand -hex 32  # Use this for JWT_SECRET

# Set the variables in Railway
railway variables set ENCRYPTION_KEY=your-generated-encryption-key-here
railway variables set JWT_SECRET=your-generated-jwt-secret-here
railway variables set NODE_ENV=production
railway variables set CORS_ORIGIN=*
```

### Step 5: Deploy

```bash
railway up
```

### Step 6: Get Your Deployment URL

```bash
railway status
```

Your backend will be available at: `https://your-app-name.up.railway.app`

## Environment Variables Checklist

Make sure these are set in Railway:

- ✅ `DATABASE_URL` (automatically set by Railway PostgreSQL)
- ✅ `ENCRYPTION_KEY` (generate with: `openssl rand -hex 32`)
- ✅ `JWT_SECRET` (generate with: `openssl rand -hex 32`)
- ✅ `NODE_ENV=production`
- ✅ `PORT=3000` (Railway sets this automatically)
- ✅ `CORS_ORIGIN=*` (or specific domains for production)

## Verify Deployment

Test your deployed backend:

```bash
# Replace with your Railway URL
curl https://your-app-name.up.railway.app/health

# Should return: {"status":"ok","timestamp":"...","version":"1.0.0"}
```

## Alternative: Manual Docker Deployment

If you prefer Docker deployment on any cloud provider:

```bash
# Build the image
docker build -t mobilecoder-backend .

# Run with environment variables
docker run -p 3000:3000 \
  -e DATABASE_URL=your-postgres-connection-string \
  -e ENCRYPTION_KEY=your-encryption-key \
  -e JWT_SECRET=your-jwt-secret \
  -e NODE_ENV=production \
  mobilecoder-backend
```

## Update Mobile App Configuration

After deployment, update your mobile app's API URL:

1. Edit `/Users/joeberson/Developer/MobileCode/services/authService.ts`
2. Update the `API_URL` to your Railway deployment URL
3. Redeploy your mobile app

## Monitoring

Railway provides:
- Automatic scaling
- Built-in metrics
- Log viewing
- Health checks

Access these through the Railway dashboard.

## Troubleshooting

**Database Connection Issues:**
- Verify `DATABASE_URL` is set correctly
- Check PostgreSQL service is running in Railway

**Authentication Issues:**
- Verify `JWT_SECRET` and `ENCRYPTION_KEY` are set
- Ensure they're the same values used in development

**API Not Responding:**
- Check Railway logs: `railway logs`
- Verify health endpoint: `/health`
- Check CORS settings if frontend can't connect