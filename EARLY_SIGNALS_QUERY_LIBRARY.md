# Early Signals - Complete Query Library

## 60 Base Queries Organized by Category

### 1. 🌍 Natural Disasters (Severity: CRITICAL)

| # | Query Pattern | Full Query |
|----|---|---|
| 1 | Earthquake | earthquake travel alert |
| 2 | Tsunami | tsunami warning travel alert |
| 3 | Volcanic eruption | volcanic eruption travel alert |
| 4 | Flooding | severe flooding travel alert |
| 5 | Wildfire | wildfire emergency travel alert |
| 6 | Hurricane | hurricane warning travel alert |
| 7 | Tornado | tornado warning travel alert |
| 8 | Landslide | landslide alert travel alert |
| 9 | Avalanche | avalanche warning travel alert |
| 10 | Drought | severe drought travel alert |

---

### 2. ⚔️ Security & Conflict (Severity: CRITICAL)

| # | Query Pattern | Full Query |
|----|---|---|
| 11 | Armed conflict | armed conflict travel alert |
| 12 | Terrorism | terrorist attack travel alert |
| 13 | Active shooter | active shooter travel alert |
| 14 | Bombing | bombing incident travel alert |
| 15 | Civil unrest | civil unrest travel alert |
| 16 | Rioting | riot warning travel alert |
| 17 | Gunfire | gunfire incident travel alert |
| 18 | Border violence | border skirmish travel alert |
| 19 | Military ops | military operation travel alert |
| 20 | Security breach | security breach travel alert |

---

### 3. 🦠 Health & Pandemic (Severity: WARNING)

| # | Query Pattern | Full Query |
|----|---|---|
| 21 | Disease outbreak | disease outbreak travel alert |
| 22 | Epidemic | epidemic alert travel alert |
| 23 | Pandemic | pandemic warning travel alert |
| 24 | Health emergency | health emergency travel alert |
| 25 | Biological threat | biological threat travel alert |
| 26 | Food poisoning | food poisoning outbreak travel alert |
| 27 | Cholera | cholera outbreak travel alert |
| 28 | Measles | measles outbreak travel alert |
| 29 | Anthrax | anthrax alert travel alert |
| 30 | Vaccine shortage | vaccine shortage travel alert |

---

### 4. ✈️ Transportation Disruption (Severity: WARNING)

| # | Query Pattern | Full Query |
|----|---|---|
| 31 | Airport closure | airport closure travel alert |
| 32 | Flight cancellations | flight cancellations travel alert |
| 33 | Port closure | port closure travel alert |
| 34 | Railway disruption | railway disruption travel alert |
| 35 | Highway closure | highway closure travel alert |
| 36 | Bridge collapse | bridge collapse travel alert |
| 37 | Tunnel disaster | tunnel disaster travel alert |
| 38 | Train derailment | train derailment travel alert |
| 39 | Cruise emergency | cruise ship emergency travel alert |
| 40 | Aviation incident | aviation incident travel alert |

---

### 5. 🏢 Infrastructure & Utilities (Severity: WARNING)

| # | Query Pattern | Full Query |
|----|---|---|
| 41 | Power outage | power outage travel alert |
| 42 | Water shortage | water shortage travel alert |
| 43 | Gas leak | gas leak travel alert |
| 44 | Pipeline rupture | pipeline rupture travel alert |
| 45 | Dam failure | dam failure travel alert |
| 46 | Bridge failure | bridge failure travel alert |
| 47 | Building collapse | building collapse travel alert |
| 48 | Electrical failure | electrical failure travel alert |
| 49 | Water contamination | water contamination travel alert |
| 50 | Sewage emergency | sewage emergency travel alert |

---

### 6. 💻 Economic & Cyber (Severity: CAUTION)

| # | Query Pattern | Full Query |
|----|---|---|
| 51 | Cyber attack | cyber attack travel alert |
| 52 | Data breach | data breach travel alert |
| 53 | Ransomware | ransomware attack travel alert |
| 54 | Bank failure | bank failure travel alert |
| 55 | Market crash | stock market crash travel alert |
| 56 | Currency crisis | currency crisis travel alert |
| 57 | Economic protest | protest economic travel alert |
| 58 | Supply chain | supply chain disruption travel alert |
| 59 | Port strike | port strike travel alert |
| 60 | Hacking | hacking incident travel alert |

---

### 7. 🌦️ Weather & Environmental (Severity: CAUTION)

| # | Query Pattern | Full Query |
|----|---|---|
| 61 | Severe weather | severe weather alert travel alert |
| 62 | Heavy snow | heavy snow storm travel alert |
| 63 | Extreme heat | extreme heat warning travel alert |
| 64 | Extreme cold | extreme cold alert travel alert |
| 65 | Acid rain | acid rain travel alert |
| 66 | Air quality | air quality alert travel alert |
| 67 | Pollution | pollution emergency travel alert |
| 68 | Smog | smog alert travel alert |
| 69 | Hail | hail storm travel alert |
| 70 | Lightning | lightning strike travel alert |

---

## Geographic Coverage (35 Countries)

### 🔴 High-Risk Tier (Processed First)

**Region: Middle East & South Asia (5)**
1. Syria
2. Yemen
3. Iraq
4. Afghanistan
5. [Regional coverage]

**Region: Eastern Europe & Central Asia (5)**
6. Ukraine
7. Russia
8. North Korea
9. Myanmar
10. [Additional conflicts]

