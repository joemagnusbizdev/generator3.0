# Early Signals Testing Guide

## Issue: Showing "0/1" or Very Few Sources

### Root Cause
When you start a scour without selecting specific sources, the system fetches ALL **enabled** sources from the database. If only 1 source is enabled, you'll see "0/1" or "1/X" in the status bar.

## How to Test Early Signals

### Step 1: Enable Sources
1. Go to **Sources** tab
2. Look at the count: `{enabledTotal} / {total} enabled`
3. If enabledTotal is very small, you need to enable more sources
4. Click the checkbox next to source names to enable them
5. You should have at least 3-5 enabled for a meaningful test

### Step 2: Start Scour
1. Click **"Run Scour"** button
2. Watch the status bar update

### Step 3: Watch for Phases
The status bar should show progression:
- **Phase 1: Main Scour** - Shows `🔄 Scouring in progress: X/Y`
- **Phase 2: Early Signals** - Shows `⚡ Early Signals: X/850`
- **Phase 3: Done** - Shows `✅ Main sources done`

### Expected Progress
- Main scour processes each enabled source
- Once all sources finish (`X/Y` becomes `Y/Y`), transitions to early signals
- Early signals phase runs 25 queries × 33 countries = ~825 queries total
- Shows `⚡ Early Signals: 0/850` → `⚡ Early Signals: 850/850` as progress
- Finally transitions to "done"

## Troubleshooting "0/1"

### Check 1: Are sources enabled?
```
Sources tab > Count at bottom: "X / {total} enabled"
If X is very small, enable more sources before scouring.
```

### Check 2: Verify browser console
```
Press F12 → Console tab
Look for: "[Scour] Fetched sources: total=X, enabled=Y"
This shows how many sources were fetched and enabled.
```

### Check 3: Verify backend is running
```
The early signals code will only run if BRAVE_API_KEY is configured.
Check: Status bar should show "✓ Brave" in the component dashboard while scouring.
If "○ Brave", the API key is missing and early signals won't run.
```

## What Should Happen

### Main Scour Phase
- Process each enabled source
- Extract alerts using AI analysis
- Check for duplicates
- Show progress: "X/Y processed"

### Early Signals Phase
- Triggered automatically after main scour completes
- Requires BRAVE_API_KEY environment variable
- Runs 25 search queries × 33 countries
- Creates proactive alerts from Brave Search results
- Shows `⚡ Early Signals: X/850` progress

### Final Result
- All alerts saved to database (draft status)
- Visible in Review tab
- Early signals alerts marked with `ai_generated: true`
- Source shows as "Brave Search: {query}"

## Notes

- **Early signals queries**: 25 base queries (earthquake, flooding, wildfire, etc.) × 33 countries = ~825 queries
- **Not all queries will run**: Due to API rate limits, may complete around 200-400 queries
- **Time estimate**: Main scour: 2-10 min depending on source count; Early signals: 5-15 min
- **Progress updates**: Every 10 queries for early signals, updates KV store with progress
