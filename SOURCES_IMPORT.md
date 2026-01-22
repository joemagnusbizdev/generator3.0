# Sources Import Guide

## Adding New Structured Feed Sources

You can now import structured data sources with the following types:

### Supported Source Types

#### USGS Earthquakes (USGS Atom)
- **Type:** `usgs-atom` or `usgs`
- **Format:** Atom feed with geographic point data
- **Auto-filtering:** Enforces magnitude ≥ 5.5
- **Example:**
```json
{
  "name": "USGS Earthquakes - Last Hour",
  "url": "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.atom",
  "type": "usgs-atom",
  "country": "USA",
  "enabled": true
}
```

#### NWS CAP Weather Alerts
- **Type:** `cap` or `nws-cap`
- **Format:** Common Alerting Protocol (CAP) Atom feed
- **Features:** Parses severity, urgency, polygon geometries, effective/expires dates
- **Example:**
```json
{
  "name": "NWS Weather Alerts (USA)",
  "url": "https://alerts.weather.gov/cap/us.php?x=1",
  "type": "cap",
  "country": "USA",
  "enabled": true
}
```

#### FAA Notices (FAA NAS JSON)
- **Type:** `faa-nas` or `faa-json`
- **Format:** JSON array of aviation notices/NOTAMs
- **Features:** Parses severity, location, effective/expires dates
- **Example:**
```json
{
  "name": "FAA Flight Activity Notices",
  "url": "https://soa.smext.faa.gov/asws/api/v3/notices",
  "type": "faa-nas",
  "country": "USA",
  "enabled": true
}
```

#### NOAA Tropical Cyclones
- **Type:** `noaa-tropical` or `noaa`
- **Format:** Atom feed for tropical cyclone advisories
- **Features:** Extracts storm names, maps to hurricane/tropical storm/outlook severity
- **Example:**
```json
{
  "name": "NOAA NHC Tropical Cyclones",
  "url": "https://www.nhc.noaa.gov/feed.xml",
  "type": "noaa-tropical",
  "country": "USA",
  "enabled": true
}
```

#### Generic RSS/Atom Feeds
- **Type:** `rss`, `atom`, or `feed`
- **Format:** RSS 2.0 or Atom 1.0
- **Features:** Minimal mapping; all alerts marked as `informative` / `general`
- **Example:**
```json
{
  "name": "Generic News Feed",
  "url": "https://example.com/feed.xml",
  "type": "rss",
  "country": "Unknown",
  "enabled": true
}
```

### Backward Compatibility

Sources **without** a `type` field will:
1. Attempt Brave Search (if query is present + Brave API configured)
2. Fall back to web scraping
3. Extract alerts using OpenAI GPT-4o-mini

This ensures existing sources continue to work without modification.

### Bulk Import Example

```bash
curl -X POST https://gnobnyzezkuyptuakztf.supabase.co/functions/v1/clever-function/sources/bulk \
  -H "Content-Type: application/json" \
  -d '[
    {
      "name": "USGS Earthquakes - Last Hour",
      "url": "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.atom",
      "type": "usgs-atom"
    },
    {
      "name": "NWS Weather Alerts",
      "url": "https://alerts.weather.gov/cap/us.php?x=1",
      "type": "cap"
    },
    {
      "name": "FAA Aviation Notices",
      "url": "https://soa.smext.faa.gov/asws/api/v3/notices",
      "type": "faa-nas"
    },
    {
      "name": "NOAA Tropical Cyclones",
      "url": "https://www.nhc.noaa.gov/feed.xml",
      "type": "noaa-tropical"
    }
  ]'
```

### Verification

After import:
1. GET `/sources` to list all sources
2. POST `/scour-sources` with source IDs to start a scour job
3. GET `/alerts/review` to see generated draft alerts
4. Verify earthquake alerts have magnitude ≥ 5.5
5. Check that structured alerts have `ai_model: "structured-parser"`

### Troubleshooting

If no alerts are extracted:
- **USGS:** Feed may have no entries, or all earthquakes below M5.5
- **CAP:** Polygon parsing may fail; check areaDesc is populated
- **FAA:** JSON structure might differ; check API response format
- **NOAA:** Feed format may have changed; check raw XML structure
- **Generic RSS/Atom:** May need AI fallback if feed format is non-standard

Check function logs for parse warnings and errors.
