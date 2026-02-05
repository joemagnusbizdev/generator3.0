# Scour-Worker URL Processing & Source Format Guide

## Overview
The scour-worker function processes source URLs in a multi-layered approach: structured parsing for known feed types, then fallback to web scraping or Brave Search API. Here's exactly how it handles different URL formats and sources.

---

## 1. SOURCE URL FORMAT REQUIREMENTS

### What Formats Are Supported?

The system supports **3 main categories** of source URLs:

#### A. **Structured Feeds (with explicit `type` field)**
These have a dedicated parser and are processed first:

| Type | URL Format | Example | Parser |
|------|-----------|---------|--------|
| `usgs-atom` | USGS Atom Feed | `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.atom` | `parseUSGSFeed()` |
| `cap` | CAP Atom Weather | `https://api.weather.gov/alerts/active?point=...` | `parseCAPAtom()` |
| `faa-nas` | FAA JSON Notices | `https://www.faa.gov/nas/...` | `parseFAANASJson()` |
| `noaa-tropical` | NOAA Cyclone Atom | `https://www.nhc.noaa.gov/feed.xml` | `parseNOAATropical()` |
| `generic-rss` | Standard RSS 2.0 or Atom 1.0 | Any RSS/Atom feed URL | Generic fallback |

#### B. **Unstructured Web Content (no `type` field or type = `generic`)**
These fall back to web scraping with AI extraction:

- **Any website URL**: `https://example.com/news/article`
- **News sites**: `https://bbc.com`, `https://reuters.com`
- **Social media**: Forum posts, blog articles
- **Reddit .rss feeds**: `https://reddit.com/r/subreddit/.rss` ✅ **SUPPORTED**

#### C. **API Endpoints**
- Brave Search API (internal fallback)
- Requires source.query field for search queries

---

## 2. HOW SOURCE URLs ARE FETCHED

### The Complete Processing Flow

```
┌─────────────────────────────────────────────┐
│ Source loaded from /sources table           │
│ (with url, type, name, query fields)       │
└──────────────────┬──────────────────────────┘
                   │
        ┌──────────▼──────────┐
        │ Check source.type   │
        └──────────┬──────────┘
                   │
        ┌──────────▼──────────────────────────┐
        │ If type = "usgs-atom", "cap",       │
        │ "faa-nas", "noaa-tropical":         │
        │ Try structured parser               │
        └──────────┬──────────────────────────┘
                   │
        ┌──────────▼──────────────────────────┐
        │ If structured parser succeeds:      │
        │ ✓ Use extracted alerts              │
        │ ✓ Set source_url on alerts          │
        │ ✓ Skip Brave/scraping               │
        └──────────┬──────────────────────────┘
                   │
        ┌──────────▼──────────────────────────┐
        │ If structured parser fails or       │
        │ returns 0 alerts:                   │
        │ Proceed to content fetching         │
        └──────────┬──────────────────────────┘
                   │
    ┌──────────────▼──────────────────┐
    │ TRY BRAVE SEARCH (if enabled)   │
    │ fetch() with Brave API          │
    │ Query: source.query or          │
    │        source.name              │
    └──────────┬───────────────────────┘
               │
    ┌──────────▼──────────────────┐
    │ If insufficient content,     │
    │ TRY SCRAPING: scrapeUrl()   │
    │ fetch() with full HTML       │
    │ Extract text, remove HTML    │
    └──────────┬──────────────────┘
               │
    ┌──────────▼──────────────────┐
    │ Content Validation:          │
    │ Must be 300-15000 chars      │
    │ (reduced for RSS feeds)      │
    └──────────┬──────────────────┘
               │
    ┌──────────▼──────────────────┐
    │ If still insufficient:       │
    │ Retry Brave Search (final)   │
    └──────────┬──────────────────┘
               │
    ┌──────────▼──────────────────┐
    │ AI EXTRACTION with Claude    │
    │ extractAlertsWithAI()        │
    │ Analyze content for alerts   │
    └──────────┬──────────────────┘
               │
    ┌──────────▼──────────────────┐
    │ Post-Process & Validate      │
    │ Add coordinates/GeoJSON      │
    │ Deduplication check          │
    │ Quality validation           │
    └──────────────────────────────┘
```

---

## 3. ACTUAL CODE: URL FETCHING IMPLEMENTATIONS

### A. **Fetching with scrapeUrl() - Direct URL Scraping**
```typescript
async function scrapeUrl(url: string): Promise<string> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000); // 45 second timeout

    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const html = await response.text();

    // Extract text content
    let text = html;
    
    // Remove script and style tags
    text = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ');
    text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ');
    
    // Remove HTML tags
    text = text.replace(/<[^>]*>/g, ' ');
    
    // Decode HTML entities
    text = text
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
    
    // Normalize whitespace
    text = text.replace(/\s+/g, ' ').trim();
    
    return text || '';
  } catch (e: any) {
    console.warn(`Scraping failed for ${url}: ${e.message}`);
    return '';
  }
}
```

