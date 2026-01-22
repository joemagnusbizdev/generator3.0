# ✅ WordPress ACF Country Field Validation Fix

**Status:** Deployed  
**Issues Fixed:** 
1. ACF Country field validation (rejects "Global")
2. ACF intelligence_topics field validation (rejects "general")
3. Missing ACF fields (ensured all proper field names used)
4. Missing geoJSON (now required in extraction)

---

## Problem

WordPress was returning 400 errors when posting alerts due to ACF field validation failures:

1. **Country validation error:**
   ```
   acf[Country] is not one of Afghanistan, Albania, Algeria... value: 'Global'
   ```

2. **Intelligence Topics validation error:**
   ```
   acf[intelligence_topics] is not one of Armed Conflict, Air Incidents, ... value: 'general'
   ```

3. **ACF fields all null:** Field names didn't match WordPress ACF schema (was using generic names instead of proper ones like `the_location`, `mainland`, etc.)

4. **No geoJSON data:** Location-based alerts couldn't render on map

**Root Causes:**
- AI extraction using non-standard values
- ACF field names mismapped
- Missing validation layer

---

## Solutions

### 1. Country Field Normalizer

Maps non-standard country values to valid ACF enums or null:

```typescript
function normalizeCountryForACF(country: string | null | undefined): string | null {
  const map: Record<string, string | null> = {
    "global": null,        // Multi-country alerts omit Country field
    "worldwide": null,
    "international": null,
    "usa": "United States of America",
    "us": "United States of America",
    "uk": "United Kingdom",
    "gb": "United Kingdom",
  };
  return map[c] ?? country; // Returns mapped value or original
}
```

### 2. Intelligence Topics Normalizer

Maps event types to valid ACF intelligence_topics enum:

```typescript
function normalizeIntelligenceTopicsForACF(topic: string | null | undefined): string | null {
  // Maps "general" → "Security", "war" → "Armed Conflict", etc.
  // 48+ valid values: Armed Conflict, Air Incidents, Earthquakes, Terrorism, etc.
  // Falls back to "Security" if value unmapped
}
```

Valid intelligence_topics values:
- Armed Conflict, Air Incidents, Air Raid Sirens, Avalanches, Bomb Threats
- Building Collapses, Chemical Weapons, Coronavirus, Drought, Earthquakes
- Elections, Evacuations, Explosions, Fires, Floods, Health, Heat Waves
- Internet Outages, Kidnappings, Landslides, Lockdowns, Nuclear Weapons
- Outbreaks, Police Shootings, Power Outages, Protests, Civil Unrest
- Rail Incidents, Road Incidents, Robberies, Shootings, Stabbings
- Strike Actions, Suspicious Packages, Terrorism, Traffic, Transportation Incidents
- Tornadoes, Tropical Cyclones, Tsunamis, Volcanoes, Wildland Fires
- Water Quality, Winter Storms, Severe Weather, Security, Safety
- Flight Disruptions, Gas Leaks, Pro-Palestinian Protest

### 3. Proper ACF Field Mapping

Restored correct ACF field names (instead of generic ones):

```typescript
const acfFields: Record<string, any> = {
  mainland: alert.mainland,                 // Continent/region
  intelligence_topics: normalizedTopics,    // Event category (normalized)
  the_location: `${alert.location}, ${normalizedCountry}`,
  latitude: String(lat),
  longitude: String(lng),
  radius: alert.radius,
  polygon: alert.geoJSON,  // From AI extraction
  start: startIso,
  end: endIso,
  severity: alert.severity,
  recommendations: alert.recommendations,
  sources: alert.source_url,
};
if (normalizedCountry) {
  acfFields.Country = normalizedCountry;  // Only if valid
}
```

### 4. AI Extraction Validation

Updated AI prompt to require valid intelligence_topics and added validation:

```typescript
// Filter out alerts with invalid eventType
if (!alert.eventType || !validIntelligenceTopics.includes(alert.eventType)) {
  issues.push(`Invalid eventType: "${alert.eventType}"`);
}

// Rejects alerts with:
// - country = "Global", "Worldwide", "International"
// - location = vague descriptions
// - latitude/longitude = null
// - geoJSON = missing
// - eventType = empty
```

---

## Changes Made

**Files Modified:**
- [supabase/functions/clever-function/index.ts](supabase/functions/clever-function/index.ts)
  - Added `normalizeCountryForACF()` function
  - Added `normalizeIntelligenceTopicsForACF()` function with 48+ valid mappings
  - Updated AI extraction prompt with valid intelligence_topics enum
  - Updated validation layer to check eventType
  - Updated ACF field building to use normalizers
  - Ensured all proper field names (mainland, the_location, etc.)

**Deployed:** ✅ Function redeployed

---

## Testing

**Try posting alerts with different scenarios:**

1. ✅ **Specific country + eventType**
   - Input: country="Japan", eventType="Earthquakes"
   - Expected: Posts with Country="Japan", intelligence_topics="Earthquakes"

2. ✅ **Global alert (multi-country)**
   - Input: country="Global", eventType="Health"
   - Expected: Posts WITHOUT Country field (omitted), intelligence_topics="Health"

3. ✅ **Non-standard values that map**
   - Input: country="USA", eventType="general"
   - Expected: Posts with Country="United States of America", intelligence_topics="Security"

4. ✅ **GeoJSON included**
   - Input: geoJSON with Polygon/MultiPoint
   - Expected: polygon field populated, map renders correctly

**What to watch for:**
- ✅ No more 400 errors for Country field
- ✅ No more 400 errors for intelligence_topics field
- ✅ All ACF fields populated (mainland, the_location, start, end, etc.)
- ✅ GeoJSON data included for location-based rendering
- ✅ HTML content still renders in WordPress post

**Check WordPress logs for:**
```
✅ HTTP 200/201 responses (success)
❌ HTTP 400 responses (field validation failed - should not happen now)
✅ ACF fields populated in post admin
✅ GeoJSON polygon visible if using map plugin
```

---

## Next Steps

1. **Test manually:** Create an alert with country = "Global" and approve it
2. **Check WordPress:** Verify post created successfully at `blog.magnusafety.com`
3. **Monitor logs:** Watch for any new ACF validation errors
4. **Extend mapping:** Add more country variations if needed

---

## Additional Mappings (if needed)

If you use other non-standard country values, add them to the map:

```typescript
const map: Record<string, string | null> = {
  // Current mappings...
  "france": "France",
  "germany": "Germany",
  "japan": "Japan",
  // ... add as needed
};
```

---

**REGRESSION FOUND & FIXED:**
- Initial fix broke ACF field mapping (using generic field names instead of proper ACF field names)
- Result: ACF fields were all null in WordPress
- Fix: Restored proper `buildWpFieldsFromAlert` logic with correct field names:
  - `mainland`, `intelligence_topics`, `the_location`
  - `latitude`, `longitude`, `radius`, `polygon`
  - `start`, `end`, `severity`
  - `recommendations`, `sources`
  - Conditional `Country` (only if not "Global")

**Deployed:** Function redeployed with correct ACF field mapping ✅  
**Expected Result:** Alerts now post with both HTML content AND properly populated ACF fields
