# Frontend ↔ Backend API Alignment Report

**Generated**: January 19, 2026  
**Status**: ✅ ALIGNED - All current frontend endpoints implemented

---

## Summary

| Category | Frontend Calls | Backend Status | Notes |
|----------|---|---|---|
| **Alerts** | 5 endpoints | ✅ All Implemented | Includes `/publish` alias for `/approve` |
| **Scour** | 2 endpoints | ✅ All Implemented | Includes `/scour-status` alias |
| **Sources** | 4 endpoints | ✅ All Implemented | All CRUD operations |
| **Analytics** | 2 endpoints | ✅ All Implemented | Added `/analytics/alerts` and `/analytics/sources` |
| **Users** | 2 endpoints | ✅ All Implemented | Added user management endpoints |
| **Total CURRENT** | **15 endpoints** | **✅ 15/15 IMPLEMENTED** | **100% Coverage** |

---

## Detailed Alignment

### ✅ Authentication (Auth)
**Status**: Handled by Supabase Auth (not Edge Function)
- `supabase.auth.getSession()` → Supabase client
- `supabase.auth.onAuthStateChange()` → Supabase client
- *Note: User sessions passed via Authorization header*

---

### ✅ Alerts Management

| Frontend Call | Backend Endpoint | Status | Notes |
|---|---|---|---|
| `GET /alerts` | `GET /alerts?status=...&limit=...` | ✅ | Query params: `status`, `limit` |
| `POST /alerts` | `POST /alerts` | ✅ | Creates draft alert |
| `PATCH /alerts/:id` | `PATCH /alerts/:id` | ✅ | Updates any fields |
| `POST /alerts/:id/publish` | `POST /alerts/:id/publish` | ✅ | **NEW** - Publishes to WordPress |
| `POST /alerts/:id/post-to-wp` | `POST /alerts/:id/post-to-wp` | ✅ | Legacy alias for `/publish` |

**Additional Endpoints Available** (not in current frontend):
- `GET /alerts/review` - Draft alerts for review
- `POST /alerts/compile` - Compile multiple alerts
- `POST /alerts/:id/dismiss` - Change status to dismissed
- `POST /alerts/:id/approve-only` - Approve without WordPress publish
- `POST /alerts/:id/generate-recommendations` - AI recommendations (requires `OPENAI_API_KEY`)

---

### ✅ Scour (Alert Extraction)

| Frontend Call | Backend Endpoint | Status | Notes |
|---|---|---|---|
| `POST /scour-sources` | `POST /scour-sources` | ✅ | Starts async job, returns `jobId` |
| `GET /scour-status?jobId=...` | `GET /scour-status?jobId=...` | ✅ | **FIXED** - Now supports both `/scour-status` and `/scour/status` |

**Response Format**:
```json
{
  "ok": true,
  "job": {
    "id": "uuid",
    "status": "running|done|error",
    "total": 5,
    "processed": 3,
    "created": 2,
    "duplicatesSkipped": 0,
    "errorCount": 0,
    "errors": []
  }
}
```

**Additional Endpoints Available**:
- `GET /auto-scour/status` - Check if auto-scour enabled
- `POST /auto-scour/toggle` - Enable/disable auto-scour
- `POST /auto-scour/run-now` - Manually trigger scheduled scour

---

### ✅ Sources Management

| Frontend Call | Backend Endpoint | Status | Notes |
|---|---|---|---|
| `GET /sources` | `GET /sources?limit=...` | ✅ | Query param: `limit` (default 1000) |
| `POST /sources` | `POST /sources` | ✅ | Creates new source |
| `PATCH /sources/:id` | `PATCH /sources/:id` | ✅ | Updates source fields |
| `DELETE /sources/:id` | `DELETE /sources/:id` | ✅ | Hard delete |

**Additional Endpoints**:
- `POST /sources/bulk` - Batch import sources (CSV/JSON compatible)

---

### ✅ Analytics

| Frontend Call | Backend Endpoint | Status | Notes |
|---|---|---|---|
| `GET /analytics/alerts` | `GET /analytics/alerts?days=...` | ✅ | **NEW** - Alert-specific analytics |
| `GET /analytics/sources` | `GET /analytics/sources` | ✅ | **NEW** - Source performance metrics |

**Available Response Fields**:
```json
{
  "ok": true,
  "analytics": {
    "totalAlerts": 42,
    "totalSources": 5,
    "byStatus": { "draft": 10, "approved": 20, "published": 12 },
    "byCountry": { "US": 20, "JP": 15, "FR": 7 },
    "bySeverity": { "critical": 5, "warning": 10, "caution": 15, "informative": 12 },
    "period": "Last 30 days"
  }
}
```

**Dashboard Endpoint** (also available):
- `GET /analytics/dashboard?days=30` - Consolidated dashboard data

---

