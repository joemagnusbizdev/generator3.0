# Structured Parsers: Reference Card

## Parser Types & URLs

### 1. USGS Earthquakes (usgs-atom)
- **Enforces:** M ≥ 5.5
- **Severity Mapping:**
  - M ≥ 7.0 → Critical 🔴
  - M 6.0-6.9 → Warning 🟠
  - M 5.5-5.9 → Caution 🟡
- **Feeds:**
  - Last Hour: `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.atom`
  - Last Day: `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.atom`
  - All Latest: `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.atom`

### 2. NWS CAP Alerts (cap)
- **Extracts:** severity, urgency, effective/expires, polygon bounds
- **Severity Mapping:**
  - extreme → Critical 🔴
  - severe + immediate → Critical 🔴
  - severe or expected/immediate → Warning 🟠
  - moderate → Caution 🟡
- **URL:**
  - US Alerts: `https://alerts.weather.gov/cap/us.php?x=1`

### 3. FAA Aviation (faa-nas)
- **Format:** JSON array
- **Extracts:** severity, location, coverage dates
- **Event Type:** aviation
- **URL:**
  - NAS Notices: `https://soa.smext.faa.gov/asws/api/v3/notices`

### 4. NOAA Tropical (noaa-tropical)
- **Extracts:** storm name, advisory level
- **Severity Mapping:**
  - Hurricane → Critical 🔴
  - Tropical Storm → Caution 🟡
  - Outlook/Watch → Informative + Forecast flag ⚪
- **URL:**
  - Main Feed: `https://www.nhc.noaa.gov/feed.xml`

### 5. Generic RSS/Atom (rss, atom, feed)
- **Format:** RSS 2.0 or Atom 1.0
- **Creates:** informative/general alerts
- **Best For:** Non-critical feeds, news sources
- **Example:** Any public RSS/Atom feed

---

## Adding a Source

### Minimal
```json
{
  "name": "Source Name",
  "url": "https://...",
  "type": "usgs-atom"
}
```

### Full
```json
{
  "name": "USGS Earthquakes",
  "url": "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.atom",
  "type": "usgs-atom",
  "country": "USA",
  "enabled": true
}
```

---

## How It Works

```
START: runScourWorker()
  │
  ├─ Fetch source from DB
  │
  ├─ Is source.type recognized?
  │  │
  │  ├─ YES → Try structured parser
  │  │  ├─ Success → Use parsed alerts ✓
  │  │  └─ Fail → Log & fallback to Brave/AI
  │  │
  │  └─ NO → Skip parser, go to Brave/AI
  │
  ├─ Brave Search (if query configured)
  │  └─ Scrape (if Brave fails or no query)
  │
  ├─ AI Extract (if content < 50 chars)
  │
  ├─ Deduplicate (7-day window)
  │
  └─ Persist to DB

RESULT: Alerts with metadata
  • Structured: ai_generated=false, ai_model="structured-parser"
  • AI-Extracted: ai_generated=true, ai_model="gpt-4o-mini"
```

---

## Common Tasks

### Import a Source
```bash
curl -X POST https://gnobnyzezkuyptuakztf.supabase.co/functions/v1/clever-function/sources \
  -H "Content-Type: application/json" \
  -d '{
    "name": "USGS M≥5.5",
    "url": "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.atom",
    "type": "usgs-atom"
  }'
```

### List Sources
```bash
curl https://gnobnyzezkuyptuakztf.supabase.co/functions/v1/clever-function/sources
```

### Start Scour
```bash
curl -X POST https://gnobnyzezkuyptuakztf.supabase.co/functions/v1/clever-function/scour-sources \
  -H "Content-Type: application/json" \
  -d '{"sourceIds": ["id1", "id2"], "daysBack": 14}'
```

### Check Results
```bash
curl https://gnobnyzezkuyptuakztf.supabase.co/functions/v1/clever-function/alerts/review \
  | jq '.alerts[] | {title, ai_model, severity, event_type}'
```

---

## Earthquake Alert Example

```json
{
  "id": "uuid",
  "title": "M 6.3 - 25 km E of Kuril'sk, Russia",
  "summary": "M 6.3 - 25 km E of Kuril'sk, Russia",
  "location": "25 km E of Kuril'sk, Russia",
  "country": "Unknown",
  "latitude": 54.2345,
  "longitude": 156.7890,
  "event_type": "earthquake",
  "severity": "warning",
  "ai_generated": false,
  "ai_model": "structured-parser",
  "created_at": "2026-01-22T06:50:00Z"
}
```

---

## Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| No alerts extracted | Feed unavailable | Check URL, curl raw feed |
| Wrong severity | Parsing issue | Check feed format matches type |
| Duplicates | Dedup window | Check 7-day overlap |
| Parser failed | Network timeout | Check logs, retry |
| Type ignored | Unknown type | Use from reference above |

---

## Backward Compat Check ✓

- Old sources (no type): Still work via Brave/AI
- Existing UI: No changes needed
- Dedup: Works across all source types
- Schema: No migrations required
- Rollback: Safe (remove type, use AI)

---

## Files Changed

- `supabase/functions/clever-function/index.ts` (+720 lines)
  - 5 new parsers
  - 8 helper functions
  - 1 dispatcher
  - Integration in runScourWorker()

## Size Impact

- Function: 142.6 KB (was ~135 KB)
- Parsers: ~15 KB (pure logic, minimal dependencies)
- No external imports added

---

## Deployment

```bash
# Deploy
npx supabase functions deploy clever-function --project-ref gnobnyzezkuyptuakztf

# Verify
curl https://gnobnyzezkuyptuakztf.supabase.co/functions/v1/clever-function/health
# Response: { "ok": true, "env": { ... } }
```

**Status:** ✅ Deployed & Tested

---

## Support

- **Issues:** Check function logs in Supabase dashboard
- **Questions:** See SOURCES_IMPORT.md or STRUCTURED_PARSERS.md
- **Examples:** See QUICK_START.md
- **Full Details:** See COMPLETION_SUMMARY.md
