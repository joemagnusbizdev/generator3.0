# Analyst-Friendly Source Management System Design

## Overview
This document outlines the enhanced source management system for analysts to easily view, add, track, and manage alert sources at scale.

## Phase 7: Enhanced UI & Analyst Workflow

### 1. Data Model Enhancement

#### Current Source Interface
```typescript
interface Source {
  id: string;
  name: string;
  url: string;
  country?: string;
  enabled: boolean;
  created_at: string;
}
```

#### Enhanced Source Interface
```typescript
interface Source {
  id: string;
  name: string;
  url: string;
  country?: string;
  type: string;              // NEW: gdacs-rss, reliefweb-rss, usgs-atom, etc.
  query?: string;            // NEW: For dynamic sources (GDELT, Google News, etc.)
  enabled: boolean;
  trust_score: number;       // NEW: 0.0-1.0, how much to weight alerts from this source
  created_at: string;
  updated_at?: string;       // NEW: Track when source config last changed
  last_success?: string;     // NEW: Last successful fetch time
  last_error?: string;       // NEW: Last error message (if any)
  health_status?: 'healthy' | 'warning' | 'error' | 'unknown'; // NEW
}
```

### 2. Source Types (Parser Routing)

The `type` field categorizes sources by how they're fetched and parsed:

#### Official/Authority Sources (Auto-parse)
- `usgs-atom`: USGS Earthquake hazards (M≥5.5)
- `nws-cap`: National Weather Service CAP feeds
- `faa-json`: FAA Notices to Airmen
- `noaa-tropical`: NOAA Tropical Storm/Hurricane
- `reliefweb-rss`: ReliefWeb humanitarian alerts
- `gdacs-rss`: Global Disaster Alert & Coordination System

#### News & Media (RSS/Atom Parsing)
- `news-rss`: Reuters, BBC, Guardian, Al Jazeera, etc.
- `travel-advisory-rss`: US State Dept, Australian DFAT travel advisories
- `social-rss`: Reddit /r/news, Google News

#### Phase 2: Dynamic Sources (Custom Parsers TBD)
- `gdelt-json`: Google Event Data from GDELT API
- `google-news-api`: Google News targeted queries
- `flightaware-html`: FlightAware disruptions (HTML scraping)
- `twitter-api`: Twitter/X search API
- `youtube-feeds`: YouTube channel subscriptions (TBD)

#### Custom/Generic
- `generic-rss`: Fallback for any RSS/Atom feed
- `manual`: Manually curated sources (analyst entered)

### 3. Trust Score Guidance

Trust scores (0.0-1.0) represent how much to weight alerts from this source:

```
0.95 - USGS Earthquake/Tsunami (official US government)
0.90 - NWS, NOAA, FAA (official US government)
0.85 - GDACS, ReliefWeb (official UN/international)
0.80 - Reuters, BBC, Guardian, Al Jazeera (major news with verification)
0.75 - US State Dept, Australian DFAT travel advisories
0.70 - NWS social media, official emergency channels
0.60 - Travel blogs, local news (useful but needs verification)
0.55 - Reddit /r/news, social media aggregators
0.50 - Unknown/unverified sources, manual entries
```

### 4. SourceTable UI Enhancements

#### Display Columns (Recommended)
1. **Name** (primary, sortable, searchable)
2. **URL** (truncated, clickable, test button)
3. **Type** (badge: orange for RSS, green for API, blue for custom)
4. **Country** (emoji flag or text)
5. **Trust Score** (visual bar, numeric value)
6. **Status** (enabled toggle, health indicator)
7. **Actions** (Edit, Test, Delete, More)

#### Layout Strategy
```
[Search Box] [Filter by Type ▼] [Sort by ▼]

┌─────────────────────────────────────────────────────────────────────┐
│ Name              │ Type      │ Country │ Trust │ Status │ Actions   │
├─────────────────────────────────────────────────────────────────────┤
│ USGS Earthquakes  │ API       │ US      │ ████▌ │ ✓     │ Test Edit  │
│ Reuters World     │ RSS       │ Global  │ ████░ │ ✓     │ Test Edit  │
│ Reddit /r/news    │ RSS       │ Social  │ ███░░ │ ✓     │ Test Edit  │
└─────────────────────────────────────────────────────────────────────┘

Page 1 of 5 (95 sources total)
```

#### Filter & Sort Options
- **Filter by Type**: Dropdown with checkboxes (USGS, RSS, News, Travel, Manual, Disabled)
- **Filter by Status**: Enabled/Disabled/All
- **Filter by Health**: Healthy/Warning/Error/Unknown
- **Sort by**: Name (A-Z), Trust Score (high-to-low), Recently Updated, Health Status
- **Search**: Real-time filter by name or URL

### 5. SourceBulkUpload Enhancement

#### New Excel Template
```
name                          | url                                | country | type           | query               | trust_score | enabled
USGS Earthquake Hazards       | https://earthquake.usgs.gov/...   | US      | usgs-atom      |                     | 0.95        | TRUE
NWS Seattle                   | https://api.weather.gov/...       | US      | nws-cap        |                     | 0.90        | TRUE
Reuters Breaking News         | https://feeds.reuters.com/...     | Global  | news-rss       | "travel" OR "safety"| 0.80        | TRUE
Google News: Storms           | https://news.google.com           | Global  | google-news-api| "hurricane OR storm"| 0.60        | FALSE
My Custom Source (disabled)   | https://example.com/feed.xml      | CA      | generic-rss    |                     | 0.50        | FALSE
```

