# WordPress ACF Field Alignment Audit

## ACF Field Schema (What WordPress Expects)

Based on the WordPress custom post type configuration and ACF admin panel:

| ACF Field Name | ACF Field Key | Field Type | Format | Required | Current Status |
|---|---|---|---|---|---|
| Mainland | mainland | Text/Select | String (continent) | No | ✅ Sending |
| Intelligence Topics | intelligence_topics | Select | String (enum) | No | ✅ Sending |
| Location | the_location | Text | String | Yes | ✅ Sending |
| Latitude | latitude | Text/Number | String (decimal) | No | ⚠️ Empty for manual alerts |
| Longitude | longitude | Text/Number | String (decimal) | No | ⚠️ Empty for manual alerts |
| Radius (km) | radius | Number | Numeric | No | ⚠️ Not populated |
| Polygon | polygon | Text/Textarea | GeoJSON string | No | ❌ Not saving from form |
| Start | start | DateTime | ISO 8601 | No | ✅ Sending (but may need format adjustment) |
| End | end | DateTime | ISO 8601 | No | ✅ Sending (but may need format adjustment) |
| Severity | severity | Select/ButtonGroup | Color code (green/yellow/orange/red/darkred) | Yes | ✅ Sending normalized |
| Description | description | Textarea | Plain text | No | ❌ NULL in database |
| Recommendations | recommendations | Repeater/Text | Array of {recommendation: text} | No | ⚠️ Repeater not populating |
| Sources | sources | Text | URL string | No | ✅ Sending |
| Country | Country | Select | String (country) | Conditional | ✅ Sending if not Global |

## Database Column Mapping

Current database columns (from 008_align_acf_fields.sql):
- `description` → TEXT (for ACF "description" field)
- `recommendations` → TEXT (for ACF "recommendations" repeater)
- `mainland` → TEXT (for ACF "mainland" field)
- `intelligence_topics` → TEXT (for ACF "intelligence_topics" field)
- `latitude` → TEXT (for ACF "latitude" field)
- `longitude` → TEXT (for ACF "longitude" field)
- `radius` → NUMERIC (for ACF "radius" field)
- `geojson` → TEXT (for ACF "polygon" field)

## Issues Found

### 1. **Description Field NOT Saving**
- **Symptom**: `description: null` in database
- **Root Cause**: Frontend form sends `summary`, not `description`
- **Status**: Fixed in code (maps summary → description)
- **Verification Needed**: Test if description now saves

### 2. **Polygon/GeoJSON NOT Saving**
- **Symptom**: `geojson: null` in database
- **Root Cause**: Frontend sends `geo_json`, but mapping may not be working
- **Status**: Code maps `geo_json` → `geojson`
- **Verification Needed**: Check if geo_json is being parsed correctly

### 3. **Recommendations Repeater Empty in WordPress**
- **Symptom**: WordPress shows empty repeater rows
- **Root Cause**: Unknown - formatting looks correct (`{recommendation: text}`)
- **Possible Issues**:
  - ACF repeater field name might be different
  - Field format might need `{label: text}` instead of `{recommendation: text}`
  - ACF REST API repeater handling might differ

### 4. **Start/End DateTime Format**
- **Current**: ISO 8601 (`2026-01-22T10:09:12Z`)
- **ACF Might Expect**: MySQL format (`2026-01-22 00:00:00`)
- **Status**: Needs verification in WordPress ACF docs

## Recommendations

1. **Verify ACF field names** on WordPress: Dashboard → Custom Fields → Check exact field keys
2. **Test repeater format**: Check if `recommendations` field expects different sub-field names
3. **Debug DateTime format**: WordPress ACF often expects MySQL format, not ISO
4. **Validate frontend data**: Ensure `geo_json` is being sent as valid JSON

## Next Steps

1. Check WordPress ACF configuration for exact field names and formats
2. Enable WordPress API logging to see actual error responses
3. Test with valid data in each field
4. Verify repeater field configuration in ACF
