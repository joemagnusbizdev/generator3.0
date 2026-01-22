# Quick Start: Structured Sources

## 1-Minute Setup

### Import Example Sources
```bash
curl -X POST https://gnobnyzezkuyptuakztf.supabase.co/functions/v1/clever-function/sources/bulk \
  -H "Content-Type: application/json" \
  -d '[
    {"name": "USGS M≥5.5 Earthquakes", "url": "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.atom", "type": "usgs-atom"},
    {"name": "NWS Weather Alerts", "url": "https://alerts.weather.gov/cap/us.php?x=1", "type": "cap"},
    {"name": "NOAA Tropical", "url": "https://www.nhc.noaa.gov/feed.xml", "type": "noaa-tropical"}
  ]'
```

### Start Scour
```bash
# Get source IDs from POST response above, then:
curl -X POST https://gnobnyzezkuyptuakztf.supabase.co/functions/v1/clever-function/scour-sources \
  -H "Content-Type: application/json" \
  -d '{"sourceIds": ["ID1", "ID2", "ID3"], "daysBack": 14}'
```

### Check Results
```bash
# Review draft alerts
curl https://gnobnyzezkuyptuakztf.supabase.co/functions/v1/clever-function/alerts/review

# Verify structured parser worked
curl https://gnobnyzezkuyptuakztf.supabase.co/functions/v1/clever-function/alerts \
  | jq '.alerts[] | select(.ai_model == "structured-parser") | {title, severity, event_type}'
```

## Source Types Reference

| Type | Format | Key Feature | Example URL |
|------|--------|-------------|-------------|
| `usgs-atom` | Atom | Enforces M≥5.5 | `earthquake.usgs.gov/.../all_hour.atom` |
| `cap` | CAP Atom | Severity + polygon | `alerts.weather.gov/cap/us.php` |
| `faa-nas` | JSON | Aviation notices | `soa.smext.faa.gov/asws/api/v3/notices` |
| `noaa-tropical` | Atom | Cyclone advisories | `nhc.noaa.gov/feed.xml` |
| `rss` / `atom` | RSS 2.0/Atom | Generic feeds | Any standard feed |
| *(none)* | Any | AI extraction | Uses Brave + GPT-4o-mini |

## What Changed

✅ **New:** Structured parsers for USGS, CAP, FAA, NOAA  
✅ **New:** Automatic fallback to Brave/AI if parser fails  
✅ **Safe:** No changes to existing sources  
✅ **Safe:** Dedup works across all source types  
✅ **Safe:** Unknown types skip silently  

## Earthquake Alerts: M≥5.5 Only

USGS parser enforces threshold:
- M 7.0+  → **critical** 🔴
- M 6.0-6.9 → **warning** 🟠
- M 5.5-5.9 → **caution** 🟡
- M < 5.5 → **filtered out** ✗

## Troubleshooting

| Issue | Solution |
|-------|----------|
| No alerts extracted | Check raw feed: `curl <url> \| head -20` |
| Wrong source type | Use from Reference table above |
| Old sources stopped working | Add `type` field or leave blank (uses AI) |
| Duplicates appearing | Check 7-day dedup window in logs |

## Files Changed

- `supabase/functions/clever-function/index.ts` - Added parsers + dispatcher
- `SOURCES_IMPORT.md` - Full import guide
- `STRUCTURED_PARSERS.md` - Technical details
- `import-sources.sh` - Example import script

## Status

✅ Deployed & Tested  
✅ Backward Compatible  
✅ Error Handling  
✅ Ready to Use  

---
See `SOURCES_IMPORT.md` for detailed examples and `STRUCTURED_PARSERS.md` for technical details.
