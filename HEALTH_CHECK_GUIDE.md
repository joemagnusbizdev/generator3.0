# Scour Health Check Agent

Daily automated health monitoring for the scour system. Checks endpoint availability, runs test scours, monitors for stuck jobs, and validates performance.

## Quick Start

### 1. Deploy the Health Check Function

```bash
# Deploy to Supabase
supabase functions deploy health-check

# Or via Vercel (git push)
git push origin main
```

### 2. Configure Environment Variables

Set these in your Supabase Edge Functions settings:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-key
TELEGRAM_BOT_TOKEN=your-bot-token (from @BotFather)
TELEGRAM_ALERT_CHAT_ID=your-chat-id (your Telegram chat or group ID)
```

**Getting these values:**
- `TELEGRAM_BOT_TOKEN`: Create a bot with @BotFather on Telegram, copy the token
- `TELEGRAM_ALERT_CHAT_ID`: Send `/start` to @userinfobot to get your chat ID, or add bot to a group and get the group ID

### 3. Set Up Daily Triggers

**Option A: GitHub Actions (Recommended)**

Create `.github/workflows/daily-health-check.yml`:

```yaml
name: Daily Scour Health Check

on:
  schedule:
    - cron: '0 2 * * *'  # 2 AM UTC daily

jobs:
  health-check:
    runs-on: ubuntu-latest
    steps:
      - name: Run Health Check
        run: |
          curl -X POST https://generator30.vercel.app/functions/v1/health-check \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
            -H "Content-Type: application/json" \
            -d '{}'
```

**Option B: Cron Service (EasyCron, Healthchecks.io)**

Set up a webhook to call:
```
POST https://generator30.vercel.app/functions/v1/health-check
```

**Option C: Linux Cron (Self-Hosted)**

```bash
# Add to crontab
0 2 * * * curl -X POST https://generator30.vercel.app/functions/v1/health-check
```

## What Gets Checked

### 1️⃣ Endpoint Health (`/scour-worker`)
- ✓ Endpoint is reachable
- ✓ Response latency < 5 seconds
- ✓ All dependencies (Supabase) are accessible

### 2️⃣ Test Scour Execution
- ✓ Can submit a scour job successfully
- ✓ Job progresses to completion (60 second timeout)
- ✓ Produces valid alert data (no negative counts)

### 3️⃣ Job Monitoring
- ✓ No jobs stuck in "running" state for >30 minutes
- ✓ All jobs eventually complete or error out
- ✓ No orphaned jobs blocking new submissions

### 4️⃣ Performance Metrics
- ✓ Average scour duration < 5 minutes
- ✓ Maximum scour duration < 15 minutes
- ✓ No performance degradation over time

## Alert Behavior

### ✅ Healthy Status
- All checks pass
- Results logged for historical tracking
- No action needed

### ⚠️ Degraded Status
- 1-2 checks fail
- Status logged with recommendations
- Check database for details

### 🚨 Critical Status
- 3+ checks fail
- Status logged with urgent recommendations
- Review `app_health_checks` table immediately

## Historical Tracking

Health check results are saved to `app_health_checks` table:

```sql
-- View recent health checks
SELECT timestamp, overall_status, checks 
FROM app_health_checks 
ORDER BY timestamp DESC 
LIMIT 10;

-- Check for patterns
SELECT overall_status, COUNT(*) 
FROM app_health_checks 
WHERE timestamp > NOW() - INTERVAL '7 days'
GROUP BY overall_status;
```

## Manual Trigger

Test the health check manually:

```bash
curl -X POST https://generator30.vercel.app/functions/v1/health-check \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"
```

## Response Format

```json
{
  "timestamp": "2026-02-25T14:30:00Z",
  "overall_status": "healthy|degraded|critical",
  "checks": {
    "endpoint_health": {
      "status": "pass|fail",
      "message": "...",
      "latency_ms": 234
    },
    "test_scour": {
      "status": "pass|fail",
      "message": "...",
      "duration_ms": 4500
    },
    "job_monitoring": {
      "status": "pass|fail",
      "message": "...",
      "stuck_jobs": 0
    },
    "performance": {
      "status": "pass|fail",
      "message": "...",
      "avg_duration_ms": 120000
    }
  },
  "errors": [],
  "recommendations": []
}
```

## Troubleshooting

### Health check not running daily
- Verify cron service is configured correctly
- Check GitHub Actions is enabled on repo
- Test manual trigger: `curl https://generator30.vercel.app/functions/v1/health-check`

### Not receiving Telegram alerts
- Verify `TELEGRAM_BOT_TOKEN` is correct (format: `123456:ABCDEFGHijklmnopqrstuvwxyz`)
- Verify `TELEGRAM_ALERT_CHAT_ID` is numeric and correct
- Test by manually running the health check and checking Telegram
- Ensure bot has permission to send messages (added to chat/group if needed)

### Test scour always fails
- Ensure at least 2 sources are enabled: `SELECT COUNT(*) FROM sources WHERE enabled=true;`
- Check source URLs are accessible
- Verify OpenAI/Claude keys are configured for AI extraction

### "Job monitoring" always fails
- This is normal if jobs regularly run for 20+ minutes
- Adjust timeout threshold in `checkJobMonitoring()` if needed
- Or implement automatic timeout/recovery for stuck jobs

## Advanced Configuration

### Custom Alert List

Modify `ALERT_EMAIL` to include multiple addresses:

```env
ALERT_EMAIL=joe@magnus.ai,ops@magnus.ai,engineering@magnus.ai
```

### Adjust Check Thresholds

Edit `health-check/index.ts`:

```typescript
// Line 228: Change endpoint latency threshold
if (latency > 5000) { // Change to 10000 for 10s

// Line 291: Change stuck job threshold
const thirtyMinsAgo = // Change to 60 mins for longer timeout

// Line 323: Change performance threshold
if (avgDuration > 5 * 60 * 1000) { // Change to 10m for more lenient
```

### Custom Test Source

Modify test source selection:

```typescript
// Line 253: Instead of limit 2, select specific sources
const testSources = await querySupabase(
  "sources", 
  `id=in.("rss-1","rss-2")` // Test only RSS sources
);
```

## Deployment

```bash
# Add to git
git add supabase/functions/health-check/

# Commit
git commit -m "Add daily health check agent for scour monitoring"

# Push (auto-deploys to Vercel + Supabase)
git push origin main

# Verify deployment
curl https://generator30.vercel.app/functions/v1/health-check
```

## Dashboard View

To see health check history in UI, add a dashboard page:

```typescript
// src1/pages/HealthDashboard.tsx
export default function HealthDashboard() {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    // Fetch last 30 days of health checks
    apiFetchJson('/app_health_checks?order=timestamp.desc&limit=30')
      .then(data => setHistory(data));
  }, []);

  return (
    <div>
      <h1>Scour System Health</h1>
      {history.map(check => (
        <div key={check.timestamp} className="check-result">
          <span className={`status ${check.overall_status}`}>
            {check.overall_status}
          </span>
          <span>{new Date(check.timestamp).toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}
```

---

**Status**: ✅ Production Ready
**Last Updated**: 2026-02-25
**Next Check**: Daily at 2 AM UTC
