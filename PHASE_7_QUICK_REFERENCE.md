# 🚀 Phase 7 Quick Reference Card

**Status:** ✅ Implementation Complete - Ready for Database Migrations & Testing

---

## 📦 What You Got

### Files Created (9 new files)

**Components:**
1. `src1/components/SourceBulkUploadEnhanced.tsx` - Enhanced bulk upload with preview & validation
2. `src1/components/SourceTableEnhanced.tsx` - Enhanced table with search, filter, sort

**Migrations:**
3. `supabase/migrations/006_add_source_trust_score.sql` - Add trust_score column
4. `supabase/migrations/007_bulk_import_95_sources.sql` - Insert 95 sources

**Documentation:**
5. `ANALYST_SOURCE_MANAGEMENT_DESIGN.md` - System design & architecture
6. `ANALYST_SOURCE_MANAGEMENT_GUIDE.md` - Analyst user guide (700+ lines)
7. `SOURCE_UPLOAD_TEMPLATE_GUIDE.md` - Excel template reference
8. `PHASE_7_IMPLEMENTATION_SUMMARY.md` - This implementation summary
9. `PHASE_7_QUICK_REFERENCE.md` - This file

### Files Modified (1 file)

1. `src1/lib/excelParser.ts` - Enhanced to parse type, query, trust_score

---

## ⚡ 3-Step Deployment

### Step 1: Apply Migrations (5 min)

```sql
-- In Supabase SQL Editor:

-- 1. Apply 005_add_confidence_score.sql (if not already done)
ALTER TABLE alerts ADD COLUMN confidence_score NUMERIC DEFAULT 0.5 CHECK (...);
CREATE INDEX idx_alerts_confidence_score ON alerts (...);

-- 2. Apply 006_add_source_trust_score.sql
ALTER TABLE sources ADD COLUMN trust_score NUMERIC DEFAULT 0.5 CHECK (...);
CREATE INDEX idx_sources_trust_score ON sources (...);

-- 3. Apply 007_bulk_import_95_sources.sql
INSERT INTO sources (name, url, type, country, query, trust_score, enabled) VALUES
  ('USGS Earthquake Hazards', 'https://...', 'usgs-atom', 'US', '', 0.95, true),
  ('NWS Severe Weather', 'https://...', 'nws-cap', 'US', '', 0.90, true),
  ...
  (95 total sources)
ON CONFLICT (url) DO NOTHING;
```

**Verify:**
```sql
SELECT COUNT(*) FROM sources; -- Should be 95+
SELECT COUNT(*) FROM sources WHERE enabled = true; -- Should be ~50
SELECT COUNT(*) FROM sources WHERE enabled = false; -- Should be ~45
```

---

### Step 2: Integrate Enhanced UI (5 min)

**Option A: Replace old components**

```powershell
# Backup old files
cd "c:\Users\Joe Serkin\Documents\GitHub\generator3.0"
mv src1/components/SourceTable.tsx src1/components/SourceTable.old.tsx
mv src1/components/SourceBulkUpload.tsx src1/components/SourceBulkUpload.old.tsx

# Activate enhanced versions
mv src1/components/SourceTableEnhanced.tsx src1/components/SourceTable.tsx
mv src1/components/SourceBulkUploadEnhanced.tsx src1/components/SourceBulkUpload.tsx
```

**Option B: Side-by-side testing**

Keep both, import enhanced versions with different names, test in parallel.

---

### Step 3: Test & Verify (10 min)

**Test Bulk Upload:**
1. Create test Excel: 5 sources with all 7 columns
2. Upload via SourceBulkUpload component
3. Verify preview shows type, trust_score, enabled status
4. Verify upload success

**Test Source Table:**
1. Open Sources tab
2. Search for "USGS" - should filter instantly
3. Filter by type "news-rss" - should show only news sources
4. Sort by "Trust Score" - highest first
5. Click "Test" on a source - should show ✓ OK or ✗ FAIL

**Test Confidence Integration:**
1. Wait for scour cycle or trigger manually
2. Check Alerts tab
3. Verify ConfidenceBadge shows on alerts
4. Verify USGS alerts have high confidence (0.85-1.0)
5. Verify Reddit alerts have low confidence (0.2-0.6)

---

## 📊 New Source Fields