### B. **Content Quality Validation**
```typescript
// GAP 9: Content validation with 300+ character minimum
// (reduced for RSS feeds like Reddit)
function validateContentQuality(content: string): boolean {
  return content.length >= 300 && content.length <= 15000;
}
```

### C. **Brave Search Fetching (Fallback)**
```typescript
async function fetchWithBraveSearch(query: string, apiKey: string): 
  Promise<{ content: string; primaryUrl: string | null }> {
  try {
    const searchUrl = 
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=10`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    const response = await fetch(searchUrl, {
      headers: { 
        'Accept': 'application/json', 
        'X-Subscription-Token': apiKey 
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (response.status === 402) {
      throw new Error('BRAVE_QUOTA_EXCEEDED');
    }
    
    if (!response.ok) throw new Error(`Brave API error: ${response.status}`);

    const data = await response.json();
    const results = data.web || [];

    if (!results.length) return { content: '', primaryUrl: null };

    // Combine top 5 results
    let content = results.slice(0, 5).map((r: any) => {
      return `Title: ${r.title}\nDescription: ${r.description || ''}\n`;
    }).join('\n');

    const primaryUrl = results[0]?.url || null;

    return { content, primaryUrl };
  } catch (e: any) {
    console.warn(`Brave search failed: ${e.message}. Will fall back to scraping.`);
    return { content: '', primaryUrl: null };
  }
}
```

### D. **Source Processing in Main Loop**
```typescript
// From line ~1495 in scour-worker/index.ts
for (const source of batchSources) {
  stats.processed++;
  logger.log(`📰 Processing: ${source.name}`);

  const sourceController = new AbortController();
  const timeoutId = setTimeout(() => sourceController.abort(), 90000);

  try {
    let content = '';
    let sourceUrl = source.url;
    let sourceQuery = source.query || source.name;

    // TRY STRUCTURED PARSING FIRST
    const sourceType = (source.type || '').toLowerCase();
    if (sourceType === 'usgs-atom') {
      logger.log(`  📋 Trying structured parser (usgs-atom)...`);
      extractedAlerts = await parseUSGSFeed(content);
      extractedAlerts = extractedAlerts.map(alert => ({
        ...alert,
        source_url: sourceUrl,  // ← CRITICAL: Set source_url
        article_url: alert.article_url || sourceUrl,
      }));
    }

    // FALLBACK TO WEB SCRAPING + AI
    if (!extractedAlerts.length && !sourceController.signal.aborted) {
      // Step 1: Try scraping the source URL directly
      logger.log(`  📄 Scraping: ${source.url}`);
      const scraped = await scrapeUrl(source.url);
      if (validateContentQuality(scraped)) {
        content = scraped;
      }
    }

    // Step 2: If insufficient content, try Brave Search (if enabled)
    if (!validateContentQuality(content) && config.braveApiKey && sourceQuery) {
      logger.log(`  🔎 Brave search: "${sourceQuery}"`);
      const br = await fetchWithBraveSearch(sourceQuery, config.braveApiKey);
      content = br.content;
      sourceUrl = br.primaryUrl || sourceUrl;
    }

    // Step 3: Validate content quality
    if (!validateContentQuality(content)) {
      logger.log(`  ❌ No content meeting quality threshold`);
      stats.errorCount++;
      continue;
    }

    // Step 4: AI EXTRACTION
    logger.log(`  🤖 AI extraction with Claude web search...`);
    extractedAlerts = await extractAlertsWithAI(content, sourceUrl, source.name, sourceQuery);
    
    // Set source_url on all extracted alerts
    extractedAlerts = extractedAlerts.map(alert => ({
      ...alert,
      source_url: sourceUrl,  // ← CRITICAL: Always set
      article_url: alert.article_url || sourceUrl,
    }));

  } catch (e: any) {
    logger.log(`  ❌ Error: ${e.message}`);
    stats.errorCount++;
  }
}
```

---

## 4. REDDIT RSS FEED SUPPORT

### ✅ Reddit .rss Feeds ARE Supported

**Format**: `https://reddit.com/r/{subreddit}/.rss`

**Example**:
```
https://reddit.com/r/worldnews/.rss
https://reddit.com/r/news/.rss
https://reddit.com/r/travel/.rss
```

**How It Works**:

1. **URL Format**: Standard RSS 2.0 feed
2. **Fetching**: 
   - Direct `scrapeUrl()` call fetches the RSS XML
   - Content is extracted and validated (300+ chars)
3. **Parsing**:
   - If `source.type` is NOT set or is `generic-rss`, falls through to AI extraction
   - Content (RSS entries) sent to Claude for alert extraction
4. **Alert Extraction**:
   - Claude analyzes Reddit post titles and descriptions
   - Extracts travel safety events
   - Generates alerts with location, severity, event type
5. **Quality Validation**:
   - Alerts must be in English
   - Must have specific location (not generic)
   - Must have valid event type

### Example Reddit Source Configuration

```json
{
  "name": "Reddit World News",
  "url": "https://reddit.com/r/worldnews/.rss",
  "type": "generic-rss",  // OR omit type entirely
  "country": "Global",
  "enabled": true
}
```

Or for emergency/disaster subreddits:

```json
{
  "name": "Reddit Disasters",
  "url": "https://reddit.com/r/Disasters/.rss",
  "query": "travel safety emergency alert",  // Optional: for Brave search backup
  "enabled": true
}
```

---

## 5. URL PROCESSING DECISION TREE

Use this to understand what happens with any given source URL:

```
Does source have type = "usgs-atom", "cap", "faa-nas", "noaa-tropical"?
├─ YES → Try structured parser first
│   ├─ Parser succeeds? → Use extracted alerts, DONE
│   └─ Parser fails/empty? → Fall through to step 2
│
└─ NO or type = "generic-rss" → Go to step 2

Step 2: Fetch Content
├─ Call scrapeUrl(source.url)
│   └─ SUCCESS & valid content? → Go to step 3
│
└─ Content insufficient?
    ├─ If Brave API key available:
    │   ├─ Call fetchWithBraveSearch(source.query or source.name)
    │   └─ Get content from Brave → Go to step 3
    └─ Else:
        └─ Log error, skip source

Step 3: Validate Content Quality
├─ Length 300-15000 chars? → Go to step 4
└─ No → Try Brave search as final fallback, or skip

Step 4: AI Extraction
├─ Call extractAlertsWithAI(content, sourceUrl, sourceName, sourceQuery)
├─ Claude analyzes content
└─ Returns array of Alert objects

Step 5: Post-Process
├─ Add coordinates/GeoJSON
├─ Validate in English
├─ Check for duplicates
├─ Save to database with source_url
└─ DONE
```

---

## 6. KEY IMPLEMENTATION DETAILS

### Source URL Storage
```typescript
interface Source {
  id: string;
  name: string;
  url: string;           // ← The actual URL to fetch
  enabled: boolean;
  type?: string;         // Optional: "usgs-atom", "cap", "generic-rss", etc.
  query?: string;        // Optional: For Brave search fallback
  trust_score?: number;
}
```

### Timeout Handling
- **Scraping**: 45 seconds per URL
- **Brave Search**: 30 seconds
- **Source Processing**: 90 seconds total per source
- **Aborted requests**: Automatically fall back to next method

### Error Handling
- Failed scrapes log warnings but don't crash
- Brave API quota exceeded (`402`) triggers fallback
- HTTP errors (`404`, `500`, etc.) result in empty content
- Skipped sources log to stats.errors

### Content Format Handling
The scraper automatically:
- Removes HTML/CSS/JavaScript
- Decodes HTML entities (`&nbsp;`, `&amp;`, etc.)
- Normalizes whitespace
- Converts to plain text
- Works for:
  - **HTML pages**: News articles, blogs, forums
  - **RSS/Atom feeds**: Reddit .rss, news feeds, USGS Atom
  - **JSON APIs**: Brave results, FAA notices

---

## 7. SUMMARY TABLE

| Aspect | Details |
|--------|---------|
| **RSS Feed Support** | ✅ YES - Reddit .rss works with generic-rss or no type |
| **Fetch Method** | Direct `fetch()` via scrapeUrl() or fetchWithBraveSearch() |
| **Timeouts** | 45sec scrape, 30sec Brave, 90sec total per source |
| **Content Validation** | 300-15000 characters required |
| **Parsing** | Structured (if type matches) → then AI extraction |
| **Reddit Format** | `https://reddit.com/r/{subreddit}/.rss` |
| **URL Storage** | `sources.url` column in database |
| **Source Tracking** | All extracted alerts get `source_url` field set |
| **Fallback Chain** | Structured → Scrape → Brave → AI extraction |

---

## 8. RELATED FILES

- **Main Worker**: [supabase/functions/scour-worker/index.ts](supabase/functions/scour-worker/index.ts#L280-L330)
  - Lines 280-330: `scrapeUrl()` implementation
  - Lines 230-270: `fetchWithBraveSearch()` implementation
  - Lines 1495-1620: Source processing main loop
  
- **Structured Parsers**: [STRUCTURED_PARSERS.md](STRUCTURED_PARSERS.md)
  - Details on type-specific parsers (USGS, CAP, FAA, NOAA)

- **Import Script**: [import-reddit-sources.sql](import-reddit-sources.sql) / [import-reddit-sources.ts](import-reddit-sources.ts)
  - Bulk-imports Reddit sources into the database
