# Early Signals - Israeli Tourism Edition

**Status:** ✅ Customized for Israeli Travelers  
**Date:** February 15, 2026  
**Focus:** Top destinations for Israeli tourists and backpackers

---

## Overview

The Early Signals system has been customized to prioritize the **top 17 destinations for Israeli tourism and backpacking**, ensuring that travelers get early threat alerts for the most popular routes and destinations.

---

## 🗺️ Top 17 Israeli Tourism Destinations (Processed First)

### Southeast Asia (Most Popular for Israeli Backpackers)
1. **🇹🇭 Thailand** - Bangkok, Chiang Mai, islands, beaches
2. **🇳🇵 Nepal** - Kathmandu, Pokhara, Everest trekking routes
3. **🇮🇳 India** - Delhi, Agra, Goa, Kerala, Himalayas
4. **🇻🇳 Vietnam** - Hanoi, Ho Chi Minh City, Halong Bay
5. **🇰🇭 Cambodia** - Siem Reap, Phnom Penh, Angkor Wat
6. **🇵🇭 Philippines** - Manila, Boracay, Cebu diving
7. **🇱🇦 Laos** - Vientiane, Luang Prabang

### Bali & Indonesian Region
8. **🇮🇩 Indonesia** - Bali, Jakarta, Yogyakarta, Lombok

### Middle East & Mediterranean
9. **🇹🇷 Turkey** - Istanbul, Cappadocia, Pamukkale, Mediterranean coast
10. **🇯🇴 Jordan** - Amman, Petra, Dead Sea, Wadi Rum
11. **🇪🇬 Egypt** - Cairo, Giza, Red Sea resorts, Sinai

### Mediterranean Europe
12. **🇬🇷 Greece** - Athens, Islands (Crete, Santorini, Rhodes, Mykonos)
13. **🇨🇾 Cyprus** - Paphos, Nicosia, Larnaca, Troodos Mountains

### South America
14. **🇵🇪 Peru** - Lima, Cusco, Machu Picchu, Sacred Valley
15. **🇦🇷 Argentina** - Buenos Aires, Patagonia, Mendoza
16. **🇨🇴 Colombia** - Bogotá, Cartagena, Santa Marta, Amazon

### Central America & Mexico
17. **🇲🇽 Mexico** - Cancun, Mexico City, Oaxaca, Yucatan

---

## Why These Destinations?

Based on Israeli tourism patterns:
- **Thailand:** #1 destination for Israeli backpackers (post-army gap year tradition)
- **Nepal:** Major trekking destination (Everest base camp, Annapurna)
- **India:** Spiritual tourism, spiritual retreats, Goan beaches
- **Southeast Asia Cluster:** Budget-friendly, connected backpacker trail
- **South America:** Growing destination for adventure tourism
- **Mediterranean:** Close to home, beach/cultural tourism
- **Middle East Neighbors:** Regional accessibility (Jordan, Egypt)

---

## How It Works

### Processing Order
```
1. Israeli Tourism Destinations (17 countries)
   ↓ Processed first at high priority
   ↓ 60 queries × 17 countries = 1,020 queries
   
2. Global Coverage Countries (32 countries)
   ↓ Processed after tourism destinations
   ↓ 60 queries × 32 countries = 1,920 queries
   
Total: 2,940 queries (49 unique countries)
```

### Query Categories (Still All 7)
The same 7 threat categories apply to all destinations:
1. **Natural Disasters** - Earthquakes, floods, wildfires in tourist areas
2. **Security & Conflict** - Terror threats, civil unrest, protests
3. **Health & Pandemic** - Disease outbreaks, health emergencies
4. **Transportation Disruption** - Airport closures, flight delays, accidents
5. **Infrastructure & Utilities** - Power outages, water shortages affecting travelers
6. **Economic & Cyber** - Scams, card fraud targeting tourists
7. **Weather & Environmental** - Typhoons, monsoons, air quality in travel season

---

## Expected Results

### Per Early Signals Run

**Israeli Tourism Focus:**
- Alerts for Thailand: 8-15 (most active)
- Alerts for Nepal: 5-10 (trekking season)
- Alerts for India: 6-12 (disease, health)
- Alerts for other tourism destinations: 3-8 each

**Total Output:**
- Queries Attempted: 2,940 (60 queries × 49 countries)
- High-Confidence Alerts: 250-450 (>0.5 confidence)
- Filtered Alerts: 50-70 (<0.5 confidence)
- Processing Time: 12-22 minutes
- Focus: 100% relevant to Israeli travelers

---

## How to Use