#### Parser Updates
- `parseExcelToSources()` should extract all 7 columns
- Validation:
  - `name`: Required, non-empty
  - `url`: Required, valid HTTP(S) URL
  - `type`: Optional, default to "generic-rss" if not recognized
  - `query`: Optional, empty string if not provided
  - `trust_score`: Optional, validate 0.0-1.0, default 0.5
  - `enabled`: Optional, parse "TRUE"/"FALSE"/"1"/"0", default true
- Warning: If type not in known list, show warning but allow (custom types OK)

#### Upload Response Enhancements
- Show counts by type (3 RSS, 2 API, 1 Manual, etc.)
- Show which sources are enabled vs. disabled
- Show trust score distribution
- Highlight any warnings (unknown types, low trust scores)

### 6. Source Testing & Health Tracking

#### Test Source Endpoint (Already in SourceTable.tsx)
```
HEAD {source.url}
Timeout: 5 seconds
Success: Status 200-299
Warning: Status 300-399
Error: Status 400+ or timeout
```

#### Health Status Logic
```
healthy:  Last 3 consecutive successful fetches
warning:  1-2 failures in last 10 attempts, but not recently
error:    Last 3 consecutive failures
unknown:  Never tested or >30 days since last test
```

#### Tracking Fields
- `last_success`: Last timestamp of successful fetch
- `last_error`: Last error message (max 200 chars)
- `health_status`: Enum (healthy/warning/error/unknown)
- Database index: `idx_sources_health_status` for quick filtering

### 7. Source Performance Metrics (Future Enhancement)

For Phase 2+, track per-source:
- Alerts generated last 7 days
- Average confidence score of alerts
- Analyst approval rate
- Duplicate rate with other sources
- Last updated time

Enables analysts to see which sources are:
- Most valuable (high approval rate, unique insights)
- Most noisy (low confidence, duplicates)
- Most stale (not generating alerts)

### 8. Source Lifecycle & Management

#### Add New Source (Manual or Bulk)
1. **Bulk Upload** (File → Spreadsheet → Preview → Upload)
   - Recommended for 10+ sources
   - Validates all fields before upload
   - Shows preview of first 5 rows
   - On success, shows count added by type

2. **Manual Add** (Form → Edit → Save)
   - Simple 7-field form
   - Type dropdown with descriptions
   - Trust score slider (0.0-1.0)
   - Query field with placeholder examples
   - Test URL before saving

#### Edit Source
- Modal form with same 7 fields
- Test URL before saving
- Show last success/error
- Show health status
- Warn if disabling high-trust source

#### Disable Source
- Toggle disabled state (keep in DB)
- Reason/comment field (optional, for analyst notes)
- Still shows in table but grayed out
- Can re-enable with one click

#### Delete Source
- Soft delete (mark deleted, keep history)
- Or hard delete (remove completely)
- Show warning: "X alerts generated from this source"
- Admins only (or analyst with confirmation)

#### Test Source
- HEAD request to URL
- Show result: Success/Warning/Error
- Show response time
- Show last test time
- Option to run full fetch simulation (for API sources)

### 9. Analyst Workflow (Day-to-Day)

#### Daily Tasks
1. **Check Source Health** (5 min)
   - Filter: Status = Warning or Error
   - Decide: Fix URL, wait for service recovery, disable source
   - Update: `updated_at` timestamp

2. **Review New Alerts by Source** (Optional)
   - Group alerts by source
   - Spot check confidence scores
   - Note if source is consistently low/high confidence

#### Weekly Tasks
1. **Add New Sources** (15 min)
   - Review user requests for new sources
   - Prepare Excel with new sources
   - Bulk upload with test
   - Monitor for new alerts

2. **Optimize Trust Scores** (Optional)
   - Identify high-performing sources (adjust up)
   - Identify noisy sources (adjust down)
   - Note changes with timestamp

#### Monthly Tasks
1. **Source Audit** (30 min)
   - Review disabled sources
   - Check if any can be re-enabled
   - Remove truly obsolete sources
   - Update trust scores based on performance

### 10. Implementation Roadmap

#### Phase 7.1 (THIS SPRINT)
- ✅ Create Source interface with new fields
- ✅ Update excelParser to parse all 7 fields
- ✅ Update SourceBulkUpload UI & validation
- ✅ Update SourceTable UI (display columns, filter, search, sort)
- ✅ Create source management guide for analysts

#### Phase 7.2 (NEXT SPRINT)
- Health tracking (last_success, last_error, health_status)
- Source performance metrics dashboard
- Bulk enable/disable actions
- CSV export of sources
- Source lifecycle audit log

#### Phase 8+ (FUTURE)
- Source recommendation engine (suggest new sources)
- Source clustering (group similar sources)
- Source contribution tracking (which analyst added/maintains each)
- Integration with alert lifecycle (which source generated which alerts)

## Summary

By enhancing the source management system with these features, analysts can:
1. **View** all 95+ sources at a glance with type, trust, and health status
2. **Add** new sources efficiently via bulk Excel upload or manual form
3. **Test** sources to verify they're working
4. **Manage** trust scores to weight alerts appropriately
5. **Track** source health and performance
6. **Scale** to hundreds of sources without overwhelming complexity

The UI is designed for **analyst efficiency**: minimal clicks, smart defaults, clear visual hierarchy, and feedback at each step.
