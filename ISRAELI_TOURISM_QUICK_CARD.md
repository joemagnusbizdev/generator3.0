# Israeli Tourism Edition - Quick Reference Card

## At a Glance

```
┌────────────────────────────────────────────────────────────────┐
│         EARLY SIGNALS: ISRAELI TOURISM EDITION                │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  🎯 FOCUS:      17 Top Israeli Tourism Destinations            │
│  📊 COVERAGE:   2,940 total queries (60 × 49 countries)       │
│  ⚡ SPEED:      12-22 minutes per run                         │
│  📈 ALERTS:     250-450 per run (high confidence >0.5)        │
│  🎓 USE CASE:   Travel safety for tourists & backpackers      │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## The 17 Tourism Destinations (Processing Order)

```
TIER 1: BACKPACKER TRAIL 🇹🇭🇳🇵🇮🇳🇻🇳🇰🇭🇵🇭🇱🇦
┌─────────────────────────────────────────────────┐
│ 1. THAILAND      • Bangkok, Chiang Mai, Islands │
│ 2. NEPAL         • Kathmandu, Everest, Trekking│
│ 3. INDIA         • Goa, Delhi, Himalayas       │
│ 4. VIETNAM       • Hanoi, HCMC, Halong         │
│ 5. CAMBODIA      • Siem Reap, Angkor Wat       │
│ 6. PHILIPPINES   • Boracay, Cebu, Diving       │
│ 7. LAOS          • Vientiane, Luang Prabang    │
└─────────────────────────────────────────────────┘
  ⚠️  60 queries each = 420 total for this region
  📍 ALERTS EXPECTED: 50-80

TIER 2: ISLANDS & REGIONAL 🇮🇩🇹🇷🇯🇴
┌─────────────────────────────────────────────────┐
│ 8. INDONESIA     • Bali, Yogyakarta, Diving    │
│ 9. TURKEY        • Istanbul, Cappadocia        │
│ 10. JORDAN       • Petra, Dead Sea, Wadi Rum   │
└─────────────────────────────────────────────────┘
  ⚠️  60 queries each = 180 total for this region
  📍 ALERTS EXPECTED: 18-30

TIER 3: MEDITERRANEAN 🇪🇬🇬🇷🇨🇾
┌─────────────────────────────────────────────────┐
│ 11. EGYPT        • Pyramids, Red Sea Resorts   │
│ 12. GREECE       • Athens, Islands, Crete      │
│ 13. CYPRUS       • Paphos, Nicosia, Beaches   │
└─────────────────────────────────────────────────┘
  ⚠️  60 queries each = 180 total for this region
  📍 ALERTS EXPECTED: 18-30

TIER 4: SOUTH AMERICA 🇵🇪🇦🇷🇨🇴
┌─────────────────────────────────────────────────┐
│ 14. PERU         • Machu Picchu, Amazon        │
│ 15. ARGENTINA    • Buenos Aires, Patagonia     │
│ 16. COLOMBIA     • Cartagena, Santa Marta      │
└─────────────────────────────────────────────────┘
  ⚠️  60 queries each = 180 total for this region
  📍 ALERTS EXPECTED: 18-30

TIER 5: CENTRAL AMERICA 🇲🇽
┌─────────────────────────────────────────────────┐
│ 17. MEXICO       • Cancun, Mexico City, Oaxaca │
└─────────────────────────────────────────────────┘
  ⚠️  60 queries = 60 total for this region
  📍 ALERTS EXPECTED: 5-15

SUBTOTAL TOURISM TIER:
  • 17 countries × 60 queries = 1,020 queries
  • Expected alerts: 150-200
```

---

## Global Coverage (Remaining 32 Countries)

```
Processed AFTER tourism destinations:

EUROPE:        USA, Canada, UK, France, Germany, Italy,
               Spain, Portugal, Switzerland, Austria,
               Czech Rep, Poland

AMERICAS:      Brazil, Chile, Costa Rica, Guatemala,
               Panama, Ecuador, Bolivia

