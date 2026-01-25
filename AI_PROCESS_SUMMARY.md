# AI Alert Generation Process - 1-Page Summary

## Three-Phase Architecture

### **Phase 1: Early Signals (Proactive Detection)**
Runs BEFORE main source scouring to catch emerging threats:

1. **Official APIs** (High confidence, structured data):
   - **GDACS** (Global Disaster Alert & Coordination System): Earthquakes, floods, wildfires, volcanoes, cyclones with official severity ratings and radius
   - **WHO Disease Outbreak News**: RSS feed of epidemic/pandemic alerts by country
   - **OpenCage Geocoder** (optional): Validates coordinates, detects offshore vs land locations

2. **Brave Search Queries** (825 total):
   - 25 base queries × 33 countries
   - Examples: "earthquake reported residents", "flash flooding", "airport closed", "protests erupted", "border closed"
   - Free paid API, returns search snippets (200-400 chars)

3. **AI Extraction** (gpt-4o-mini):
   - Processes content from APIs and Brave Search
   - Confidence threshold: 0.85 (85%)
   - Temperature: 0.7 (balanced specificity)

### **Phase 2: Main Source Scouring**
Processes 670+ RSS feeds and URLs:
- Custom news sources (AP, Reuters, BBC, regional feeds)
- Topic-specific feeds (health, security, transportation)
- Content fetched via Brave Search fallback if RSS fails
- Same AI extraction pipeline as Phase 1

### **Phase 3: Finalizing**
- Deduplication (AI-powered semantic matching)
- Confidence scoring (0.0-1.0 scale)
- Severity mapping: critical > warning > caution > informative
- Status: draft (requires human review before publishing)

---

## AI Extraction Logic

**Input:** Raw text content (100-15,000 chars)

**Processing:**
1. **System Prompt** instructs gpt-4o-mini to extract travel-affecting events only
2. **INCLUDE categories**: Natural disasters, weather, transportation, infrastructure, health, political unrest, security, borders, economic, environmental
3. **REJECT categories**: Entertainment, sports, politics unrelated to travel, celebrity news, product launches
4. **Mandatory fields**:
   - `title`: Specific event (no generic summaries)
   - `country`: Real country name (no "Global" or "Various")
   - `location`: Specific city/region (required)
   - `latitude`/`longitude`: Decimal degrees (not null)
   - `severity`: critical | warning | caution | informative
   - `eventType`: One of 12 categories (Severe Weather, Political Unrest, etc.)
   - `eventStartDate`: ISO 8601 timestamp (when event occurred, inferred if needed)
   - `radiusKm`: Impact radius scaled by severity (35 km for critical, 20 for warning, 10 for caution, 7 for informative)
   - `isOffshore`: Boolean (true if on water; triggers shoreline GeoJSON instead of circular radius)
   - `geoJSON`: Valid Feature or FeatureCollection polygon
   - `recommendations`: 3-4 specific, actionable traveler guidance (type-based, not generic)

**Output:** JSON array of validated alerts

---

## Sources Beyond Basic URLs

| Source | Type | Update Frequency | Coverage | Data Quality |
|--------|------|------------------|----------|--------------|
| **GDACS API** | Official coordination system | Real-time (2+ per hour) | Global disasters, hazards | 95% confidence (UN-backed) |
| **WHO RSS** | Health authority feed | Daily | Disease outbreaks, epidemics | 95% confidence (official) |
| **Brave Search** | News aggregator | Real-time | 825 custom queries across 33 countries | Variable (news-dependent) |
| **OpenCage** | Geocoding service | N/A | Coordinate validation & land/water detection | 95% accuracy |
| **Custom RSS Feeds** | Topic-specific feeds | Varies (5min-hourly) | 670+ news/health/security sources | Depends on source |

---

## Confidence & Validation

**AI Confidence Scoring:**
- Official APIs: 0.95 (GDACS, WHO marked as ai_generated: false)
- AI-extracted from news: 0.85 (gpt-4o-mini)
- Duplicates detected via: Semantic similarity + title matching + geographic proximity

**Data Quality Checks:**
- Invalid coordinates rejected (0,0 or NaN)
- Countries without specific locations rejected
- Content must be 100+ chars (Brave) or 500+ chars (RSS sources)
- Duplicate country/event_type/title combinations flagged for review
- GeoJSON validated (valid Feature geometry required)

**Frontend Display:**
- Paginated (10 per page) with sequential numbering (#1, #2, #3...)
- Select page / Deselect page option for batch operations
- Severity color-coded with confidence badges
- Event dates shown (when event occurred vs when detected)
- Type-specific recommendations displayed (not generic)
