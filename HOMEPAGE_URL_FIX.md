# Homepage URL Fix - Issue & Resolution

## Problem
The scour worker was incorrectly setting the `source_url` field to the homepage of news sources instead of the actual source URL (RSS feed, API endpoint, etc.).

### Root Cause
In [supabase/functions/scour-worker/index.ts](supabase/functions/scour-worker/index.ts#L1576), when using Brave Search as a fallback content fetching method:

```typescript
sourceUrl = br.primaryUrl || sourceUrl;  // ❌ WRONG
```

The `br.primaryUrl` returned from Brave Search was the first search result URL (often the homepage), not the original source URL.

### Impact
- Alerts were being tagged with homepage URLs instead of the RSS feed or API endpoint
- Example: Instead of `https://feeds.reutersagency.com/news/world`, alerts got `https://www.reuters.com`
- This broke traceability and verification of alert sources

## Solution
**Remove the `primaryUrl` override** - keep the original `source.url` intact.

### Changes Made
[File: supabase/functions/scour-worker/index.ts](supabase/functions/scour-worker/index.ts#L1570-L1580)

```typescript
// Final fallback: retry Brave if configured
if (!validateContentQuality(content) && config.braveApiKey && sourceQuery && !braveQuotaExceeded && !sourceController.signal.aborted) {
  logger.log(`  🔎 Retrying Brave search (scrape insufficient)`);
  const br = await fetchWithBraveSearch(sourceQuery, config.braveApiKey);
  if (sourceController.signal.aborted) throw new Error('Timeout during Brave retry');
  if (validateContentQuality(br.content)) {
    content = br.content;
    // ✅ CRITICAL FIX: Do NOT use Brave's primaryUrl - keep original source.url
    // sourceUrl remains as source.url (the actual RSS feed or target URL)
  }
}
```

## Why This Works
1. **`source.url`** = The actual configured source (RSS feed, API endpoint, news site)
2. **Brave search** = Used only to fetch supplemental content when scraping fails
3. **primaryUrl from Brave** = The first search result (often homepage, not specific article)

The source URL should represent the **source of the data**, not the search result.

## Testing
To verify the fix:
1. Run scour worker with a test source
2. Check the `source_url` field in alerts
3. Confirm it matches the original source URL, not a homepage

Example:
- Source: `https://feeds.reutersagency.com/news/world`
- Alert `source_url`: Should be `https://feeds.reutersagency.com/news/world` ✅
- NOT `https://www.reuters.com` ❌

## Related Files
- [SCOUR_WORKER_URL_PROCESSING_GUIDE.md](SCOUR_WORKER_URL_PROCESSING_GUIDE.md) - URL processing documentation
- [supabase/functions/scour-worker/index.ts](supabase/functions/scour-worker/index.ts) - Main scour worker implementation

## Status
✅ **FIXED** - Line 1576 no longer overrides sourceUrl with Brave's primaryUrl
