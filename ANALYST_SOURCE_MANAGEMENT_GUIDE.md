# 📘 Analyst Source Management Guide

**For: Alert Analysts & Source Managers**  
**Last Updated:** January 2026  
**Status:** Phase 7 Implementation Complete

---

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Understanding Source Fields](#understanding-source-fields)
4. [Adding Sources (Bulk Upload)](#adding-sources-bulk-upload)
5. [Managing Sources](#managing-sources)
6. [Trust Score Guidelines](#trust-score-guidelines)
7. [Source Type Reference](#source-type-reference)
8. [Testing & Health Monitoring](#testing--health-monitoring)
9. [Best Practices](#best-practices)
10. [Troubleshooting](#troubleshooting)

---

## Overview

The Source Management system allows you to:
- **Add** new alert sources via bulk Excel upload or manual entry
- **Manage** trust scores to weight alerts appropriately
- **Monitor** source health and reachability
- **Filter & Search** sources by type, status, country
- **Enable/Disable** sources based on performance

All sources feed into the alert generation system, where each alert receives a confidence score based on the source's trust level and alert quality.

---

## Quick Start

### Adding 1-2 Sources (Manual)
1. Go to **Sources** tab
2. Click **Add Source** button
3. Fill in name, URL, type, trust score, etc.
4. Click **Save**
5. Click **Test** to verify URL is reachable

### Adding 10+ Sources (Bulk Upload)
1. Download Excel template (available in Sources tab)
2. Fill in columns: name, url, type, country, query, trust_score, enabled
3. Save as `.xlsx` file
4. Click **Bulk Upload** button
5. Select your Excel file
6. Review preview table
7. Click **Upload** button
8. Verify success message

---

## Understanding Source Fields

### Required Fields

#### **name**
- **What:** Display name for the source
- **Format:** Plain text, 3-100 characters
- **Example:** `"USGS Earthquake Hazards"`, `"Reuters Breaking News"`
- **Best Practice:** Use official source name if possible

#### **url**
- **What:** RSS/Atom feed URL or API endpoint
- **Format:** Valid HTTP(S) URL
- **Example:** `https://earthquake.usgs.gov/earthquakes/feed/v1.0/atom.xml`
- **Best Practice:** Test URL in browser first before adding

### Optional Fields (Highly Recommended)

#### **type**
- **What:** Parser type for routing alerts
- **Format:** Lowercase string, one of predefined types (see [Source Type Reference](#source-type-reference))
- **Default:** `generic-rss`
- **Example:** `usgs-atom`, `nws-cap`, `news-rss`
- **Best Practice:** Choose correct type to ensure proper parsing

#### **trust_score**
- **What:** Weight for confidence scoring (0.0-1.0 scale)
- **Format:** Decimal number, 0.0 to 1.0
- **Default:** `0.5` (unknown/unverified)
- **Example:** `0.95` (USGS), `0.80` (Reuters), `0.55` (Reddit)
- **Best Practice:** Use [Trust Score Guidelines](#trust-score-guidelines)

#### **country**
- **What:** Geographic scope or country of origin
- **Format:** 2-letter code or full name
- **Example:** `US`, `AU`, `Global`, `UK`
- **Best Practice:** Use for filtering sources by region

#### **query**
- **What:** Search keywords or query string (for dynamic sources like GDELT, Google News)
- **Format:** Plain text or Boolean query
- **Example:** `"hurricane OR storm OR typhoon"`, `"travel AND safety"`
- **Best Practice:** Leave empty for RSS/Atom feeds, use for API searches

#### **enabled**
- **What:** Whether source is active or disabled
- **Format:** Boolean (TRUE/FALSE, 1/0, Yes/No)
- **Default:** `TRUE`
- **Best Practice:** Disable sources during maintenance or if generating low-quality alerts

### Advanced Fields (Auto-populated)

These fields are managed by the system:

- **last_success**: Last time source was successfully fetched
- **last_error**: Last error message (if any)
- **health_status**: `healthy`, `warning`, `error`, `unknown`
- **created_at**: When source was added
- **updated_at**: Last time source config was changed

---

## Adding Sources (Bulk Upload)

### Step 1: Prepare Excel File

Create an Excel file (`.xlsx`) with these columns:

| name | url | type | country | query | trust_score | enabled |
|------|-----|------|---------|-------|-------------|---------|
| USGS Earthquake Hazards | https://earthquake.usgs.gov/earthquakes/feed/v1.0/atom.xml | usgs-atom | US | | 0.95 | TRUE |
| NWS Seattle Weather Alerts | https://api.weather.gov/alerts/active/zone/WAZ558 | nws-cap | US | | 0.90 | TRUE |
| Reuters Breaking News | https://feeds.reuters.com/reuters/worldNews | news-rss | Global | | 0.80 | TRUE |
| Google News: Hurricanes | https://news.google.com | google-news-api | Global | hurricane OR storm OR typhoon | 0.60 | FALSE |
| My Custom Feed | https://example.com/feed.xml | generic-rss | CA | | 0.50 | TRUE |

**Column Flexibility:**
- Columns can be in any order
- Column names are case-insensitive (`Name`, `name`, `NAME` all work)
- Alternative column names accepted:
  - `name` = `title`
  - `url` = `link` or `URL`
  - `trust_score` = `trust_score` or `Trust Score`
  - `enabled` = `Enabled` or `ENABLED`

### Step 2: Upload File

1. Go to **Sources** tab
2. Click **Bulk Upload Sources (Excel)** section
3. Click **Browse** or drag-and-drop your Excel file
4. Wait for parser to validate (2-5 seconds)

### Step 3: Review Preview

You'll see a preview table with:
- **Name**: Source display name
- **Type**: Parser type (color-coded badge)
- **Trust**: Trust score (color-coded: green ≥0.75, yellow ≥0.5, red <0.5)
- **Status**: Enabled (✓) or Disabled (✗)
- **URL**: Source URL (truncated)

**Summary Box Shows:**
- Total sources parsed
- Enabled vs. disabled count

**Validation Warnings:**
- Unknown types (system accepts custom types)
- Trust scores outside 0.0-1.0 range (auto-clamped)
- Missing URLs (error)

### Step 4: Upload to Database

1. Review preview carefully
2. Click **✓ Upload {N} Sources** button
3. Wait for upload confirmation (5-15 seconds for 50+ sources)
4. Success message shows:
   - Inserted count (new sources)
   - Updated count (existing sources, if any)
   - Rejected count (unreachable URLs, if any)

**Note:** Upload uses `INSERT ... ON CONFLICT DO NOTHING` for safety. Existing sources (by URL) won't be duplicated.

---

## Managing Sources

### Searching Sources

Use the **🔍 Search** box to filter by:
- Source name (e.g., "USGS")
- URL substring (e.g., "reuters.com")
- Country (e.g., "US", "Australia")

Real-time filtering as you type.

### Filtering by Type

Use **📋 Type Filter** dropdown:
- `All Types` (default)
- `usgs-atom`, `nws-cap`, `news-rss`, `gdacs-rss`, etc.

Only shows sources matching selected type.

### Filtering by Status

Use **📊 Status** dropdown:
- `All ({total})` - All sources
- `Enabled ({count})` - Only active sources
- `Disabled ({count})` - Only inactive sources

### Sorting

Use **📈 Sort By** dropdown:
- `Name (A-Z)` - Alphabetical by name
- `Trust Score (High→Low)` - Highest trust first
- `Type` - Alphabetical by parser type

### Enable/Disable Source

1. Find source in table
2. Click **Enable** or **Disable** button in Actions column
3. Status badge updates immediately (✓ ON / ✗ OFF)

**When to Disable:**
- Source is temporarily down for maintenance
- Source is generating too many duplicate alerts
- Source quality is poor (low approval rate)
- Testing new sources before full activation

**When to Enable:**
- After fixing source URL
- After source service recovery
- After verifying source quality

### Testing Source URL

1. Find source in table
2. Click **Test** button in Actions column
3. System performs HTTP HEAD request (5-second timeout)
4. Result shows:
   - **✓ OK** (green) - URL is reachable
   - **✗ FAIL** (red) - URL is unreachable or timeout

**Note:** `no-cors` mode may show false positives. If test fails but you know URL works, check browser console for details.

---

## Trust Score Guidelines

Trust scores (0.0-1.0) determine how much weight an alert from this source receives in confidence scoring.

### Trust Score Tiers

| Score Range | Category | Examples | When to Use |
|-------------|----------|----------|-------------|
| **0.90-0.95** | Official Government (US/AU/CA/UK) | USGS Earthquake, NWS Weather, FAA Notices | Federal/state agencies with verification processes |
| **0.80-0.89** | International Authority | GDACS, ReliefWeb, NOAA, WHO | UN agencies, intergovernmental organizations |
| **0.75-0.79** | Major News (Verified) | Reuters, BBC, Guardian, Al Jazeera, NPR | News orgs with fact-checking teams |
| **0.60-0.74** | Travel Advisories / Regional News | US State Dept, DFAT, local news outlets | Official advisories, regional reporting |
| **0.50-0.59** | Social Media / Aggregators | Reddit /r/news, Google News, Twitter feeds | Crowd-sourced or aggregated content |
| **0.40-0.49** | Blogs / User-Generated | Travel blogs, forums, YouTube channels | Unverified user content |
| **0.00-0.39** | Unknown / Untrusted | - | Avoid using (noise risk) |

### How Trust Score Affects Confidence

Example: USGS earthquake alert (M6.5):
- Source trust: 0.95
- Quality boosters: +0.10 (precise coordinates), +0.05 (recent event), +0.08 (severity high)
- **Final confidence: 0.95 + 0.23 = 1.0 (capped at 1.0)** → "Verified" category

Example: Reddit post about earthquake (unverified):
- Source trust: 0.55
- Quality boosters: None (vague location, no official source)
- Penalties: -0.20 (vague location), -0.15 (no summary)
- **Final confidence: 0.55 - 0.35 = 0.20** → "Noise" category

**Recommendation:** Start new sources at 0.50, adjust up/down after 1-2 weeks based on alert approval rate.

---

## Source Type Reference

### Official Government Sources

| Type | Description | Example Sources | Trust Score |
|------|-------------|-----------------|-------------|
| `usgs-atom` | USGS Earthquake/Tsunami Atom feeds | USGS M5.5+ Earthquakes | 0.95 |
| `nws-cap` | National Weather Service CAP-XML | NWS Severe Weather Alerts | 0.90 |
| `noaa-tropical` | NOAA Tropical Storm/Hurricane JSON | NOAA Active Tropical Cyclones | 0.90 |
| `faa-json` | FAA Notices to Airmen JSON | FAA NAS Status | 0.90 |

### International Authorities

| Type | Description | Example Sources | Trust Score |
|------|-------------|-----------------|-------------|
| `gdacs-rss` | Global Disaster Alert & Coordination System RSS | GDACS Earthquakes, Floods, Storms | 0.85 |
| `reliefweb-rss` | UN ReliefWeb humanitarian alerts | ReliefWeb Disasters Feed | 0.85 |

### News & Media

| Type | Description | Example Sources | Trust Score |
|------|-------------|-----------------|-------------|
| `news-rss` | Major news outlets (RSS/Atom) | Reuters World News, BBC Breaking, Guardian Global | 0.75-0.80 |
| `travel-advisory-rss` | Official travel advisories | US State Dept Travel, DFAT Smartraveller | 0.75 |

### Dynamic/Search Sources (Phase 2)

| Type | Description | Example Sources | Trust Score |
|------|-------------|-----------------|-------------|
| `gdelt-json` | Google Event Data from GDELT API (requires API key) | GDELT disasters, protests, conflicts | 0.65 |
| `google-news-api` | Google News search API (requires query field) | Google News: "hurricane" | 0.60 |

### Generic/Fallback

| Type | Description | Example Sources | Trust Score |
|------|-------------|-----------------|-------------|
| `generic-rss` | Any RSS 2.0 or Atom 1.0 feed | Most blogs, news sites, forums | 0.50 (default) |
| `manual` | Manually curated alerts (analyst-entered) | - | 0.50 (default) |

**Note:** Phase 2 parsers (GDELT, Google News, Twitter, YouTube) are planned but not yet implemented. You can add these sources now with `enabled=FALSE` and enable them when parsers are ready.

---

## Testing & Health Monitoring

### Health Status Indicators

| Emoji | Status | Meaning | Action |
|-------|--------|---------|--------|
| ✅ | Healthy | Last 3 fetches successful | None - source is working |
| ⚠️ | Warning | 1-2 failures in last 10 attempts | Monitor, may recover |
| ❌ | Error | Last 3 consecutive failures | Check URL, fix or disable |
| ❓ | Unknown | Never tested or >30 days stale | Test source manually |

### Testing a Source

1. **Manual Test** (Sources table)
   - Click **Test** button next to source
   - HTTP HEAD request sent (5-sec timeout)
   - Result: ✓ OK or ✗ FAIL

2. **Bulk Test** (Advanced)
   - Select multiple sources (checkbox)
   - Click **Test Selected** button
   - System tests all URLs in parallel
   - Results update in table

3. **Auto Health Check** (Background)
   - Every scour cycle (hourly/daily)
   - Updates `last_success`, `last_error`, `health_status`
   - Check Sources tab regularly for ⚠️ or ❌ sources

### Troubleshooting Failed Sources

#### ✗ FAIL - URL Unreachable
- **Cause:** URL is down, moved, or incorrect
- **Fix:** 
  1. Test URL in browser
  2. Check if RSS feed still exists
  3. Update URL if changed
  4. Disable source if permanently gone

#### ⚠️ Warning - Intermittent Failures
- **Cause:** Source server is overloaded or flaky
- **Fix:**
  1. Wait 24 hours and retest
  2. If persists, lower trust score by 0.1
  3. If persists for 1 week, disable

#### ❌ Error - Consecutive Failures
- **Cause:** Source is permanently down or URL changed
- **Fix:**
  1. Research if source moved to new URL
  2. Update URL and re-enable
  3. If no new URL, delete source

---

## Best Practices

### Daily Tasks (5 minutes)

1. **Check Health Status**
   - Go to Sources tab
   - Filter: Status = Enabled
   - Sort: By health status (errors first)
   - Review ⚠️ and ❌ sources
   - Test failed sources
   - Disable if still failing

2. **Review New Alerts by Source** (Optional)
   - Go to Alerts tab
   - Group by source (filter dropdown)
   - Note which sources generate high/low confidence
   - Adjust trust scores accordingly

### Weekly Tasks (15 minutes)

1. **Add New Sources**
   - Review user requests for new sources
   - Research source authority/trust
   - Prepare Excel with 5-20 new sources
   - Bulk upload
   - Test all new sources

2. **Optimize Trust Scores**
   - Identify high-performing sources (high approval rate)
   - Increase trust score by 0.05-0.10
   - Identify noisy sources (low approval rate)
   - Decrease trust score by 0.05-0.10 or disable

### Monthly Tasks (30 minutes)

1. **Source Audit**
   - Review disabled sources
   - Check if any can be re-enabled
   - Delete truly obsolete sources
   - Document changes in log

2. **Performance Review**
   - Export source performance metrics (CSV)
   - Identify top 10 highest-value sources
   - Identify bottom 10 noisiest sources
   - Recommend trust score adjustments

### Quarterly Tasks (1 hour)

1. **Source Discovery**
   - Research new authoritative sources
   - Review competitor alert systems
   - Test 10-20 new candidate sources
   - Add top performers

2. **Documentation Update**
   - Update this guide with new learnings
   - Add examples of good/bad sources
   - Share best practices with team

---

## Troubleshooting

### "No sources found in Excel file"

**Cause:** Excel columns don't match expected names  
**Fix:** Ensure columns are named: `name`, `url`, `type`, `country`, `query`, `trust_score`, `enabled` (case-insensitive)

### "Upload failed: {error message}"

**Cause:** Network error or backend issue  
**Fix:**
1. Check internet connection
2. Try again in 30 seconds
3. If persists, check backend health status
4. Contact dev team if issue continues

### "Rejected N sources due to reachability issues"

**Cause:** Backend performs HEAD request to verify URLs before inserting. Some URLs are unreachable.  
**Fix:**
1. Review rejected sources in error message
2. Test URLs manually in browser
3. Fix URLs and re-upload
4. Or add with `enabled=FALSE` and troubleshoot later

### Preview shows wrong trust scores

**Cause:** Excel trust_score column is formatted as text, not number  
**Fix:**
1. In Excel, select trust_score column
2. Format → Number → 2 decimal places
3. Re-save and re-upload

### Sources not showing in table

**Cause:** Filter is active  
**Fix:**
1. Check Type Filter (set to "All Types")
2. Check Status Filter (set to "All")
3. Clear search box
4. Refresh page

### Test button shows "✗ FAIL" but URL works in browser

**Cause:** CORS restrictions or HEAD request not supported  
**Fix:**
1. Ignore test result if URL works in browser
2. Backend scour engine uses GET requests (more permissive)
3. Health status will update after first successful fetch

---

## FAQ

### Can I add the same source twice?

**No.** System uses URL as unique identifier. If you upload an Excel with duplicate URLs, only the first will be inserted (ON CONFLICT DO NOTHING).

### Can I change a source's trust score after adding?

**Yes.** Click **Edit** button in Actions column (future feature), or re-upload Excel with updated trust_score.

### What happens if I disable a source?

Source stops generating new alerts. Existing alerts from that source remain in the system. You can re-enable anytime.

### What happens if I delete a source?

Source is permanently removed. Existing alerts remain but won't show source link. **Use with caution.**

### How often do sources get checked?

Depends on scour cycle configuration (hourly/daily). Each enabled source is fetched once per cycle. Health status updates after each fetch.

### Can I add sources without URLs (manual entry)?

**Not yet.** Manual alert creation is separate workflow. All sources in Sources tab must have valid URLs for automated fetching.

### What's the maximum number of sources?

No hard limit. System tested with 100+ sources. Performance may degrade above 500 sources (pagination and filtering help).

### Can I export sources to CSV?

**Future feature.** For now, use database export or copy-paste from table.

### Can I see which alerts came from which source?

**Yes.** Each alert has `source_id` field. Use Alerts tab filter dropdown to group by source.

### Can I track when a source was last modified?

**Future feature.** `updated_at` timestamp will be added in Phase 7.2.

---

## Need Help?

- **Slack Channel:** `#alert-sources`
- **Documentation:** See `ANALYST_SOURCE_MANAGEMENT_DESIGN.md`
- **Dev Team:** Tag `@dev-team` in Slack
- **Emergency:** Email `alerts@company.com`

---

**Last Updated:** January 2026  
**Version:** 1.0 (Phase 7 Complete)
