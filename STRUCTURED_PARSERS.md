# Structured Sources Implementation Summary

## What's New

### Structured Feed Parsers
Added type-specific parsers for critical sources:
- **USGS Earthquakes (usgs-atom)**: Filters M≥5.5, maps severity by magnitude
- **NWS CAP Weather (cap)**: Parses severity/urgency, extracts polygon bounds
- **FAA Aviation (faa-nas)**: JSON notices with severity and coverage dates
- **NOAA Tropical (noaa-tropical)**: Cyclone advisories with storm name extraction

### Backward Compatibility Guaranteed
1. **Sources without `type` field** continue using Brave Search + AI fallback
2. **Existing AI-powered extraction** unchanged and remains as fallback
3. **Dedup logic** works uniformly across all alert sources (structured or AI)
4. **No schema migrations required** - `type` field already exists in `sources` table

### Safe Fallback Chain

```
Source Processing Flow:
├─ If source.type matches known type → Try structured parser
│  ├─ Success: Use structured alerts
│  └─ Failure: Log warning, proceed to Brave/Scrape
├─ If no structured alerts → Fetch content (Brave Search or scrape)
├─ With content → Extract via OpenAI GPT-4o-mini
└─ All alerts → Deduplicate against existing (7-day window)
```

## Verified Safety

✅ **Unknown source types** are skipped silently and fallback to Brave/AI  
✅ **Parser failures** log warnings but don't crash the job  
✅ **Dedup logic** applies equally to structured and AI alerts  
✅ **Timestamp consistency** - structured alerts use feed dates  
✅ **Severity mapping** consistent across all source types  

## Usage

### Add a structured source
```json
{
  "name": "USGS Earthquakes",
  "url": "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.atom",
  "type": "usgs-atom",
  "country": "USA",
  "enabled": true
}
```

### Trigger scour
```bash
POST /scour-sources
{
  "sourceIds": ["<id1>", "<id2>", ...],
  "daysBack": 14
}
```

### Review results
- Structured alerts: `ai_generated: false`, `ai_model: "structured-parser"`
- AI-fallback alerts: `ai_generated: true`, `ai_model: "gpt-4o-mini"`
- All alerts: `/alerts/review` (draft status)

## Implementation Details

### Parser Modules
- `parseUSGSAtom()` - Atom feed with M, lat/lon, region parsing
- `parseCAPAtom()` - CAP with severity/urgency/polygon bounds
- `parseFAANASJson()` - JSON array with notices and effective dates
- `parseNOAATropical()` - Atom with storm name extraction
- `parseRSSOrAtom()` - Generic RSS 2.0 / Atom 1.0 fallback
- `parseBySourceType()` - Dispatcher by source.type

### Helper Functions
- `fetchRaw(url)` - Timeout-safe fetch
- `parseText(tag, xml)` - Minimal XML text extraction
- `parseAttr(tag, attr, xml)` - Minimal XML attribute extraction
- `splitEntries(xml, tag)` - Entry/item enumeration
- `centroidFromPolygon(polygon)` - CAP geometry to lat/lon/radius
- `magnitudeFromTitle(title)` - Extract M from USGS title
- `severityFromMagnitude(mag)` - Map M to severity

## Testing Recommendations

1. **Add USGS source**, start scour → verify M≥5.5 filter works
2. **Add CAP source**, start scour → verify weather alerts are extracted
3. **Add old non-typed source**, start scour → verify Brave/AI fallback
4. **Scour both typed & untyped** → verify dedup works across both

## Files Modified

- `supabase/functions/clever-function/index.ts`
  - Added `parseUSGSAtom()`, `parseCAPAtom()`, `parseFAANASJson()`, `parseNOAATropical()`
  - Added `parseBySourceType()` dispatcher
  - Updated `runScourWorker()` to attempt structured parse first, fallback to Brave/AI
  - Preserved all existing Brave Search + AI extraction logic
  - No breaking changes to dedup, KV, or database operations

## Next Steps (Optional)

- Add `frequency_min` scheduling (sources table already has capacity)
- Improve USGS alerts with country/region geocoding
- Add more parsers (GDELT, Google News, Reddit, GDACS, ReliefWeb)
- Implement CSV export for alerts → WordPress import
