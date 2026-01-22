# Confidence Scoring Quick Reference for Analysts

## What is Confidence Scoring?

A **Factal-inspired confidence score** (0-100%) that measures how reliable an alert is for publishing. All draft alerts now display their confidence level.

**Key Point**: Confidence is **advisory only**. You always decide whether to publish, edit, or dismiss.

---

## Reading Confidence Badges

### Visual Guide

```
❌ 0-40% RED/GRAY       [Noise]         → Usually dismiss; very uncertain
🔶 40-60% AMBER         [Early Signal]  → Monitor for 24-48h; needs more data
👁️ 60-70% BLUE          [Review]        → Review carefully before publishing
✓ 70-85% LIGHT GREEN    [Publish]       → Good to publish with approval
✅ 85-100% BRIGHT GREEN [Verified]      → Highest confidence; safe to publish
```

### Example Alert Card

```
┌──────────────────────────────────────────────────────────────┐
│ 🔴 USGS Earthquake Alert - Magnitude 5.8 Detected            │
│ Location: 📍 Kern County, California                         │
│ ✅ 94% Verified | Severity: ⚠️  WARNING                      │
├──────────────────────────────────────────────────────────────┤
│ A magnitude 5.8 earthquake struck Kern County at 14:32 UTC   │
│ Depth: 8 km. USGS reports strong ground shaking in the...    │
├──────────────────────────────────────────────────────────────┤
│ [Approve] [Edit] [Dismiss] [View Details]                    │
└──────────────────────────────────────────────────────────────┘
```

---

## Decision Framework

### By Confidence Level:

#### 85-100% ✅ VERIFIED
- **Action**: Approve for immediate publishing
- **Why**: Official source (USGS, NWS, FAA, NOAA) with complete data
- **Examples**:
  - USGS earthquake alert with coordinates
  - NWS severe weather warning with polygon
  - FAA airspace restriction with effective date
- **Risk**: Very low; official data

#### 70-85% ✓ PUBLISH
- **Action**: Review for accuracy, then approve
- **Why**: Good data quality, known source
- **Review**: Check summary is accurate; verify locations match
- **Examples**:
  - Reuters article about evacuation with details
  - AI-extracted alert with high confidence and coordinates
  - RSS feed from official government agency
- **Risk**: Low; unlikely to be false positive

#### 60-70% 👁️ REVIEW
- **Action**: Analyst review required; may edit before publishing
- **Why**: Moderate data quality; some fields may be incomplete
- **Review**: 
  - Verify location accuracy
  - Check event timing is correct
  - Ensure severity is appropriate
  - Confirm summary is accurate
- **Examples**:
  - AI alert missing precise coordinates (has region only)
  - Generic news alert about unrest
  - Feed item with minimal location details
- **Risk**: Medium; verify before publishing

#### 40-60% 🔶 EARLY SIGNAL
- **Action**: Monitor for 24-48 hours; don't publish yet
- **Why**: Preliminary data; needs confirmation
- **Next**: Wait for more sources or official updates
- **Examples**:
  - Early Twitter reports of event
  - Fragmentary information from blog post
  - Unconfirmed social media alert
- **Risk**: High; likely premature; wait for confirmation

#### <40% ❌ NOISE
- **Action**: Dismiss (usually safe)
- **Why**: Very unreliable; likely false positive
- **Examples**:
  - Vague alert with unknown location
  - Historical event mistaken for current
  - Spam or low-quality content
- **Risk**: Very high; don't publish

---

## Why Alerts Get Different Scores

### USGS Earthquake (usually 90-95%)
✅ Official source (0.95 base)  
✅ Precise latitude/longitude (+0.10)  
✅ Event timing included (+0.05)  
✅ Critical/warning severity (+0.08)  
= **~0.90-0.95** → ✅ Verified

### News Article via Brave Search (usually 55-70%)
✅ Generic RSS source (0.55 base)  
✅ Rough location (city, region) (+0.05)  
✅ Summary provided (no penalty)  
= **~0.60-0.65** → 👁️ Review

### Vague Social Media Post (usually <40%)
❌ Unknown source (0.50 base)  
❌ "Unknown location" (-0.20 penalty)  
❌ "?" or "somewhere in France"  
❌ Very short summary (-0.15 penalty)  
= **~0.15** → ❌ Noise (dismiss)

### NOAA Tropical Storm (usually 85-90%)
✅ Official source NOAA (0.90 base)  
✅ Precise coordinates of storm center (+0.10)  
✅ Event timing from advisory (+0.05)  
= **~0.85-0.90** → ✓ Publish

---

## Best Practices

### Do's ✅
- ✅ Trust official sources (USGS, NWS, FAA, NOAA) - they have high confidence
- ✅ Higher confidence = faster approve decision
- ✅ Lower confidence = take time to review/verify
- ✅ If in doubt, monitor 24h before publishing
- ✅ Edit alerts to add missing details → improves future confidence

### Don'ts ❌
- ❌ Auto-dismiss all low-confidence alerts (sometimes they're real!)
- ❌ Auto-publish all high-confidence alerts without reading
- ❌ Rely solely on confidence score; use your judgment
- ❌ Publish unverified alerts just because they're high confidence
- ❌ Dismiss official sources because of a typo (edit instead)

---

## Confidence Won't Improve:

These don't affect confidence score:

- ❌ Analyst reviews (manual decisions don't retroactively change score)
- ❌ WordPress publishing (confidence is set at creation)
- ❌ Time passage (staleness penalty is already applied)
- ❌ Manual editing alert (confidence is calculated once)

**Note**: In Phase 3+, we'll track analyst overrides to improve future confidence calculations.

---

## Troubleshooting

### Alert shows 0% confidence - why?
- **Cause**: Very incomplete alert (missing title, country, or location)
- **Fix**: Edit the alert to add missing fields
- **Result**: Confidence will increase when alert is updated

### Official source shows low confidence (e.g., 40%)?
- **Cause**: Missing coordinates or event timing
- **Fix**: Edit to add precise location and dates
- **Result**: Score should jump to 70%+

### Should I publish an 85% alert or wait?
- **Answer**: Approve! 85% is "publish confidence"
- **Note**: You still make the decision; confidence is just data

---

## Questions?

For detailed technical information, see:
- **PHASE_1_5_IMPLEMENTATION.md** - Full implementation details
- **PHASE_1_5_DEPLOYMENT_SUMMARY.md** - Deployment checklist

For analyst workflow training, see the review queue dashboard.

---

**Remember**: Confidence is a **guide**, not a rule. Trust your expertise.