### Standard Operation
1. **Start Scour** - Click "Run Scour" in Source Manager
2. **Monitor** - Status shows "⚡ Early Signals: X/2,940"
3. **Review** - Alerts appear in Alerts tab with confidence scores
4. **Filter** - Use "Country" filter to focus on your destinations
5. **Act** - Approve relevant alerts before publishing

### Filter by Tourism Destination
In the Alerts tab:
```
Country: Thailand        → All Thailand travel alerts
Country: Nepal           → All Nepal trekking area alerts
Country: India           → Health & transportation alerts for India
Country: Peru            → Machu Picchu & Amazon region alerts
```

### For Specific Trip Planning
```
Destination: "Thailand"
Dates: Aug 15-Sep 15
1. Filter alerts by country (Thailand)
2. Filter by event_type (storms, protests, etc.)
3. Check confidence scores (>0.7 = high priority)
4. Review severity (critical/warning first)
```

---

## Example Alerts You'll Receive

### Thailand Example
```
Title: Typhoon season alert - Bangkok to Phuket
Country: Thailand
Severity: warning
Confidence: 0.87
Category: Weather & Environmental
Content: Monsoon season affects island transportation...
Recommendation: Check flight status, travel inland during peaks
```

### Nepal Example
```
Title: Earthquake risk - Everest base camp area
Country: Nepal
Severity: caution
Confidence: 0.72
Category: Natural Disaster
Content: Seismic activity in Himalayan trekking routes...
Recommendation: Monitor weather, inform trek guides
```

### India Example
```
Title: Disease outbreak - Goa beach resorts area
Country: India
Severity: warning
Confidence: 0.79
Category: Health & Pandemic
Content: Cholera outbreak reported in coastal areas...
Recommendation: Ensure vaccinations, avoid street food
```

---

## Tourism-Specific Threat Patterns

### By Destination Type

**Beach Destinations** (Thailand, Philippines, Indonesia)
- Watch for: Typhoons, monsoons, water safety, coral reef damage
- Season: November-March safest

**Trekking Routes** (Nepal, Peru, mountains)
- Watch for: Earthquake, landslides, altitude sickness info
- Season: October-November, March-April best

**Cultural Tourism** (Egypt, Jordan, Peru)
- Watch for: Civil unrest, security incidents, site closures
- Monitor: Political demonstrations

**Beach Resorts** (Goa, Egypt Red Sea)
- Watch for: Health outbreaks, water contamination, typhoons
- Check: Vaccination requirements

**Budget Backpacker Trail** (Thailand→Vietnam→Cambodia)
- Watch for: Scams, theft rings, transportation delays
- Risk: Economic/cyber threats

---

## Customization Options

### To Add More Tourism Destinations
```typescript
// In scour-worker/index.ts, update ISRAELI_TOURISM_PRIORITY:

const ISRAELI_TOURISM_PRIORITY = [
  'Thailand',
  'Nepal',
  'India',
  'Vietnam',
  // ... existing
  'Bulgaria',      // NEW: Cheap beach destination
  'Romania',       // NEW: Budget hiking
  'Albania',       // NEW: Mediterranean emerging
];
```

### To Remove Non-Essential Countries
```typescript
// Comment out or remove from GLOBAL_COVERAGE_COUNTRIES:

const GLOBAL_COVERAGE_COUNTRIES = [
  'Israel',
  // 'North Korea',  // REMOVED: Not relevant for tourists
  // 'Myanmar',      // REMOVED: Already in tourism tier
  // ... keep essential ones
];
```

### To Adjust Threat Queries for Tourism
```typescript
// Already included in EARLY_SIGNAL_CATEGORIES, but you could add:

{
  name: 'Tourist Safety Issues',  // NEW CATEGORY
  severity: 'warning',
  queries: [
    'tourist scam alert',
    'bag theft gang',
    'overpriced taxi warning',
    'tourist assault',
    'fake tour guide',
  ],
}
```

---

## Key Benefits for Israeli Travelers

✅ **Prioritized Coverage** - Top 17 destinations get processed first  
✅ **Relevant Threats** - Focused on tourism-specific risks  
✅ **Early Warning** - Get alerts before they become critical  
✅ **Destination Filters** - Easily filter by where you're going  
✅ **Trip Planning** - Verify safety before booking  
✅ **Gap Year Safe** - Perfect for post-army backpackers  
✅ **Family Travel** - Know destination safety status  
✅ **Cultural Events** - Track protests/festivals affecting travel  

---

## Monitoring Dashboard

