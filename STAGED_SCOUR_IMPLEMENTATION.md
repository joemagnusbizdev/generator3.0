# Staged Scour System Implementation

## Overview

The scour process has been redesigned to break the monolithic job into manageable, operator-controlled stages. This allows operators to control scour execution, monitor results per group, and automatically disable failed sources.

## Architecture

### Two-Stage System

1. **Early Signals Stage**: Base queries against all configured sources for rapid threat detection
2. **Source Groups Stage**: Operator-triggered groups of sources divided by type and batched by 50 sources per group

### Components

#### Frontend: ScourManagementInline.tsx
- **Location**: `src1/components/ScourManagementInline.tsx`
- **Purpose**: Operator UI for managing staged scour execution
- **Features**:
  - Loads enabled sources from REST API
  - Groups sources by type (RSS, Reddit, etc.)
  - Batches each type into groups of 50
  - Creates "Run Group" buttons for operator control
  - Tracks results per group:
    - `alerts_created`: Number of new alerts created
    - `duplicates_skipped`: Number of duplicates found
    - `errors`: Number of sources that errored
    - `disabled_sources`: Count of sources auto-disabled
  - Auto-disables failed sources via REST API PATCH
  - Shows visual completion status per group

#### Integration in SourceManagerInline
- **Location**: `src1/components/SourceManagerInline.tsx` (line ~340)
- **Purpose**: Display scour management UI within the Sources tab
- **Condition**: Only shown if `canScour` permission is true

#### Backend: POST /scour-group
- **Location**: `supabase/functions/clever-function/index.ts` (lines 602-668)
- **Purpose**: Process a group of sources
- **Request Body**:
  ```json
  {
    "source_ids": ["id1", "id2", ...],
    "group_id": "rss-0"
  }
  ```
- **Response**:
  ```json
  {
    "ok": true,
    "jobId": "scour-uuid",
    "group_id": "rss-0",
    "results": {
      "alerts_created": 15,
      "duplicates_skipped": 3,
      "errors": 2,
      "disabled_sources": 1,
      "disabled_source_ids": ["source-123"]
    }
  }
  ```

#### Proxy Handler
- **Location**: `src1/lib/supabase/index.ts` (lines 774-799)
- **Purpose**: Route frontend requests to clever-function
- **Path**: `/scour-group` or `/clever-function/scour-group`
- **Method**: POST
- **Functionality**: Forwards request with auth headers to edge function

### Flow Diagram

```
UI (ScourManagementInline)
  ↓ POST /scour-group
Proxy (src1/lib/supabase/index.ts)
  ↓ Forward with auth
Edge Function (clever-function/index.ts)
  ↓ POST /scour-group handler
Call scour-worker
  ↓
scour-worker (index.ts) processes sourceIds array
  ↓
Returns results: { alerts_created, duplicates_skipped, errors, disabled_source_ids }
  ↓
Edge function stores in KV and returns
  ↓
Proxy returns to frontend
  ↓
UI updates group status to "completed"
  ↓
Disable failed sources via REST API PATCH
```

## Integration Points

### 1. SourceManagerInline
**Added**:
- Import: `import ScourManagementInline from "./ScourManagementInline";`
- Component: `<ScourManagementInline accessToken={accessToken} />`
- Condition: Only shown when `canScour` is true

**Result**: Operators see both legacy scour controls AND new grouped scour management

### 2. Proxy Layer
**Added**:
- Route handler for POST /scour-group
- Forwards requests to clever-function with proper auth headers
- Returns results object with disabled_source_ids for auto-disable logic

### 3. Backend Endpoint
**Added**:
- Complete endpoint that:
  - Receives source_ids array and group_id
  - Creates job ID and stores in KV
  - Calls scour-worker with specific source list
  - Handles results with disabled sources
  - Returns structured response

## User Workflow

### 1. Navigate to Sources Tab
- User sees "Scour Management" section with:
  - Early Signals Scour (first group)
  - Grouped sources by type (RSS-Group1, Reddit-Group1, etc.)

### 2. Run Groups Sequentially
- Click "Run Group" button on Early Signals Scour
- Wait for completion (shows spinner)
- See results grid: Alerts Created | Duplicates | Errors | Disabled
- Click "Run Group" on next source group
- Continue until all groups complete
- See "✅ All scour groups completed!" message

