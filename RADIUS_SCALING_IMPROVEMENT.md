# Polygon Radius Scaling Improvement

## Overview
Updated the alert polygon `radiusKm` calculation to scale dynamically based on **event scope/impact**, not just severity level. This ensures polygons are appropriately sized for the geographic extent of events.

## Changes Made

### 1. **Scope-Based Radius Calculation**
Implemented `getRadiusFromSeverity()` function that considers:
- **Geographic Scope**: local → city → regional → national → multinational
- **Severity Level**: critical, warning, caution, informative
- **Event Type**: Natural Disaster, War, Health, Environmental, etc.

### 2. **Scope Radius Baseline**
```typescript
const scopeRadius = {
  'local': 8 km           // Street/neighborhood level
  'city': 25 km           // City/urban area
  'regional': 75 km       // Region/state level
  'national': 200 km      // Country/nationwide
  'multinational': 500 km // Continental/global scale
}
```

### 3. **Severity Multipliers**
Applied on top of scope baseline:
```typescript
'critical': 1.8x    // Highest impact events
'warning': 1.3x     // Significant impact
'caution': 0.9x     // Moderate impact
'informative': 0.7x // Low impact
```

### 4. **Event Type Multipliers**
Additional scaling by event category:
```typescript
'Natural Disaster': 1.5x   // Earthquakes, floods, wildfires
'War': 1.6x                 // Widespread conflict impact
'Terrorism': 1.4x           # High security impact
'Health': 1.3x              # Disease outbreaks
'Environmental': 1.4x       # Pollution, environmental issues
'Maritime': 1.2x            # Ocean/coastal incidents
'Political': 1.1x           # Unrest, protests
'Aviation': 0.8x            # Localized to flight corridors
'Crime': 0.6x               # Localized crime incidents
'Infrastructure': 0.9x      # Power, water outages
'Transportation': 1.0x      # General transport issues
```

### 5. **Minimum and Maximum**
- **Minimum**: 5 km (ensures "few square kilometers" coverage)
- **Maximum**: 800 km (prevents unrealistic continental coverage)

## Examples of New Radius Values

### Natural Disaster (Earthquake)
- **Severity**: critical
- **Scope**: national
- **Event Type**: Natural Disaster
- **Calculation**: 200 × 1.8 × 1.5 = **540 km** (was 35 km)

### Regional Health Crisis
- **Severity**: warning
- **Scope**: regional
- **Event Type**: Health
- **Calculation**: 75 × 1.3 × 1.3 = **127 km** (was 20 km)

### Local Street Crime
- **Severity**: caution
- **Scope**: local
- **Event Type**: Crime
- **Calculation**: 8 × 0.9 × 0.6 = **4.3 km → 5 km minimum** (was 10 km)

### National Political Unrest
- **Severity**: warning
- **Scope**: national
- **Event Type**: Political
- **Calculation**: 200 × 1.3 × 1.1 = **286 km** (was 20 km)

## Updated Functions

### 1. **clever-function/index.ts**
- Line 1410: GDACS radius calculation now uses `getRadiusFromSeverity(severity, 'regional', alertType)`
- Line 4184-4191: Early signals now calculate scope + use `getRadiusFromSeverity()`

### 2. **scour-worker/index.ts**
- Added `determineGeoScope()` and `getRadiusFromSeverity()` helper functions
- Line 420-427: Main source scouring now uses `getRadiusFromSeverity()`

## Automatic Scope Detection

The system automatically determines scope from:
1. **Severity Level**:
   - Critical events → regional scope minimum
   - Warning events → city or regional scope
   - Lower severity → local scope

2. **Region/Location Data**:
   - Multi-word regions (e.g., "Western Europe") → regional
   - Single regions → city or local

3. **Provided GeoScope Field**:
   - Uses explicit scope if provided by AI

## Deployment Status
✅ **Deployed**: 2024
- clever-function: Updated GDACS + early signals
- scour-worker: Updated main source processing

## Testing Recommendations
1. Run full scour with various event types
2. Verify radius values in generated alerts
3. Check polygon visualization on map
4. Compare old vs new polygon sizes in UI
5. Validate that wide-impact events have larger zones

## User Impact
- **National disasters**: 10-20x larger polygons
- **Regional events**: 5-10x larger polygons
- **Local incidents**: Similar or smaller (more accurate)
- **Minimum coverage**: Guaranteed "few square kilometers"