### ✅ User Management

| Frontend Call | Backend Endpoint | Status | Notes |
|---|---|---|---|
| `GET /users` | `GET /users` | ✅ | **NEW** - List all users |
| `PATCH /users/:id` | `PATCH /users/:id` | ✅ | **NEW** - Update user details |

**Additional User Endpoints**:
- `POST /users` - Create new user account

---

## Roadmap Features (Not Yet Implemented)

These endpoints are planned but not yet in frontend or backend:

### Trends
- `GET /trends` - List all trends
- `GET /trends/:id` - Get specific trend
- `POST /alerts/:id/link-trend` - Link alert to trend
- `POST /trends/rebuild` - Rebuild trends from alerts (backend: ✅ ready)

### Geolocation & Maps
- `GET /alerts/geo` - Geographic data for map
- `POST /alerts/:id/geo` - Set geographic metadata

### Distribution & Notifications
- `POST /alerts/:id/notify` - Send notifications
- `GET /alerts/:id/delivery-status` - Track notification delivery

### MAGNUS Core Integration
- `POST /garmin/ecc/alert-link` - Link to MAGNUS system
- `GET /clients/:id/alerts` - Get alerts for specific client

### Audit & Control
- `GET /audit/logs` - Audit trail
- `POST /alerts/:id/lock` - Lock alert from editing

---

## Path Normalization

The backend handles multiple path formats automatically:

```
/alerts                          → /alerts
/clever-function/alerts          → /alerts
/functions/v1/clever-function/alerts  → /alerts
```

**Frontend Implications**: You can use any format; they all work!

---

## Environment Variables Required

For full functionality, configure these in your Supabase project:

```env
# Required
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-key

# Optional - AI Features
OPENAI_API_KEY=your-openai-key
OPENAI_KEY=your-openai-key  (alternative)

# Optional - Search
BRAVE_SEARCH_API_KEY=your-brave-key

# Optional - WordPress Publishing
WP_URL=https://your-wordpress.com
WP_USER=admin
WP_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
```

---

## Frontend Implementation Patterns

### Basic Alert Fetch
```typescript
const response = await fetch('/alerts', {
  headers: { 'Authorization': `Bearer ${session.access_token}` }
});
const { alerts } = await response.json();
```

### Start Scour Job & Poll Status
```typescript
// Start job
const scourRes = await fetch('/scour-sources', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${session.access_token}` },
  body: JSON.stringify({
    sourceIds: ['id1', 'id2'],
    daysBack: 14
  })
});
const { jobId } = await scourRes.json();

// Poll status
const interval = setInterval(async () => {
  const statusRes = await fetch(`/scour-status?jobId=${jobId}`, {
    headers: { 'Authorization': `Bearer ${session.access_token}` }
  });
  const { job } = await statusRes.json();
  
  if (job.status === 'done' || job.status === 'error') {
    clearInterval(interval);
    console.log(`Processed: ${job.processed}, Created: ${job.created}`);
  }
}, 2000);
```

### Publish Alert to WordPress
```typescript
const response = await fetch(`/alerts/${alertId}/publish`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${session.access_token}` }
});
const { alert, wordpress_url } = await response.json();
```

---

## CORS Configuration

All endpoints respond with CORS headers:
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS
Access-Control-Allow-Headers: authorization, content-type, apikey
```

---

## Testing Checklist

Before deploying to production, verify:

- [ ] All 5 alert endpoints respond correctly
- [ ] Scour job starts and status can be polled
- [ ] Sources CRUD operations work
- [ ] `/analytics/alerts` returns alert data
- [ ] `/analytics/sources` returns source metrics
- [ ] User endpoints return user list (if user mgmt enabled)
- [ ] CORS headers present on all responses
- [ ] Environment variables configured in Supabase
- [ ] Database tables exist: `alerts`, `sources`, `trends`, `app_kv`

---

## Deployment Readiness

**Current Status**: ✅ Production Ready for Current Features

**Before Deployment**:
1. ✅ Code: All endpoints implemented
2. ⚠️ Environment: Verify all required env vars configured
3. ⚠️ Database: Confirm tables exist and have correct schema
4. ⚠️ Permissions: Service role key has correct access

**Deploy Command**:
```bash
supabase functions deploy clever-function
```

**Monitor After Deployment**:
- Check Supabase Edge Function logs for errors
- Test critical paths with frontend
- Monitor for integration errors

---

## Support for Planned Features

The backend code has structural support for future endpoints:

✅ **Trends** - `POST /trends/rebuild`, `GET /trends`, `GET /trends/:id`, etc. (all implemented)  
🟡 **Geo** - Requires schema update to store coordinates  
🟡 **Distribution** - Requires notification service integration  
🟡 **MAGNUS** - Requires API key and partner integration  
🟡 **Audit** - Requires audit table and logging middleware