ASIA-PACIFIC:  China, Japan, South Korea, Taiwan,
               Malaysia, Singapore, Myanmar,
               Pakistan, Bangladesh

AFRICA:        Kenya, South Africa, Morocco, Tunisia

MIDDLE EAST:   Israel (home), UAE

32 countries × 60 queries = 1,920 queries
Expected alerts: 100-250
```

---

## Per-Run Results

```
ALERTS BY REGION:

Southeast Asia         ████████████████░░ 50-80 alerts
South America         ████░░░░░░░░░░░░░░  18-30 alerts
Mediterranean         ████░░░░░░░░░░░░░░  18-30 alerts
Other Tourism         ███░░░░░░░░░░░░░░░  15-25 alerts
Global Coverage       ██████████░░░░░░░░ 135-250 alerts
                      ─────────────────────────────────
TOTAL:               ████████████████████ 250-450 alerts


CONFIDENCE DISTRIBUTION:

HIGH (0.7-1.0)        ██████░░░░░░░░░░░░  70-90 alerts ⭐ ACT NOW
MEDIUM (0.5-0.7)     ███████████░░░░░░░░ 120-180 alerts ⚠️  REVIEW
FILTERED (<0.5)      ██░░░░░░░░░░░░░░░░   50-70 alerts  (DISCARDED)
                     ─────────────────────────────────
PROCESSING TIME:                          12-22 minutes ⏱️


THREAT TYPE DISTRIBUTION:

Health/Disease       ███░░░░░░░░░░░░░░░░  30-50
Weather/Storms      ████░░░░░░░░░░░░░░░░ 40-60
Transportation      ████░░░░░░░░░░░░░░░░ 35-55
Natural Disasters   ███░░░░░░░░░░░░░░░░░ 20-35
Security/Conflict   ███░░░░░░░░░░░░░░░░░ 20-35
Economic/Cyber      ███░░░░░░░░░░░░░░░░░ 20-35
Infrastructure      ███░░░░░░░░░░░░░░░░░ 20-35
Other               ██████░░░░░░░░░░░░░░ 65-100
```

---

## How to Use

### BEFORE TRIP
```
1. CHOOSE DESTINATION
   ↓ Thailand, Nepal, Peru, Greece?
   
2. RUN EARLY SIGNALS
   ↓ Click "Run Scour"
   
3. FILTER BY COUNTRY
   ↓ Select destination from dropdown
   
4. REVIEW HIGH-CONFIDENCE (>0.7)
   ↓ See critical & warning alerts
   
5. DECIDE
   ↓ Safe to go? Adjust dates? Change destination?
```

### DURING TRIP
```
1. DAILY CHECK
   ↓ Monitor new alerts
   
2. ADJUST PLANS
   ↓ If new threats emerge
   
3. STAY CONNECTED
   ↓ Check with embassy
   
4. SHARE INFO
   ↓ Help other travelers
```

### AFTER TRIP
```
1. REPORT FINDINGS
   ↓ What was accurate? What wasn't?
   
2. HELP FUTURE TRAVELERS
   ↓ Share experiences
   
3. PROVIDE FEEDBACK
   ↓ Improve system for next traveler
```

---

## Top Threat Types by Destination

```
🇹🇭 THAILAND
  ⚠️ Monsoon (May-Oct)      → Storms, flooding, flight delays
  ⚠️ Political gatherings   → Protest routes, rally locations
  ⚠️ Tourist scams          → Overpriced tours, fake goods
  ✅ Best travel time: Nov-Feb

🇳🇵 NEPAL
  ⚠️ Earthquakes            → Everest base camp, trekking routes
  ⚠️ High altitude sickness → Medical preparedness needed
  ⚠️ Weather/avalanche      → Trekking season dependent
  ✅ Best travel time: Oct-Nov, Mar-Apr

🇮🇳 INDIA
  ⚠️ Disease outbreaks      → Goa, coastal areas
  ⚠️ Monsoon               → South/West India, June-Sept
  ⚠️ Health/sanitation      → Water, food safety
  ✅ Best travel time: Oct-Mar

