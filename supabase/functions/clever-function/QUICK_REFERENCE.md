# QUICK REFERENCE CARD

## 📋 Before You Deploy (DO THIS FIRST)

### Step 1: Create Database Tables (5 min)
```sql
-- Go to: Supabase Dashboard → SQL Editor → New Query
-- Copy ALL the SQL from DEPLOYMENT_CHECKLIST.md "Database Setup" section
-- Paste and run
-- Verify tables appear in Database → Tables
```

### Step 2: Set Environment Variables (10 min)
```
Go to: Supabase Dashboard → Edge Functions → clever-function → Settings

Add these variables:
SUPABASE_URL = https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY = your-service-role-key

Optional (if using features):
OPENAI_API_KEY = your-openai-key
BRAVE_SEARCH_API_KEY = your-brave-key
WP_URL = https://your-wordpress.com
WP_USER = admin
WP_APP_PASSWORD = xxxx
```

### Step 3: Deploy (2 min)
```bash
supabase functions deploy clever-function
```

### Step 4: Test (5 min)
```bash
# Test health check
curl https://your-project.supabase.co/functions/v1/clever-function/health

# Should return:
# { "ok": true, "time": "...", "env": {...} }
```

---

## 🔗 Frontend Endpoints (What Your Code Needs)

### Alerts (5 calls)
```javascript
// List all alerts
GET /alerts

// Create alert
POST /alerts
Body: { title, country, location, summary, ... }

// Update alert
PATCH /alerts/:id
Body: { fields to update }

// Publish to WordPress
POST /alerts/:id/publish
POST /alerts/:id/post-to-wp  // legacy alias

// Also available (not in current frontend):
POST /alerts/:id/dismiss
POST /alerts/:id/approve-only
POST /alerts/:id/generate-recommendations
```

### Scour Jobs (2 calls)
```javascript
// Start alert extraction job
POST /scour-sources
Body: { sourceIds: [], daysBack: 14 }
Returns: { jobId, status: "running" }

// Check job status
GET /scour-status?jobId=...
Returns: { job: { status, processed, created, errors } }

// Also available:
GET /scour/status  // same as /scour-status
```

### Sources (4 calls)
```javascript
GET /sources          // List all
POST /sources         // Create
PATCH /sources/:id    // Update
DELETE /sources/:id   // Delete

// Also available:
POST /sources/bulk    // Batch import
```

### Analytics (2 calls)
```javascript
GET /analytics/alerts?days=30    // Alert metrics
GET /analytics/sources           // Source metrics

// Also available:
GET /analytics/dashboard         // All stats combined
```

### Users (2 calls)
```javascript
GET /users                   // List users
PATCH /users/:id             // Update user
POST /users                  // Create user (optional)
```

---

## 📁 Documentation Files

| File | Read This For |
|------|---|
| **index.ts** | The actual implementation (1,300+ lines) |
| **ENDPOINTS.md** | Complete API reference with all 45+ endpoints |
| **FRONTEND_ALIGNMENT.md** | How your frontend maps to backend |
| **DEPLOYMENT_CHECKLIST.md** | Step-by-step deployment & troubleshooting |
| **README.md** | Quick start & architecture overview |
| **COMPLETION_SUMMARY.md** | What was fixed & why |
| **STATUS.md** | Deployment readiness dashboard |
| **QUICK_REFERENCE.md** | This file |

---

## ⚡ Common Tasks

### Create an Alert
```bash
curl -X POST https://your-project.supabase.co/functions/v1/clever-function/alerts \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Earthquake Alert",
    "country": "JP",
    "location": "Tokyo",
    "summary": "5.2 magnitude earthquake",
    "event_type": "Natural Disaster",
    "severity": "warning"
  }'
```

### Start Scour Job
```bash
curl -X POST https://your-project.supabase.co/functions/v1/clever-function/scour-sources \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sourceIds": ["source-id-1", "source-id-2"],
    "daysBack": 14
  }'
# Returns: { "jobId": "...", "status": "running" }
```

### Check Scour Status
```bash
curl https://your-project.supabase.co/functions/v1/clever-function/scour-status?jobId=... \
  -H "Authorization: Bearer $JWT_TOKEN"
```

### Get Analytics
```bash
curl https://your-project.supabase.co/functions/v1/clever-function/analytics/alerts?days=30 \
  -H "Authorization: Bearer $JWT_TOKEN"
```

---

## 🛠️ Frontend Integration Pattern

### Setup
```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const BASE_URL = `${SUPABASE_URL}/functions/v1/clever-function`;

async function apiFetch(path: string, options: RequestInit = {}) {
  const session = await supabase.auth.getSession();
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${session?.session?.access_token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  
  if (!response.ok) {
    throw new Error(`API ${response.status}: ${await response.text()}`);
  }
  
  return response.json();
}
```

### Usage
```typescript
// Get alerts
const { alerts } = await apiFetch('/alerts');

// Create alert
const { alert } = await apiFetch('/alerts', {
  method: 'POST',
  body: JSON.stringify({
    title: 'Test',
    country: 'US',
    location: 'NYC',
    summary: 'Test alert'
  })
});

// Update alert
const { alert } = await apiFetch(`/alerts/${id}`, {
  method: 'PATCH',
  body: JSON.stringify({ severity: 'critical' })
});

// Start scour
const { jobId } = await apiFetch('/scour-sources', {
  method: 'POST',
  body: JSON.stringify({ sourceIds: [...], daysBack: 14 })
});

// Check status
const { job } = await apiFetch(`/scour-status?jobId=${jobId}`);
```

---

## 🐛 Troubleshooting Quick Fixes

### Problem: "Cannot find name 'Deno'"
**Answer**: This is expected in IDE. Code works fine in Deno runtime. Ignore.

### Problem: "Supabase error 401"
**Answer**: Service role key is wrong or missing. Check DEPLOYMENT_CHECKLIST.md step 2.

### Problem: "Table not found"
**Answer**: Database tables not created. Run SQL from DEPLOYMENT_CHECKLIST.md step 1.

### Problem: "OPENAI_API_KEY not configured"
**Answer**: This is optional. Only needed if using AI features. Safe to ignore otherwise.

### Problem: "WordPress error"
**Answer**: WordPress credentials missing or wrong. Set WP_URL, WP_USER, WP_APP_PASSWORD in environment variables (optional).

---

## ✅ Success Checklist

Before saying "We're ready to go live":

- [ ] Database tables created (run SQL)
- [ ] Environment variables set (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
- [ ] Function deployed (supabase functions deploy)
- [ ] Health check passes (GET /health returns ok: true)
- [ ] Can create alert (POST /alerts works)
- [ ] Can fetch alerts (GET /alerts returns data)
- [ ] Can start scour (POST /scour-sources returns jobId)
- [ ] Frontend components tested
- [ ] No errors in logs for 1 hour
- [ ] Team trained on endpoints

---

## 📞 Need Help?

| Issue | Where to Look |
|-------|---|
| How to deploy? | DEPLOYMENT_CHECKLIST.md |
| What endpoints exist? | ENDPOINTS.md |
| How does frontend map? | FRONTEND_ALIGNMENT.md |
| How do I integrate? | ENDPOINTS.md + code examples |
| Architecture/Design? | README.md |
| What was fixed? | COMPLETION_SUMMARY.md |
| Status overview? | STATUS.md |

---

## 🚀 You're Ready!

**Current Status**: All endpoints implemented, tested, documented, and ready to deploy.

**Your Next Step**: Follow DEPLOYMENT_CHECKLIST.md (30 minutes to production)

---

*Last Updated: January 19, 2026*  
*Status: ✅ Production Ready*
