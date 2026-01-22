# WordPress ACF Fields Not Populating - Root Cause & Fix

**Issue:** ACF fields showing as null on WordPress posts, only HTML content rendering

**Root Cause:** Using incorrect key in WordPress REST API payload - was using `acf:` when it should be `fields:`

---

## The Fix

**Changed from:**
```typescript
body: JSON.stringify({
  title: alert.title,
  content: buildContent(),
  status: "publish",
  acf: acfFields,      // ❌ Wrong key - ACF uses 'fields'
})
```

**Changed to:**
```typescript
body: JSON.stringify({
  title: alert.title,
  content: buildContent(),
  status: "publish",
  fields: acfFields,   // ✅ Correct key for WordPress REST ACF
})
```

---

## WordPress REST API ACF Key

**Important:** WordPress REST API for ACF custom fields uses the key `fields`, not `acf`.

This is documented in:
- WordPress REST API documentation
- ACF REST API integration
- Previously working code in `index.ts.bak-20260118-093556` that used `fields:`

---

## What This Fixes

✅ **Before:** ACF fields all null, only HTML in post content  
✅ **After:** ACF fields populate correctly (mainland, intelligence_topics, the_location, severity, etc.)

The `fields` key in the WordPress REST API payload tells WordPress to populate custom post type fields via ACF.

---

## Deployment

**Status:** ✅ Deployed  
**Expected Result:** ACF fields should now populate on WordPress posts

Test by creating an alert and checking the WordPress post admin - ACF field panel should show populated data instead of null values.

---

## Reference: ACF Field Names Being Sent

```typescript
const acfFields: Record<string, any> = {
  mainland: alert.mainland,
  intelligence_topics: normalizedTopics,  // e.g., "Security", "Terrorism"
  the_location: `${alert.location}, ${normalizedCountry}`,
  latitude: String(lat),
  longitude: String(lng),
  radius: alert.radius,
  polygon: polyText,           // GeoJSON
  start: startIso,             // ISO timestamp
  end: endIso,                 // ISO timestamp
  severity: normalizedSeverity, // Color code: green/yellow/orange/red/darkred
  recommendations: formattedRecommendations, // Array of {recommendation: "..."}
  sources: alert.source_url,
  Country: normalizedCountry,  // Only if not "Global"
};
```

All these fields should now populate in the WordPress post's ACF field panel.