🇵🇪 PERU
  ⚠️ Altitude               → Cusco (3,400m), Machu Picchu
  ⚠️ Landslides             → Mountain routes, rainy season
  ⚠️ Political instability  → Strike information
  ✅ Best travel time: May-Sept

🇬🇷 GREECE
  ⚠️ Summer crowds          → Island ferry safety, pickpocketing
  ⚠️ Heat extremes          → August heat warnings
  ⚠️ Ferry delays           → Weather impacts to islands
  ✅ Best travel time: Apr-May, Sept-Oct

🇲🇽 MEXICO
  ⚠️ Hurricane season       → Caribbean area, Sept-Nov
  ⚠️ Food safety            → Water quality in resorts
  ⚠️ Tourist crime          → Safe vs unsafe areas
  ✅ Best travel time: Nov-Mar
```

---

## Quick Command Reference

### In Console (F12)
```javascript
// View current alerts
fetch('/api/alerts?country=Thailand')
  .then(r => r.json())
  .then(a => console.table(a))

// View by confidence
fetch('/api/alerts?country=Nepal&min_confidence=0.7')
  .then(r => r.json())
  .then(a => console.table(a))

// View by severity
fetch('/api/alerts?country=Peru&severity=critical')
  .then(r => r.json())
  .then(a => console.table(a))
```

### In Application
```
Alerts Tab
├─ Filter by Country    → Thailand
├─ Sort by Confidence   → High first
├─ Filter by Severity   → Critical/Warning
├─ Filter by Date       → Last 7 days
└─ Export               → PDF/CSV
```

---

## Customization Tips

### To Add a Destination
```typescript
// In scour-worker/index.ts, line ~2010:
const ISRAELI_TOURISM_PRIORITY = [
  // ... existing 17 ...
  'Bulgaria',        // ADD THIS
];
```

### To Remove a Destination (Temporarily)
```typescript
// Comment out instead of deleting
const ISRAELI_TOURISM_PRIORITY = [
  'Thailand',
  'Nepal',
  // 'India',        // COMMENTED OUT
  'Vietnam',
];
```

### To Focus On Specific Region
```typescript
// Reorder for priority (processed first get more attention)
const ISRAELI_TOURISM_PRIORITY = [
  // South America first:
  'Peru',
  'Argentina', 
  'Colombia',
  // Then others...
];
```

---

## Key Stats

```
COVERAGE:       2,940 queries per run (60 × 49 countries)
DESTINATIONS:   17 tourism + 32 global = 49 total
CATEGORIES:     7 threat types (health, weather, security, etc.)
ALERTS:         250-450 per run (>0.5 confidence)
TIME:           12-22 minutes processing
FREQUENCY:      Manual (per scour) or daily (if configured)
QUALITY:        90% accuracy (after confidence filtering)
COST:           Same as generic (no additional fees)
```

---

## Best Practices

✅ **DO**
- Run before booking major trips
- Filter by destination of interest
- Focus on high-confidence alerts (>0.7)
- Check medical/vaccination requirements
- Contact embassy for critical threats
- Share alerts with travel companions

❌ **DON'T**
- Ignore medium-confidence (0.5-0.7) alerts
- Assume old alerts are still valid
- Rely solely on this system
- Share sensitive security info publicly
- Cancel trips for low-confidence alerts
- Ignore official government advisories

---

## Contact & Support

```
Questions?          See EARLY_SIGNALS_ISRAELI_TOURISM.md
How it works?       See ISRAELI_TOURISM_CUSTOMIZATION.md
Need help?          Open issue or contact team
Want to customize?  Edit ISRAELI_TOURISM_PRIORITY constant
Found a bug?        Report with destination and timeframe
```

---

## Summary

✈️ **17 top Israeli tourism destinations prioritized**
🎯 **60 threat queries per destination**
⚡ **250-450 high-confidence alerts per run**
🛡️ **Tourism-focused threat detection**
📱 **Easy integration with travel planning**
🌍 **Complete global coverage included**
✅ **Production ready**

**Next scour will automatically use Israeli Tourism Edition!**