**Region: Americas & Africa (5)**
11. Venezuela
12. Somalia
13. South Sudan
14. Democratic Republic of Congo
15. Central African Republic
16. Haiti

### 🟢 Global Standard Tier (Processed After)

**Developed Nations (12)**
1. United States
2. United Kingdom
3. France
4. Germany
5. Japan
6. Canada
7. Italy
8. Spain
9. South Korea
10. Australia
11. [Additional developed]
12. [Additional developed]

**Emerging Markets (8)**
1. India
2. China
3. Brazil
4. Mexico
5. Indonesia
6. Pakistan
7. Nigeria
8. South Africa
9. Egypt
10. [Additional global]

---

## Query Execution Formula

```
Total Queries = Base Queries × Countries × Iterations

Standard Expansion:
= 60 queries × 35 countries × 1 iteration
= 2,100 total query attempts

With Batching:
- Batch Size: 6 concurrent
- Batches: 10 (for 60 queries)
- Execution Time: ~10-20 minutes
- Rate Limited By: Brave API (10 req/sec typical)
```

---

## Query Pattern Structure

### Base Pattern
```
[THREAT_TYPE] travel alert
```

### In Context
Each query is combined with a country:
```
"earthquake travel alert" + "United States"
= "earthquake travel alert United States"

Sent to Brave Search API:
GET /api.search.brave.com/res/v1/web/search
  ?q=earthquake%20travel%20alert%20United%20States
  &count=10
  &result_filter=news
```

### API Response Processing
1. Brave returns 10 news results
2. Claude AI analyzes each result
3. Extracts: title, summary, location, country, severity
4. Calculates: confidence_score (0.0-1.0)
5. Filters: Only saves if confidence > 0.5
6. Stores: Creates alert in database

---

## Threat Mapping to Severity

### 🔴 CRITICAL (Natural Disasters + Security)
- Earthquake, tsunami, armed conflict, terrorism, active shooter
- Bomb incidents, civil unrest, military operations
- **Action:** Immediate escalation, high visibility

### 🟠 WARNING (Health + Transportation + Infrastructure)
- Disease outbreak, epidemic, airport closure, flight disruptions
- Power outage, dam failure, bridge collapse
- **Action:** Standard alert workflow, monitoring

### 🟡 CAUTION (Economic + Weather)
- Cyber attack, data breach, stock market events
- Severe weather, extreme temperatures, pollution
- **Action:** Informational alert, lower priority

---

## Query Effectiveness by Category

### High-Volume Results Expected
- Natural Disasters: 40-60 alerts/run
- Security & Conflict: 35-50 alerts/run
- Transportation: 30-45 alerts/run

### Medium-Volume Results Expected
- Health & Pandemic: 20-30 alerts/run
- Infrastructure: 15-25 alerts/run

### Lower-Volume Results Expected
- Economic & Cyber: 10-20 alerts/run (highly specific)
- Weather & Environmental: 10-20 alerts/run (localized)

**Total:** 200-400 high-confidence alerts per complete run

---

## Customization Guide

### Adding a New Query
1. Choose category (or create new one)
2. Add query string (concise, 2-3 words)
3. Verify it's not redundant
4. Example:
   ```typescript
   {
     name: 'Natural Disasters',
     queries: [
       // ... existing
       'mudslide alert',  // NEW
     ]
   }
   ```

### Removing a Query
1. Comment out or delete line
2. Keep queries balanced per category
3. Example:
   ```typescript
   // 'severe drought', // REMOVED - too regional
   ```

### Creating New Category
```typescript
{
  name: 'Custom Category Name',
  severity: 'critical', // or 'warning' or 'caution'
  queries: [
    'query 1',
    'query 2',
    'query 3',
    'query 4',
    'query 5',
  ],
}
```

---

## Query Performance Notes

### Queries with Highest Hit Rate
1. "severe weather alert" - Always has results
2. "power outage" - Multiple daily incidents
3. "flight cancellations" - High volume
4. "cyber attack" - Frequent news

### Queries with Lower Hit Rate
1. "avalanche warning" - Seasonal, regional
2. "acid rain" - Rare in news
3. "anthrax alert" - Very specific
4. "ransomware attack" - Specific to cybersecurity

### Rate Limit Considerations
- Brave API: ~10 requests/second
- 2,100 queries × 2 seconds average = ~70 minutes raw
- With parallel batching (6 concurrent): ~12 minutes
- Actual time: 10-20 minutes (depends on API health)

---

## Debugging Query Results

### If getting 0 results for a query:
1. Check internet connectivity
2. Verify Brave API key is active
3. Try query manually in Brave.com
4. Consider removing redundant queries
5. Check for typos in query string

### If getting too many false positives:
1. Increase confidence threshold from 0.5 to 0.6
2. Remove broad queries (too generic)
3. Add location specificity to queries
4. Review Claude prompt for stricter criteria

### If alerts are stale:
1. Verify `daysBack: 1` is set (should limit to 24h)
2. Check Brave API `result_filter=news`
3. Add date filter to queries
4. Verify alert date extraction is working

---

## Summary

- **60 Base Queries** organized by threat category
- **35 Countries** with high-risk prioritization
- **2,100 Total Query Combinations**
- **200-400 Expected High-Confidence Alerts**
- **10-20 Minutes Processing Time**
- **Fully Customizable** for regional needs

Each query targets specific threat types, combined with geographic coverage for comprehensive early signals threat detection across Magnus Intelligence operations.

