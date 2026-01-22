# 📋 Source Upload Template Guide

## Quick Reference: Excel Template for Bulk Source Upload

This document provides a ready-to-use Excel template structure for uploading alert sources.

---

## Template Structure

Create an Excel file (`.xlsx`) with 7 columns:

### Column Headers (Row 1)

```
name | url | type | country | query | trust_score | enabled
```

**Note:** Column names are case-insensitive. `Name`, `name`, `NAME` all work.

---

## Column Definitions

| Column | Required? | Format | Default | Examples |
|--------|-----------|--------|---------|----------|
| **name** | ✅ Yes | Text | - | USGS Earthquakes, Reuters World News |
| **url** | ✅ Yes | URL (http/https) | - | https://earthquake.usgs.gov/feed.xml |
| **type** | ⚠️ Optional | Text (lowercase) | generic-rss | usgs-atom, nws-cap, news-rss |
| **country** | ⚠️ Optional | Text (2-letter code or full name) | - | US, AU, Global, United Kingdom |
| **query** | ⚠️ Optional | Text (search keywords) | "" | "hurricane OR storm", "travel safety" |
| **trust_score** | ⚠️ Optional | Number (0.0-1.0) | 0.5 | 0.95, 0.80, 0.55 |
| **enabled** | ⚠️ Optional | Boolean (TRUE/FALSE or 1/0) | TRUE | TRUE, FALSE, 1, 0 |

---

## Example Template (Copy to Excel)

### Official Government Sources (High Trust)

| name | url | type | country | query | trust_score | enabled |
|------|-----|------|---------|-------|-------------|---------|
| USGS Earthquake Hazards (M5.5+) | https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_month.atom | usgs-atom | US | | 0.95 | TRUE |
| National Weather Service Alerts | https://api.weather.gov/alerts/active | nws-cap | US | | 0.90 | TRUE |
| NOAA Tropical Cyclones | https://www.nhc.noaa.gov/index-at.xml | noaa-tropical | US | | 0.90 | TRUE |
| FAA NAS Status | https://nasstatus.faa.gov/api/status | faa-json | US | | 0.90 | TRUE |

### International Authorities (High Trust)

| name | url | type | country | query | trust_score | enabled |
|------|-----|------|---------|-------|-------------|---------|
| GDACS Global Disasters | https://www.gdacs.org/xml/rss.xml | gdacs-rss | Global | | 0.85 | TRUE |
| ReliefWeb Disasters | https://reliefweb.int/disasters/rss.xml | reliefweb-rss | Global | | 0.85 | TRUE |
| WHO Disease Outbreaks | https://www.who.int/feeds/entity/csr/don/en/rss.xml | generic-rss | Global | | 0.85 | TRUE |

### Major News Outlets (Medium-High Trust)

| name | url | type | country | query | trust_score | enabled |
|------|-----|------|---------|-------|-------------|---------|
| Reuters World News | https://feeds.reuters.com/reuters/worldNews | news-rss | Global | | 0.80 | TRUE |
| BBC Breaking News | http://feeds.bbci.co.uk/news/rss.xml | news-rss | UK | | 0.80 | TRUE |
| Guardian Global | https://www.theguardian.com/world/rss | news-rss | UK | | 0.80 | TRUE |
| Al Jazeera English | https://www.aljazeera.com/xml/rss/all.xml | news-rss | Global | | 0.80 | TRUE |

### Travel Advisories (Medium Trust)

| name | url | type | country | query | trust_score | enabled |
|------|-----|------|---------|-------|-------------|---------|
| US State Dept Travel Advisories | https://travel.state.gov/_res/rss/TAsTWs.xml | travel-advisory-rss | US | | 0.75 | TRUE |
| Australian DFAT Smartraveller | https://www.smartraveller.gov.au/api/alerts/rss.xml | travel-advisory-rss | AU | | 0.75 | TRUE |
| UK Foreign Office Travel | https://www.gov.uk/government/announcements.atom | travel-advisory-rss | UK | | 0.75 | TRUE |

### Social Media & Aggregators (Medium-Low Trust)

| name | url | type | country | query | trust_score | enabled |
|------|-----|------|---------|-------|-------------|---------|
| Reddit /r/worldnews | https://www.reddit.com/r/worldnews/.rss | news-rss | Social | | 0.55 | TRUE |
| Google News: Disasters | https://news.google.com/rss/search?q=disaster+OR+emergency+OR+crisis | news-rss | Global | disaster OR emergency OR crisis | 0.60 | TRUE |

### Phase 2 Sources (Disabled - Awaiting Custom Parsers)

| name | url | type | country | query | trust_score | enabled |
|------|-----|------|---------|-------|-------------|---------|
| GDELT Event Data: Protests | https://api.gdeltproject.org/api/v2/doc/doc | gdelt-json | Global | protest OR riot | 0.65 | FALSE |
| Google News API: Hurricanes | https://newsapi.org/v2/everything | google-news-api | Global | hurricane OR storm OR typhoon | 0.60 | FALSE |
| FlightAware Disruptions | https://www.flightaware.com/live/airport_status_bigmap.rvt | flightaware-html | Global | | 0.70 | FALSE |

---

## Trust Score Quick Reference

Use this guide to assign trust scores:

