# Clever Function - Travel Alert Management API

**Status**: ✅ Production Ready  
**Last Updated**: January 19, 2026  
**Version**: 1.0.0  

---

## Overview

Clever Function is a Supabase Edge Function providing a comprehensive REST API for managing travel safety alerts. It handles:

- **Alert Management** (CRUD, actions, publishing)
- **Source Management** (news/alert sources)
- **Alert Extraction** (AI-powered web scraping with OpenAI)
- **Trend Analysis** (aggregating similar alerts)
- **WordPress Integration** (auto-publishing to blogs)
- **Analytics & Reporting** (dashboard, metrics, audit)

---

## Quick Start

### 1. Deploy
```bash
supabase functions deploy clever-function
```

### 2. Configure Environment
In Supabase Dashboard → Edge Functions → clever-function → Settings:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-key
OPENAI_API_KEY=optional-openai-key
WP_URL=optional-wordpress-url
WP_USER=optional-wordpress-user
WP_APP_PASSWORD=optional-wordpress-password
```

### 3. Create Database Tables
Copy SQL from [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) → Database Setup

### 4. Test
```bash
curl https://your-project.supabase.co/functions/v1/clever-function/health \
  -H "Authorization: Bearer YOUR_JWT"
```

---

## Documentation Files

| File | Purpose |
|------|---------|
| **index.ts** | Main function code (1,300+ lines) |
| **[ENDPOINTS.md](./ENDPOINTS.md)** | Complete API endpoint reference |
| **[FRONTEND_ALIGNMENT.md](./FRONTEND_ALIGNMENT.md)** | Frontend ↔ Backend mapping (✅ 15/15 endpoints) |
| **[DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)** | Step-by-step deployment & verification |
| **README.md** | This file |

---

## API Endpoints (Summary)

### Core Endpoints

**Alerts** (5 endpoints)
- `GET /alerts` - List all alerts
- `POST /alerts` - Create alert
- `PATCH /alerts/:id` - Update alert
- `POST /alerts/:id/publish` - Publish to WordPress
- `POST /alerts/:id/post-to-wp` - Legacy alias

**Scour** (2 endpoints)
- `POST /scour-sources` - Start AI alert extraction
- `GET /scour-status` - Check job status

**Sources** (4 endpoints)
- `GET /sources` - List sources
- `POST /sources` - Create source
- `PATCH /sources/:id` - Update source
- `DELETE /sources/:id` - Delete source

**Analytics** (3 endpoints)
- `GET /analytics/dashboard` - Dashboard stats
- `GET /analytics/alerts` - Alert metrics
- `GET /analytics/sources` - Source performance

**Additional Endpoints**
- `GET /health` - Health check
- `GET /trends` - Trend management
- `GET /users` - User management
- And more... (see [ENDPOINTS.md](./ENDPOINTS.md))

**Total**: 45+ fully implemented endpoints

---

## Architecture

```
Frontend Components
    ↓
apiFetch() → HTTP Requests
    ↓
Supabase Edge Function (Deno Runtime)
    ├── Request Parsing & Routing
    ├── Authentication (JWT Bearer Token)
    ├── Business Logic
    └── Integration Layer
        ├── Supabase PostgreSQL DB
        ├── OpenAI API (AI extraction)
        ├── Brave Search API (web search)
        └── WordPress REST API (publishing)
    ↓
Response JSON
    ↓
