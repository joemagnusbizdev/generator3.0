# MAGNUS Intelligence Alert Generator - Deployment Guide

## Overview
This guide walks you through deploying the MAGNUS system with:
- **Frontend**: Vercel (React + Vite)
- **Backend**: Supabase Edge Function
- **Database**: Supabase PostgreSQL
- **Auth**: Supabase Auth

---

## Prerequisites

1. **GitHub Account** - with your dedicated repository
2. **Vercel Account** - https://vercel.com (free tier works)
3. **Supabase Account** - https://supabase.com (free tier works)
4. **API Keys**:
   - OpenAI API Key (for AI features)
   - Brave Search API Key (for web search)
   - WordPress credentials (for publishing)

---

## Step 1: Supabase Project Setup

### 1.1 Create Supabase Project
1. Go to https://supabase.com/dashboard
2. Click **"New Project"**
3. Fill in:
   - **Name**: `magnus-alerts` (or your choice)
   - **Database Password**: Generate a strong password (save it!)
   - **Region**: Choose closest to your users
4. Click **"Create new project"** and wait ~2 minutes

### 1.2 Get Your Supabase Credentials
From your Supabase project dashboard:

1. Go to **Settings** → **API**
2. Copy these values (you'll need them later):
   ```
   Project URL: https://xxxxxx.supabase.co
   Project ID: xxxxxx (the part before .supabase.co)
   anon/public key: eyJhbGc...
   service_role key: eyJhbGc... (keep this SECRET!)
   ```

### 1.3 Run Database Migration
1. Go to **SQL Editor** in Supabase dashboard
2. Click **"New query"**
3. Copy and paste the contents of `supabase/migrations/001_trends_table.sql`
4. Click **"Run"**

---

## Step 2: Deploy Supabase Edge Function

### 2.1 Create the Edge Function
1. In Supabase dashboard, go to **Edge Functions**
2. Click **"Create a new function"**
3. Name it: `clever-function`
4. Delete the default code
5. Copy and paste the ENTIRE contents of `supabase/functions/clever-function/index.ts`
6. Click **"Deploy"**

### 2.2 Set Edge Function Secrets
1. In **Edge Functions**, click on your function
2. Go to **"Manage secrets"** or **Settings** → **Edge Functions** → **Secrets**
3. Add these secrets:

| Secret Name | Description | Example |
|-------------|-------------|---------|
| `SUPABASE_URL` | Your Supabase project URL | `https://xxxxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (from API settings) | `eyJhbGc...` |
| `OPENAI_API_KEY` | OpenAI API key | `sk-...` |
| `BRAVE_API_KEY` | Brave Search API key | `BSA...` |
| `ADMIN_SECRET` | Secret for admin API calls | Generate a random string |
| `CRON_SECRET` | Secret for cron jobs | Generate a random string |
| `WP_URL` | WordPress site URL | `https://yoursite.com` |
| `WP_USER` | WordPress username | `admin` |
| `WP_APP_PASSWORD` | WordPress application password | `xxxx xxxx xxxx` |

**To generate random secrets:**
```bash
openssl rand -hex 32
```

---

## Step 3: GitHub Repository Setup

### 3.1 Prepare Your Repository
1. Clone your repository locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git
   cd YOUR_REPO
   ```

2. Copy all files from this deployment package to your repo:
   ```bash
   # Copy everything except .git folder
   cp -r /path/to/deployment-package/* .
   ```

3. Create `.gitignore`:
   ```gitignore
   node_modules/
   dist/
   .env
   .env.local
   *.log
   .DS_Store
   ```

4. Commit and push:
   ```bash
   git add .
   git commit -m "Initial MAGNUS deployment"
   git push origin main
   ```

---

## Step 4: Vercel Deployment

### 4.1 Connect Repository to Vercel
1. Go to https://vercel.com/dashboard
2. Click **"Add New..."** → **"Project"**
3. Select **"Import Git Repository"**
4. Find and select your GitHub repository
5. Click **"Import"**

### 4.2 Configure Build Settings
Vercel should auto-detect Vite, but verify:

| Setting | Value |
|---------|-------|
| Framework Preset | Vite |
| Root Directory | `./` |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `npm install` |

### 4.3 Set Environment Variables
In the Vercel project settings, add:

| Variable | Value |
|----------|-------|
| `VITE_SUPABASE_PROJECT_ID` | Your Supabase project ID (e.g., `xxxxxx`) |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon/public key |
| `VITE_MAPBOX_ACCESS_TOKEN` | Your Mapbox access token (optional - enables GeoJSON modal map) |

### 4.4 Deploy
1. Click **"Deploy"**
2. Wait for build to complete (~1-2 minutes)
3. Your app will be live at `https://your-project.vercel.app`

---

## Step 5: Post-Deployment Setup

### 5.1 Create Admin User
1. Go to Supabase **Authentication** → **Users**
2. Click **"Add user"** → **"Create new user"**
3. Fill in:
   - Email: `admin@magnus.co.il`
   - Password: Strong password
4. After creation, click on the user
5. Go to **"User metadata"** and add:
   ```json
   {
     "name": "Admin User",
     "role": "admin"
   }
   ```
6. Click **"Save"**

### 5.2 Verify Deployment
1. Open your Vercel URL
2. Log in with the admin user
3. Verify all tabs are visible (Review, Create, Trends, Sources, Analytics, Admin)
4. Go to Admin tab and verify you can see/manage users

---

## Step 6: Configure WordPress (Optional)

### 6.1 Create Application Password in WordPress
1. Log into your WordPress admin
2. Go to **Users** → **Profile**
3. Scroll to **"Application Passwords"**
4. Enter a name: `MAGNUS Alert System`
5. Click **"Add New Application Password"**
6. Copy the generated password (spaces included)
7. Update the `WP_APP_PASSWORD` secret in Supabase

---

## Environment Variables Reference

### Vercel (Frontend)
```env
VITE_SUPABASE_PROJECT_ID=your-project-id
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Supabase Edge Function (Backend)
```env
SUPABASE_URL=https://xxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
OPENAI_API_KEY=sk-...
BRAVE_API_KEY=BSA...
ADMIN_SECRET=random-32-char-string
CRON_SECRET=random-32-char-string
WP_URL=https://yourwordpress.com
WP_USER=wordpress_username
WP_APP_PASSWORD=xxxx xxxx xxxx xxxx
```

---

## Troubleshooting

### "Failed to fetch" errors
- Check Supabase Edge Function is deployed and running
- Verify CORS is enabled (the function handles this)
- Check browser console for specific errors

### Authentication issues
- Verify `VITE_SUPABASE_ANON_KEY` is correct
- Check user exists in Supabase Auth
- Verify user has `role` in user_metadata

### Edge Function errors
- Check Supabase Edge Function logs
- Verify all secrets are set
- Test the function URL directly: `https://xxxxxx.supabase.co/functions/v1/clever-function/health`

### Build failures on Vercel
- Check Node.js version (should be 18+)
- Verify all dependencies in package.json
- Check build logs for specific errors

---

## File Structure

```
your-repo/
├── src1/                          # Frontend source
│   ├── components/                # React components
│   │   ├── AlertCreateInline.tsx
│   │   ├── AlertReviewQueueInline.tsx
│   │   ├── AnalyticsDashboardInline.tsx
│   │   ├── EnhancedAlertCard.tsx
│   │   ├── ScourContext.tsx
│   │   ├── ScourStatusBarInline.tsx
│   │   ├── SourceManagerInline.tsx
│   │   ├── TrendsView.tsx
│   │   ├── UserManagementInline.tsx
│   │   └── index.ts
│   ├── lib/                       # Utilities
│   │   ├── permissions.ts         # Role-based permissions
│   │   ├── supabase/             # Supabase client
│   │   └── utils/                # API helpers
│   ├── styles/                   # Design system
│   ├── App.tsx                   # Main app
│   ├── main.tsx                  # Entry point
│   └── index.html
├── supabase/
│   ├── functions/
│   │   └── clever-function/
│   │       └── index.ts          # Edge function (COPY TO SUPABASE)
│   └── migrations/
│       └── 001_trends_table.sql  # Database schema (RUN IN SQL EDITOR)
├── package.json
├── vite.config.ts
├── vercel.json
└── tsconfig.json
```

---

## Security Notes

1. **Never commit `.env` files** - use `.gitignore`
2. **Keep service_role key secret** - only use in backend
3. **Use strong ADMIN_SECRET** - at least 32 characters
4. **Rotate secrets periodically**
5. **Enable RLS policies** - already configured in migration

---

## Support

For issues:
1. Check Supabase Edge Function logs
2. Check Vercel deployment logs
3. Check browser console for frontend errors
4. Verify all environment variables are set correctly
