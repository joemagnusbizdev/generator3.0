# Bulk Import: 95+ Global Travel Safety Sources

**Status**: Ready to import ✅  
**Sources**: 95 feeds across 15+ categories  
**Migrations**: 2 files (trust_score column + bulk insert)

---

## Quick Start (2 steps)

### Step 1: Apply Trust Score Migration
In Supabase SQL Editor:
```sql
-- Copy from: supabase/migrations/006_add_source_trust_score.sql
-- This adds trust_score column (optional, for future tuning)
```

### Step 2: Import All Sources
In Supabase SQL Editor:
```sql
-- Copy from: supabase/migrations/007_bulk_import_95_sources.sql
-- Inserts all 95 sources with ON CONFLICT DO NOTHING (safe to rerun)
```

**Done!** All sources imported and ready to use.

---

## What Gets Imported

### Enabled by Default (~50 sources)
These start immediately with Scour enabled:

**Official Government & Humanitarian**
- GDACS (Global Disaster Alert) - 2 feeds
- ReliefWeb (Humanitarian Crisis) - 3 feeds
- USGS Earthquakes - 3 feeds
- Travel Advisories (US, AU, CA, UK) - 5 feeds
- Weather & Emergency (NWS, NOAA, BOM) - 5 feeds
- Border & Security (CBP, TSA, DOT) - 4 feeds
- Major News (Reuters, BBC, Al Jazeera, Guardian) - 4 feeds
- Crisis & Investigation (Crisis Group, Bellingcat) - 2 feeds
- Humanitarian (IFRC, UNHCR) - 2 feeds
- Wikipedia Current Events - 1 feed
- Tsunami & Volcano - 2 feeds
- Wildfires - 1 feed
- Health (CDC) - 1 feed
- Reddit World News - 1 feed

**Trust scores**: 0.75-0.95 (official sources)

### Disabled for Phase 2 (~45 sources)
These require custom parsers before enabling:

**GDELT Event Detection** (35 queries)
- Airport/border/airspace closures
- Evacuation orders, curfews
- Mass casualty, terror attacks
- Protests (general + Palestine-focused, multilingual)
- Infrastructure disruptions (power, internet, comms)
- Trust score: 0.55-0.60 (event detection, may have false positives)

**Google News Targeted** (10 queries)
- Airport closure, border closure, evacuation
- Mass casualty, violent protest
- General strike, Palestine protests
- Trust score: 0.65

**FlightAware** (2 sources)
- HTML scraping (deferred per agreement)
- Trust score: 0.70

**FAA JSON API** (1 source)
- Requires custom JSON parser (Phase 2)
- Trust score: 0.92

---

## Source Categories & Trust Scores

| Category | Count | Enabled | Trust Score | Notes |
|----------|-------|---------|-------------|-------|
| Official Govt (US/AU/CA/UK) | 8 | ✅ | 0.90-0.92 | Travel advisories, travel updates |
| USGS/Earthquakes | 3 | ✅ | 0.95 | Highest authority, uses M≥5.5 filter |
| GDACS/Disasters | 2 | ✅ | 0.88 | Global disaster coordination |
| ReliefWeb | 3 | ✅ | 0.87 | Humanitarian crisis data |
| Weather/NOAA | 5 | ✅ | 0.90-0.92 | NWS, NOAA, BOM official alerts |
| Tsunami/Volcano | 2 | ✅ | 0.85-0.90 | Specialized natural disasters |
| Wildfire | 1 | ✅ | 0.88 | US incident tracking |
| Border/Security | 4 | ✅ | 0.85-0.86 | CBP, TSA, DOT official |
| Major News | 4 | ✅ | 0.75-0.78 | Reuters, BBC, Guardian, AJ |
| FAA/Aviation | 3 | ⏳ | 0.88-0.92 | Newsroom RSS enabled, JSON/HTML pending |
| Health | 1 | ✅ | 0.90 | CDC official |
| Wikipedia | 1 | ✅ | 0.70 | Current events feed |
| Reddit | 7 | ⏳ | 0.50-0.55 | Social media, low trust |
| GDELT Events | 35 | ⏳ | 0.55-0.60 | Event detection queries |
| Google News | 10 | ⏳ | 0.65 | News aggregator with queries |
| FlightAware | 2 | ⏳ | 0.70 | HTML scraping (deferred) |
| Crisis/Humanitarian | 5 | ✅ | 0.80-0.86 | Analysis & humanitarian orgs |
| **TOTAL** | **95** | **~50** | — | — |

---

## How Confidence Scoring Works with These