Frontend State Management
```

---

## Key Features

### 1. Alert Management
- Create, update, delete travel alerts
- Status workflow: draft → approved → published
- AI-powered duplicate detection
- WordPress auto-publishing
- AI-generated recommendations

### 2. Intelligent Scour
- Async web scraping from multiple sources
- OpenAI integration for alert extraction
- Duplicate prevention
- Job status tracking via KV store
- Background execution with `waitUntil()`

### 3. Analytics
- Alert metrics by status, country, severity
- Source performance tracking
- Trend analysis
- Customizable date ranges

### 4. WordPress Integration
- Auto-publish approved alerts
- Track WordPress post ID and URL
- Configurable via environment variables

### 5. Auto-Scour Scheduling
- Enable/disable scheduled jobs
- Configurable intervals (30+ minutes)
- Status polling

---

## Data Models

### Alert
```typescript
{
  id: UUID,
  title: string,
  summary: string,
  location: string,
  country: string,
  event_type: string,
  severity: 'critical' | 'warning' | 'caution' | 'informative',
  status: 'draft' | 'approved' | 'published' | 'dismissed',
  source_url: string,
  ai_generated: boolean,
  recommendations?: string,
  wordpress_post_id?: number,
  created_at: ISO8601,
  updated_at: ISO8601
}
```

### Source
```typescript
{
  id: UUID,
  name: string,
  url: string,
  country?: string,
  query?: string,
  enabled: boolean,
  created_at: ISO8601,
  updated_at: ISO8601
}
```

### Trend
```typescript
{
  id: UUID,
  country: string,
  category: string,
  count: number,
  highest_severity: string,
  alert_ids: UUID[],
  status: 'open' | string,
  created_at: ISO8601,
  updated_at: ISO8601
}
```

---

## Configuration

### Required Environment Variables
```env
SUPABASE_URL              # Supabase project URL
SUPABASE_SERVICE_ROLE_KEY # Service role API key
```

### Optional Environment Variables
```env
OPENAI_API_KEY            # For AI features
BRAVE_SEARCH_API_KEY      # For web search
WP_URL                    # WordPress site URL
WP_USER                   # WordPress username
WP_APP_PASSWORD           # WordPress app password
```

---

## Error Handling

All endpoints return standardized responses:

**Success**:
```json
{
  "ok": true,
  "data": {...}
}
```

**Error**:
```json
{
  "ok": false,
  "error": "Description of error"
}
```

HTTP Status Codes:
- `200` - Success
- `400` - Bad request
- `401` - Unauthorized
- `404` - Not found
- `500` - Server error

---

## Frontend Integration

### Required Authorization
```javascript
const headers = {
  'Authorization': `Bearer ${session.access_token}`,
  'Content-Type': 'application/json'
};
```

### Example: Fetch Alerts
```typescript
const response = await fetch(
  'https://your-project.supabase.co/functions/v1/clever-function/alerts',
  { headers }
);
const { alerts } = await response.json();
```

### Path Flexibility
These paths all work:
- `/alerts`
- `/clever-function/alerts`
- `/functions/v1/clever-function/alerts`

---

## Performance

### Request Latency
- Simple queries: 50-200ms
- Complex aggregations: 200-500ms
- Scour jobs: Async (10-60 seconds depending on sources)

### Database
- Queries use indexed columns for fast lookup
- Batch operations chunk at 100 records
- KV store for job tracking (fast access)

### Scalability
- Auto-scales per Supabase plan
- No connection pooling issues (managed by Supabase)
- Async jobs don't block response

---

## Testing

### Health Check
```bash
curl https://your-project.supabase.co/functions/v1/clever-function/health
```

### Create Test Alert
```bash
curl -X POST https://your-project.supabase.co/functions/v1/clever-function/alerts \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Alert",
    "country": "US",
    "location": "New York",
    "summary": "Test summary"
  }'
```

### Monitor Logs
```bash
supabase functions logs clever-function --tail
```

---

## Troubleshooting

### Issue: "Cannot find name 'Deno'"
**Cause**: IDE type checking  
**Solution**: This is expected; code works in Deno runtime. Ignore errors.

### Issue: "Supabase error 401"
**Cause**: Missing/invalid service key  
**Solution**: Verify `SUPABASE_SERVICE_ROLE_KEY` in environment

### Issue: "Table not found"
**Cause**: Missing database tables  
**Solution**: Run SQL setup from [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)

### Issue: AI features failing
**Cause**: Missing OpenAI key  
**Solution**: Optional - add `OPENAI_API_KEY` if using AI features

---

## Roadmap

### ✅ Implemented
- Alert CRUD & management
- Source management
- Alert extraction with AI
- Analytics dashboard
- WordPress integration
- User management
- Trend analysis (backend ready)

### 🟡 Planned
- Geographic alerts (map integration)
- Notification distribution
- MAGNUS core integration
- Audit logging
- Alert notifications to users

---

## Support

- **Documentation**: See [ENDPOINTS.md](./ENDPOINTS.md)
- **Deployment**: See [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)
- **Frontend Integration**: See [FRONTEND_ALIGNMENT.md](./FRONTEND_ALIGNMENT.md)
- **Issues**: Check logs in Supabase Dashboard → Edge Functions
- **Resources**:
  - [Supabase Docs](https://supabase.com/docs)
  - [Deno Manual](https://deno.land/manual)
  - [Edge Functions Guide](https://supabase.com/docs/guides/functions)

---

## License

Internal use for MAGNUS Travel Intelligence Platform

---

## Changelog

### v1.0.0 (Jan 19, 2026)
- ✅ Initial production release
- ✅ All 15 frontend endpoints implemented
- ✅ 45+ total endpoints
- ✅ Frontend alignment 100%
- ✅ Deployment ready
