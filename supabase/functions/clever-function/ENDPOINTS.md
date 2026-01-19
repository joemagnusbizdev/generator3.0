# Clever Function - API Endpoints Documentation

## Overview
This Supabase Edge Function provides a comprehensive REST API for managing travel safety alerts, sources, scour jobs, and trends.

## Environment Variables Required

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-key
OPENAI_API_KEY=your-openai-api-key  (optional, for AI features)
BRAVE_SEARCH_API_KEY=your-brave-api-key  (optional, for search)
WP_URL=https://your-wordpress.com  (optional, for WordPress integration)
WP_USER=your-wordpress-user  (optional)
WP_APP_PASSWORD=your-wordpress-app-password  (optional)
```

## Health & Status Endpoints

### GET /health
Health check endpoint
- **Response**: `{ ok: true, time: ISO8601, env: { AI_ENABLED, SCOUR_ENABLED, AUTO_SCOUR_ENABLED, WP_CONFIGURED } }`

### GET /last-scoured
Get timestamp of last scour job
- **Response**: `{ ok: true, lastIso: ISO8601 | null }`

### GET /analytics/dashboard?days=30
Get analytics dashboard data
- **Query Params**: `days` (default 30)
- **Response**: `{ ok: true, analytics: { totalAlerts, totalSources, byStatus, byCountry, bySeverity, period } }`

---

## Alerts Endpoints

### GET /alerts?status=draft&limit=1000
Get all alerts with optional filtering
- **Query Params**: 
  - `status`: Filter by status (draft, approved, published, dismissed)
  - `limit`: Max results (default 1000)
- **Response**: `{ ok: true, alerts: Alert[] }`

### GET /alerts/review
Get draft alerts for review
- **Response**: `{ ok: true, alerts: Alert[] }`

### POST /alerts/compile
Compile multiple alerts into a briefing
- **Body**: `{ alertIds: string[] }`
- **Response**: `{ ok: true, compiled: { id, title, alerts, created_at, alert_count } }`

### POST /alerts
Create a new alert
- **Body**: `{ title, country, location, summary, event_type, severity, ... }`
- **Required Fields**: `title`, `country`, `location`
- **Response**: `{ ok: true, alert: Alert }`

### PATCH /alerts/:id
Update an alert
- **Body**: Alert fields to update
- **Response**: `{ ok: true, alert: Alert }`

### DELETE /alerts/:id
Delete an alert
- **Response**: `{ ok: true, deleted: id }`

### POST /alerts/:id/dismiss
Dismiss an alert (change status to dismissed)
- **Response**: `{ ok: true, alert: Alert }`

### POST /alerts/:id/approve-only
Approve an alert (change status to approved)
- **Response**: `{ ok: true, alert: Alert }`

### POST /alerts/:id/approve
Approve and publish to WordPress (if configured)
- **Response**: `{ ok: true, alert: Alert, wordpress_post_id?, wordpress_url? }`

### POST /alerts/:id/publish
ALIAS: Same as `/approve` endpoint
- **Response**: `{ ok: true, alert: Alert, wordpress_post_id?, wordpress_url? }`

### POST /alerts/:id/post-to-wp
LEGACY: Same as `/approve` endpoint
- **Response**: `{ ok: true, alert: Alert, wordpress_post_id?, wordpress_url? }`

### POST /alerts/:id/generate-recommendations
Generate AI recommendations for an alert
- **Requires**: `OPENAI_API_KEY` environment variable
- **Response**: `{ ok: true, recommendations: string, alert: Alert }`

---

## Scour (Alert Extraction) Endpoints

### POST /scour-sources
Start a scour job to extract alerts from sources
- **Body**: `{ jobId?, sourceIds: string[], daysBack?: number }`
- **Response**: `{ ok: true, jobId, status: "running", total }`
- **Note**: Job runs asynchronously; poll `/scour/status` for results

### GET /scour/status?jobId=...
Get status of a scour job
- **Query Params**: `jobId` (if not provided, uses last job)
- **Response**: `{ ok: true, job: ScourJob }`

### GET /scour-status?jobId=...
ALIAS: Same as `/scour/status` - Get status of a scour job
- **Query Params**: `jobId` (if not provided, uses last job)
- **Response**: `{ ok: true, job: ScourJob }`

ScourJob structure:
```
{
  id: string,
  status: "running" | "done" | "error",
  sourceIds: string[],
  daysBack: number,
  processed: number,
  created: number,
  duplicatesSkipped: number,
  errorCount: number,
  errors: string[],
  created_at: ISO8601,
  updated_at: ISO8601,
  total: number
}
```

---

## Auto-Scour (Scheduled Scour) Endpoints

### GET /auto-scour/status
Get auto-scour status
- **Response**: `{ ok: true, enabled: boolean, intervalMinutes: number, lastRun: ISO8601 | null, envEnabled: boolean }`

### POST /auto-scour/toggle
Enable/disable auto-scour and set interval
- **Body**: `{ enabled: boolean, intervalMinutes?: number }`
- **Note**: `intervalMinutes` must be >= 30 if provided
- **Response**: `{ ok: true, enabled, intervalMinutes, message }`

### POST /auto-scour/run-now
Manually trigger an auto-scour job
- **Response**: `{ ok: true, jobId, status: "running", total, message }`
- **Note**: Uses all enabled sources

---

## Analytics Endpoints

### GET /analytics/dashboard?days=30
Get comprehensive dashboard analytics
- **Query Params**: `days` (default 30)
- **Response**: `{ ok: true, analytics: { totalAlerts, totalSources, byStatus, byCountry, bySeverity, period } }`

### GET /analytics/alerts?days=30
Get detailed alert analytics for the specified period
- **Query Params**: `days` (default 30)
- **Response**: `{ ok: true, alerts: Alert[], stats: { total, byStatus, byCountry, bySeverity, period } }`

### GET /analytics/sources
Get source performance metrics with alert counts
- **Response**: `{ ok: true, sources: Source[], stats: { total, enabled, totalAlertsFromSources } }`

---

## User Management Endpoints

### GET /users
Get all users (requires admin access)
- **Response**: `{ ok: true, users: User[] }`

### POST /users
Create a new user
- **Body**: `{ email, password?, user_metadata?, email_confirm? }`
- **Required Fields**: `email`
- **Response**: `{ ok: true, user: User }`

### PATCH /users/:id
Update a user
- **Body**: User fields to update
- **Response**: `{ ok: true, user: User }`

---

## Sources Endpoints

### GET /sources?limit=1000
Get all news/alert sources
- **Query Params**: `limit` (default 1000)
- **Response**: `{ ok: true, sources: Source[] }`

### POST /sources
Create a new source
- **Body**: `{ name, url, country?, query?, enabled?: boolean }`
- **Response**: `{ ok: true, source: Source }`

### POST /sources/bulk
Bulk upload sources (CSV/JSON compatible)
- **Body**: `Source[]` or `{ sources: Source[] }`
- **Response**: `{ ok: true, count: number, sources: Source[] }`
- **Note**: Validates URLs start with http:// or https://

### PATCH /sources/:id
Update a source
- **Body**: Source fields to update
- **Response**: `{ ok: true, source: Source }`

### DELETE /sources/:id
Delete a source
- **Response**: `{ ok: true, deleted: id }`

---

## Trends Endpoints

### POST /trends/rebuild
Rebuild trends from existing alerts (last 14 days, min 3 alerts)
- **Response**: `{ ok: true, created: number, windowDays: 14, minAlerts: 3 }`
- **Note**: Clears existing trends and recreates based on country + event_type combinations

### GET /trends?status=open&limit=1000
Get all trends
- **Query Params**: 
  - `status`: Filter by status
  - `limit`: Max results (default 1000)
- **Response**: `{ ok: true, trends: Trend[] }`

### GET /trends/:id
Get a specific trend
- **Response**: `{ ok: true, trend: Trend }`

### POST /trends
Create a new trend
- **Body**: Trend fields
- **Response**: `{ ok: true, trend: Trend }`

### PATCH /trends/:id
Update a trend
- **Body**: Trend fields to update
- **Response**: `{ ok: true, trend: Trend }`

### DELETE /trends/:id
Delete a trend
- **Response**: `{ ok: true, deleted: id }`

---

## Data Models

### Alert
```typescript
{
  id: string (UUID),
  title: string,
  summary: string,
  location: string,
  country: string,
  region?: string,
  event_type: string,
  severity: "critical" | "warning" | "caution" | "informative",
  status: "draft" | "approved" | "published" | "dismissed",
  source_url: string,
  article_url?: string,
  sources?: string,
  event_start_date?: ISO8601,
  event_end_date?: ISO8601,
  ai_generated: boolean,
  ai_model: string,
  ai_confidence?: number,
  generation_metadata?: any,
  wordpress_post_id?: number,
  wordpress_url?: string,
  recommendations?: string,
  created_at: ISO8601,
  updated_at: ISO8601
}
```

### Source
```typescript
{
  id: string (UUID),
  name: string,
  url: string (must be valid HTTP/HTTPS),
  country?: string,
  query?: string (for Brave Search),
  enabled: boolean,
  created_at: ISO8601,
  updated_at: ISO8601
}
```

### Trend
```typescript
{
  id: string (UUID),
  country: string,
  category: string (event_type),
  count: number (alert count),
  highest_severity: string,
  alert_ids: string[],
  last_seen_at: ISO8601,
  status: "open" | string,
  created_at: ISO8601,
  updated_at: ISO8601
}
```

---

## Error Responses

All endpoints return error responses in this format:
```json
{
  "ok": false,
  "error": "Error description"
}
```

Common status codes:
- `200`: Success
- `400`: Bad request (missing required fields, invalid input)
- `404`: Not found (resource doesn't exist)
- `500`: Server error

---

## Deployment Requirements

### Supabase Setup

1. **Create required tables**:
   ```sql
   CREATE TABLE alerts (
     id UUID PRIMARY KEY,
     title TEXT NOT NULL,
     summary TEXT,
     location TEXT NOT NULL,
     country TEXT NOT NULL,
     region TEXT,
     event_type TEXT,
     severity TEXT CHECK (severity IN ('critical', 'warning', 'caution', 'informative')),
     status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'published', 'dismissed')),
     source_url TEXT,
     article_url TEXT,
     sources TEXT,
     event_start_date TIMESTAMPTZ,
     event_end_date TIMESTAMPTZ,
     ai_generated BOOLEAN DEFAULT false,
     ai_model TEXT,
     ai_confidence FLOAT,
     generation_metadata JSONB,
     wordpress_post_id INTEGER,
     wordpress_url TEXT,
     recommendations TEXT,
     created_at TIMESTAMPTZ DEFAULT NOW(),
     updated_at TIMESTAMPTZ DEFAULT NOW()
   );

   CREATE TABLE sources (
     id UUID PRIMARY KEY,
     name TEXT NOT NULL,
     url TEXT NOT NULL,
     country TEXT,
     query TEXT,
     enabled BOOLEAN DEFAULT true,
     created_at TIMESTAMPTZ DEFAULT NOW(),
     updated_at TIMESTAMPTZ DEFAULT NOW()
   );

   CREATE TABLE trends (
     id UUID PRIMARY KEY,
     country TEXT NOT NULL,
     category TEXT NOT NULL,
     count INTEGER,
     highest_severity TEXT,
     alert_ids UUID[],
     last_seen_at TIMESTAMPTZ,
     status TEXT DEFAULT 'open',
     created_at TIMESTAMPTZ DEFAULT NOW(),
     updated_at TIMESTAMPTZ DEFAULT NOW()
   );

   CREATE TABLE app_kv (
     key TEXT PRIMARY KEY,
     value JSONB,
     updated_at TIMESTAMPTZ DEFAULT NOW()
   );
   ```

2. **Create indexes for performance**:
   ```sql
   CREATE INDEX idx_alerts_status ON alerts(status);
   CREATE INDEX idx_alerts_created_at ON alerts(created_at DESC);
   CREATE INDEX idx_alerts_country ON alerts(country);
   CREATE INDEX idx_sources_enabled ON sources(enabled);
   CREATE INDEX idx_trends_country_category ON trends(country, category);
   ```

3. **Set up Edge Function**:
   - Deploy this file as a Supabase Edge Function named `clever-function`
   - Set environment variables in Supabase dashboard

4. **Enable AI Features (Optional)**:
   - Get OpenAI API key from https://platform.openai.com
   - Set `OPENAI_API_KEY` environment variable

5. **Enable Search Features (Optional)**:
   - Get Brave Search API key from https://brave.com/search/api/
   - Set `BRAVE_SEARCH_API_KEY` environment variable

6. **Enable WordPress Integration (Optional)**:
   - Set WordPress credentials for auto-publishing
   - WordPress user needs permission to create posts

---

## Frontend Integration Examples

### Fetch All Alerts
```javascript
const response = await fetch('https://your-project.supabase.co/functions/v1/clever-function/alerts', {
  headers: { 'Authorization': 'Bearer ' + session.access_token }
});
const { alerts } = await response.json();
```

### Start a Scour Job
```javascript
const jobId = crypto.randomUUID();
const response = await fetch('https://your-project.supabase.co/functions/v1/clever-function/scour-sources', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer ' + session.access_token },
  body: JSON.stringify({
    jobId,
    sourceIds: ['source-1', 'source-2'],
    daysBack: 14
  })
});
const { jobId } = await response.json();

// Poll for status
setInterval(async () => {
  const statusRes = await fetch(
    `https://your-project.supabase.co/functions/v1/clever-function/scour/status?jobId=${jobId}`,
    { headers: { 'Authorization': 'Bearer ' + session.access_token } }
  );
  const { job } = await statusRes.json();
  if (job.status === 'done' || job.status === 'error') {
    // Job complete
  }
}, 5000);
```

### Approve and Publish Alert
```javascript
const response = await fetch(
  'https://your-project.supabase.co/functions/v1/clever-function/alerts/alert-id/approve',
  {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + session.access_token }
  }
);
const { alert, wordpress_url } = await response.json();
```

---

## Notes

- All timestamps are in ISO 8601 format (UTC)
- Path normalization supports both `/alerts` and `/clever-function/alerts` formats
- CORS headers are included on all responses
- Scour jobs run asynchronously; use job ID to poll status
- AI-powered duplicate detection and recommendation generation require OpenAI API
- WordPress integration optional; function works without it
