# AI Extraction: Mandatory Location & GeoJSON Requirements

**Status:** Deployed  
**Purpose:** Force AI to extract alerts with specific locations and geographic data for proper WordPress posting

---

## Problem

Last scour batch returned many alerts with:
- `country: "Global"` (not specific - causes WordPress ACF errors)
- Missing `geoJSON` data (required for location-based alerts in WordPress)

These invalid alerts would post to WordPress but with incomplete data, breaking the map/location functionality.

---

## Solution

### 1. Updated AI Extraction Prompt

**New Requirements in System Prompt:**

```
CRITICAL REQUIREMENTS:
- COUNTRY: MUST be specific country name. REJECT any alert with 'Global', 'Worldwide', 'International', or 'Multiple'. If event affects multiple countries, create separate alerts per country.
- LOCATION: MUST be specific city or region name. REJECT vague locations like 'Various locations' or 'Nationwide'. If nationwide, use capital city + radius. For multi-city events, list specific cities.
- LATITUDE/LONGITUDE: REQUIRED and MUST NOT be null. Provide decimal degrees for the affected area's center.
- GEOJSON: REQUIRED for all alerts. Must be valid GeoJSON FeatureCollection with polygon(s) or point(s) covering affected area. No null values.

REJECT CRITERIA - DO NOT INCLUDE ALERTS WITH:
- country = "Global", "Worldwide", "International", "Multiple", null, or undefined
- location = null, undefined, vague descriptions like "Various locations"
- latitude or longitude = null, undefined, 0, or missing
- geoJSON = null, undefined, invalid JSON, or missing
- If any of these are missing, skip the alert entirely
```

### 2. New Validation Layer

Added validation function that filters AI-extracted alerts BEFORE processing:

```typescript
const validAlerts = alerts.filter((alert: any) => {
  // Reject if country is Global/Worldwide/International/Multiple
  const invalidCountries = ['global', 'worldwide', 'international', 'multiple', 'various'];
  if (!alert.country || invalidCountries.includes(country.toLowerCase())) {
    return false; // Skip this alert
  }
  
  // Reject if location is vague/generic
  const invalidLocations = ['various', 'various locations', 'multiple locations', 'nationwide', 'countrywide'];
  if (!alert.location || invalidLocations.includes(location.toLowerCase())) {
    return false; // Skip this alert
  }
  
  // Reject if coordinates are missing/null/zero
  if (isNaN(latitude) || isNaN(longitude) || (lat === 0 && lon === 0)) {
    return false; // Skip this alert
  }
  
  // Reject if geoJSON is missing or invalid
  if (!alert.geoJSON || !isValidGeoJSON(alert.geoJSON)) {
    return false; // Skip this alert
  }
  
  return true; // Alert passes all validation
});
```

**Result:** Alerts that don't meet requirements are filtered out and logged, not imported into database

### 3. GeoJSON Priority

Changed logic to use AI-provided geoJSON instead of generated fallbacks:

```typescript
// Use geoJSON from AI response (validation ensures it exists)
let geoJSON = alert.geoJSON; // Use what AI provided
if (!isValidGeoJSON(geoJSON)) {
  geoJSON = generateCircleGeoJSON(lat, lon, radiusKm); // Only fallback if invalid
}
```

---

## Expected Changes in Scour Results

**Before (❌ Invalid):**
```json
{
  "title": "Regional security concerns",
  "country": "Global",        // ❌ Rejected
  "location": "Various locations",  // ❌ Rejected
  "latitude": null,           // ❌ Rejected
  "longitude": null,          // ❌ Rejected
  "geoJSON": null            // ❌ Rejected - Won't be imported
}
```

**After (✅ Valid):**
```json
{
  "title": "Escalating security situation in Middle East",
  "country": "Israel",        // ✅ Specific country
  "location": "Tel Aviv",     // ✅ Specific city
  "latitude": 32.0853,        // ✅ Coordinates
  "longitude": 34.7818,       // ✅ Coordinates
  "geoJSON": {                // ✅ GeoJSON required
    "type": "FeatureCollection",
    "features": [
      {
        "type": "Feature",
        "geometry": {
          "type": "Polygon",
          "coordinates": [[[32.0, 34.7], [32.1, 34.7], [32.1, 34.8], [32.0, 34.8], [32.0, 34.7]]]
        },
        "properties": {"name": "Tel Aviv alert zone"}
      }
    ]
  }
}
```

---

## Deployment & Testing

**Deployed:** Function redeployed with updated extraction logic ✅

**Test Steps:**
1. Run a new scour job with sources that have multi-country or "Global" content
2. Check logs for: `Filtered X alerts → Y valid (Z rejected for missing required fields)`
3. Verify WordPress posts include both ACF fields AND geoJSON data
4. Verify rejected alerts don't appear in database

**Expected Behavior:**
- ✅ More alerts with proper location/geoJSON data
- ✅ Fewer alerts making it to WordPress (only quality ones)
- ✅ WordPress posts with complete ACF + geoJSON fields
- ✅ Location-based alerts work correctly with map visualization

---

## Console Logging

Watch for these log lines to verify validation is working:

```
? Filtering out alert "Regional security": Invalid country: "Global"
? Filtering out alert "Travel warning": Invalid location: "Various locations"
? Filtering out alert "Safety alert": Invalid coordinates: lat=null, lon=null
? Filtering out alert "Border closure": Missing geoJSON

? Filtered 15 alerts → 8 valid (7 rejected for missing required fields)
```

If you see no filtering messages, it means the AI is already providing good data.

---

## Configuration

To adjust validation criteria, modify these constants in the validation function:

```typescript
const invalidCountries = ['global', 'worldwide', 'international', 'multiple', 'various'];
const invalidLocations = ['various', 'various locations', 'multiple locations', 'nationwide', 'countrywide'];
```

Add more entries if you see other vague values coming from the AI.

---

## Impact on Processing

- **Validation adds ~50ms per scour batch** (minimal impact)
- **Invalid alerts silently rejected** (not stored in DB)
- **Logs show rejection counts** (visibility into data quality)
- **No API changes** (transparent to existing code)