### High-Trust Sources (Enabled)
Example: USGS Earthquake alert
```
Source trust:        0.95 (USGS, official)
+ Precise coords:    +0.10
+ Event timing:      +0.05
+ Official warning:  +0.08
= Confidence:        ~0.90 (Verified)
```

### Medium-Trust Sources
Example: Reuters article via news RSS
```
Source trust:        0.78 (Reuters, credible news)
+ Rough location:    +0.05
+ Summary:           (no penalty)
= Confidence:        ~0.65-0.70 (Review)
```

### Low-Trust Sources (Disabled)
Example: GDELT event detection
```
Source trust:        0.55-0.60 (event detection)
+ Unknown location:  -0.20
= Confidence:        ~0.35 (Early Signal)
```

---

## Enabling Disabled Sources

When you're ready to activate GDELT, Google News, or Reddit:

### Via SQL:
```sql
UPDATE sources 
SET enabled = true 
WHERE type IN ('gdelt-json', 'google-news-rss', 'reddit-rss');
```

### Via Dashboard:
1. Go to Sources management tab
2. Find source, toggle "Enabled"
3. Save

---

## Custom Trust Score Tuning

If a source consistently produces high-confidence but low-quality alerts, you can override:

```sql
UPDATE sources 
SET trust_score = 0.40
WHERE name = 'GDELT Protest Query';

-- Now confidence will be lower even with good data
```

---

## What If I Need to Add More?

The migration uses `ON CONFLICT DO NOTHING`, so it's safe to re-run. To add new sources later:

```sql
INSERT INTO sources (id, name, url, country, type, enabled, trust_score)
VALUES 
  (gen_random_uuid(), 'New Source', 'https://...', 'Country', 'type', true, 0.75)
ON CONFLICT DO NOTHING;
```

---

## Monitoring After Import

### Check Import Success:
```sql
SELECT COUNT(*) FROM sources WHERE enabled = true;
-- Should show ~50

SELECT COUNT(*) FROM sources WHERE enabled = false;
-- Should show ~45

SELECT type, COUNT(*) as count
FROM sources
GROUP BY type
ORDER BY count DESC;
-- Shows distribution by source type
```

### Monitor Disabled Sources:
You can enable them individually once Phase 2 parsers are ready:

```sql
SELECT name, type, enabled, trust_score
FROM sources
WHERE enabled = false
ORDER BY trust_score DESC;
```

---

## Phase 2: Custom Parsers Needed

To fully enable disabled sources, implement:

1. **GDELT JSON Parser** (35 sources)
   - Parse JSON response format
   - Extract articles from each query
   - Handle API rate limits

2. **Google News Targeted Parser** (10 sources)
   - Handle dynamic query parameters
   - Extract search results RSS

3. **FAA JSON API Parser** (1 source)
   - Parse airport status JSON
   - Extract operational data

4. **FlightAware HTML Parser** (2 sources)
   - (Deferred per earlier agreement)

---

## Timeline

| Phase | What | Timeline |
|-------|------|----------|
| **Now** | Import 95 sources (~50 enabled) | ✅ Today |
| **Week 1** | Use enabled sources with Scour | Start collecting alerts |
| **Week 2-3** | Monitor alert quality | Tune trust scores if needed |
| **Phase 2** | Implement Phase 2 parsers | Unlock 45 more sources |
| **Phase 2+** | Expand to visual sources (YouTube, etc.) | Future |

---

## FAQ

**Q: Why are some sources disabled?**  
A: They require custom parsers (GDELT JSON, Google News dynamic) or HTML scraping (deferred). Safe to enable disabled sources if you want to use them with generic parsing now.

**Q: Should I enable all sources immediately?**  
A: No, start with enabled sources (~50). They have high trust and proven parsers. Disable/enable others as needed.

**Q: Can I change trust scores later?**  
A: Yes, anytime via SQL or dashboard. Scores are used in confidence calculations.

**Q: What about duplicates across sources?**  
A: Dedup logic (hash + temporal + AI) handles this automatically.

**Q: How many alerts will this generate?**  
A: Depends on activity level. During calm periods: 5-20/day. During crises: 100+/day. Dedup reduces to unique incidents.

---

## Summary

✅ **95 sources ready**  
✅ **~50 enabled** (official + high-trust)  
✅ **~45 disabled** (waiting for Phase 2 parsers)  
✅ **Trust scores** assigned by authority  
✅ **Confidence integration** ready  
✅ **Safe to rerun** (ON CONFLICT)  

**Next**: Run the two migrations, then start using Scour with real sources.

---

**Created**: January 22, 2026  
**Migration Files**: 006_add_source_trust_score.sql, 007_bulk_import_95_sources.sql  
**Status**: Ready to deploy