### Status Bar During Scour
```
Phase: EARLY SIGNALS ⚡
Mode: ISRAELI TOURISM EDITION
Progress: ████████░░░░░░░░░░  42% (1,236/2,940)

Processing:
├─ Tourism Destinations   [▓▓▓▓▓▓▓░░]  70% (714/1,020)
│  └─ Next: Jordan, Egypt
└─ Global Coverage        [▓░░░░░░░░]  5% (97/1,920)
   └─ Next: Europe, Americas

Results So Far:
├─ Alerts Created: 156
├─ Alerts Filtered: 18 (confidence < 0.5)
├─ By Region:
│  ├─ Southeast Asia: 89 (Thailand 34, Nepal 22, India 18, Vietnam 15)
│  ├─ South America: 34 (Peru 15, Argentina 12, Colombia 7)
│  ├─ Mediterranean: 22 (Greece 10, Turkey 8, Cyprus 4)
│  └─ Other: 11
```

---

## Integration with Trip Planning

### Pre-Trip Workflow
1. **Plan Dates** - "Thailand Aug 15-Sep 15"
2. **Run Early Signals** - Get latest alerts
3. **Filter Results** - Thailand alerts only
4. **Review Severity** - Focus on critical/warning
5. **Contact Authorities** - If needed
6. **Book with Confidence** - Informed decision

### During Trip
1. **Check Daily** - Run daily scour on trip
2. **Monitor Country Alerts** - Receive daily updates
3. **Act on Warnings** - Adjust itinerary if needed
4. **Stay Connected** - Follow embassy updates

### Post-Trip
1. **Share Findings** - Help other travelers
2. **Report Observations** - Submit corrections
3. **Plan Next Trip** - Use data for next destination

---

## Comparison: Before vs. After Customization

### Before (Generic High-Risk Focus)
```
Countries: Syria, Yemen, Iraq, Afghanistan, Ukraine, Russia, etc.
Relevance for Israeli tourists: LOW
Alerts: Generic conflict/security focused
Value: Not specific to tourism
```

### After (Israeli Tourism Focus)
```
Countries: Thailand, Nepal, India, Vietnam, Cambodia, etc.
Relevance for Israeli tourists: HIGH
Alerts: Health, weather, transportation in tourism hotspots
Value: Directly applicable to travel planning
```

---

## Future Enhancements

### Phase 1 (Current)
- ✅ Prioritize top 17 tourism destinations
- ✅ Full 60-query threat coverage
- ✅ Confidence filtering for quality

### Phase 2 (Planned)
- 🔧 Holiday/Festival tracking
- 🔧 Peak season alerts
- 🔧 Visa requirement changes

### Phase 3 (Planned)
- 🔧 Backpacker-specific threats
- 🔧 Budget accommodation warnings
- 🔧 Transport reliability alerts

### Phase 4 (Planned)
- 🔧 Israeli embassy alerts
- 🔧 Community reports
- 🔧 Direct traveler notifications

---

## Quick Reference

### Top 5 Most Important Destinations
1. **🇹🇭 Thailand** - Monitor: Monsoons, political stability
2. **🇳🇵 Nepal** - Monitor: Earthquakes, trekking accidents
3. **🇮🇳 India** - Monitor: Health/disease, transportation strikes
4. **🇵🇪 Peru** - Monitor: Altitude sickness alerts, security
5. **🇬🇷 Greece** - Monitor: Weather, ferry safety

### Query Coverage per Destination
- Each destination gets 60 different threat queries
- Covers 7 categories (disasters, security, health, transport, infra, cyber, weather)
- 50+ specific threat patterns per destination

### Expected Alert Quality
- **High Confidence (0.7-1.0):** 60-80 alerts/run - Act immediately
- **Medium Confidence (0.5-0.7):** 100-150 alerts/run - Review carefully
- **Filtered Low (0.0-0.5):** 50-70 alerts/run - Discarded as noise

---

## FAQ

**Q: Why prioritize Israeli destinations?**
A: These are where Israeli travelers actually go, making alerts most relevant.

**Q: Can I customize the destination list?**
A: Yes! Edit `ISRAELI_TOURISM_PRIORITY` in scour-worker/index.ts

**Q: How often should I check?**
A: Before trip planning (weekly), during travel (daily), or continuously.

**Q: What if something's not covered?**
A: Add custom queries to EARLY_SIGNAL_CATEGORIES for specific concerns.

**Q: How do I share findings with other travelers?**
A: Future phases will include community reporting features.

**Q: Can embassy get these alerts?**
A: Setup available via webhooks (Phase 3).

---

## Getting Started

1. **Next Scour Run** - Will automatically use Israeli Tourism Edition
2. **Check Status** - Bar shows "⚡ Israeli Tourism Edition"
3. **Filter Alerts** - Use Country dropdown to find your destination
4. **Plan Safely** - Make informed travel decisions

---

**Version:** 1.0 Israeli Tourism Edition  
**Created:** February 15, 2026  
**Ready:** For immediate use