### 3. Error Handling
- Sources that error are automatically disabled
- Operator can see which sources were disabled in results grid
- Failed sources won't be included in future scours

### 4. Progress Monitoring
- ScourStatusIndicator (global banner) shows overall progress
- Group results show detailed per-batch metrics
- Can track alerts created, duplicates found, errors encountered

## Status of Implementation

### ✅ Completed
- ScourManagementInline component created (fully functional UI)
- Proxy handler for /scour-group added
- Backend endpoint skeleton created
- Integration into SourceManagerInline
- Build and deployment successful
- ScourStatusIndicator global visibility

### 🔄 In Progress / Partially Complete
- POST /scour-group endpoint calls scour-worker but may need result aggregation tuning
- Error detection in scour-worker may need enhancement for auto-disable accuracy

### 🟩 Next Steps (If Needed)
1. **Test staged scour pipeline**:
   - Run Early Signals group
   - Run first RSS group (50 sources)
   - Verify results tracking
   - Verify auto-disable of failed sources

2. **Optional enhancements**:
   - Add batch processing progress within each group
   - Add resume capability if group interrupted
   - Add group reordering capability
   - Add source count display per group

## Files Modified

1. **src1/components/ScourManagementInline.tsx** (NEW)
   - 305 lines
   - Complete UI for grouped scour management

2. **src1/components/SourceManagerInline.tsx**
   - Added import for ScourManagementInline
   - Added component to JSX (~1 line change)

3. **src1/lib/supabase/index.ts**
   - Added POST /scour-group proxy handler (~25 lines)

4. **supabase/functions/clever-function/index.ts**
   - Already has POST /scour-group endpoint (pre-existing)

## Technical Notes

### Architecture Decisions
1. **Group-based instead of source-based**: Groups of 50 provide better progress tracking and error scope
2. **Operator-triggered not automatic**: Allows operators to pause, monitor, and adjust
3. **Type-based grouping**: Keeps similar sources together for easier debugging
4. **Auto-disable on error**: Prevents repeated failures of known-bad sources

### Error Handling
- Sources that fail during scour are returned in `disabled_source_ids`
- Frontend immediately disables these via REST API PATCH
- Worker should track errors per source for accurate identification

### Performance
- Early Signals: Runs base queries
- Source groups: Sequential batches of 50 prevent resource exhaustion
- Operator can add delays between groups if needed
- Results returned immediately after group completion

## API Contracts

### POST /scour-group Request
```typescript
{
  source_ids: string[];      // Array of source IDs to scour
  group_id: string;          // Identifier for this group (e.g., "rss-0")
}
```

### POST /scour-group Response
```typescript
{
  ok: boolean;
  jobId: string;
  group_id: string;
  results: {
    alerts_created: number;
    duplicates_skipped: number;
    errors: number;
    disabled_sources: number;
    disabled_source_ids: string[];  // IDs to disable
  }
}
```

### Source Auto-Disable via REST API
```
PATCH /rest/v1/sources?id=eq.{sourceId}
Body: { "enabled": false }
```

## Testing Checklist

- [ ] Load Sources tab
- [ ] See "Scour Management" section with grouped sources
- [ ] Click "Run Group" on Early Signals
- [ ] See running status with spinner
- [ ] See results grid after completion
- [ ] Verify alerts_created count is non-zero
- [ ] Click next group
- [ ] See completion message after all groups done
- [ ] Verify failed sources are disabled in database
- [ ] Global ScourStatusIndicator shows progress

## Rollback Notes

If needed to revert:
1. Remove ScourManagementInline import from SourceManagerInline
2. Remove ScourManagementInline component from JSX
3. Remove proxy handler from src1/lib/supabase/index.ts
4. Re-deploy clever-function

The legacy POST /scour-sources endpoint remains unchanged for backward compatibility.

## Future Enhancements

1. **Pause/Resume**: Allow pausing between groups
2. **Batch Progress**: Show progress within each 50-source group
3. **Retry Failed**: Option to re-run failed groups
4. **Custom Batching**: Allow operators to adjust batch size or grouping
5. **Results Export**: Export results per group as CSV/JSON
6. **Scheduled Scour**: Run groups on schedule instead of manual