```
0.95 - USGS Earthquake/Tsunami (official US government seismic authority)
0.90 - NWS, NOAA, FAA (official US government weather/aviation)
0.85 - GDACS, ReliefWeb, WHO (UN agencies, international authorities)
0.80 - Reuters, BBC, Guardian, Al Jazeera (major news with fact-checking)
0.75 - US State Dept, Australian DFAT, UK FCO (official travel advisories)
0.70 - NWS social media, FlightAware (semi-official or verified)
0.60 - Travel blogs, regional news, Google News queries
0.55 - Reddit /r/news, social media aggregators
0.50 - Unknown/unverified sources (default)
```

**Rule of Thumb:**
- Government authority with verification process: **0.90-0.95**
- International organization (UN, WHO, etc.): **0.80-0.89**
- Major news outlet with editorial standards: **0.75-0.79**
- Official but indirect (travel blogs, advisories): **0.60-0.74**
- Social media or crowd-sourced: **0.50-0.59**
- Unknown/untested: **0.50** (default)

---

## Source Type Quick Reference

| Type | Use For | Examples |
|------|---------|----------|
| `usgs-atom` | USGS Earthquake/Tsunami Atom feeds | USGS M5.5+ Earthquakes |
| `nws-cap` | National Weather Service CAP-XML alerts | NWS Severe Weather |
| `noaa-tropical` | NOAA Tropical Storm/Hurricane JSON | NOAA Active Cyclones |
| `faa-json` | FAA Notices to Airmen JSON | FAA NAS Status |
| `gdacs-rss` | Global Disaster Alert & Coordination System RSS | GDACS Earthquakes, Floods |
| `reliefweb-rss` | UN ReliefWeb humanitarian alerts | ReliefWeb Disasters |
| `news-rss` | Major news outlets (RSS/Atom) | Reuters, BBC, Guardian |
| `travel-advisory-rss` | Official travel advisories | US State Dept, DFAT |
| `gdelt-json` | GDELT Event Data API (Phase 2) | GDELT Protests, Conflicts |
| `google-news-api` | Google News search API (Phase 2) | Google News queries |
| `generic-rss` | Any RSS 2.0 or Atom 1.0 feed | Most blogs, news sites |
| `manual` | Manually curated alerts (analyst-entered) | - |

**Default:** If unsure, use `generic-rss` - works for most RSS/Atom feeds.

---

## Common Mistakes to Avoid

### ❌ Incorrect: Trust score as text
```
trust_score: "0.95"  ← String, not number
```

### ✅ Correct: Trust score as number
```
trust_score: 0.95  ← Number format in Excel
```

---

### ❌ Incorrect: Boolean as text
```
enabled: "TRUE"  ← String
```

### ✅ Correct: Boolean as TRUE/FALSE
```
enabled: TRUE  ← Boolean (or 1/0)
```

---

### ❌ Incorrect: Missing http(s)://
```
url: earthquake.usgs.gov/feed.xml  ← Missing protocol
```

### ✅ Correct: Full URL
```
url: https://earthquake.usgs.gov/feed.xml  ← Full URL
```

**Note:** Parser will auto-add `https://` if missing, but best practice is to include it.

---

### ❌ Incorrect: Unknown type (typo)
```
type: usgs-rss  ← Should be usgs-atom
```

### ✅ Correct: Known type
```
type: usgs-atom  ← Correct type
```

**Note:** System accepts unknown types but may not parse correctly. Check [Source Type Reference](#source-type-quick-reference).

---

## Upload Checklist

Before uploading your Excel file:

- [ ] ✅ All rows have `name` and `url`
- [ ] ✅ All URLs start with `http://` or `https://`
- [ ] ✅ `trust_score` column formatted as **Number** (not text)
- [ ] ✅ `enabled` column formatted as **Boolean** or use `TRUE`/`FALSE` text
- [ ] ✅ `type` column uses lowercase (e.g., `usgs-atom`, not `USGS-ATOM`)
- [ ] ✅ Tested 2-3 URLs in browser to verify they work
- [ ] ✅ Reviewed trust scores against guidelines (0.50-0.95 range)

---

## After Upload

1. **Review Success Message**
   - Check inserted count (new sources added)
   - Check updated count (existing sources updated, should be 0)
   - Check rejected count (unreachable URLs)

2. **Test Sources**
   - Go to Sources tab
   - Filter by Status = Enabled
   - Click **Test** button for each new source
   - Verify ✓ OK or ✗ FAIL

3. **Monitor Alerts**
   - Wait 1-2 scour cycles (hourly/daily)
   - Check Alerts tab for new alerts from your sources
   - Review confidence scores (should match expected trust levels)

4. **Adjust Trust Scores**
   - After 1 week, review alert approval rate
   - Increase trust for high-performing sources (+0.05 to +0.10)
   - Decrease trust for noisy sources (-0.05 to -0.10)

---

## Download Blank Template

**Filename:** `source-upload-template.xlsx`

**Column Headers:**
```
name | url | type | country | query | trust_score | enabled
```

**Row 1:** Headers  
**Row 2+:** Your data

**Save As:** Excel Workbook (.xlsx)

---

## Need Help?

- **Slack Channel:** `#alert-sources`
- **Guide:** See `ANALYST_SOURCE_MANAGEMENT_GUIDE.md`
- **Dev Team:** Tag `@dev-team` in Slack

---

**Last Updated:** January 2026  
**Version:** 1.0 (Phase 7 Complete)