| Field | Type | Default | Example |
|-------|------|---------|---------|
| `type` | string | generic-rss | usgs-atom, news-rss |
| `query` | string | "" | "hurricane OR storm" |
| `trust_score` | number | 0.5 | 0.95 (USGS), 0.80 (Reuters) |
| `last_success` | timestamp | null | 2026-01-20T10:30:00Z |
| `last_error` | string | null | "Connection timeout" |
| `health_status` | enum | unknown | healthy, warning, error |

---

## 🎯 Trust Score Quick Guide

```
0.95 = USGS, official US government seismic
0.90 = NWS, NOAA, FAA (official US gov)
0.85 = GDACS, ReliefWeb (UN agencies)
0.80 = Reuters, BBC, Guardian (major news)
0.75 = US State Dept, DFAT (travel advisories)
0.60 = Travel blogs, regional news
0.55 = Reddit, social media aggregators
0.50 = Unknown/unverified (default)
```

---

## 🔍 Source Type Quick Guide

**Official Government:**
- `usgs-atom` - USGS Earthquake feeds
- `nws-cap` - NWS Weather alerts
- `noaa-tropical` - NOAA Tropical storms
- `faa-json` - FAA NOTAM

**International:**
- `gdacs-rss` - Global Disaster Alert
- `reliefweb-rss` - UN ReliefWeb

**News:**
- `news-rss` - Reuters, BBC, Guardian, etc.
- `travel-advisory-rss` - US State, DFAT, FCO

**Phase 2 (not yet implemented):**
- `gdelt-json` - GDELT Event Data
- `google-news-api` - Google News search
- `generic-rss` - Fallback for any RSS/Atom

---

## 📋 Excel Template (Copy to Excel)

**Column Headers (Row 1):**
```
name | url | type | country | query | trust_score | enabled
```

**Example Row:**
```
USGS Earthquakes | https://earthquake.usgs.gov/feed.xml | usgs-atom | US | | 0.95 | TRUE
```

**Column Rules:**
- `name`, `url` = Required
- `type` = Lowercase (usgs-atom, not USGS-ATOM)
- `trust_score` = Number format (not text)
- `enabled` = Boolean TRUE/FALSE or 1/0

---

## ⚠️ Common Issues & Fixes

### "No sources found in Excel"
**Fix:** Ensure columns named: name, url, type, country, query, trust_score, enabled (case-insensitive)

### "Upload failed"
**Fix:** Check Supabase connectivity, verify migrations applied

### "Rejected N sources"
**Fix:** URLs unreachable. Test URLs in browser, fix or disable those sources

### Preview shows wrong trust scores
**Fix:** Format trust_score column as Number in Excel (not text)

### Sources not showing in table
**Fix:** Clear search box, set Type Filter to "All Types", set Status to "All"

---

## 📞 Next Steps

1. **Apply Migrations** → Supabase SQL Editor
2. **Integrate Enhanced UI** → Rename files or update imports
3. **Test End-to-End** → Upload test sources, verify table/alerts
4. **Share with Team** → Send analyst guides
5. **Monitor** → Check alert confidence scores, adjust trust scores

---

## 📚 Documentation Links

- **Design:** `ANALYST_SOURCE_MANAGEMENT_DESIGN.md`
- **Analyst Guide:** `ANALYST_SOURCE_MANAGEMENT_GUIDE.md`
- **Template Guide:** `SOURCE_UPLOAD_TEMPLATE_GUIDE.md`
- **Full Summary:** `PHASE_7_IMPLEMENTATION_SUMMARY.md`

---

## ✅ Completion Checklist

**Backend:**
- [ ] Migration 005 applied (confidence_score)
- [ ] Migration 006 applied (trust_score)
- [ ] Migration 007 applied (95 sources)
- [ ] Verify 95+ sources in database

**Frontend:**
- [ ] Enhanced SourceTable component activated
- [ ] Enhanced SourceBulkUpload component activated
- [ ] Test search/filter/sort functionality
- [ ] Test bulk upload with sample Excel

**Integration:**
- [ ] Confidence scores show on alerts
- [ ] High-trust sources generate high confidence
- [ ] Low-trust sources generate low confidence
- [ ] Health indicators working (✅⚠️❌❓)

**Documentation:**
- [ ] Share analyst guides with team
- [ ] Run training session (15 min)
- [ ] Gather feedback

---

**Status:** Ready for deployment! 🚀

**Questions?** Refer to `PHASE_7_IMPLEMENTATION_SUMMARY.md` for detailed explanations.
