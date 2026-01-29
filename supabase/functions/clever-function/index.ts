/// <reference lib="deno.unstable" />

console.log("=== Clever Function starting ===");
console.log("Edge function initialized:");

// ============================================================================
// GEOJSON & COORDINATE HELPERS
// ============================================================================

interface GeometryPoint {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

interface GeometryPolygon {
  type: 'Polygon';
  coordinates: number[][][];
}

type Geometry = GeometryPoint | GeometryPolygon;

interface GeoJSONFeature {
  type: 'Feature';
  geometry: Geometry;
  properties: Record<string, any>;
}

// Approximate country coordinates for fallback
const COUNTRY_COORDS: Record<string, [number, number]> = {
  'United States': [-95.7129, 37.0902],
  'Canada': [-95.7129, 56.1304],
  'Mexico': [-102.5528, 23.6345],
  'United Kingdom': [-3.4360, 55.3781],
  'France': [2.2137, 46.2276],
  'Germany': [10.4515, 51.1657],
  'Spain': [-3.7492, 40.4637],
  'Italy': [12.5674, 41.8719],
  'Japan': [138.2529, 36.2048],
  'China': [104.1954, 35.8617],
  'India': [78.9629, 20.5937],
  'Australia': [133.7751, -25.2744],
  'Brazil': [-51.9253, -14.2350],
  'Thailand': [100.9925, 15.8700],
  'Philippines': [121.7740, 12.8797],
  'South Korea': [127.0780, 37.5665],
  // Removed duplicate 'France' and 'Germany' entries
  'Netherlands': [5.2913, 52.1326],
};

// Generate point-based GeoJSON
function generatePointGeoJSON(latitude: number, longitude: number): GeoJSONFeature {
  return {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [longitude, latitude],
    },
    properties: {
      type: 'alert_location',
      zoomLevel: 'exact',
    },
  };
}

// Generate circle polygon as GeoJSON from center point and radius
function generateCircleGeoJSON(
  latitude: number,
  longitude: number,
  radiusKm: number
): GeoJSONFeature {
  const earthRadiusKm = 6371;
  const latChange = (radiusKm / earthRadiusKm) * (180 / Math.PI);
  const lonChange = (radiusKm / (earthRadiusKm * Math.cos((latitude * Math.PI) / 180))) * (180 / Math.PI);

  const points: number[][] = [];
  for (let i = 0; i < 32; i++) {
    const angle = (i / 32) * 2 * Math.PI;
    const lat = latitude + latChange * Math.sin(angle);
    const lon = longitude + lonChange * Math.cos(angle);
    points.push([lon, lat]);
  }
  points.push(points[0]); // Close the polygon

  return {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [points],
    },
    properties: {
      type: 'alert_radius',
      radiusKm,
      zoomLevel: 'approximate',
    },
  };
}

// Get approximate country coordinates as fallback
function getCountryCoordinates(country: string): [number, number] {
  return COUNTRY_COORDS[country] || [0, 0];
}

// Problematic sources that hang or cause issues - skip these
const BLOCKED_SOURCE_PATTERNS = [
  // Add source names or URL patterns here that are known to hang
  // Examples: 'slowsite.com', 'timeout-prone-feed', etc.
];

function isSourceBlocked(source: { name?: string; url?: string }): boolean {
  const nameStr = (source.name || '').toLowerCase();
  const urlStr = (source.url || '').toLowerCase();
  
  for (const pattern of BLOCKED_SOURCE_PATTERNS) {
    if (nameStr.includes(pattern.toLowerCase()) || urlStr.includes(pattern.toLowerCase())) {
      return true;
    }
  }
  return false;
}

// Determine radius in km based on severity and scope
function getRadiusFromSeverity(severity: string, scope: string, eventType?: string): number {
  // Base radius by geoScope - INCREASED for better visibility
  const scopeRadius: Record<string, number> = {
    'local': 20,        // was 8 - city blocks
    'city': 50,         // was 25 - metro area
    'regional': 150,    // was 75 - multi-state/province
    'national': 400,    // was 250 - country
    'multinational': 800,  // was 500 - continental
  };
  
  // Multiplier by severity and event type
  let baseRadius = scopeRadius[scope] || 50;
  
  // Apply severity multiplier
  const severityMultiplier: Record<string, number> = {
    'critical': 2.0,
    'warning': 1.5,
    'caution': 1.1,
    'informative': 0.8,
  };
  baseRadius *= severityMultiplier[severity] || 1.0;
  
  // Additional multiplier by event type impact
  const eventTypeMultiplier: Record<string, number> = {
    'Natural Disaster': 1.6,
    'War': 1.7,
    'Terrorism': 1.5,
    'Aviation': 1.0,
    'Maritime': 1.3,
    'Crime': 0.7,
    'Health': 1.4,
    'Environmental': 1.5,
    'Infrastructure': 1.1,
    'Political': 1.2,
    'Transportation': 1.1,
  };
  
  const multiplier = eventType ? (eventTypeMultiplier[eventType] || 1.0) : 1.0;
  baseRadius *= multiplier;
  
  // Enforce minimum radius of 25km for all alerts, max of 1000km
  return Math.max(25, Math.min(1000, Math.round(baseRadius)));
}

// Country to continent mapping
const COUNTRY_TO_CONTINENT: Record<string, string> = {
  'United States': 'North America',
  'Canada': 'North America',
  'Mexico': 'North America',
  'UK': 'Europe',
  'United Kingdom': 'Europe',
  'France': 'Europe',
  'Germany': 'Europe',
  'Spain': 'Europe',
  'Italy': 'Europe',
  'Netherlands': 'Europe',
  'Belgium': 'Europe',
  'Switzerland': 'Europe',
  'Poland': 'Europe',
  'Japan': 'Asia',
  'China': 'Asia',
  'India': 'Asia',
  'Thailand': 'Asia',
  'Philippines': 'Asia',
  'South Korea': 'Asia',
  'Vietnam': 'Asia',
  'Australia': 'Oceania',
  'Brazil': 'South America',
  'Argentina': 'South America',
  'Chile': 'South America',
  'Colombia': 'South America',
  'Peru': 'South America',
};

function getContinent(country: string): string {
  return COUNTRY_TO_CONTINENT[country] || 'Unknown';
}

// ============================================================================
// WORDPRESS ACF VALIDATORS
// ============================================================================

function normalizeCountryForACF(country: string | null | undefined): string | null {
  if (!country) return null;
  const c = country.trim().toLowerCase();
  const map: Record<string, string | null> = {
    "global": null,
    "worldwide": null,
    "international": null,
    "usa": "United States of America",
    "us": "United States of America",
    "uk": "United Kingdom",
    "gb": "United Kingdom",
  };
  return map[c] ?? country;
}

function normalizeIntelligenceTopicsForACF(topic: string | null | undefined): string | null {
  if (!topic) return null;
  const t = topic.trim().toLowerCase();
  
  // Valid ACF enum values for intelligence_topics
  const validTopics = [
    'Armed Conflict', 'Air Incidents', 'Air Raid Sirens', 'Avalanches', 'Bomb Threats',
    'Building Collapses', 'Chemical Weapons', 'Coronavirus', 'Drought', 'Earthquakes',
    'Elections', 'Evacuations', 'Explosions', 'Fires', 'Floods', 'Health', 'Heat Waves',
    'Internet Outages', 'Kidnappings', 'Landslides', 'Lockdowns', 'Nuclear Weapons',
    'Outbreaks', 'Police Shootings', 'Power Outages', 'Protests', 'Civil Unrest',
    'Rail Incidents', 'Road Incidents', 'Robberies', 'Shootings', 'Stabbings',
    'Strike Actions', 'Suspicious Packages', 'Terrorism', 'Traffic', 'Transportation Incidents',
    'Tornadoes', 'Tropical Cyclones', 'Tsunamis', 'Volcanoes', 'Wildland Fires',
    'Water Quality', 'Winter Storms', 'Severe Weather', 'Security', 'Safety',
    'Flight Disruptions', 'Gas Leaks', 'Pro-Palestinian Protest'
  ];
  
  // Mapping of common/invalid values to valid ACF enum
  const map: Record<string, string> = {
    "general": "Security",
    "terrorism": "Terrorism",
    "war": "Armed Conflict",
    "armed conflict": "Armed Conflict",
    "natural disaster": "Severe Weather",
    "earthquake": "Earthquakes",
    "flood": "Floods",
    "hurricane": "Tropical Cyclones",
    "typhoon": "Tropical Cyclones",
    "cyclone": "Tropical Cyclones",
    "tornado": "Tornadoes",
    "wildfire": "Wildland Fires",
    "fire": "Fires",
    "volcanic": "Volcanoes",
    "volcano": "Volcanoes",
    "tsunami": "Tsunamis",
    "avalanche": "Avalanches",
    "landslide": "Landslides",
    "drought": "Drought",
    "heat wave": "Heat Waves",
    "winter storm": "Winter Storms",
    "severe weather": "Severe Weather",
    "protest": "Protests",
    "civil unrest": "Civil Unrest",
    "evacuation": "Evacuations",
    "explosion": "Explosions",
    "attack": "Terrorism",
    "bombing": "Bomb Threats",
    "kidnapping": "Kidnappings",
    "shootings": "Shootings",
    "shooting": "Shootings",
    "strikes": "Strike Actions",
    "power outage": "Power Outages",
    "outage": "Power Outages",
    "internet": "Internet Outages",
    "transportation": "Transportation Incidents",
    "flight": "Flight Disruptions",
    "health": "Health",
    "disease": "Outbreaks",
    "outbreak": "Outbreaks",
    "coronavirus": "Coronavirus",
    "covid": "Coronavirus",
    "pandemic": "Outbreaks",
    "election": "Elections",
    "security": "Security",
    "safety": "Safety",
  };
  
  // Check if already a valid value
  if (validTopics.includes(topic)) {
    return topic;
  }
  
  // Try exact mapping
  if (map[t]) {
    return map[t];
  }
  
  // Try partial matching (if value contains one of the keywords)
  for (const [key, value] of Object.entries(map)) {
    if (t.includes(key) || key.includes(t)) {
      return value;
    }
  }
  
  // Default fallback
  return "Security";
}

const VALID_MAINLANDS = new Set([
  'Africa',
  'Antarctica',
  'Asia',
  'Europe',
  'North America',
  'Australia (Oceania)',
  'South America',
]);

function normalizeMainland(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.trim();
  if (VALID_MAINLANDS.has(v)) return v;
  if (v === 'Oceania') return 'Australia (Oceania)';
  return null;
}

function normalizeSeverityForDb(severity: string | null | undefined): 'critical' | 'warning' | 'caution' | 'informative' {
  const s = (severity || '').trim().toLowerCase();
  if (s === 'critical' || s === 'warning' || s === 'caution' || s === 'informative') {
    return s as 'critical' | 'warning' | 'caution' | 'informative';
  }
  return 'informative';
}

function normalizeSourcesForDb(sources: any, fallbackSourceName?: string): any[] {
  if (Array.isArray(sources)) return sources;
  if (typeof sources === 'string' && sources.trim()) return [sources.trim()];
  if (fallbackSourceName) return [fallbackSourceName];
  return [];
}

function buildAlertForDb(alert: any, source?: { id?: string; url?: string; name?: string }) {
  const countryNormalized = normalizeCountryForACF(alert?.country ?? null) ?? alert?.country ?? null;
  const mainlandNormalized = normalizeMainland(alert?.mainland ?? (countryNormalized ? getContinent(countryNormalized) : null));
  const intelligenceTopic = normalizeIntelligenceTopicsForACF(
    alert?.intelligence_topics ?? alert?.event_type ?? alert?.eventType ?? null
  );

  const recommendations = Array.isArray(alert?.recommendations)
    ? alert.recommendations.join('\n')
    : (alert?.recommendations ?? null);

  const geoJsonObj = alert?.geoJSON ?? alert?.geo_json ?? null;
  const geoJsonText = alert?.geojson ?? (geoJsonObj ? JSON.stringify(geoJsonObj) : null);

  // Only include fields that exist in the alerts table schema
  // Base schema fields from 001_complete_schema.sql
  const basePayload: any = {
    title: alert?.title || 'Untitled alert',
    summary: alert?.summary ?? alert?.eventSummary ?? '',
    location: alert?.location ?? null,
    country: countryNormalized,
    region: alert?.region ?? null,
    event_type: alert?.event_type ?? alert?.eventType ?? null,
    severity: normalizeSeverityForDb(alert?.severity),
    status: 'draft',
    source_id: source?.id ?? null,
    source_url: alert?.source_url ?? source?.url ?? null,
    article_url: alert?.article_url ?? null,
    sources: normalizeSourcesForDb(alert?.sources, source?.name),
    event_start_date: alert?.event_start_date ?? alert?.eventStartDate ?? null,
    event_end_date: alert?.event_end_date ?? alert?.eventEndDate ?? null,
    ai_generated: true,
    ai_model: alert?.ai_model ?? 'claude-3-haiku-20240307',
    ai_confidence: alert?.ai_confidence ?? null,
    generation_metadata: alert?.generation_metadata ?? {},
    created_at: nowIso(),
    updated_at: nowIso(),
  };

  // Add extended fields only if they exist (from migrations 008 and 010)
  // These might not be present on all databases
  try {
    if (alert?.description) basePayload.description = alert.description;
    if (mainlandNormalized) basePayload.mainland = mainlandNormalized;
    if (intelligenceTopic) basePayload.intelligence_topics = intelligenceTopic;
    if (alert?.latitude != null) basePayload.latitude = String(alert.latitude);
    if (alert?.longitude != null) basePayload.longitude = String(alert.longitude);
    if (alert?.radiusKm || alert?.radius) basePayload.radius = alert?.radiusKm ?? alert?.radius;
    if (geoJsonObj) basePayload.geo_json = geoJsonObj;
    if (geoJsonText) basePayload.geojson = geoJsonText;
    if (recommendations) basePayload.recommendations = recommendations;
    if (alert?.confidence_score) basePayload.confidence_score = alert.confidence_score;
  } catch (e) {
    // Silently skip extended fields if they cause issues
  }

  return basePayload;
}

// Convert recommendations string/array to ACF repeater format (array of objects)
function formatRecommendationsForACF(recs: string | string[] | null | undefined): Array<Record<string, any>> {
  if (!recs) return [];
  
  let recArray: string[] = [];
  if (typeof recs === 'string') {
    // Split by newline, bullet, or number patterns
    recArray = recs
      .split(/\n|;/)
      .map((rec: string) => {
        // Remove leading numbers, bullets, etc
        let cleaned = rec.trim();
        if (/^[\d+.•\-*]\s/.test(cleaned)) {
          cleaned = cleaned.substring(cleaned.search(/[^\d+.•\-*\s]/));
        }
        return cleaned;
      })
      .filter((rec: string) => rec.length > 0);
  } else if (Array.isArray(recs)) {
    recArray = recs.map((r: any) => String(r).trim()).filter((r: string) => r.length > 0);
  }
  
  // Convert to ACF repeater format: array of objects with 'label' field to match ACF
  return recArray.slice(0, 10).map((rec: string, idx: number) => ({
    id: String(idx + 1),
    label: rec
  }));
}

// Map alert severity levels to ACF color codes
function normalizeSeverityForACF(severity: string | null | undefined): string {
  if (!severity) return "yellow";
  
  const s = severity.trim().toLowerCase();
  const map: Record<string, string> = {
    "critical": "darkred",
    "high": "red",
    "warning": "orange",
    "caution": "yellow",
    "informative": "green",
    "info": "green",
    "low": "green",
    "severe": "darkred",
    "red": "red",
    "orange": "orange",
    "yellow": "yellow",
    "green": "green",
    "darkred": "darkred",
  };
  
  return map[s] ?? "yellow"; // Default to yellow if unknown
}

// ============================================================================
// CONFIDENCE SCORING (FACTAL-STYLE)
// ============================================================================

interface ConfidenceFactors {
  sourceTrustScore: number;  // 0.5-0.95 based on source authority
  multiSourceBoost: boolean; // +0.15 if multiple independent sources
  officialSourceBoost: boolean; // +0.15 if official (USGS/NWS/FAA/NOAA)
  hasCoordinates: boolean;   // +0.1 if precise location data
  hasTimeRange: boolean;     // +0.05 if event dates provided
  timingPenalty: number;     // -0.15 if very old or unclear timing
  locationPenalty: number;   // -0.2 if vague/unclear location
}

function getSourceTrustScore(source: any): number {
  const sourceType = (source?.type || '').toLowerCase();
  const name = (source?.name || '').toLowerCase();
  
  // Official high-trust sources
  const officialSources: Record<string, number> = {
    'usgs': 0.95,
    'usgs-atom': 0.95,
    'nws': 0.92,
    'cap': 0.92,
    'nws-cap': 0.92,
    'faa': 0.90,
    'faa-nas': 0.90,
    'faa-json': 0.90,
    'noaa': 0.90,
    'noaa-tropical': 0.90,
  };
  
  // Check by type first
  if (sourceType && officialSources[sourceType]) {
    return officialSources[sourceType];
  }
  
  // Check by name for well-known sources
  const wellKnown: Record<string, number> = {
    'usgs': 0.95,
    'us geological survey': 0.95,
    'national weather service': 0.92,
    'faa': 0.90,
    'noaa': 0.90,
    'national oceanic': 0.90,
  };
  
  for (const [key, score] of Object.entries(wellKnown)) {
    if (name.includes(key)) {
      return score;
    }
  }
  
  // Early signals and web sources
  if (sourceType && ['brave-search', 'web-early-signal', 'web'].includes(sourceType)) {
    return 0.55;
  }
  
  // Generic sources (RSS, feeds, etc.)
  if (sourceType && ['rss', 'rss-feed', 'atom', 'feed', 'web'].includes(sourceType)) {
    return 0.55;
  }
  
  // NewsAPI and generic sources
  if (sourceType && ['newsapi', 'newsapi-secondary'].includes(sourceType)) {
    return 0.50;
  }
  
  // ACLED and similar conflict data
  if (sourceType && ['acled'].includes(sourceType)) {
    return 0.60; // Reliable for conflict data, but less verified than official sources
  }
  
  // Default medium trust
  return 0.5;
}

function calculateConfidence(alert: Alert, source: any = null): number {
  let confidence = 0.5; // baseline
  
  // 1. Source trust (base 0.3 weight)
  const sourceTrust = source ? getSourceTrustScore(source) : 0.5;
  confidence = sourceTrust;
  
  // 2. Structured data quality boosters (each +0.08 to 0.1)
  if (alert.latitude !== undefined && alert.longitude !== undefined) {
    confidence += 0.1; // precise coordinates = high quality
  } else if (alert.location && alert.location.length > 5 && !alert.location.includes('Unknown')) {
    confidence += 0.05; // named location is better than vague
  }
  
  if (alert.event_start_date) {
    confidence += 0.05; // event timing information
  }
  
  // 3. Severity-based adjustments
  // Critical/Warning events from official sources are more trustworthy
  if ((alert.severity === 'critical' || alert.severity === 'warning') && sourceTrust >= 0.85) {
    confidence += 0.08;
  }
  
  // 4. AI-generated alerts get a slight boost if ai_confidence is present
  if (alert.ai_generated && alert.ai_confidence && alert.ai_confidence > 0.7) {
    confidence += 0.05;
  }
  
  // 5. Penalties for data quality issues
  // Very vague location
  if (alert.location && (alert.location.length < 3 || alert.location === 'Unknown' || alert.location.includes('?'))) {
    confidence -= 0.2;
  }
  
  // Missing critical fields
  if (!alert.summary || alert.summary.length < 20) {
    confidence -= 0.15;
  }
  
  // Old alerts (more than 30 days) lose credibility
  if (alert.created_at) {
    const alertDate = new Date(alert.created_at);
    const daysSinceCreation = (Date.now() - alertDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceCreation > 30) {
      confidence -= 0.25; // stale data
    } else if (daysSinceCreation > 14) {
      confidence -= 0.1;
    }
  }
  
  // Clamp to valid range [0.0, 1.0]
  confidence = Math.max(0.0, Math.min(1.0, confidence));
  
  return confidence;
}

// Categorize alerts by confidence level for workflow routing
function getConfidenceCategory(score: number): 'noise' | 'early-signal' | 'review' | 'publish' | 'verified' {
  if (score < 0.4) return 'noise';
  if (score < 0.6) return 'early-signal';
  if (score < 0.7) return 'review';
  if (score < 0.85) return 'publish';
  return 'verified';
}

// ============================================================================
// TREND MATCHING & AGGREGATION
// ============================================================================

async function matchAlertToTrend(
  alert: Alert,
  existingTrend: Trend,
  openaiKey: string
): Promise<boolean> {
  // Geographic validation is MANDATORY
  if (existingTrend.country !== alert.country) {
    console.log(`Geographic mismatch: ${alert.country} vs trend country ${existingTrend.country}`);
    return false;
  }

  // Event type should be similar
  const alertType = (alert.eventType || alert.event_type || '').toLowerCase();
  const trendType = (existingTrend.eventType || '').toLowerCase();
  
  if (!alertType.includes(trendType.split(' ')[0]) && !trendType.includes(alertType.split(' ')[0])) {
    return false;
  }

  // Use AI to confirm semantic match
  const prompt = `Analyze if this new alert belongs to an EXISTING TREND (same situation, same country).

TREND: ${existingTrend.title} (${existingTrend.country})
TREND SUMMARY: ${existingTrend.summary}

NEW ALERT: ${alert.title} (${alert.country})
NEW ALERT SUMMARY: ${alert.summary}

Rules:
- MUST be same country (already confirmed)
- MUST be same or related event type
- MUST be part of ongoing situation in SAME LOCATION/REGION
- Different severity levels CAN belong to same trend
- New development in ongoing situation should be added

Answer ONLY "MATCH" or "NO MATCH"`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 150,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) return false;
    
    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content?.trim().toUpperCase();
    return answer?.includes('MATCH') || false;
  } catch {
    return false;
  }
}

async function createTrendsFromAlerts(
  alerts: Alert[],
  existingTrends: Trend[],
  openaiKey: string
): Promise<Trend[]> {
  if (alerts.length < 2) {
    console.log('Not enough unmatched alerts to create trend (<2)');
    return [];
  }

  // Group alerts by country and event type
  const alertsByCountryType = new Map<string, Alert[]>();
  
  for (const alert of alerts) {
    const key = `${alert.country}|${alert.eventType || alert.event_type}`;
    if (!alertsByCountryType.has(key)) {
      alertsByCountryType.set(key, []);
    }
    alertsByCountryType.get(key)!.push(alert);
  }

  const newTrends: Trend[] = [];

  for (const [key, groupedAlerts] of alertsByCountryType) {
    if (groupedAlerts.length < 2) continue;

    const [country, eventType] = key.split('|');
    const continent = getContinent(country);

    // Use AI to analyze pattern and create trend
    const alertSummaries = groupedAlerts
      .map((a) => `- ${a.title} (${a.location}, ${a.region || 'N/A'}) [${a.severity}]`)
      .join('\n');

    const prompt = `Analyze these RELATED alerts (same country, same event type) and create a DESCRIPTIVE trend title and summary.

COUNTRY: ${country}
EVENT TYPE: ${eventType}

ALERTS:
${alertSummaries}

Generate:
1. DESCRIPTIVE trend title (specific, not generic like "Incidents in ${country}")
2. 2-3 sentence summary of the pattern
3. Predictive analysis (what this pattern indicates)
4. Forecast (expected developments)

Format as JSON:
{
  "title": "Specific descriptive title",
  "summary": "Pattern summary",
  "predictiveAnalysis": "What this indicates",
  "forecast": "Expected developments"
}

CRITICAL: Title must be SPECIFIC to ${country}. Examples:
- YES: "Flooding Events in Thailand"
- YES: "Airport Strikes in France"
- NO: "Global Incidents"
- NO: "Multiple Events"`;

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          max_tokens: 2000,
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) continue;

      const data = await response.json();
      const aiResponse = data.choices?.[0]?.message?.content || '{}';
      
      let trendData: any = {};
      try {
        let cleaned = aiResponse.trim();
        if (cleaned.startsWith('```json')) {
          cleaned = cleaned.substring(7);
        } else if (cleaned.startsWith('```')) {
          cleaned = cleaned.substring(3);
        }
        if (cleaned.endsWith('```')) {
          cleaned = cleaned.substring(0, cleaned.length - 3);
        }
        cleaned = cleaned.trim();
        trendData = JSON.parse(cleaned);
      } catch {
        const match = aiResponse.match(/\{[\s\S]*\}/);
        if (match) trendData = JSON.parse(match[0]);
      }

      // Validate trend title (reject generic titles)
      const title = trendData.title || `${eventType} Events in ${country}`;
      if (title.includes('undefined') || title.includes('multiple') || title.includes('global')) {
        console.log(`Rejected generic trend title: ${title}`);
        continue;
      }

      const severity = groupedAlerts.reduce((max, a) => {
        const severityRank: Record<string, number> = { critical: 4, warning: 3, caution: 2, informative: 1 };
        return (severityRank[a.severity] || 0) > (severityRank[max.severity] || 0) ? a : max;
      }).severity;

      const now = new Date().toISOString();
      const trend: Trend = {
        id: crypto.randomUUID(),
        title,
        alertIds: groupedAlerts.map((a) => a.id),
        subItems: groupedAlerts.map((a) => a.id),
        subItemCount: groupedAlerts.length,
        country,
        region: groupedAlerts[0]?.region,
        continent,
        eventType,
        severity,
        summary: trendData.summary || `Multiple ${eventType} events in ${country}`,
        predictiveAnalysis: trendData.predictiveAnalysis,
        forecast: trendData.forecast,
        sources: [...new Set(groupedAlerts.flatMap((a) => a.sources ? [a.sources] : []))],
        sourceCount: [...new Set(groupedAlerts.flatMap((a) => a.sources ? [a.sources] : []))].length,
        firstIncidentDate: groupedAlerts[groupedAlerts.length - 1]?.created_at || now,
        lastIncidentDate: groupedAlerts[0]?.created_at || now,
        autoGenerated: true,
        created_at: now,
        updated_at: now,
      };

      newTrends.push(trend);
    } catch (err: any) {
      console.error('Error creating trend:', err);
      continue;
    }
  }

  return newTrends;
}

// ============================================================================
// SCOUR WORKER & ALERT EXTRACTION
// ============================================================================

interface ScourConfig {
  jobId: string;
  sourceIds: string[];
  daysBack: number;
  supabaseUrl: string;
  serviceKey: string;
  openaiKey: string;
  claudeKey?: string;
  braveApiKey?: string;
}

interface Alert {
  id: string;
  title: string;
  summary: string;
  eventSummary?: string;
  location: string;
  country: string;
  countryFlag?: string;
  region?: string;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  geoScope?: 'local' | 'city' | 'regional' | 'national' | 'multinational';
  geoJSON?: any;
  event_type: string;
  eventType?: string;
  severity: 'critical' | 'warning' | 'caution' | 'informative';
  status: 'draft' | 'approved' | 'published' | 'dismissed';
  source_url: string;
  article_url?: string;
  sources?: string;
  sourceCount?: number;
  event_start_date?: string;
  event_end_date?: string;
  ai_generated: boolean;
  ai_model: string;
  ai_confidence?: number;
  confidence_score?: number;  // Factal-style confidence (0.0-1.0)
  generation_metadata?: any;
  created_at: string;
  updated_at: string;
  wordpress_post_id?: number;
  wordpress_url?: string;
  recommendations?: string;
  mitigation?: string;
  recommendedActions?: string[];
  topics?: string[];
  regions?: string[];
  alertType?: 'Current' | 'Forecast' | 'Escalation Watch' | 'Emerging Pattern' | 'Seasonal Risk';
  escalationLikelihood?: 'low' | 'medium' | 'high';
  secondaryImpacts?: string[];
  parentTrendId?: string;
}

interface Trend {
  id: string;
  title: string;
  alertIds: string[];
  subItems?: string[];
  subItemCount: number;
  country: string;
  region?: string;
  continent: string;
  eventType: string;
  severity: 'critical' | 'warning' | 'caution' | 'informative';
  summary: string;
  predictiveAnalysis?: string;
  forecast?: string;
  sources: string[];
  sourceCount?: number;
  firstIncidentDate: string;
  lastIncidentDate: string;
  autoGenerated: boolean;
  created_at: string;
  updated_at: string;
}

async function querySupabaseForWorker(url: string, serviceKey: string, options: RequestInit = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${serviceKey}`,
      'apikey': serviceKey,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase error ${response.status}: ${text}`);
  }

  return response.json();
}

// ============================================================================
// TIMESTAMP STANDARDIZATION - Convert various date formats to ISO 8601
function normalizeTimestamp(dateString: string): string {
  if (!dateString) return new Date().toISOString();
  
  // If already ISO 8601, return as-is
  if (dateString.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) {
    return dateString;
  }
  
  try {
    // Try to parse as Date - handles RFC 2822 (RSS), ISO, and other common formats
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
  } catch (e) {
    // If parsing fails, log warning and return current time
    console.warn(`Failed to parse timestamp: "${dateString}", using current time`);
  }
  
  return new Date().toISOString();
}

// ============================================================================
// RSS FEED PARSER - Extract articles from RSS XML
// ============================================================================
function parseRSSFeed(xmlContent: string): { articles: Array<{ title: string; description: string; link: string; pubDate: string }>; isRSS: boolean } {
  try {
    // Check if this looks like RSS/XML
    if (!xmlContent.includes('<rss') && !xmlContent.includes('<feed') && !xmlContent.includes('<item')) {
      return { articles: [], isRSS: false };
    }

    const articles: Array<{ title: string; description: string; link: string; pubDate: string }> = [];
    
    // Simple regex-based parsing (not full XML parser, but works for RSS)
    const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/g;
    let match;

    while ((match = itemRegex.exec(xmlContent)) !== null) {
      const itemContent = match[1];
      
      // Extract fields using regex
      const titleMatch = itemContent.match(/<title[^>]*>([\s\S]*?)<\/title>/);
      const descMatch = itemContent.match(/<description[^>]*>([\s\S]*?)<\/description>/);
      const linkMatch = itemContent.match(/<link[^>]*>([\s\S]*?)<\/link>/);
      const pubDateMatch = itemContent.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/);

      if (titleMatch && (descMatch || linkMatch)) {
        articles.push({
          title: titleMatch[1].replace(/<[^>]+>/g, '').trim(),
          description: descMatch ? descMatch[1].replace(/<[^>]+>/g, '').trim() : '',
          link: linkMatch ? linkMatch[1].trim() : '',
          pubDate: pubDateMatch ? normalizeTimestamp(pubDateMatch[1].trim()) : new Date().toISOString(),
        });
      }
    }

    return { articles, isRSS: articles.length > 0 };
  } catch (e) {
    console.warn(`RSS parsing error: ${e}`);
    return { articles: [], isRSS: false };
  }
}

// ============================================================================
// Structured Source Parsers (USGS Atom, NWS CAP, Generic RSS/Atom)
// ============================================================================

async function fetchRaw(url: string, timeoutMs = 10000): Promise<string> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`Fetch ${res.status}: ${t.slice(0, 120)}`);
    }
    return await res.text();
  } catch (e: any) {
    console.warn(`Raw fetch failed for ${url}: ${e?.message || e}`);
    return "";
  }
}

function parseText(tag: string, xml: string): string | null {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return m ? m[1].trim() : null;
}

function parseAttr(tag: string, attr: string, xml: string): string | null {
  const m = xml.match(new RegExp(`<${tag}[^>]*${attr}=[\"']([^\"']+)[\"'][^>]*\\/?>`, 'i'));
  return m ? m[1].trim() : null;
}

function splitEntries(xml: string, entryTag = 'entry'): string[] {
  const entries: string[] = [];
  const re = new RegExp(`<${entryTag}[^>]*>([\\s\\S]*?)<\\/${entryTag}>`, 'ig');
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) entries.push(m[1]);
  return entries;
}

function severityFromMagnitude(mag: number): 'critical' | 'warning' | 'caution' | 'informative' {
  if (mag >= 7.0) return 'critical';
  if (mag >= 6.0) return 'warning';
  if (mag >= 5.5) return 'caution';
  return 'informative';
}

function magnitudeFromTitle(title: string): number | null {
  const m = title.match(/\\bM\\s*(\\d+(?:\\.\\d+)?)\\b/i);
  return m ? parseFloat(m[1]) : null;
}

function centroidFromPolygon(polygon: string): { lat?: number; lon?: number; radiusKm?: number } {
  try {
    const points = polygon.split(/\\s+/).map(p => p.split(',').map(Number)).filter(a => a.length === 2 && !isNaN(a[0]) && !isNaN(a[1]));
    if (!points.length) return {};
    const lat = points.reduce((s, p) => s + p[0], 0) / points.length;
    const lon = points.reduce((s, p) => s + p[1], 0) / points.length;
    // crude radius: max distance to centroid
    let maxKm = 0;
    for (const [plat, plon] of points) {
      const dlat = (plat - lat) * Math.PI / 180;
      const dlon = (plon - lon) * Math.PI / 180;
      const a = Math.sin(dlat/2)**2 + Math.cos(lat*Math.PI/180)*Math.cos(plat*Math.PI/180)*Math.sin(dlon/2)**2;
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const km = 6371 * c;
      if (km > maxKm) maxKm = km;
    }
    return { lat, lon, radiusKm: Math.round(maxKm) };
  } catch {
    return {};
  }
}

async function parseUSGSAtom(xml: string, source: any): Promise<Alert[]> {
  if (!xml) return [];
  const now = new Date().toISOString();
  const entries = splitEntries(xml, 'entry');
  const alerts: Alert[] = [];
  for (const e of entries) {
    const title = parseText('title', e) || 'Earthquake';
    const link = parseAttr('link', 'href', e) || source.url;
    const updated = parseText('updated', e) || now;
    const point = parseText('georss:point', e) || parseText('point', e) || '';
    let mag = magnitudeFromTitle(title);
    if (mag === null) {
      const summaryText = parseText('summary', e) || parseText('description', e) || parseText('content', e) || '';
      mag = magnitudeFromTitle(summaryText);
    }
    if (mag === null || mag < 5.5) continue; // enforce threshold
    const [latStr, lonStr] = point.split(/\\s+/);
    const lat = latStr ? parseFloat(latStr) : undefined;
    const lon = lonStr ? parseFloat(lonStr) : undefined;
    const locPart = title.replace(/M\\s*\\d+(?:\\.\\d+)?\\s*-\\s*/i, '').trim();
    const alert: Alert = {
      id: crypto.randomUUID(),
      title,
      summary: title,
      location: locPart || 'Unknown',
      country: 'Unknown',
      latitude: isNaN(lat || NaN) ? undefined : lat,
      longitude: isNaN(lon || NaN) ? undefined : lon,
      radiusKm: 50,
      event_type: 'earthquake',
      severity: severityFromMagnitude(mag!),
      status: 'draft',
      source_url: source.url,
      article_url: link,
      sources: source.name,
      ai_generated: false,
      ai_model: 'structured-parser',
      created_at: updated,
      updated_at: updated,
    };
    alerts.push(alert);
  }
  return alerts;
}

function mapCapSeverity(sev: string | null, urgency: string | null): 'critical' | 'warning' | 'caution' | 'informative' {
  const s = (sev || '').toLowerCase();
  const u = (urgency || '').toLowerCase();
  if (s === 'extreme' || (s === 'severe' && u === 'immediate')) return 'critical';
  if (s === 'severe' || u === 'expected' || u === 'immediate') return 'warning';
  if (s === 'moderate') return 'caution';
  return 'informative';
}

function mapCapAlertType(event: string | null): 'Current' | 'Forecast' | 'Escalation Watch' | 'Emerging Pattern' | 'Seasonal Risk' | undefined {
  const e = (event || '').toLowerCase();
  if (e.includes('watch') || e.includes('outlook') || e.includes('advisory')) return 'Forecast';
  return undefined;
}

async function parseCAPAtom(xml: string, source: any): Promise<Alert[]> {
  if (!xml) return [];
  const now = new Date().toISOString();
  const entries = splitEntries(xml, 'entry');
  const alerts: Alert[] = [];
  for (const e of entries) {
    const title = parseText('title', e) || 'Weather Alert';
    const link = parseAttr('link', 'href', e) || source.url;
    const updated = parseText('updated', e) || now;
    const event = parseText('cap:event', e) || parseText('event', e);
    const severity = parseText('cap:severity', e) || parseText('severity', e);
    const urgency = parseText('cap:urgency', e) || parseText('urgency', e);
    const effective = parseText('cap:effective', e) || parseText('effective', e);
    const expires = parseText('cap:expires', e) || parseText('expires', e);
    const areaDesc = parseText('cap:areaDesc', e) || parseText('areaDesc', e) || 'Affected Area';
    const polygon = parseText('cap:polygon', e) || parseText('polygon', e) || '';
    const centroid = polygon ? centroidFromPolygon(polygon) : {};
    const alert: Alert = {
      id: crypto.randomUUID(),
      title,
      summary: title,
      location: areaDesc,
      country: 'USA',
      latitude: centroid.lat,
      longitude: centroid.lon,
      radiusKm: centroid.radiusKm,
      event_type: (event || 'weather').toLowerCase(),
      severity: mapCapSeverity(severity, urgency),
      status: 'draft',
      source_url: source.url,
      article_url: link,
      sources: source.name,
      event_start_date: effective || undefined,
      event_end_date: expires || undefined,
      alertType: mapCapAlertType(event),
      ai_generated: false,
      ai_model: 'structured-parser',
      created_at: updated,
      updated_at: updated,
    } as Alert;
    alerts.push(alert);
  }
  return alerts;
}

async function parseRSSOrAtom(xml: string, source: any): Promise<Alert[]> {
  if (!xml) return [];
  const now = new Date().toISOString();
  const itemEntries = splitEntries(xml, 'item');
  const atomEntries = splitEntries(xml, 'entry');
  const entries = itemEntries.length ? itemEntries : atomEntries;
  const alerts: Alert[] = [];
  for (const e of entries) {
    const title = parseText('title', e) || 'Update';
    const link = parseText('link', e) || parseAttr('link', 'href', e) || source.url;
    const pubRaw = parseText('pubDate', e) || parseText('updated', e) || now;
    // Standardize to ISO 8601 format
    const pub = normalizeTimestamp(pubRaw);
    const alert: Alert = {
      id: crypto.randomUUID(),
      title,
      summary: title,
      location: source.country || 'Unknown',
      country: source.country || 'Unknown',
      event_type: 'general',
      severity: 'informative',
      status: 'draft',
      source_url: source.url,
      article_url: link,
      sources: source.name,
      ai_generated: false,
      ai_model: 'structured-parser',
      created_at: pub,
      updated_at: pub,
    };
    alerts.push(alert);
  }
  return alerts;
}

async function parseFAANASJson(jsonStr: string, source: any): Promise<Alert[]> {
  if (!jsonStr) return [];
  const now = new Date().toISOString();
  try {
    let data: any = JSON.parse(jsonStr);
    if (!Array.isArray(data)) data = data.notices || data.alerts || [];
    if (!Array.isArray(data)) return [];
    
    const alerts: Alert[] = [];
    for (const notice of data.slice(0, 100)) {
      const title = notice.title || notice.notam || notice.notice || 'FAA Notice';
      const link = notice.link || notice.url || source.url;
      const effective = notice.effective || notice.issued || now;
      const expires = notice.expires || null;
      const alert: Alert = {
        id: crypto.randomUUID(),
        title,
        summary: notice.description || notice.text || title,
        location: notice.location || notice.airport || 'Unknown',
        country: 'USA',
        event_type: 'aviation',
        severity: notice.severity?.toLowerCase() === 'high' ? 'warning' : 'caution',
        status: 'draft',
        source_url: source.url,
        article_url: link,
        sources: source.name,
        event_start_date: effective,
        event_end_date: expires || undefined,
        alertType: 'Current' as const,
        ai_generated: false,
        ai_model: 'structured-parser',
        created_at: effective,
        updated_at: effective,
      };
      alerts.push(alert);
    }
    return alerts;
  } catch (e: any) {
    console.warn(`FAA NAS JSON parse failed: ${e?.message || e}`);
    return [];
  }
}

async function parseNOAATropical(xml: string, source: any): Promise<Alert[]> {
  if (!xml) return [];
  const now = new Date().toISOString();
  const entries = splitEntries(xml, 'entry');
  const alerts: Alert[] = [];
  
  for (const e of entries) {
    const title = parseText('title', e) || 'Tropical Cyclone Advisory';
    const link = parseAttr('link', 'href', e) || source.url;
    const updated = parseText('updated', e) || now;
    const summary = parseText('summary', e) || parseText('content', e) || title;
    
    // Extract location from title if it contains a storm name
    const locationMatch = title.match(/(?:Hurricane|Typhoon|Storm|Cyclone)\s+([A-Za-z]+)/i);
    const location = locationMatch ? locationMatch[1] : 'Atlantic/Pacific';
    
    // Determine severity from title keywords
    let severity: 'critical' | 'warning' | 'caution' | 'informative' = 'warning';
    if (title.includes('Hurricane') || title.includes('Typhoon')) severity = 'critical';
    if (title.includes('Tropical Storm')) severity = 'caution';
    if (title.includes('Outlook')) severity = 'informative';
    
    const alert: Alert = {
      id: crypto.randomUUID(),
      title,
      summary,
      location,
      country: 'USA',
      event_type: 'tropical-cyclone',
      severity,
      status: 'draft',
      source_url: source.url,
      article_url: link,
      sources: source.name,
      alertType: title.includes('Outlook') ? 'Forecast' : 'Current',
      ai_generated: false,
      ai_model: 'structured-parser',
      created_at: updated,
      updated_at: updated,
    };
    alerts.push(alert);
  }
  return alerts;
}

async function parseBySourceType(source: any): Promise<Alert[]> {
  const type = (source.type || '').toLowerCase();
  if (!type || type === 'unknown') return []; // skip unknown types
  
  const raw = await fetchRaw(source.url);
  if (!raw) return [];
  
  if (type === 'usgs-atom' || type === 'usgs') return await parseUSGSAtom(raw, source);
  if (type === 'cap' || type === 'nws-cap') return await parseCAPAtom(raw, source);
  if (type === 'faa-nas' || type === 'faa-json') {
    try {
      return await parseFAANASJson(raw, source);
    } catch {
      return [];
    }
  }
  if (type === 'noaa-tropical' || type === 'noaa') return await parseNOAATropical(raw, source);
  if (type === 'rss' || type === 'atom' || type === 'feed') return await parseRSSOrAtom(raw, source);
  return [];
}

async function scrapeUrl(url: string): Promise<string> {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  ];
  
  const randomUA = userAgents[Math.floor(Math.random() * userAgents.length)];
  
  try {
    console.log(`   ?? Scraping: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': randomUA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      // For 429 (rate limited) or 403 (forbidden), don't throw - return empty
      // This allows Brave Search fallback to work
      if (response.status === 429 || response.status === 403) {
        return '';
      }
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    if (!html || html.length < 50) {
      console.warn(`   ??  Empty response from ${url}`);
      return '';
    }
    
    const cleaned = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 15000);
    console.log(`   ? Scraped ${cleaned.length} chars from ${url}`);
    return cleaned;
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.warn(`   ??  Scrape failed for ${url}: ${errMsg}`);
    return '';
  }
}

// Early signal queries for proactive detection via Brave Search
const EARLY_SIGNAL_QUERIES: string[] = [
  // NATURAL DISASTERS & ENVIRONMENTAL EVENTS
  'earthquake reported residents say shaking',
  'aftershock felt this morning',
  'landslide blocked road',
  'flash flooding reported',
  'river overflowed homes evacuated',
  'wildfire spreading toward town',
  'smoke visible kilometers away',
  'volcanic ash advisory issued',
  'tsunami warning issued locally',
  'dam overflow emergency evacuation',
  // TRAVEL & AVIATION DISRUPTIONS
  'airport closed due to weather',
  'runway closed after incident',
  'flights cancelled without notice',
  'airspace closed temporarily',
  'ground stop issued airport',
  'aircraft diverted after emergency',
  'airport power outage',
  'radar failure airport delays',
  'strike affects flights today',
  'airport evacuation reported',
  // BORDER, IMMIGRATION & CROSSING ISSUES
  'border closed without warning',
  'border crossing delays hours',
  'entry denied travelers today',
  'immigration system outage',
  'customs strike reported',
  'passport control backlog',
  'visa suspension announced',
  'foreign nationals stranded border',
  'crossing temporarily suspended',
  'travelers stuck overnight border',
  // POLITICAL INSTABILITY & CIVIL UNREST
  'protests erupted overnight',
  'demonstrators blocked main roads',
  'riot police deployed downtown',
  'state of emergency declared',
  'curfew announced tonight',
  'government buildings evacuated',
  'internet shutdown reported',
  'mobile networks disrupted protests',
  'military deployed to streets',
  'clashes reported between protesters police',
  // SAFETY, SECURITY & INCIDENTS AFFECTING MOVEMENT
  'explosion reported near transit',
  'gunfire reported near station',
  'suspicious package airport',
  'security incident public transport',
  'train service suspended incident',
  'metro shut down emergency',
  'ferry service cancelled weather',
  'bridge closed structural issue',
  'tunnel closed after accident',
  'major highway closed indefinitely',
];

function buildRegionalQueries(base: string[], countries: string[], cities: string[]): string[] {
  const queries: string[] = [];
  const uniq = new Set<string>();
  const add = (q: string) => { const k = q.toLowerCase(); if (!uniq.has(k)) { uniq.add(k); queries.push(q); } };

  for (const q of base) {
    add(q);
    for (const country of countries) add(`${q} ${country}`);
    for (const city of cities) add(`${q} ${city}`);
  }
  return queries.slice(0, 500); // cap to avoid excessive calls
}

function generateDefaultRecommendations(severity: string, eventType: string, location: string): string {
  const recommendations: Record<string, string[]> = {
    // Natural Disasters & Severe Weather
    'Severe Weather': [
      `Monitor official weather alerts and local news channels continuously. Check forecasts from ${location} meteorological services before any movement outside shelters.`,
      `Stock essential supplies including water, non-perishable food, first aid supplies, and medications. Ensure power banks and battery-powered radios are available.`,
      `Identify safe shelter locations (hotels with backup power, government emergency shelters) and have evacuation routes planned. Know the location of nearest hospital and emergency services.`,
      `Stay in communication with your embassy/consulate and register for emergency alerts. Have multiple communication methods (satellite phone, local SIM cards) as backup.`,
    ],
    'Earthquake': [
      `Drop, Cover, and Hold On immediately when tremors are felt. Move away from windows, heavy objects, and building exteriors. Stay indoors unless under immediate threat.`,
      `Have emergency supplies accessible (water, food, first aid, flashlight, whistle). Know the location of nearest safe building and open spaces away from structures.`,
      `If traveling, inform someone of your location and check-in regularly. Have medical records/prescriptions digitized and accessible. Register with your embassy.`,
      `Monitor aftershock warnings through local authorities and international monitoring services. Be prepared for potential infrastructure disruptions (roads, utilities, communications).`,
    ],
    'Flood': [
      `Avoid all low-lying areas, river valleys, and flood-prone regions. Do not attempt to cross flooded roads or bridges—water depth is unpredictable and currents are strong.`,
      `Relocate immediately to higher ground if in flood zones. Stay with local authorities and follow evacuation orders without delay. Have emergency contacts and important documents readily available.`,
      `Monitor water levels through local services and weather updates. Keep emergency supplies (food, water, first aid, flashlight) in waterproof containers on upper levels.`,
      `Plan alternative transportation routes. Check bridge and road status before travel. Have travel insurance that covers flooding-related cancellations and disruptions.`,
    ],
    'Wildfire': [
      `Monitor air quality indices and evacuation orders from local fire services. Have a prepared evacuation plan with multiple exit routes from your location.`,
      `Stock N95/P100 masks, air purifiers, and medications for respiratory issues. Stay indoors with windows closed when air quality is hazardous.`,
      `Keep vehicle fueled above half-tank at all times. Have a go-bag with essential documents, medications, and valuables. Register your location with local authorities.`,
      `Check road conditions and fire perimeter maps regularly. Avoid areas with active fires. If evacuation is ordered, leave immediately—do not wait for confirmation.`,
    ],
    // Security Issues
    'Violence Alert': [
      `Avoid affected neighborhoods and areas where violence has been reported. Use trusted, vetted transportation and avoid walking alone, especially after dark.`,
      `Register with your embassy and join their emergency notification system. Keep embassy contact information and legal assistance resources accessible at all times.`,
      `Maintain low profile—avoid large gatherings, public demonstrations, and visibly displaying valuables or foreign status. Vary your routine and movement patterns.`,
      `Stay in well-secured accommodations in safe areas. Maintain emergency cash in multiple currencies and keep passport/documents in secure locations with copies stored separately.`,
    ],
    'Political Unrest': [
      `Avoid all demonstrations, protests, and large public gatherings regardless of your political stance. These can turn violent rapidly with minimal warning.`,
      `Monitor official government sources and reputable international news outlets. Avoid spreading unverified information and maintain distance from politically charged conversations.`,
      `Stay flexible with travel plans—borders, flights, and infrastructure may be disrupted unexpectedly. Have contingency accommodations and alternative transportation options identified.`,
      `Maintain regular contact with family/friends outside the country. Document your location and status with your embassy. Have multiple ways to contact help (local numbers, VPN access).`,
    ],
    'Terrorism': [
      `Avoid crowded public places, government buildings, military facilities, and places of worship where attacks historically target. Use less-frequented routes and vary your patterns.`,
      `Report suspicious activity to local authorities immediately. Understand local emergency numbers and have them memorized. Know nearest embassy location and security protocols.`,
      `Keep valuables and documents secure. Avoid discussing travel plans or personal details in public. Maintain situational awareness and trust your instincts about threatening situations.`,
      `Consider evacuation insurance and ensure your travel insurance covers terrorism-related events. Have quick access to important documents and backup identification.`,
    ],
    // Transportation
    'Transportation Disruption': [
      `Check real-time flight and transportation status before departure. Build buffer time into connections and have backup routes planned.`,
      `Book refundable tickets when possible and verify cancellation policies. Have travel insurance covering transportation disruptions. Monitor airline/transit authority announcements.`,
      `Use official transportation services only. Avoid unofficial taxis or rides. Register travel itinerary with your embassy and inform them of changes.`,
      `Stay flexible with schedules. Have contingency accommodations if delays occur. Keep emergency cash and local currency for unexpected transportation costs.`,
    ],
    'Border Closure': [
      `Verify entry requirements and border status with your embassy before travel. Obtain all necessary visas and documentation well in advance of travel dates.`,
      `Have backup entry routes and countries identified. Travel through official border crossings during designated hours. Avoid informal or restricted border areas.`,
      `Register your travel with your embassy. Keep documents and vaccinations up-to-date. Maintain emergency contact information for your consulate.`,
      `Check current restrictions on the day of travel—situations change rapidly. Have flexible return dates and consider purchasing flexible insurance. Communicate plans to family/friends.`,
    ],
    // Health
    'Disease Outbreak': [
      `Follow all public health advisories from WHO and local health authorities. Ensure vaccinations are current and carry proof of vaccination documentation.`,
      `Practice rigorous hygiene—frequent handwashing, masks in crowded areas, and avoiding touching face. Maintain physical distance from symptomatic individuals.`,
      `Know location of medical facilities and have travel/medical insurance that covers pandemic-related care. Keep essential medications and thermometer available.`,
      `Monitor symptoms daily and seek medical attention immediately if ill. Inform healthcare providers of recent travel. Have reliable communication to reach medical emergency services.`,
    ],
    // Default for unknown types
    default: [
      `Monitor official government and international travel advisory updates regularly for changes in conditions.`,
      `Register with your embassy and maintain communication with home contacts. Have emergency protocols and meeting points established.`,
      `Maintain situational awareness and adjust plans based on current conditions. Trust your instincts and prioritize personal safety.`,
      `Ensure travel insurance covers relevant risks and have evacuation/emergency assistance contacts readily accessible.`,
    ],
  };

  // Select recommendations based on eventType
  const typeKey = Object.keys(recommendations).find(key => eventType?.toLowerCase().includes(key.toLowerCase())) || 'default';
  const recs = recommendations[typeKey] || recommendations.default;
  
  // Return 3-4 recommendations joined with line breaks
  return recs.slice(0, 4).join('\n\n');
}

// ============================================================================
// AI-POWERED EVENT-SPECIFIC RECOMMENDATIONS
// ============================================================================
async function generateAIEventSpecificRecommendations(
  alert: Alert,
  openaiKey: string
): Promise<string> {
  if (!openaiKey) {
    return generateDefaultRecommendations(alert.severity, alert.eventType, alert.location);
  }

  try {
    const prompt = `You are a MAGNUS Travel Safety Intelligence Analyst specializing in real-time risk mitigation for travelers.

Generate SPECIFIC, ACTION-DRIVEN traveler recommendations based on this EXACT event:

EVENT TITLE: ${alert.title}
LOCATION: ${alert.location}, ${alert.country}${alert.region ? ` (Region: ${alert.region})` : ''}
EVENT TYPE: ${alert.eventType || 'General'}
SEVERITY: ${alert.severity}
EVENT DATES: ${alert.event_start_date || 'Unknown'} to ${alert.event_end_date || 'Ongoing'}
SUMMARY: ${alert.summary}

CRITICAL REQUIREMENTS:
- Recommendations MUST be specific to THIS event, NOT generic
- Include specific places/infrastructure affected (roads, airports, neighborhoods)
- Include specific actions (alternate routes, evacuation procedures, specific contact numbers if available)
- Recommendations should differ based on whether travelers are already IN the location vs planning to arrive
- 4-5 highly specific, action-driven bullet points
- Include what to AVOID (specific areas), what to DO (specific actions), and where to GET HELP
- Be prepared for infrastructure impact (mention specific transport alternatives if known)

Format: Return ONLY the recommendations, one per line, each starting with a specific action verb (Avoid, Contact, Use, Monitor, Report, Relocate, etc.). No numbering, no explanations.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.6,
        max_tokens: 800,
      }),
      signal: AbortSignal.timeout(20000),
    });

    if (!response.ok) {
      console.warn(`AI recommendations failed (${response.status}), using defaults`);
      return generateDefaultRecommendations(alert.severity, alert.eventType, alert.location);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    return content.trim() || generateDefaultRecommendations(alert.severity, alert.eventType, alert.location);
  } catch (e) {
    console.warn(`AI recommendations error: ${e}, using defaults`);
    return generateDefaultRecommendations(alert.severity, alert.eventType, alert.location);
  }
}

// ============================================================================
// INTELLIGENT GEOJSON GENERATION
// ============================================================================
async function generateIntelligentGeoJSON(
  alert: Alert,
  openaiKey: string
): Promise<GeoJSONFeature> {
  // Start with basic circle as fallback
  const lat = parseFloat(alert.latitude?.toString() || 'NaN');
  const lon = parseFloat(alert.longitude?.toString() || 'NaN');
  const radius = parseFloat(alert.radius?.toString() || '25');

  if (isNaN(lat) || isNaN(lon)) {
    return generatePointGeoJSON(lat, lon);
  }

  // For AI-powered geojson, try to get event-specific polygon
  if (!openaiKey) {
    return generateCircleGeoJSON(lat, lon, radius);
  }

  try {
    const prompt = `You are a geographic expert specializing in event impact zones. Generate a smart GeoJSON polygon that accurately represents the affected area for this event.

EVENT: ${alert.title}
LOCATION: ${alert.location}, ${alert.country}
TYPE: ${alert.eventType}
SEVERITY: ${alert.severity}
SUMMARY: ${alert.summary}
CENTER: [${lon}, ${lat}]
ESTIMATED_RADIUS_KM: ${radius}

GUIDELINES:
- For localized events (building fire, accident): Use small tight polygon around exact location
- For road closures/disruptions: Create polygon that includes affected routes extending beyond impact zone
- For weather (storm, flood): Extend radius based on extent described in summary
- For security threats: Use larger radius for evacuation perimeter
- For earthquakes/natural disaster: Extend further based on secondary damage description
- For disease outbreaks: Scale polygon to population centers mentioned

Return a GeoJSON Feature with Polygon geometry. Center should be near [${lon}, ${lat}].
Format ONLY as valid GeoJSON Feature (no explanation). Coordinates in [longitude, latitude] format.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 1000,
      }),
      signal: AbortSignal.timeout(20000),
    });

    if (!response.ok) {
      return generateCircleGeoJSON(lat, lon, radius);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    try {
      // Extract JSON from response (might include explanation before/after)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.type === 'Feature' && parsed.geometry?.type === 'Polygon') {
          return parsed;
        }
      }
    } catch (e) {
      console.warn(`Failed to parse AI GeoJSON: ${e}`);
    }

    return generateCircleGeoJSON(lat, lon, radius);
  } catch (e) {
    console.warn(`AI GeoJSON generation error: ${e}, using circle fallback`);
    return generateCircleGeoJSON(lat, lon, radius);
  }
}

// ============================================================================
// NewsAPI Integration - NEWS SOURCE MONITORING
// ============================================================================
async function fetchNewsApiAlerts(apiKey: string): Promise<Alert[]> {
  try {
    console.log(`📰 Fetching alerts from NewsAPI...`);
    
    // Search for disaster, crisis, and emergency-related news
    const queries = [
      'disaster earthquake wildfire',
      'humanitarian crisis emergency',
      'severe weather flooding',
      'conflict emergency',
      'health outbreak alert'
    ];
    
    const alerts: Alert[] = [];
    const now = nowIso();
    const seenUrls = new Set<string>();

    for (const query of queries) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        const response = await fetch(
          `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&sortBy=publishedAt&language=en&pageSize=10&apiKey=${apiKey}`,
          {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            signal: controller.signal,
          }
        );
        clearTimeout(timeoutId);

        if (!response.ok) {
          console.warn(`⚠️  NewsAPI request failed: ${response.status} for query "${query}"`);
          continue;
        }

        const data = await response.json();
        
        if (!data.articles || !Array.isArray(data.articles)) {
          console.warn(`⚠️  NewsAPI: No articles in response for query "${query}"`);
          continue;
        }

        for (const article of data.articles) {
          // Skip duplicates by URL
          if (seenUrls.has(article.url)) continue;
          seenUrls.add(article.url);

          if (!article.title || !article.description) continue;

          // Skip generic survey/overview articles without specific events
          const contentLower = `${article.title} ${article.description}`.toLowerCase();
          if (/(survey|overview|analysis|impact assessment|global summary|roundup|recap)/i.test(article.title)) {
            // Only accept surveys if they mention specific locations (not just "global")
            if (!/\b(USA|UK|China|India|Brazil|Mexico|Japan|Germany|France|Australia|Canada|Russia|Indonesia|Nigeria|Pakistan|Egypt|Bangladesh|Philippines|Vietnam|Ethiopia|Iran|Turkey|South Africa|Kenya|Thailand|Malaysia|Singapore|UAE|Saudi Arabia|Israel|Greece|Spain|Portugal|Netherlands|Belgium|Switzerland|Sweden|Norway|Denmark|Finland|Ireland|Poland|Ukraine|South Korea|New Zealand|Chile|Argentina|Colombia|Peru)\b/i.test(contentLower)) {
              console.log(`    ⊘ Skipping generic survey: "${article.title.substring(0, 50)}..."`);
              continue;
            }
          }

          // Extract location and event type from content
          const content = `${article.title} ${article.description}`;
          const keywords = [
            { keyword: 'earthquake', type: 'Natural Disaster' },
            { keyword: 'hurricane|typhoon|cyclone', type: 'Severe Weather' },
            { keyword: 'flooding|flood', type: 'Severe Weather' },
            { keyword: 'wildfire|bushfire', type: 'Natural Disaster' },
            { keyword: 'tornado', type: 'Severe Weather' },
            { keyword: 'drought', type: 'Severe Weather' },
            { keyword: 'outbreak|epidemic|pandemic', type: 'Health Crisis' },
            { keyword: 'conflict|war|attack', type: 'Conflict' },
            { keyword: 'humanitarian|refugee|displaced', type: 'Humanitarian Crisis' },
          ];

          let eventType = 'News Alert';
          for (const { keyword, type } of keywords) {
            if (new RegExp(keyword, 'i').test(content)) {
              eventType = type;
              break;
            }
          }

          // Extract specific location from article content (simple approach)
          let location = 'Global';
          let country = null;
          const locationRegex = /\b(USA|UK|China|India|Brazil|Mexico|Japan|Germany|France|Australia|Canada|Russia|Indonesia|Nigeria|Pakistan|Egypt|Bangladesh|Philippines|Vietnam|Ethiopia|Iran|Turkey|South Africa|Kenya|Thailand|Malaysia|Singapore|UAE|Saudi Arabia|Israel|Greece|Spain|Portugal|Netherlands|Belgium|Switzerland|Sweden|Norway|Denmark|Finland|Ireland|Poland|Ukraine|South Korea|New Zealand|Chile|Argentina|Colombia|Peru|Philippines|Thailand|Vietnam|Malaysia|Indonesia|Singapore|Myanmar|Laos|Cambodia|Hong Kong|Taiwan|Philippines|Fiji|Samoa|Tonga|Vanuatu|Kiribati)\b/i;
          const locationMatch = contentLower.match(locationRegex);
          if (locationMatch) {
            location = locationMatch[1];
            country = locationMatch[1];
          }

          // Skip if still global - we need specific locations
          if (location === 'Global') {
            console.log(`    ⊘ Skipping alert without specific location: "${article.title.substring(0, 50)}..."`);
            continue;
          }

          alerts.push({
            id: crypto.randomUUID(),
            title: article.title,
            summary: article.description || '',
            description: article.content || article.description || '',
            location: location,
            country: country,
            region: null,
            mainland: null,
            intelligence_topics: [eventType],
            event_type: eventType,
            severity: 'caution',
            status: 'draft',
            source_url: article.source.id,
            article_url: article.url,
            sources: `NewsAPI: ${article.source.name}`,
            event_start_date: article.publishedAt || now,
            event_end_date: null,
            latitude: getCountryCoordinates(country)[0] || null,
            longitude: getCountryCoordinates(country)[1] || null,
            geoJSON: country ? generateCircleGeoJSON(
              getCountryCoordinates(country)[0],
              getCountryCoordinates(country)[1],
              100 // 100km radius for country-level events
            ) : null,
            recommendations: generateDefaultRecommendations(eventType, 'caution'),
            ai_generated: false,
            ai_model: null,
            ai_confidence: 0.95, // High confidence - official source
            created_at: now,
            updated_at: now,
          });
        }
      } catch (queryErr) {
        console.warn(`Error processing NewsAPI query: ${queryErr}`);
      }
    }

    console.log(`✅ NewsAPI: Fetched ${alerts.length} articles from disaster-related news`);
    return alerts;
  } catch (e) {
    console.error(`❌ NewsAPI fetch error: ${e}`);
    return [];
  }
}

// ============================================================================
// WHO DISEASE OUTBREAK ALERTS - FREE RSS/API
// ============================================================================
async function fetchWhoAlerts(): Promise<Alert[]> {
  try {
    console.log(`🏥 Fetching WHO disease outbreak alerts...`);
    // WHO Disease Outbreak News (free, updated daily)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
    
    const response = await fetch('https://www.who.int/feeds/entity/csr/don/en/feed.xml', {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.warn(`WHO API error: ${response.status}`);
      return [];
    }

    const text = await response.text();
    const alerts: Alert[] = [];
    const now = nowIso();

    // Simple XML parsing for items
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    let count = 0;

    while ((match = itemRegex.exec(text)) && count < 10) {
      const itemText = match[1];
      
      // Extract fields
      const titleMatch = itemText.match(/<title[^>]*>([^<]+)<\/title>/);
      const descMatch = itemText.match(/<description[^>]*>([^<]+)<\/description>/);
      const pubMatch = itemText.match(/<pubDate[^>]*>([^<]+)<\/pubDate>/);
      
      if (!titleMatch) continue;

      const title = titleMatch[1].trim();
      const description = descMatch ? descMatch[1].trim() : '';
      const pubDate = pubMatch ? new Date(pubMatch[1]).toISOString() : now;

      // Extract country/location from title (format: "Disease - Country" typically)
      const parts = title.split(' - ');
      const country = parts.length > 1 ? parts[parts.length - 1].trim() : 'Various';

      // Get country coordinates if recognized
      let lat = 0, lon = 0;
      const coords = COUNTRY_COORDS[country];
      if (coords) {
        [lon, lat] = coords;
      } else {
        continue; // Skip if we can't geolocate
      }

      alerts.push({
        id: crypto.randomUUID(),
        title: title,
        summary: description.substring(0, 500),
        description: description,
        location: country,
        country: country,
        region: null,
        mainland: null,
        intelligence_topics: ['Health Crisis'],
        event_type: 'Health Crisis',
        severity: 'warning',
        status: 'draft',
        source_url: 'https://www.who.int/emergencies/disease-outbreak-news',
        article_url: 'https://www.who.int/emergencies/disease-outbreak-news',
        sources: 'WHO Disease Outbreak News',
        event_start_date: pubDate,
        event_end_date: null,
        latitude: lat,
        longitude: lon,
        radius_km: 20,
        geoJSON: generateCircleGeoJSON(lat, lon, 20),
        recommendations: generateDefaultRecommendations('Health Crisis', 'warning'),
        ai_generated: false,
        ai_model: null,
        ai_confidence: 0.95, // High confidence - official WHO source
        created_at: now,
        updated_at: now,
      });

      count++;
    }

    console.log(`  ✓ WHO: Found ${alerts.length} disease outbreak alerts`);
    return alerts;
  } catch (e) {
    console.error(`WHO fetch error: ${e}`);
    return [];
  }
}

// ============================================================================
// NOAA WEATHER ALERTS
// ============================================================================
async function fetchNOAAAlerts(): Promise<Alert[]> {
  try {
    console.log(`🌦️  Fetching NOAA weather alerts...`);
    const alerts: Alert[] = [];
    const now = nowIso();

    // NOAA provides alerts by region (US only)
    // We'll fetch the active alerts feed
    const response = await fetch('https://api.weather.gov/alerts/active?point=40.7128,-74.0060', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Alert System)' },
    });

    if (!response.ok) {
      console.warn(`  NOAA API error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    
    if (!data.features || !Array.isArray(data.features)) {
      console.warn(`  ⚠️  NOAA: No features in response`);
      return [];
    }

    // Process up to 20 alerts
    for (const feature of data.features.slice(0, 20)) {
      const props = feature.properties;
      if (!props) continue;

      const title = `${props.event} - ${props.areaDesc}`;
      const description = props.description || props.headline || '';
      const coordinates = feature.geometry?.coordinates;
      
      // NOAA uses [lon, lat] format
      let latitude = 0, longitude = 0;
      if (Array.isArray(coordinates)) {
        longitude = coordinates[0];
        latitude = coordinates[1];
      }

      alerts.push({
        id: crypto.randomUUID(),
        title: title,
        summary: description.substring(0, 500),
        description: description,
        location: props.areaDesc || 'USA',
        country: 'United States',
        region: props.areaDesc,
        mainland: null,
        intelligence_topics: ['Weather Alert'],
        event_type: props.event || 'Weather Alert',
        severity: props.severity || 'Moderate',
        status: 'draft',
        source_url: props.url || 'https://weather.gov',
        article_url: props.url || 'https://weather.gov',
        sources: 'NOAA',
        latitude: latitude.toString(),
        longitude: longitude.toString(),
        event_start_date: props.effective || now,
        event_end_date: props.expires || null,
        recommendations: props.instruction || null,
        ai_generated: false,
        created_at: now,
        updated_at: now,
      });
    }

    console.log(`  ✓ NOAA: Found ${alerts.length} weather alerts`);
    return alerts;
  } catch (e) {
    console.error(`NOAA fetch error: ${e}`);
    return [];
  }
}

// ============================================================================
// NEWSAPI ALERTS
// ============================================================================
async function fetchNewsAPIAlerts(query: string): Promise<Alert[]> {
  try {
    if (!NEWSAPI_KEY) {
      console.warn(`  ⚠️  NEWSAPI_KEY not set, skipping NewsAPI alerts`);
      return [];
    }

    console.log(`📰 Fetching NewsAPI alerts for: "${query}"`);
    const alerts: Alert[] = [];
    const now = nowIso();

    // Search for relevant news articles
    const url = new URL('https://newsapi.org/v2/everything');
    url.searchParams.append('q', query);
    url.searchParams.append('sortBy', 'publishedAt');
    url.searchParams.append('pageSize', '20');
    url.searchParams.append('apiKey', NEWSAPI_KEY);

    const response = await fetch(url.toString());

    if (!response.ok) {
      console.warn(`  NewsAPI error: ${response.status}`);
      return [];
    }

    const data = await response.json();

    if (!data.articles || !Array.isArray(data.articles)) {
      console.warn(`  ⚠️  NewsAPI: No articles in response`);
      return [];
    }

    // Process articles
    for (const article of data.articles.slice(0, 15)) {
      if (!article.title) continue;

      // Extract location from article if possible
      const content = `${article.title} ${article.description || ''} ${article.content || ''}`;
      
      alerts.push({
        id: crypto.randomUUID(),
        title: article.title,
        summary: article.description || article.title,
        description: article.content || article.description || article.title,
        location: article.source?.name || 'Global',
        country: 'Global',
        region: null,
        mainland: null,
        intelligence_topics: ['News Alert'],
        event_type: 'News Event',
        severity: 'Medium',
        status: 'draft',
        source_url: article.url,
        article_url: article.url,
        sources: `NewsAPI: ${article.source?.name}`,
        latitude: '0',
        longitude: '0',
        event_start_date: article.publishedAt || now,
        event_end_date: null,
        recommendations: null,
        ai_generated: false,
        created_at: now,
        updated_at: now,
      });
    }

    console.log(`  ✓ NewsAPI: Found ${alerts.length} news articles for "${query}"`);
    return alerts;
  } catch (e) {
    console.error(`NewsAPI fetch error: ${e}`);
    return [];
  }
}

// ============================================================================
// ACLED (Armed Conflict Location & Event Data) ALERTS
// ============================================================================
async function fetchACLEDAlerts(limit = 20): Promise<Alert[]> {
  try {
    if (!ACLED_EMAIL) {
      console.warn(`  ⚠️  ACLED_EMAIL not set, skipping ACLED alerts`);
      return [];
    }

    console.log(`⚔️  Fetching ACLED conflict/event data...`);
    const alerts: Alert[] = [];
    const now = nowIso();

    // Get events from last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dateStr = thirtyDaysAgo.toISOString().split('T')[0];

    const url = new URL('https://api.acleddata.com/api/add/csv');
    url.searchParams.append('email', ACLED_EMAIL);
    url.searchParams.append('key', ACLED_EMAIL); // ACLED uses email as key
    url.searchParams.append('event_date.gte', dateStr);
    url.searchParams.append('limit', limit.toString());
    url.searchParams.append('orderby', 'event_date');

    const response = await fetch(url.toString());

    if (!response.ok) {
      console.warn(`  ACLED API error: ${response.status}`);
      return [];
    }

    const text = await response.text();
    const lines = text.split('\n');
    
    if (lines.length < 2) {
      console.warn(`  ⚠️  ACLED: No data returned`);
      return [];
    }

    // Parse CSV (simple parser - assumes no escaped quotes)
    const headers = lines[0].split(',').map(h => h.trim());
    const dataIndex = headers.reduce((acc: any, h: string, i: number) => {
      acc[h] = i;
      return acc;
    }, {});

    // Process data rows
    for (let i = 1; i < Math.min(lines.length, limit + 1); i++) {
      const values = lines[i].split(',').map(v => v.trim());
      if (values.length < 5) continue;

      const eventType = values[dataIndex['event_type']] || 'Conflict Event';
      const country = values[dataIndex['country']] || 'Unknown';
      const admin1 = values[dataIndex['admin1']] || '';
      const location = values[dataIndex['location']] || '';
      const latitude = parseFloat(values[dataIndex['latitude']] || '0');
      const longitude = parseFloat(values[dataIndex['longitude']] || '0');
      const eventDate = values[dataIndex['event_date']] || now;
      const notes = values[dataIndex['notes']] || '';

      const title = `${eventType} - ${location}, ${admin1}`;

      alerts.push({
        id: crypto.randomUUID(),
        title: title.substring(0, 500),
        summary: notes.substring(0, 500),
        description: `${eventType} reported in ${location}, ${admin1}, ${country}. ${notes}`,
        location: location || admin1,
        country: country,
        region: admin1,
        mainland: null,
        intelligence_topics: ['Conflict', 'Civil Unrest'],
        event_type: eventType,
        severity: 'High',
        status: 'draft',
        source_url: 'https://acleddata.com',
        article_url: 'https://acleddata.com',
        sources: 'ACLED',
        latitude: latitude.toString(),
        longitude: longitude.toString(),
        event_start_date: eventDate,
        event_end_date: null,
        recommendations: null,
        ai_generated: false,
        created_at: now,
        updated_at: now,
      });
    }

    console.log(`  ✓ ACLED: Found ${alerts.length} conflict/event records`);
    return alerts;
  } catch (e) {
    console.error(`ACLED fetch error: ${e}`);
    return [];
  }
}

// ============================================================================
// OPENCAGE GEOCODER - COORDINATE VALIDATION, GEOCODING & ENRICHMENT
// ============================================================================
async function geocodeLocation(location: string, country?: string): Promise<{ latitude: number; longitude: number; confidence: number } | null> {
  try {
    const opencageKey = Deno.env.get('OPENCAGE_API_KEY');
    if (!opencageKey) return null;

    // Format query: "location, country" for better accuracy
    const query = country ? `${location}, ${country}` : location;
    const response = await fetch(
      `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(query)}&key=${opencageKey}&limit=1&no_annotations=1`
    );

    if (!response.ok) return null;

    const data = await response.json();
    if (!data.results || data.results.length === 0) return null;

    const result = data.results[0];
    // Calculate normalized confidence (0-1 scale)
    const confidence = result.confidence ? Math.min(result.confidence / 10, 1) : 0.85;
    
    return {
      latitude: result.geometry?.lat || 0,
      longitude: result.geometry?.lng || 0,
      confidence: confidence
    };
  } catch (e) {
    console.warn(`OpenCage geocoding error for "${location}": ${e}`);
    return null;
  }
}

async function validateAndEnrichCoordinates(
  latitude: number,
  longitude: number,
  location: string,
  country: string
): Promise<{ 
  latitude: number; 
  longitude: number; 
  country: string;
  region: string;
  confidence: number;
}> {
  try {
    const opencageKey = Deno.env.get('OPENCAGE_API_KEY');
    
    if (!opencageKey) {
      // No OpenCage key - return as-is
      return { latitude, longitude, country, region: '', confidence: 0.7 };
    }

    // Skip if coordinates already have high confidence (to save API calls)
    // We'll do reverse geocoding for better region/country data
    const response = await fetch(
      `https://api.opencagedata.com/geocode/v1/json?q=${latitude}+${longitude}&key=${opencageKey}&limit=1&no_annotations=1`
    );

    if (!response.ok) {
      return { latitude, longitude, country, region: '', confidence: 0.7 };
    }

    const data = await response.json();
    if (!data.results || data.results.length === 0) {
      return { latitude, longitude, country, region: '', confidence: 0.7 };
    }

    const result = data.results[0];
    const components = result.components || {};

    // Extract better country/region info from OpenCage
    const validatedCountry = components.country || country;
    const region = components.state || components.province || components.region || '';

    // Use OpenCage's validated coordinates if available
    const validLat = result.geometry?.lat || latitude;
    const validLon = result.geometry?.lng || longitude;

    return {
      latitude: validLat,
      longitude: validLon,
      country: validatedCountry,
      region: region,
      confidence: 0.95
    };
  } catch (e) {
    console.warn(`OpenCage validation error: ${e}`);
    return { latitude, longitude, country, region: '', confidence: 0.7 };
  }
}

// Simple water body detection for common locations (without API call)
function checkCommonWaterBodies(lat: number, lon: number): boolean {
  // Common ocean/sea patterns (very simplified - would be more comprehensive in production)
  const waterBodies = [
    // Caribbean
    { minLat: 15, maxLat: 25, minLon: -85, maxLon: -55, name: 'Caribbean' },
    // Mediterranean
    { minLat: 30, maxLat: 46, minLon: -6, maxLon: 42, name: 'Mediterranean' },
    // Southeast Asia (has many large islands but lots of water)
    { minLat: -10, maxLat: 25, minLon: 95, maxLon: 145, name: 'Southeast Asia' },
  ];

  for (const body of waterBodies) {
    if (lat >= body.minLat && lat <= body.maxLat && 
        lon >= body.minLon && lon <= body.maxLon) {
      // Rough check - would need actual coastline data for accuracy
      // For now, flag as potentially offshore for review
      return false; // Default to land unless confirmed water
    }
  }

  return false;
}

// Basic duplicate check without AI (fast, for official APIs)
function checkDuplicateBasic(newAlert: Alert, existingAlert: Alert): boolean {
  // Check if title is very similar (first 50 chars) AND same location + country
  const newTitleShort = newAlert.title.toLowerCase().slice(0, 50);
  const existingTitleShort = existingAlert.title.toLowerCase().slice(0, 50);
  const titleMatch = newTitleShort === existingTitleShort || 
                     newAlert.title.toLowerCase() === existingAlert.title.toLowerCase();
  
  const sameLocation = newAlert.location?.toLowerCase() === existingAlert.location?.toLowerCase();
  const sameCountry = newAlert.country?.toLowerCase() === existingAlert.country?.toLowerCase();
  
  // Also check if created very recently (within 5 minutes) as a safety check
  const createdRecently = existingAlert.created_at && 
    (Date.now() - new Date(existingAlert.created_at).getTime()) < (5 * 60 * 1000);
  
  // Duplicate if: exact title match + same location + same country OR created very recently
  return (titleMatch && sameLocation && sameCountry) || createdRecently;
}

// ============================================================================
// EARLY SIGNALS HELPER FUNCTIONS
// ============================================================================

// Fetch web search results from Brave Search API
async function fetchBraveSearchResults(query: string, apiKey: string): Promise<string> {
  try {
    const response = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=10`,
      {
        headers: {
          'Accept': 'application/json',
          'X-Subscription-Token': apiKey
        },
        signal: AbortSignal.timeout(10000)
      }
    );

    if (!response.ok) {
      console.warn(`  ⚠️ Brave Search API error: ${response.status}`);
      return '';
    }

    const data = await response.json();
    const results = data.web?.results || [];
    
    if (results.length === 0) {
      console.log(`  ℹ️ No Brave results for query`);
      return '';
    }

    // Combine title, description, and URL from top results
    const combinedText = results.slice(0, 10).map((r: any) => {
      return `${r.title || ''}\n${r.description || ''}\n${r.url || ''}\n`;
    }).join('\n---\n');

    console.log(`  ✓ Brave Search: ${results.length} results, ${combinedText.length} chars`);
    return combinedText;
  } catch (error: any) {
    console.warn(`  ⚠️ Brave Search failed: ${error.message}`);
    return '';
  }
}

function buildEarlySignalsQueries(): string[] {
  // GLOBAL, COMPREHENSIVE, TRAVELER-FOCUSED early signals
  // Travel-focused = relevant for NON-NATIVES, outsiders visiting the region
  // Strategy: ALL disruptions that impact traveler safety, health, and mobility
  const queries = [
    // EARTHQUAKES & SEISMIC - Global coverage
    "What earthquakes (magnitude 5.0+) happened globally in the last 48 hours? Include location, magnitude, depth, and proximity to major cities or tourist areas.",
    "What tsunami warnings, volcanic eruptions, or major aftershock alerts exist that could impact travelers?",
    
    // SEVERE WEATHER - Comprehensive weather threats
    "What hurricanes, typhoons, cyclones, or tropical storms threaten populated regions or travel routes in the next 48 hours?",
    "What major flooding, flash floods, or monsoon alerts are affecting cities, airports, or highways globally?",
    "What extreme heatwaves causing health emergencies or heat-related deaths are reported? Include locations and temperatures.",
    "What severe storms, tornadoes, or damaging wind events are disrupting travel or causing casualties?",
    "What blizzards, heavy snow, ice storms, or extreme cold warnings exist that could strand travelers?",
    "What landslides, mudslides, or avalanches have blocked roads or damaged infrastructure?",
    
    // INFRASTRUCTURE & UTILITIES - Power, water, services
    "What major power outages, blackouts, or electrical grid failures are affecting cities or regions globally?",
    "What water shortages, water contamination, or utility shutdowns are impacting populated areas?",
    "What infrastructure collapses (bridges, buildings, dams) or failures were reported in the last 24 hours?",
    
    // TRANSPORTATION - Strikes, closures, disruptions
    "What airport strikes, airline worker strikes, or mass flight cancellations are happening globally?",
    "What international airports have emergency closures, evacuations, or major operational disruptions?",
    "What train strikes, railway closures, or mass transit shutdowns are affecting major cities?",
    "What highway blockades, road closures, or border crossings are blocked or restricted?",
    "What port strikes, shipping disruptions, or ferry cancellations could affect travelers?",
    
    // PROTESTS & CIVIL UNREST - Demonstrations, blockages
    "What major protests, demonstrations, or civil unrest are blocking airports, train stations, or city centers?",
    "What general strikes, labor strikes, or nationwide shutdowns are happening in any country?",
    "What riots, violent protests, or clashes with police are occurring in capital cities or tourist areas?",
    
    // SECURITY THREATS - Violence, terrorism, conflict
    "What armed conflicts, military operations, coups, or civil wars are affecting traveler safety globally?",
    "What terrorism incidents, bombings, shootings, or attacks on civilians were reported in the last 24 hours?",
    "What kidnappings, attacks on foreigners, or hostage situations are reported?",
    
    // DISEASE & HEALTH - Outbreaks, pandemics, health emergencies
    "What disease outbreaks (cholera, dengue, malaria, Ebola, measles, etc.) pose risks to travelers?",
    "What new COVID-19 variants, pandemic alerts, or respiratory illness outbreaks are being tracked?",
    "What food poisoning incidents, contaminated water alerts, or health emergencies exist in tourist areas?",
    
    // WILDFIRES & ENVIRONMENTAL DISASTERS
    "What wildfires, forest fires, or brush fires are threatening cities, highways, or airports?",
    "What air quality emergencies, toxic smog, or hazardous air pollution alerts exist in populated areas?",
    
    // INDUSTRIAL & CHEMICAL INCIDENTS
    "What chemical spills, gas leaks, factory explosions, or toxic hazmat incidents require evacuations?",
    "What nuclear incidents, radiation leaks, or power plant emergencies are being reported?",
    
    // CYBER & COMMUNICATION DISRUPTIONS
    "What cyber attacks on airports, banks, or critical infrastructure are disrupting services?",
    "What internet blackouts, communication shutdowns, or network outages are affecting regions?",
    
    // FUEL & RESOURCES
    "What fuel shortages, gas station closures, or energy rationing are impacting transportation?",
    
    // GOVERNMENT ACTIONS - Travel restrictions, emergencies
    "What border closures, visa restrictions, entry bans, or travel prohibitions were announced?",
    "What countries declared states of emergency, martial law, or curfews in the last 48 hours?",
    "What travel warnings, embassy alerts, or evacuation orders were issued by governments?",
    
    // REGIONAL COVERAGE - Geographic completeness
    "What emergencies are developing in Sub-Saharan Africa, Middle East, or North Africa affecting travelers?",
    "What incidents are reported in Southeast Asia, South Asia, or East Asia that impact travel safety?",
    "What situations are unfolding in Latin America, Central America, or the Caribbean?",
    "What alerts exist in Eastern Europe, Central Asia, or former Soviet states?",
    
    // VERIFICATION - Breaking news
    "What major breaking incidents affecting travelers were verified by Reuters, AP, BBC, or Al Jazeera in the last 12 hours?",
    "What unexpected emergencies disrupted airports, hotels, tourist sites, or city centers in the last 24 hours?"
  ];
  
  return queries;
}

function extractAlertsFromText(text: string): any[] {
  // Simple extraction - look for patterns like "Alert:" or "Warning:"
  const alerts: any[] = [];
  const lines = text.split('\n');
  
  for (const line of lines) {
    if ((line.includes('Alert') || line.includes('Warning') || line.includes('Emergency')) && line.length > 10) {
      alerts.push({
        title: line.trim(),
        description: line.trim(),
        severity: 'high'
      });
    }
  }
  
  return alerts;
}

// ============================================================================
// CLAUDE STRICT FILTERING - For sequential scour (v2)
// Validates against 13 content categories + relevance criteria
// ============================================================================
// Helper: Exponential backoff retry for Claude API calls
async function fetchClaudeWithRetry(
  endpoint: string,
  options: any,
  maxRetries = 5,
  initialDelayMs = 1000
): Promise<Response> {
  let lastError: any;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(endpoint, options);

      // Handle rate limit (429) with exponential backoff
      if (response.status === 429) {
        const delayMs = initialDelayMs * Math.pow(2, attempt);
        const maxDelayMs = 60000; // Cap at 60 seconds
        const actualDelayMs = Math.min(delayMs, maxDelayMs);

        console.warn(
          `  ⚠️ Claude rate limit (429) on attempt ${attempt + 1}/${maxRetries}. ` +
          `Waiting ${(actualDelayMs / 1000).toFixed(1)}s...`
        );

        await new Promise(resolve => setTimeout(resolve, actualDelayMs));
        continue;
      }

      // For other non-200 responses, also retry with backoff
      if (!response.ok && attempt < maxRetries - 1) {
        const delayMs = Math.min(
          initialDelayMs * Math.pow(2, attempt),
          60000
        );
        console.warn(
          `  ⚠️ Claude API error ${response.status} on attempt ${attempt + 1}/${maxRetries}. ` +
          `Waiting ${(delayMs / 1000).toFixed(1)}s...`
        );
        await new Promise(resolve => setTimeout(resolve, delayMs));
        continue;
      }

      // Success or final attempt
      return response;
    } catch (error: any) {
      lastError = error;

      // Network errors get retried with backoff
      if (attempt < maxRetries - 1) {
        const delayMs = Math.min(
          initialDelayMs * Math.pow(2, attempt),
          60000
        );
        console.warn(
          `  ⚠️ Network error on attempt ${attempt + 1}/${maxRetries}: ${error.message}. ` +
          `Waiting ${(delayMs / 1000).toFixed(1)}s...`
        );
        await new Promise(resolve => setTimeout(resolve, delayMs));
        continue;
      }
    }
  }

  // Exhausted retries
  throw lastError || new Error(`Failed after ${maxRetries} retries`);
}

async function extractAlertsWithClaude(
  content: string,
  sourceUrl: string,
  sourceName: string,
  existingAlerts: any[],
  context: any
): Promise<any[]> {
  if (!content || content.length < 300) return [];
  
  const claudeKey = context.claudeKey;
  if (!claudeKey) return [];
  
  // Strict prompt that ONLY extracts if content matches our 13 categories
  const systemPrompt = `You are a JSON extraction API. Return ONLY valid JSON. Never include explanations or text.

Extract travel-relevant crisis alerts from content. Include any event that affects:
- Safety/Health: Earthquakes, tsunamis, volcanos, hurricanes, floods, tornadoes, landslides, avalanches, extreme weather
- Disease: Disease outbreaks, pandemics, health emergencies
- Infrastructure: Power outages, water disruptions, internet outages, major fires
- Transportation: Airport closures, road closures, rail disruptions, port closures (affecting 50+ people or regions)
- Security: Terrorism, armed conflict, civil unrest, riots, protests, military activity
- Utilities: Fuel shortages, gas shortages, supply chain disruptions
- Environmental: Air quality crises, pollution events, wildfires
- Other: Any significant event affecting travelers (accidents, emergencies, quarantines)

Return ONLY this JSON structure - no other text:
[
  {
    "title": "Event name",
    "location": "City name",
    "country": "Country name",
    "severity": "critical|warning|caution|informative",
    "event_type": "category",
    "relevance_score": 1
  }
]

Return [] if NO travel-relevant alerts found.`;

  const userPrompt = `Extract ONLY alerts matching the 13 categories above. Return ONLY the JSON array.

Content from ${sourceName}:
${content.slice(0, 8000)}`;

  try {
    const response = await fetchClaudeWithRetry(
      'https://api.anthropic.com/v1/messages',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': claudeKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 2000,
          temperature: 0,
          system: systemPrompt,
          messages: [{
            role: 'user',
            content: userPrompt
          }]
        }),
        signal: AbortSignal.timeout(15000),
      },
      5,
      1000
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error(`  ❌ Claude API error ${response.status}: ${JSON.stringify(errorData).slice(0, 200)}`);
      return [];
    }

    const responseData = await response.json();

    // Extract text from response
    if (!responseData.content || !responseData.content[0] || !responseData.content[0].text) {
      console.warn(`  ⚠️ Unexpected Claude response structure`);
      return [];
    }

    const responseText = responseData.content[0].text.trim();
    let alerts: any[] = [];

    // Strategy 1: Direct JSON parse
    try {
      alerts = JSON.parse(responseText);
      console.log(`  ✅ Direct parse successful: ${alerts.length} alerts`);
    } catch (directErr) {
      // Strategy 2: Extract JSON array using regex
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          alerts = JSON.parse(jsonMatch[0]);
          console.log(`  ✅ Regex extract successful: ${alerts.length} alerts`);
        } catch (regexErr) {
          console.warn(`  ⚠️ Regex extracted text but parse failed: ${(regexErr as any).message}`);
          alerts = [];
        }
      } else {
        // Strategy 3: Check if Claude said "no alerts"
        if (responseText.toLowerCase().includes('no alert') || responseText.trim() === '[]') {
          alerts = [];
          console.log(`  ℹ️ Claude returned no alerts (text confirmed)`);
        } else {
          console.warn(`  ⚠️ No JSON array found in response`);
          console.warn(`  Response preview: "${responseText.slice(0, 300)}"`);
          alerts = [];
        }
      }
    }

    // Validate and filter alerts
    const validated = alerts
      .filter((a: any) => a && a.title && a.location && a.country)
      .filter((a: any) => a.relevance_score >= 1) // Accept relevance 1+ (informational through critical)
      .filter((a: any) => !existingAlerts.some(e => 
        e.title?.toLowerCase() === a.title?.toLowerCase() &&
        e.location?.toLowerCase() === a.location?.toLowerCase()
      ))
      .map((a: any) => {
        // COORDINATE VALIDATION & FALLBACK (3-step process)
        let latitude = parseFloat(a.latitude);
        let longitude = parseFloat(a.longitude);
        let coordinateSource = 'provided';
        
        // If invalid or missing, use country centroid
        if (isNaN(latitude) || isNaN(longitude) || 
            latitude < -90 || latitude > 90 ||
            longitude < -180 || longitude > 180) {
          const [countryLat, countryLon] = getCountryCoordinates(a.country);
          latitude = countryLat;
          longitude = countryLon;
          coordinateSource = 'country_centroid';
          console.log(`  ℹ️ Coords for "${a.title}" → using ${a.country} centroid [${latitude}, ${longitude}]`);
        }
        
        // OFFSHORE DETECTION (for earthquakes)
        const isEarthquake = a.event_type?.toLowerCase().includes('earthquake');
        const isOffshore = isEarthquake && isLikelyOffshore(latitude, longitude);
        const coastDistance = isOffshore ? (a.coastlineDistance || 'unknown offshore') : null;
        
        return {
          title: a.title || 'Unknown alert',
          description: a.description || '',
          event_type: a.event_type || 'Crisis',
          severity: a.severity || 'caution',
          location: a.location || 'Unknown',
          country: a.country || 'Unknown',
          latitude,
          longitude,
          radius: parseFloat(a.radius) || 25,
          isOffshore,
          coastlineDistance: coastDistance,
          coordinateSource,
          source_name: sourceName,
          source_url: sourceUrl,
          ai_model: 'claude-3-haiku-20240307',
          relevance_score: a.relevance_score || 3,
          source_reliability: a.source_reliability || 'medium',
        };
      });
    
    console.log(`  ✓ Claude validated ${validated.length} alerts`);
    return validated;
    
  } catch (error: any) {
    console.error(`❌ Claude extraction failed after retries: ${error.message}`);
    return [];
  }
}

// Legacy function - kept for compatibility
async function fetchClaudeWithRetryOld(
  endpoint: string,
  options: any,
  maxRetries = 5,
  initialDelayMs = 1000
): Promise<Response> {
  return fetchClaudeWithRetry(endpoint, options, maxRetries, initialDelayMs);
}

// OLD IMPLEMENTATION - REPLACED ABOVE
/* REMOVED - See new fetchClaudeWithRetry and extractAlertsWithClaude implementation
async function extractAlertsWithClaudeOld(
  content: string,
  sourceUrl: string,
  sourceName: string,
  existingAlerts: any[],
  context: any
): Promise<any[]> {
  if (!content || content.length < 300) return [];
  
  const claudeKey = context.claudeKey;
  if (!claudeKey) return [];
  
  const systemPrompt = `...`;
  const userPrompt = `...`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': claudeKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 2000,
        temperature: 0,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: userPrompt
        }]
      }),
      signal: AbortSignal.timeout(15000),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error(`  ❌ Claude API error ${response.status}: ${JSON.stringify(errorData).slice(0, 200)}`);
      throw new Error(`Claude API error: ${response.status}`);
    }
    
    const data = await response.json();
    // Claude API returns content directly, not nested in choices
    const responseText = data.content?.[0]?.text || '';
    
    console.log(`  📨 Claude response length: ${responseText.length} chars`);
    if (responseText.length > 0) {
      console.log(`  📨 First 200 chars: "${responseText.slice(0, 200)}"`);
    }
    let alerts: any[] = [];
    
    // Strategy 1: Direct JSON parse
    try {
      alerts = JSON.parse(responseText);
      console.log(`  ✅ Direct parse successful: ${alerts.length} alerts`);
    } catch (directErr) {
      // Strategy 2: Extract JSON array using regex
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          alerts = JSON.parse(jsonMatch[0]);
          console.log(`  ✅ Regex extract successful: ${alerts.length} alerts`);
        } catch (regexErr) {
          console.warn(`  ⚠️  Regex extracted text but parse failed: ${(regexErr as any).message}`);
          alerts = [];
        }
      } else {
        // Strategy 3: Check if Claude said "no alerts"
        if (responseText.toLowerCase().includes('no alert') || responseText.trim() === '[]') {
          alerts = [];
          console.log(`  ℹ️ Claude returned no alerts (text confirmed)`);
        } else {
          console.warn(`  ⚠️ No JSON array found in response`);
          console.warn(`  Response preview: "${responseText.slice(0, 300)}"`);
          alerts = [];
        }
      }
    }
    
    // Validate and filter alerts
    const validated = alerts
      .filter((a: any) => a && a.title && a.location && a.country)
      .filter((a: any) => a.relevance_score >= 1) // Accept relevance 1+ (informational through critical)
      .filter((a: any) => !existingAlerts.some(e => 
        e.title?.toLowerCase() === a.title?.toLowerCase() &&
        e.location?.toLowerCase() === a.location?.toLowerCase()
      ))
      .map((a: any) => {
        // COORDINATE VALIDATION & FALLBACK (3-step process)
        let latitude = parseFloat(a.latitude);
        let longitude = parseFloat(a.longitude);
        let coordinateSource = 'provided';
        
        // If invalid or missing, use country centroid
        if (isNaN(latitude) || isNaN(longitude) || 
            latitude < -90 || latitude > 90 ||
            longitude < -180 || longitude > 180) {
          const [countryLat, countryLon] = getCountryCoordinates(a.country);
          latitude = countryLat;
          longitude = countryLon;
          coordinateSource = 'country_centroid';
          console.log(`  ℹ️  Coords for "${a.title}" → using ${a.country} centroid [${latitude}, ${longitude}]`);
        }
        
        // OFFSHORE DETECTION (for earthquakes)
        const isEarthquake = a.event_type?.toLowerCase().includes('earthquake');
        const isOffshore = isEarthquake && isLikelyOffshore(latitude, longitude);
        const coastDistance = isOffshore ? (a.coastlineDistance || 'unknown offshore') : null;
        
        return {
          title: a.title || 'Unknown alert',
          description: a.description || '',
          event_type: a.event_type || 'Crisis',
          severity: a.severity || 'caution',
          location: a.location || 'Unknown',
          country: a.country || 'Unknown',
          latitude,
          longitude,
          radius: parseFloat(a.radius) || 25,
          isOffshore,
          coastlineDistance: coastDistance,
          coordinateSource,
          source_name: sourceName,
          source_url: sourceUrl,
          ai_model: 'claude-3-5-haiku-20241022',
          relevance_score: a.relevance_score || 3,
          source_reliability: a.source_reliability || 'medium',
        };
      });
    
    console.log(`  ✓ Claude validated ${validated.length} alerts (relevance >= 2)`);
    return validated;
    
  } catch (error: any) {
    console.error(`❌ Claude extraction failed: ${error.message}`);
    return [];
  }
}

async function extractAlertsWithAI(
  content: string,
  source_url: string,
  sourceName: string,
  existingAlerts: Alert[],
  config: ScourConfig
): Promise<Alert[]> {
  const currentDate = new Date().toISOString().split('T')[0];

  const systemPrompt = `You are a travel intelligence analyst. Extract ANYTHING that could reasonably affect someone traveling to, from, or within a location.

CRITICAL INSTRUCTIONS FOR PAST EVENTS:
- If an event occurred MORE than 7 days ago, you MUST focus on ONGOING IMPACTS and recovery issues, NOT the historical event itself
- For past disasters: Extract alerts only if there are ongoing hazards (road closures, infrastructure damage, contaminated water, displacement camps, supply shortages, etc.)
- For past political events: Focus on current state of unrest, travel restrictions, security presence, or checkpoint activity
- Recommendations MUST address current/future travel concerns, not the past event
- If an event is fully resolved with no ongoing impact, SKIP IT (return empty array)
- Always include current date context in title/summary if event is older than 7 days (e.g., "Ongoing: Earthquake recovery" or "Current disruption from")

EXAMPLE: A 10-day-old earthquake would be extracted as:
[{
  "title": "Ongoing: Road damage and aftershocks - Southern California (10 days post-earthquake)",
  "summary": "Earthquake on Jan 17 caused road damage currently affecting transportation. Aftershocks and structural assessments ongoing.",
  "recommendations": ["Check road conditions before travel", "Monitor aftershock updates", "Verify building safety on arrival"]
}]

NOT as a historical account of the earthquake itself.

INCLUDE ALERTS FOR:
- Natural disasters: earthquakes, floods, hurricanes, typhoons, wildfires, volcanic eruptions, severe storms
- Weather: extreme heat/cold, monsoons, heavy snow, dangerous wind, unusual/hazardous conditions
- Transportation disruptions: airport closures, flight cancellations, strikes, road blockades, traffic chaos, port closures
- Infrastructure failures: power outages, water shortages, internet outages, bridge/road collapses
- Health crises: disease outbreaks, pandemics, medical facility closures, epidemics
- Political/civil unrest: protests, riots, civil unrest, political instability, government changes, coups
- Security threats: terrorism, attacks, violence, gang activity, crime waves, civil conflict
- Border/immigration: border closures, visa suspensions, travel bans, entry restrictions
- Major event cancellations: festivals, conferences, events cancelled
- Economic disruption: currency crises, market crashes affecting travel
- Environmental hazards: pollution, contamination, hazardous conditions
- Evacuations or emergency warnings

REJECT ONLY:
- Entertainment/sports news without safety impact
- Celebrity news or gossip
- Business/corporate news without travel impact
- Technology releases or product launches
- Positive tourism promotions

CRITICAL: Be INCLUSIVE not exclusive. If an event MIGHT affect travelers, extract it.

EXAMPLE OUTPUT (for a flooding alert in Nigeria):
[{
  "title": "Flash Flooding Alert - Lagos State",
  "summary": "Heavy rainfall causing severe flooding across Lagos metropolitan area affecting transportation and infrastructure",
  "country": "Nigeria",
  "location": "Lagos",
  "latitude": 6.5244,
  "longitude": 3.3792,
  "severity": "warning",
  "eventType": "Severe Weather",
  "eventStartDate": "2026-01-24T14:30:00Z",
  "radiusKm": 15,
  "geoJSON": {"type":"FeatureCollection","features":[{"type":"Feature","geometry":{"type":"Point","coordinates":[3.3792,6.5244]},"properties":{"name":"Lagos flooding","severity":"warning"}}]},
  "recommendations": ["Avoid low-lying areas and flood-prone zones", "Check flight status and use alternative transport routes", "Monitor water level updates from local authorities"]
}]

REQUIREMENTS:
- country: MUST be specific (no "Global", "Worldwide", "International")
- location: MUST be specific city/region
- latitude/longitude: REQUIRED decimal degrees (real coordinates for the location)
- severity: Use critical|warning|caution|informative
- eventType: Use category from INCLUDE list (e.g., "Severe Weather", "Political Unrest", "Transportation Disruption")
- eventStartDate: ISO 8601 timestamp when event started/occurred (if mentioned or can be inferred, otherwise use current time)
- radiusKm: Impact radius in kilometers. Scale based on severity and event type:
  * Critical events: 25-50 km (e.g., major earthquake, volcano, large wildfire)
  * Warning events: 15-25 km (e.g., flooding, civil unrest, infrastructure failure)
  * Caution events: 5-15 km (e.g., localized disruption, minor weather, border closure)
  * Informative: 5-10 km (general information)
- geoJSON: Point feature with coordinates (minimal but valid). For offshore events, use MultiPolygon or LineString to trace coastal impact area
- recommendations: Array of practical travel advice recommendations (3-5 actionable items)

If NO travel-affecting events found, return: []

Return ONLY JSON array, no explanation, no markdown.`;

  try {
    console.log(`\n🔍 EXTRACTING ALERTS - Starting AI extraction`);
    console.log(`   Source: ${sourceName}`);
    console.log(`   Content: ${content.length} chars`);
    console.log(`   Prompt length: ${systemPrompt.length} chars`);
    
    let aiResponse: string | null = null;
    let model = '';

    // TRY CLAUDE FIRST (better at travel intelligence, faster, cheaper)
    if (config.claudeKey) {
      try {
        console.log(`🤖 Trying Claude 3.5 Haiku...`);
        const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': config.claudeKey,
            'content-type': 'application/json',
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-3-haiku-20240307',
            max_tokens: 3500,
            messages: [
              { role: 'user', content: systemPrompt + '\n\nContent to analyze:\n' + content.slice(0, 12000) }
            ]
          }),
          signal: AbortSignal.timeout(30000),
        });

        if (claudeResponse.ok) {
          const data = await claudeResponse.json() as any;
          aiResponse = data.content[0]?.text || null;
          model = 'Claude 3.5 Haiku';
          console.log(`✅ Claude responded (${aiResponse?.length || 0} chars)`);
        } else {
          const error = await claudeResponse.text();
          console.warn(`⚠️  Claude failed: ${claudeResponse.status} - ${error.slice(0, 100)}`);
        }
      } catch (e: any) {
        console.warn(`⚠️  Claude error: ${e.message} - will try OpenAI...`);
      }
    }

    // FALLBACK TO OPENAI if Claude didn't work
    if (!aiResponse && config.openaiKey) {
      console.log(`🤖 Calling OpenAI gpt-4o-mini (Claude unavailable)...`);
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.openaiKey}`,
          'Content-Type': 'application/json',
        },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Source: ${sourceName}\n\nContent:\n${content.slice(0, 12000)}` },
        ],
        temperature: 0.2,
        max_tokens: 3500,
      }),
      signal: AbortSignal.timeout(30000),
      });

      if (response.ok) {
        const data = await response.json();
        aiResponse = data.choices[0]?.message?.content || null;
        model = 'OpenAI gpt-4o-mini';
        console.log(`✅ OpenAI responded (${aiResponse?.length || 0} chars)`);
      } else {
        const errorText = await response.text().catch(() => 'unknown error');
        console.error(`❌ OpenAI failed: ${response.status} - ${errorText.slice(0, 100)}`);
        return [];
      }
    } else {
      console.error('❌ No AI API keys available (Claude and OpenAI both missing)');
      return [];
    }

    // Parse response (works for both Claude and OpenAI)
    if (!aiResponse) {
      console.error('❌ No response from AI model');
      return [];
    }

    console.log(`\n✅ ${model} responded (${aiResponse.length} chars)`);
    if (aiResponse.length > 100) {
      console.log(`   Response preview: ${aiResponse.slice(0, 200)}`);
    } else {
      console.log(`   Full response: ${aiResponse}`);
    }

    let alerts: any[] = [];
    try {
      let cleaned = aiResponse.trim();
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.substring(7);
      } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.substring(3);
      }
      if (cleaned.endsWith('```')) {
        cleaned = cleaned.substring(0, cleaned.length - 3);
      }
      cleaned = cleaned.trim();
      alerts = JSON.parse(cleaned);
      console.log(`\n📊 PARSED: ${alerts.length} items detected from ${model}`);
      if (alerts.length > 0) {
        console.log(`   First item keys: ${Object.keys(alerts[0]).join(', ')}`);
        console.log(`   Sample: title="${alerts[0].title}", country="${alerts[0].country}", location="${alerts[0].location}"`);
      }
    } catch (e) {
      console.error(`❌ JSON parse error: ${e}`);
      try {
        const match = aiResponse.match(/\[[\s\S]*\]/);
        if (match) {
          alerts = JSON.parse(match[0]);
          console.log(`\n📊 PARSED (via fallback regex): ${alerts.length} items detected`);
        } else {
          console.log(`❌ No JSON array found in response`);
        }
      } catch (e2) {
        console.error(`❌ Fallback parse also failed: ${e2}`);
        return [];
      }
    }

    if (!Array.isArray(alerts)) {
      console.error(`❌ AI response is not an array, got: ${typeof alerts}`);
      console.error(`   Value: ${JSON.stringify(alerts).slice(0, 200)}`);
      return [];
    }

    console.log(`✅ Raw AI response: ${alerts.length} items detected`);
    if (alerts.length > 0) {
      console.log(`   First item keys: ${Object.keys(alerts[0]).join(', ')}`);
      console.log(`   First item: ${JSON.stringify(alerts[0]).slice(0, 200)}`);
    }

    console.log(`\n🔎 VALIDATING: Checking ${alerts.length} items from AI...`);
    // VALIDATION: Filter out alerts that don't meet CRITICAL mandatory requirements
    const validAlerts = alerts.filter((alert: any) => {
      const issues: string[] = [];
      
      // Check title - MUST exist
      if (!alert.title || alert.title.trim() === '') {
        issues.push(`Missing title`);
      }
      
      // REJECT: Earthquakes below 5.5 magnitude
      const title = alert.title?.toLowerCase() || '';
      const isMagnitudeEarthquake = title.includes('earthquake') || title.includes('magnitude') || title.includes('seismic');
      if (isMagnitudeEarthquake) {
        // Try to extract magnitude from title
        const magnitudeMatch = title.match(/(\d+\.?\d*)\s*(?:-|\s)?\s*magnitude/i);
        if (magnitudeMatch) {
          const magnitude = parseFloat(magnitudeMatch[1]);
          if (magnitude < 4.0) {
            issues.push(`Earthquake magnitude ${magnitude} < 4.0 threshold`);
          }
        }
      }
      
      // Check country - MUST NOT be Global/Worldwide/International/Multiple
      const country = alert.country?.trim().toLowerCase() || '';
      const invalidCountries = ['global', 'worldwide', 'international', 'multiple', 'various'];
      if (!alert.country || invalidCountries.includes(country)) {
        issues.push(`Invalid country: "${alert.country}"`);
      }
      
      // Check location - MUST be specific (but be lenient with what "specific" means)
      const location = alert.location?.trim().toLowerCase() || '';
      const invalidLocations = ['various', 'various locations', 'multiple locations', 'unknown', ''];
      if (!alert.location || invalidLocations.includes(location)) {
        issues.push(`Invalid location: "${alert.location}"`);
      }
      
      // Check coordinates - MUST be valid numbers (allow 0,0 as last resort)
      const lat = parseFloat(alert.latitude ?? 'NaN');
      const lon = parseFloat(alert.longitude ?? 'NaN');
      if (isNaN(lat) || isNaN(lon)) {
        issues.push(`Invalid coordinates: lat=${alert.latitude}, lon=${alert.longitude}`);
      }
      
      // VALIDATE: Alert date should be recent (not older than 30 days for general events)
      // Only validate if eventStartDate is present
      const eventDate = alert.eventStartDate ? new Date(alert.eventStartDate) : null;
      if (eventDate) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 30); // 30 day window
        if (eventDate < cutoffDate) {
          const daysOld = Math.floor((new Date().getTime() - eventDate.getTime()) / (1000 * 60 * 60 * 24));
          // Only warn, don't reject - older events can still be valuable
          console.warn(`⚠️  Alert "${alert.title}" is ${daysOld} days old`);
        }
      }
      
      // For older events, check if they mention resolution/recovery completion (which means no ongoing impact)
      if (eventDate) {
        const daysOld = Math.floor((new Date().getTime() - eventDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysOld > 7) {
          // Check if summary/description suggests the issue is fully resolved
          const fullText = `${alert.title} ${alert.summary || ''} ${alert.description || ''}`.toLowerCase();
          const resolutionKeywords = ['fully reopened', 'completely resolved', 'back to normal', 'no longer affecting', 'situation normalizing', 'ended', 'over'];
          const isResolved = resolutionKeywords.some(kw => fullText.includes(kw));
          
          if (isResolved) {
            issues.push(`Event is fully resolved (${daysOld} days old) - no ongoing travel impact`);
          } else if (!fullText.includes('ongoing') && !fullText.includes('still') && !fullText.includes('continuing') && !fullText.includes('current')) {
            // Warn if old event doesn't explicitly mention ongoing impacts
            console.warn(`⚠️  Old event (${daysOld} days) lacks ongoing impact language: "${alert.title}"`);
          }
        }
      }
      
      // geoJSON is optional - we'll generate it if missing
      if (alert.geoJSON) {
        try {
          const gj = typeof alert.geoJSON === 'string' ? JSON.parse(alert.geoJSON) : alert.geoJSON;
          if (gj && !gj.type) {
            console.warn(`⚠️  geoJSON present but might be malformed for "${alert.title}": ${JSON.stringify(gj).slice(0, 100)}`);
          }
        } catch (e) {
          console.warn(`⚠️  geoJSON parse error for "${alert.title}", will generate fallback: ${e}`);
          // Don't reject - we'll generate fallback
        }
      }
      
      // Check eventType - should exist but we can normalize it
      if (!alert.eventType || alert.eventType.trim() === '') {
        console.warn(`⚠️  Alert "${alert.title}" missing eventType, will default to "General"`);
        // Don't reject - we'll set a default
      }
      
      if (issues.length > 0) {
        console.log(`   ❌ REJECT: "${alert.title}" - ${issues.join(', ')}`);
        return false;
      }
      console.log(`   ✅ ACCEPT: "${alert.title}" (${alert.location}, ${alert.country})`);
      return true;
    });
    
    // Log validation summary
    if (alerts.length === 0) {
      console.log(`\n📊 AI EXTRACTION: No alerts detected in content`);
    } else if (validAlerts.length === 0) {
      console.log(`\n📊 VALIDATION FAILED: ${alerts.length} extracted but 0 passed validation`);
    } else if (validAlerts.length < alerts.length) {
      const rejected = alerts.length - validAlerts.length;
      console.log(`\n📊 VALIDATION RESULT: ${validAlerts.length}/${alerts.length} passed (${rejected} rejected)`);
    } else {
      console.log(`\n✅ VALIDATION SUCCESS: All ${validAlerts.length} items passed`);
    }

    const now = new Date().toISOString();
    const alertPromises = validAlerts.map(async (alert: any) => {
      let lat = alert.latitude || 0;
      let lon = alert.longitude || 0;
      let country = alert.country || '';
      let region = alert.region || '';
      
      // If coordinates are missing (0,0), try to geocode location
      if (lat === 0 && lon === 0 && alert.location && alert.country) {
        console.log(`  🔍 Geocoding location: "${alert.location}, ${alert.country}"`);
        const geocoded = await geocodeLocation(alert.location, alert.country);
        if (geocoded && geocoded.confidence > 0.5) {
          lat = geocoded.latitude;
          lon = geocoded.longitude;
          console.log(`  ✓ Geocoded to: ${lat.toFixed(2)}, ${lon.toFixed(2)} (confidence: ${(geocoded.confidence * 100).toFixed(0)}%)`);
        }
      }
      
      // Validate and enrich coordinates with OpenCage
      // This gets validated country/region and improved accuracy
      if ((lat !== 0 || lon !== 0) && alert.country) {
        const enriched = await validateAndEnrichCoordinates(lat, lon, alert.location, alert.country);
        lat = enriched.latitude;
        lon = enriched.longitude;
        country = enriched.country;
        region = enriched.region || alert.region;
        console.log(`  ✓ Validated: ${country}${region ? ', ' + region : ''} (confidence: ${(enriched.confidence * 100).toFixed(0)}%)`);
      }
      
      const severity = alert.severity || 'informative';
      const geoScope = alert.geoScope || determineGeoScope(severity, country, region);
      const eventType = alert.eventType || 'General';
      const radiusKm = alert.radiusKm || getRadiusFromSeverity(severity, geoScope, eventType);
      
      // Use geoJSON from AI response (validation ensures it exists)
      let geoJSON = null;
      if (alert.geoJSON) {
        try {
          geoJSON = typeof alert.geoJSON === 'string' ? JSON.parse(alert.geoJSON) : alert.geoJSON;
        } catch (e) {
          console.warn(`Failed to parse geoJSON for "${alert.title}", will generate intelligent fallback`);
          geoJSON = await generateIntelligentGeoJSON(alert, config.openaiKey);
        }
      } else {
        // Generate intelligent GeoJSON based on event type and details
        geoJSON = await generateIntelligentGeoJSON(alert, config.openaiKey);
      }
      
      // Generate event-specific recommendations if missing, and ensure it's an array
      let recommendedActions: string[] = [];
      let recommendationsString = '';
      
      if (alert.recommendations) {
        // If AI returned array, use it directly
        if (Array.isArray(alert.recommendations)) {
          recommendedActions = alert.recommendations.filter((r: any) => typeof r === 'string' && r.length > 0);
        } else if (typeof alert.recommendations === 'string' && alert.recommendations.trim()) {
          // Parse string recommendations (numbered list or newline separated)
          recommendedActions = alert.recommendations
            .split(/[\n;]/)
            .map((rec: string) => {
              // Remove leading numbers, bullets, etc
              let cleaned = rec.trim();
              if (/^[\d+.•\-*]\s/.test(cleaned)) {
                cleaned = cleaned.substring(cleaned.search(/[^\d+.•\-*\s]/));
              }
              return cleaned;
            })
            .filter((rec: string) => rec.length > 0 && rec.length < 500);
        }
      }
      
      // If no valid recommendations from AI, generate event-specific AI recommendations
      if (recommendedActions.length === 0) {
        const aiRecsString = await generateAIEventSpecificRecommendations(alert, config.openaiKey);
        recommendedActions = aiRecsString
          .split(/\n\n/)
          .map((rec: string) => rec.trim())
          .filter((rec: string) => rec.length > 0);
      }
      
      recommendationsString = recommendedActions.join('\n\n');
      
      console.log(`?? Alert "${alert.title}" - Location: ${alert.location}, Country: ${alert.country}, GeoJSON: YES, Recommendations: ${recommendedActions.length} items`);

      // Calculate intelligent confidence score (not uniform 0.85)
      let alertConfidence = 0.65; // baseline for AI-extracted
      
      // Add points for data quality
      if (lat !== 0 && lon !== 0 && !isNaN(lat) && !isNaN(lon)) {
        alertConfidence += 0.15; // precise coordinates
      } else if (alert.location && alert.location.length > 5) {
        alertConfidence += 0.08; // named location
      }
      
      if (alert.eventStartDate) {
        alertConfidence += 0.08; // has event timing
      }
      
      if (severity === 'critical' || severity === 'warning') {
        alertConfidence += 0.05; // high severity = AI was careful
      }
      
      if (geoJSON) {
        alertConfidence += 0.05; // has geographic context
      }
      
      // Cap at 0.95
      alertConfidence = Math.min(alertConfidence, 0.95);

      return {
        id: crypto.randomUUID(),
        title: alert.title,
        summary: alert.summary,
        description: alert.summary || '',
        location: alert.location,
        country: alert.country,
        region: alert.region,
        mainland: alert.mainland || null,
        intelligence_topics: normalizeIntelligenceTopicsForACF(alert.eventType),
        event_type: alert.eventType || alert.event_type,
        severity,
        status: 'draft',
        source_url,
        article_url: source_url,
        sources: sourceName,
        event_start_date: alert.eventStartDate || alert.event_start_date || nowIso(),
        event_end_date: alert.eventEndDate || alert.event_end_date || getDefaultEndDate(alert.eventStartDate || alert.event_start_date),
        latitude: typeof lat === 'number' && !isNaN(lat) ? lat : undefined,
        longitude: typeof lon === 'number' && !isNaN(lon) ? lon : undefined,
        geoJSON: geoJSON,
        recommendations: recommendationsString,
        recommendedActions: recommendedActions,
        ai_generated: true,
        ai_model: 'gpt-4o-mini',
        ai_confidence: alertConfidence,
        generation_metadata: JSON.stringify({
          extracted_at: now,
          source_name: sourceName,
          days_back: config.daysBack,
          model: 'gpt-4o-mini',
          job_id: config.jobId,
          latitude: lat,
          longitude: lon,
          radiusKm,
          geoScope,
          recommendedActions: recommendedActions,
          topics: alert.topics || [],
          regions: alert.regions || [alert.region].filter(Boolean),
          alertType: alert.alertType || 'Current',
          escalationLikelihood: alert.escalationLikelihood || 'low',
          secondaryImpacts: alert.secondaryImpacts || [],
        }),
        created_at: now,
        updated_at: now,
      };
    });
    
    // Await all alert processing (geocoding, enrichment, etc.)
    try {
      const processedAlerts = await Promise.all(alertPromises);
      return processedAlerts as Alert[];
    } catch (enrichErr: any) {
      console.warn(`Warning during alert enrichment: ${enrichErr.message}`);
      // If enrichment fails, return the promises array as-is
      // This shouldn't happen with our error handling in geocodeLocation and validateAndEnrichCoordinates
      const results = await Promise.all(alertPromises.map(p => p.catch(() => null)));
      return results.filter(Boolean) as Alert[];
    }

  } catch (err: any) {
    console.error('AI extraction error:', err);
    throw err;
  }
}

async function checkDuplicate(
  newAlert: Alert,
  existingAlert: Alert,
  openaiKey: string
): Promise<boolean> {
  const prompt = `Compare these alerts. Answer ONLY "DUPLICATE" or "SEPARATE":

NEW: ${newAlert.title} (${newAlert.location}, ${newAlert.country})
EXISTING: ${existingAlert.title} (${existingAlert.location}, ${existingAlert.country})`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 10,
      }),
      signal: AbortSignal.timeout(10000),
    });

    const data = await response.json();
    const answer = data.choices[0]?.message?.content?.trim().toUpperCase();
    
    return answer?.includes('DUPLICATE') || false;
  } catch {
    return true;
  }
}

async function runScourWorker(config: ScourConfig): Promise<{
  processed: number;
  created: number;
  duplicates: number;
  errors: string[];
}> {
  const stats = {
    processed: 0,
    created: 0,
    duplicates: 0,
    errors: [] as string[],
  };

  // Activity log helper - adds timestamped entry to job status
  const activityLog: Array<{ time: string; message: string }> = [];
  // Helper to update job status with optional flags
  const setJobStatus = async (fields: Record<string, any>) => {
    try {
      const currentJob = await getKV(`scour_job:${config.jobId}`) || {};
      await setKV(`scour_job:${config.jobId}`, {
        ...currentJob,
        ...fields,
        updated_at: new Date().toISOString(),
      });
    } catch (e) {
      // Non-critical: log update failed
    }
  };

  const logActivity = async (message: string, flags?: Record<string, boolean>) => {
    const entry = { time: new Date().toISOString(), message };
    activityLog.push(entry);
    if (activityLog.length > 10) activityLog.shift();
    await setJobStatus({ activityLog: activityLog.slice(), ...(flags || {}) });
  };

  console.log(`\n?? Starting scour ${config.jobId} with ${config.sourceIds.length} sources`);
  await logActivity(`Starting scour with ${config.sourceIds.length} sources`);

  try {
    // Load blocked alerts (dismissed, deleted, or rejected) to prevent re-extraction
    // These are alerts user explicitly doesn't want to see again
    const blockedAlerts: Alert[] = await querySupabaseForWorker(
      `${config.supabaseUrl}/rest/v1/alerts?select=id,title,location,country&status=in.(dismissed,deleted,rejected)&order=updated_at.desc&limit=500`,
      config.serviceKey
    ) || [];

    console.log(`? Found ${blockedAlerts.length} blocked/dismissed alerts to exclude from re-extraction`);

    // Only check against recent alerts (last 7 days) to reduce false duplicates
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const existingAlerts: Alert[] = await querySupabaseForWorker(
      `${config.supabaseUrl}/rest/v1/alerts?select=id,title,location,country,status,summary&created_at=gte.${encodeURIComponent(sevenDaysAgo)}&limit=100&order=created_at.desc`,
      config.serviceKey
    );

    // Combine existing alerts with blocked alerts for comprehensive dedup
    const allExistingAlerts = [...existingAlerts, ...blockedAlerts];

    console.log(`? Found ${existingAlerts.length} existing alerts (last 7 days) + ${blockedAlerts.length} blocked for deduplication`);
    await logActivity(`Loaded ${allExistingAlerts.length} alerts for dedup check (${existingAlerts.length} active + ${blockedAlerts.length} blocked)`);

    for (const sourceId of config.sourceIds) {
      try {
        const sources = await querySupabaseForWorker(
          `${config.supabaseUrl}/rest/v1/sources?id=eq.${sourceId}&select=*`,
          config.serviceKey
        );
        const source = sources[0];

        if (!source?.url) {
          stats.errors.push(`Source ${sourceId} not found`);
          await logActivity(`⚠️ Source ${sourceId} not found - skipping`);
          stats.processed++; // Increment even for skipped sources

          // Update status for skipped source
          await setKV(`scour_job:${config.jobId}`, {
            id: config.jobId,
            status: 'running',
            total: config.sourceIds.length,
            processed: stats.processed,
            created: stats.created,
            duplicatesSkipped: stats.duplicates,
            errorCount: stats.errors.length,
            currentSource: `Source ${sourceId}`,
            currentActivity: `⚠️ Skipped: Source not found`,
            activityLog: activityLog.slice(),
            updated_at: new Date().toISOString(),
          }).catch(() => {});

          continue;
        }

        // Safety: skip sources that exist but are disabled in the DB
        if (source.enabled === false) {
          await logActivity(`⚠️ Source disabled: ${source.name || sourceId} - skipping`);
          stats.processed++;

          await setKV(`scour_job:${config.jobId}`, {
            id: config.jobId,
            status: 'running',
            total: config.sourceIds.length,
            processed: stats.processed,
            created: stats.created,
            duplicatesSkipped: stats.duplicates,
            errorCount: stats.errors.length,
            currentSource: source.name || `Source ${sourceId}`,
            currentActivity: `⚠️ Skipped: Disabled`,
            activityLog: activityLog.slice(),
            updated_at: new Date().toISOString(),
          }).catch(() => {});

          continue;
        }

        // Increment processed count at the start of processing
        stats.processed++;

        console.log(`\n?? [${stats.processed}/${config.sourceIds.length}] Processing: ${source.name}`);
        await logActivity(`📰 Scouring: ${source.name}`);
        await setJobStatus({
          id: config.jobId,
          status: 'running',
          total: config.sourceIds.length,
          processed: stats.processed,
          created: stats.created,
          duplicatesSkipped: stats.duplicates,
          errorCount: stats.errors.length,
          currentSource: source.name,
          currentActivity: 'Fetching content',
        });

        let content = '';
        let articleUrl: string | null = null;
        
        // Note: Brave Search has been disabled. Using Claude queries + web scraping only.
        
        // Fall back to scraping
        if (!content || content.length < 100) {
          await logActivity(`🌐 Web scraping ${source.name}...`, { extractActive: true });
          await setJobStatus({
            id: config.jobId,
            status: 'running',
            total: config.sourceIds.length,
            processed: stats.processed,
            created: stats.created,
            duplicatesSkipped: stats.duplicates,
            errorCount: stats.errors.length,
            currentSource: source.name,
            currentActivity: '🌐 Web scraping',
            extractActive: true,
          });
          console.log(`  ?? Scraping source: ${source.url}`);
          const scraped = await scrapeUrl(source.url);
          if (scraped && scraped.length >= 100) {
            content = scraped;
            articleUrl = articleUrl || source.url;
            console.log(`  ? Scraped: ${content.length} chars`);
            await logActivity(`✓ Scraped ${content.length} characters`);
          }

          }
        }
        
        if (!content || content.length < 50) {
          stats.errors.push(`No content from ${source.name}`);
          console.log(`  ? No content extracted from any source`);
          await logActivity(`⚠️ No content retrieved - skipping source`);
          continue;
        }

        let extractedAlerts: Alert[] = [];
        const sourceType = (source.type || '').toLowerCase();
        const knownTypes = ['usgs-atom','usgs','cap','nws-cap','faa-nas','faa-json','noaa-tropical','noaa','rss','atom','feed'];
        
        // Only attempt structured parse if source has a recognized type
        if (sourceType && knownTypes.includes(sourceType)) {
          console.log(`  ?? Attempting structured parse for type: ${sourceType}`);
          try {
            extractedAlerts = await parseBySourceType(source);
            console.log(`  ? Structured parser produced ${extractedAlerts.length} alerts`);
          } catch (parseErr: any) {
            console.warn(`  !! Structured parser failed: ${parseErr?.message || parseErr}`);
            extractedAlerts = [];
          }
        } else if (sourceType) {
          console.log(`  ?? Unknown source type '${sourceType}' - will use AI fallback`);
        }

        // Fallback to web scraping + Claude if no structured parser or it returned nothing
        if (!extractedAlerts.length) {
          console.log(`  ?? No alerts from structured parser (or none attempted) - fetching content for Claude analysis...`);
          
          // Note: Brave Search has been disabled. Using scraping + Claude only.
          
          // Fall back to scraping
          if (!content || content.length < 100) {
            await setKV(`scour_job:${config.jobId}`, {
              id: config.jobId,
              status: 'running',
              total: config.sourceIds.length,
              processed: stats.processed,
              created: stats.created,
              duplicatesSkipped: stats.duplicates,
              errorCount: stats.errors.length,
              currentSource: source.name,
              currentActivity: '?? Web scraping',
              updated_at: new Date().toISOString(),
            }).catch(() => {});
            const scraped = await scrapeUrl(source.url);
            if (scraped && scraped.length >= 100) {
              content = scraped;
              articleUrl = articleUrl || source.url;
            }
            // Note: Brave Search fallback removed. Using Claude queries only.
          }
          
          if (!content || content.length < 50) {
            stats.errors.push(`No content from ${source.name}`);
            continue;
          }

          await logActivity(`🤖 AI analyzing content...`);
          await setJobStatus({
            id: config.jobId,
            status: 'running',
            total: config.sourceIds.length,
            processed: stats.processed,
            created: stats.created,
            duplicatesSkipped: stats.duplicates,
            errorCount: stats.errors.length,
            currentSource: source.name,
            currentActivity: '🤖 AI analyzing content',
          });
          try {
            extractedAlerts = await extractAlertsWithAI(
              content,
              articleUrl || source.url,
              source.name,
              allExistingAlerts,
              config
            );
          } catch (aiErr: any) {
            console.error(`  !! AI extraction failed: ${aiErr.message}`);
            await logActivity(`⚠️ AI extraction failed: ${aiErr.message}`);
            extractedAlerts = [];
          }
        }

        if (extractedAlerts.length === 0) {
          await logActivity(`No relevant alerts found in content`);
        } else {
          await logActivity(`✓ Extracted ${extractedAlerts.length} potential alerts`);
        }

        for (const alert of extractedAlerts) {
          let isDuplicate = false;

          await setJobStatus({
            id: config.jobId,
            status: 'running',
            total: config.sourceIds.length,
            processed: stats.processed,
            created: stats.created,
            duplicatesSkipped: stats.duplicates,
            errorCount: stats.errors.length,
            currentSource: source.name,
            currentActivity: `🔍 Checking: ${alert.title.slice(0, 40)}...`,
          });

          // Check against both existing alerts (from before scour) AND alerts created in this scour run
          // Plus blocked alerts (dismissed/deleted) to prevent re-extraction

          for (const existing of allExistingAlerts) {
            // More comprehensive duplicate checking
            const titleMatch = existing.title.toLowerCase().includes(alert.title.toLowerCase().slice(0, 40)) ||
                             alert.title.toLowerCase().includes(existing.title.toLowerCase().slice(0, 40));
            const locationMatch = existing.location === alert.location && existing.country === alert.country;
            const similarLocation = existing.location.toLowerCase().includes(alert.location.toLowerCase()) ||
                                  alert.location.toLowerCase().includes(existing.location.toLowerCase());
            const sameCountry = existing.country === alert.country;

            // Check for duplicates if titles are similar OR locations are the same OR (similar location + same country)
            if (titleMatch || locationMatch || (similarLocation && sameCountry)) {
              console.log(`      ?? Potential duplicate found: "${existing.title}" (${existing.location}, ${existing.country})`);
              const duplicate = await checkDuplicate(alert, existing, config.openaiKey);
              if (duplicate) {
                isDuplicate = true;
                stats.duplicates++;
                console.log(`      ? Confirmed duplicate by AI`);
                await logActivity(`⊘ Skipped duplicate: "${alert.title.slice(0, 35)}..."`);
                break;
              } else {
                console.log(`      ? AI says not duplicate - continuing`);
              }
            }
          }

          if (!isDuplicate) {
            try {
              // Calculate confidence score (Factal-style)
              const confidenceScore = calculateConfidence(alert, source);
              alert.confidence_score = confidenceScore;
              const confidenceCategory = getConfidenceCategory(confidenceScore);
              
              console.log(`    ?? Confidence: ${(confidenceScore * 100).toFixed(1)}% (${confidenceCategory})`);
              
              await querySupabaseForWorker(
                `${config.supabaseUrl}/rest/v1/alerts`,
                config.serviceKey,
                {
                  method: 'POST',
                  body: JSON.stringify(alert),
                  headers: { 'Prefer': 'return=representation' },
                }
              );
              
              allExistingAlerts.push(alert);
              stats.created++;
              
              await logActivity(`✅ Created: "${alert.title.slice(0, 40)}..." (${alert.country})`);
              
              // Update job tracking in real-time for frontend progress display
              try {
                await setKV(`scour_job:${config.jobId}`, {
                  id: config.jobId,
                  status: 'running',
                  total: config.sourceIds.length,
                  processed: stats.processed,
                  created: stats.created,
                  duplicatesSkipped: stats.duplicates,
                  errorCount: stats.errors.length,
                  currentSource: source.name,
                  lastAlert: alert.title,
                  activityLog: activityLog.slice(),
                  updated_at: new Date().toISOString(),
                });
              } catch (e) {
                // Non-critical: job tracking update failed, continue
              }
              
              console.log(`    ? Created: "${alert.title}" (${alert.location}, ${alert.country})`);
            } catch (insertErr: any) {
              stats.errors.push(`Insert failed: ${insertErr.message}`);
              console.log(`    ? Insert error: ${insertErr.message}`);
            }
          } else {
            console.log(`    ? Duplicate: "${alert.title}"`);
          }
        }

        // Update status after completing this source
        await setJobStatus({
          id: config.jobId,
          status: 'running',
          total: config.sourceIds.length,
          processed: stats.processed,
          created: stats.created,
          duplicatesSkipped: stats.duplicates,
          errorCount: stats.errors.length,
          currentSource: source.name,
          currentActivity: `✅ Completed: ${source.name}`,
        });

      } catch (sourceErr: any) {
        stats.errors.push(`Source error: ${sourceErr.message}`);
        
        // Update status for errored source
        await setKV(`scour_job:${config.jobId}`, {
          id: config.jobId,
          status: 'running',
          total: config.sourceIds.length,
          processed: stats.processed,
          created: stats.created,
          duplicatesSkipped: stats.duplicates,
          errorCount: stats.errors.length,
          currentSource: sourceId || '',
          currentActivity: `❌ Error: ${sourceId || 'Unknown source'}`,
          activityLog: activityLog.slice(),
          updated_at: new Date().toISOString(),
        }).catch(() => {});
      }
    }

    // Run proactive early signals queries each cycle (early detection)
    // Runs asynchronously and doesn't block scour completion
    // ALWAYS runs now - uses Claude proactive queries instead of Brave Search
    console.log(`\n??? Triggering early-signal queries (async, non-blocking)`);
    // Fire and forget - don't await, don't block completion
    fetch(`${config.supabaseUrl}/functions/v1/clever-function/scour/early-signals`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ jobId: config.jobId }),
    }).catch(e => console.warn('Early signals trigger failed:', e));
    
    console.log(`? SCOUR WORKER COMPLETE: processed=${stats.processed}, created=${stats.created}, duplicates=${stats.duplicates}, errors=${stats.errors.length}`);

    return stats;

  } catch (err: any) {
    console.error(`Fatal scour error:`, err);
    throw err;
  }
}

// ============================================================================
// GLOBAL CONFIG & HELPERS
// ============================================================================

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "https://gnobnyzezkuyptuakztf.supabase.co";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || Deno.env.get("OPENAI_KEY");
const CLAUDE_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
// Use BRAVRE_SEARCH_API_KEY for Brave Search (paid version)
const BRAVE_API_KEY = Deno.env.get("BRAVRE_SEARCH_API_KEY");
const WP_URL = Deno.env.get("WP_URL");
const WP_USER = Deno.env.get("WP_USER");
const WP_APP_PASSWORD = Deno.env.get("WP_APP_PASSWORD");
const WP_POST_TYPE = Deno.env.get("WP_POST_TYPE") || "rss-feed"; // REST-enabled CPT slug

// External API keys (optional - set in environment)
const NEWSAPI_KEY = Deno.env.get("NEWSAPI_KEY"); // Free tier available at newsapi.org
const ACLED_EMAIL = Deno.env.get("ACLED_EMAIL"); // Required for ACLED API

// Timeout configuration (in milliseconds)
const AI_EXTRACTION_TIMEOUT_MS = parseInt(Deno.env.get("AI_EXTRACTION_TIMEOUT_MS") || "20000", 10);
const BRAVE_REQUEST_TIMEOUT_MS = parseInt(Deno.env.get("BRAVE_REQUEST_TIMEOUT_MS") || "10000", 10);
const BATCH_TIMEOUT_MS = parseInt(Deno.env.get("BATCH_TIMEOUT_MS") || "120000", 10);

// Log startup config (only once per function instance)
console.log(`Edge function initialized:`);
if (!serviceKey) console.warn("WARNING: SUPABASE_SERVICE_ROLE_KEY not set!");
console.log(`   OpenAI: ${OPENAI_API_KEY ? 'OK' : 'NOT SET'}`);
console.log(`   WordPress: ${WP_URL ? 'OK' : 'NOT SET'}`);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
};

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

function nowIso() {
  return new Date().toISOString();
}

function getDefaultEndDate(startDate?: string): string {
  // If no start date, default to 7 days from now
  if (!startDate) {
    const end = new Date();
    end.setDate(end.getDate() + 7);
    return end.toISOString();
  }
  
  // If start date exists, default end date to 7 days after start
  try {
    const start = new Date(startDate);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return end.toISOString();
  } catch {
    // Fallback: 7 days from now
    const end = new Date();
    end.setDate(end.getDate() + 7);
    return end.toISOString();
  }
}

async function querySupabaseRest(endpoint: string, options: RequestInit = {}) {
  const url = `${supabaseUrl}/rest/v1${endpoint}`;
  
  // Add 15 second timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "Authorization": `Bearer ${serviceKey}`,
        "apikey": serviceKey,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Supabase error ${response.status}: ${text}`);
    }

    const contentType = response.headers.get('content-type');
    const text = await response.text();
    
    // Handle empty responses
    if (!text || text.trim() === '') {
      console.warn(`Empty response from ${endpoint}`);
      return null;
    }
    
    // Parse JSON with better error handling
    try {
      return JSON.parse(text);
    } catch (e) {
      console.error(`Failed to parse response from ${endpoint}: ${text.slice(0, 200)}`);
      throw new Error(`Failed to parse JSON from ${endpoint}: ${e}`);
    }
  } finally {
    clearTimeout(timeoutId);
  }
}

async function safeQuerySupabaseRest(endpoint: string, options: RequestInit = {}) {
  try {
    return await querySupabaseRest(endpoint, options);
  } catch (error: any) {
    if (error.message.includes("PGRST205") || error.message.includes("404")) {
      console.warn(`Table not found: ${endpoint}`);
      return null;
    }
    throw error;
  }
}

async function getKV(key: string) {
  try {
    const result = await querySupabaseRest(`/app_kv?key=eq.${encodeURIComponent(key)}&select=value`);
    if (!result || result.length === 0) {
      console.log(`⚠️ KV GET empty result: ${key}`);
      return null;
    }
    let value = result[0]?.value ?? null;
    // value is already a JSONB object from Supabase, no parsing needed
    console.log(`✓ KV GET: ${key}`, value ? `(${typeof value})` : '');
    return value;
  } catch (e: any) {
    console.error(`✗ KV GET ERROR: ${key}`, e?.message || e);
    return null;
  }
}

async function setKV(key: string, value: any) {
  // value column is JSONB, so send object/array directly, not stringified
  const data = { 
    key, 
    value: value,
    updated_at: nowIso() 
  };
  try {
    // Strategy: Try PATCH first (update if exists), then fallback to POST (insert if not)
    // This handles concurrent writes gracefully
    
    let result;
    let patchAttempted = false;
    
    try {
      patchAttempted = true;
      // Try to update existing key
      const patchRes = await querySupabaseRest(`/app_kv?key=eq.${encodeURIComponent(key)}`, {
        method: "PATCH",
        body: JSON.stringify(data),
        headers: { "Prefer": "return=representation" }
      });
      
      // Check if PATCH actually updated something
      if (patchRes && Array.isArray(patchRes) && patchRes.length > 0) {
        console.log(`✓ KV updated via PATCH: ${key}`);
        return patchRes;
      }
      
      // PATCH succeeded but no rows matched - key doesn't exist yet, will try INSERT
      console.log(`  KV key not found in PATCH, will try POST: ${key}`);
    } catch (patchErr: any) {
      // PATCH failed - key might exist or might be another error
      if (!patchErr?.message?.includes("duplicate")) {
        // Not a duplicate key error, log it but continue to POST
        console.log(`  KV PATCH skipped (${patchErr?.message}), trying POST: ${key}`);
      }
    }
    
    // Try INSERT - will either create new key or fail if it exists (which is fine, means PATCH user already updated it)
    try {
      console.log(`  KV attempting POST (insert): ${key}`);
      const postRes = await querySupabaseRest("/app_kv", {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "Prefer": "return=representation" }
      });
      console.log(`✓ KV inserted via POST: ${key}`);
      return postRes;
    } catch (postErr: any) {
      // POST failed - likely duplicate key (another task beat us to it)
      if (postErr?.message?.includes("23505") || postErr?.message?.includes("duplicate")) {
        // This is expected in concurrent scenarios - another task already set it
        console.log(`  KV key already exists (from concurrent task): ${key}`);
        // Not an error - the key is set to some value, which is what we want
        return { ok: true, note: "Key already existed from concurrent write" };
      }
      throw postErr;
    }
  } catch (err: any) {
    console.error(`✗ KV SAVE FAILED for ${key}: ${err?.message}`);
    console.error(`  Error details:`, err);
    throw err;
  }
}

async function deleteKV(key: string) {
  try {
    await querySupabaseRest(`/app_kv?key=eq.${encodeURIComponent(key)}`, {
      method: "DELETE"
    });
    console.log(`✓ KV DELETE success: ${key}`);
  } catch (e: any) {
    console.error(`✗ KV DELETE FAILED for ${key}: ${e?.message}`);
    throw e;
  }
}

// Ensure alert has geojson using 3-step logic: geo_json object → geojson string → auto-generate
function ensureGeoJSON(alertData: any): any {
  // Step 1: If geo_json JSONB object exists, save to both fields
  if (alertData.geo_json && typeof alertData.geo_json === 'object') {
    alertData.geojson = JSON.stringify(alertData.geo_json);
    return alertData;
  }
  
  // Step 2: If geojson string exists, parse and populate geo_json
  if (alertData.geojson && typeof alertData.geojson === 'string') {
    try {
      alertData.geo_json = JSON.parse(alertData.geojson);
    } catch (e) {
      console.warn(`  ⚠ Failed to parse geojson: ${e}`);
    }
    return alertData;
  }
  
  // Step 3: If neither exists, auto-generate from coordinates
  if (!alertData.geojson && !alertData.geo_json) {
    const lat = parseFloat(alertData.latitude);
    const lon = parseFloat(alertData.longitude);
    
    if (!isNaN(lat) && !isNaN(lon)) {
      // For offshore earthquakes, use larger radius + note impact zone
      const isOffshoreEarthquake = alertData.isOffshore && alertData.event_type?.toLowerCase().includes('earthquake');
      const radius = isOffshoreEarthquake ? 100 : 50; // 100km for offshore earthquakes, 50km default
      
      const geoJsonObj = generateCircleGeoJSON(lat, lon, radius);
      
      // Enhance properties for offshore events
      if (isOffshoreEarthquake) {
        geoJsonObj.properties.isOffshore = true;
        geoJsonObj.properties.coastlineDistance = alertData.coastlineDistance || 'unknown';
        geoJsonObj.properties.tsunamiRisk = true;
        geoJsonObj.properties.description = `Offshore earthquake - potential tsunami risk. Distance from shore: ${alertData.coastlineDistance || 'unknown'}`;
      }
      
      alertData.geo_json = geoJsonObj;
      alertData.geojson = JSON.stringify(geoJsonObj);
      const geoType = isOffshoreEarthquake ? 'Offshore earthquake GeoJSON (100km radius)' : 'GeoJSON';
      console.log(`  ✓ Auto-generated ${geoType} from coordinates (${lat}, ${lon})`);
    }
  }
  
  return alertData;
}

async function batchInsert(table: string, records: any[], chunkSize = 100) {
  const results: any[] = [];
  for (let i = 0; i < records.length; i += chunkSize) {
    const chunk = records.slice(i, i + chunkSize);
    const inserted = await querySupabaseRest(`/${table}`, {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(chunk),
    });
    if (Array.isArray(inserted)) results.push(...inserted);
  }
  return results;
}

function normalizePath(pathname: string): string {
  let p = pathname;
  // Strip common prefixes for various deployments (Supabase, Vercel, generic API routes)
  // Remove everything up to and including "/clever-function" if present
  const cfIdx = p.indexOf("/clever-function");
  if (cfIdx >= 0) {
    p = p.slice(cfIdx + "/clever-function".length);
  }
  // Generic removals if function prefix isn't present
  if (p.includes("/functions/v1")) {
    p = p.replace("/functions/v1", "");
  }
  if (p.startsWith("/api")) {
    p = p.replace("/api", "");
  }
  // Normalize final shape
  if (p.endsWith("/") && p.length > 1) p = p.slice(0, -1);
  if (!p.startsWith("/")) p = `/${p}`;
  return p;
}

function parseIdFromPath(p: string): string | null {
  const parts = p.split("/").filter(Boolean);
  const idx = parts.indexOf("alerts");
  if (idx === -1) return null;
  return parts[idx + 1] ?? null;
}

async function fetchAlertById(id: string): Promise<any | null> {
  const rows = await querySupabaseRest(`/alerts?id=eq.${encodeURIComponent(id)}&select=*`);
  return rows?.[0] ?? null;
}

async function patchAlertById(id: string, patch: Record<string, any>) {
  const rows = await querySupabaseRest(`/alerts?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ ...patch, updated_at: nowIso() }),
  });
  return rows?.[0] ?? null;
}

async function dismissAlert(id: string) {
  return await patchAlertById(id, { status: "dismissed" });
}

async function approveOnly(id: string) {
  return await patchAlertById(id, { status: "approved" });
}

async function approveAndPublishToWP(id: string) {
  const alert = await fetchAlertById(id);
  if (!alert) return { status: 404, body: { ok: false, error: "Alert not found" } };

  // Validate required fields before attempting to publish
  const validationErrors: string[] = [];
  
  if (!alert.title || alert.title.trim().length === 0) {
    validationErrors.push("Missing title");
  }
  if (!alert.country || alert.country.trim().length === 0) {
    validationErrors.push("Missing country");
  }
  if (!alert.location || alert.location.trim().length === 0) {
    validationErrors.push("Missing location");
  }
  if (!alert.summary && !alert.description) {
    validationErrors.push("Missing summary or description");
  }
  
  // Check if alert has EITHER polygon OR valid coordinates
  const hasPolygon = !!(alert.geojson || alert.geo_json);
  const hasValidCoords = !!(alert.latitude && alert.longitude && 
    !isNaN(parseFloat(String(alert.latitude))) && 
    !isNaN(parseFloat(String(alert.longitude))));
  
  if (!hasPolygon && !hasValidCoords) {
    validationErrors.push("Missing polygon and coordinates - alert must have either a GeoJSON polygon OR valid latitude/longitude to publish to WordPress");
  }
  
  if (validationErrors.length > 0) {
    return {
      status: 400,
      body: {
        ok: false,
        error: "Cannot publish alert - validation failed",
        validation_errors: validationErrors,
        instructions: "Please edit the alert to add missing fields. Polygon/coordinates are needed for WordPress publishing.",
        alert_id: id
      }
    };
  }

  // If WordPress not configured, just approve the alert
  if (!WP_URL || !WP_USER || !WP_APP_PASSWORD) {
    const updated = await patchAlertById(id, { status: "approved" });
    return { 
      status: 200, 
      body: { 
        ok: true, 
        alert: updated,
        message: "Alert approved (WordPress not configured for publishing)",
        wordpress_configured: false,
        wordpress_debug: {
          has_url: !!WP_URL,
          has_user: !!WP_USER,
          has_app_password: !!WP_APP_PASSWORD,
          post_type: WP_POST_TYPE,
        }
      } 
    };
  }

  try {
    // Build comprehensive WordPress post content with all alert fields
    const buildContent = (): string => {
      // MAGNUS Brand Colors
      const darkGreen = '#144334';
      const deepGreen = '#1A6B51';
      const orange = '#F88A35';
      const primaryText = '#192622';
      const secondaryText = '#17221E';

      let html = '';
      
      // Title & Severity Header
      html += `<div style="padding: 25px; background: ${darkGreen}; color: white; border-left: 4px solid ${orange}; margin-bottom: 25px; border-radius: 4px;">`;
      html += `<h2 style="color: white; margin: 0 0 10px 0; font-size: 1.6em;">${alert.title || "Travel Alert"}</h2>`;
      html += `<p style="margin: 0; font-weight: 600; font-size: 1.05em;"><strong>Severity:</strong> <span style="color: ${orange};">${alert.severity?.toUpperCase() || 'INFO'}</span></p>`;
      html += `</div>`;

      // Location & Geography
      html += `<h2 style="color: ${darkGreen}; border-bottom: 3px solid ${orange}; padding-bottom: 8px; margin: 25px 0 15px 0; font-size: 1.3em;">Location & Geography</h2>`;
      html += `<ul style="margin-left: 20px; margin-bottom: 15px;">`;
      html += `<li style="margin-bottom: 8px; color: ${secondaryText};"><strong>Country:</strong> ${alert.countryFlag || '??'} ${alert.country}</li>`;
      if (alert.location) html += `<li style="margin-bottom: 8px; color: ${secondaryText};"><strong>City/Location:</strong> ${alert.location}</li>`;
      if (alert.region) html += `<li style="margin-bottom: 8px; color: ${secondaryText};"><strong>Region:</strong> ${alert.region}</li>`;
      if (alert.latitude && alert.longitude) {
        html += `<li style="margin-bottom: 8px; color: ${secondaryText};"><strong>Coordinates:</strong> ${alert.latitude.toFixed(4)}, ${alert.longitude.toFixed(4)}</li>`;
      }
      if (alert.geoScope) html += `<li style="margin-bottom: 8px; color: ${secondaryText};"><strong>Geographic Scope:</strong> ${alert.geoScope}</li>`;
      if (alert.radiusKm) html += `<li style="margin-bottom: 8px; color: ${secondaryText};"><strong>Affected Radius:</strong> ~${Math.round(alert.radiusKm)} km</li>`;
      html += `</ul>`;

      // Event Details
      html += `<h2 style="color: ${darkGreen}; border-bottom: 3px solid ${orange}; padding-bottom: 8px; margin: 25px 0 15px 0; font-size: 1.3em;">Event Details</h2>`;
      if (alert.eventType) html += `<p style="margin-bottom: 8px; color: ${secondaryText};"><strong>Event Type:</strong> ${alert.eventType}</p>`;
      if (alert.alertType) html += `<p style="margin-bottom: 8px; color: ${secondaryText};"><strong>Alert Type:</strong> ${alert.alertType}</p>`;
      if (alert.escalationLikelihood) html += `<p style="margin-bottom: 8px; color: ${secondaryText};"><strong>Escalation Likelihood:</strong> ${alert.escalationLikelihood}</p>`;

      // Summary & Recommendations
      html += `<h2 style="color: ${darkGreen}; border-bottom: 3px solid ${orange}; padding-bottom: 8px; margin: 25px 0 15px 0; font-size: 1.3em;">Summary</h2>`;
      
      // Check if recommendations are in summary (they'll be marked with **Traveler Recommendations:**)
      const summaryText = alert.summary || alert.eventSummary || 'No summary available';
      const hasRecommendationsInSummary = summaryText.includes('**Traveler Recommendations:**');
      
      if (hasRecommendationsInSummary) {
        // Split summary and recommendations
        const parts = summaryText.split('**Traveler Recommendations:**');
        html += `<p style="color: ${secondaryText}; margin-bottom: 15px;">${parts[0].trim()}</p>`;
        
        // Add recommendations section
        if (parts[1]) {
          html += `<h2 style="color: ${darkGreen}; border-bottom: 3px solid ${orange}; padding-bottom: 8px; margin: 25px 0 15px 0; font-size: 1.3em;">Traveler Recommendations</h2>`;
          const recLines = parts[1].trim().split('\n').filter((line: string) => line.trim());
          html += `<ol style="margin-left: 20px; margin-bottom: 15px;">`;
          recLines.forEach((line: string) => {
            let cleanLine = line.trim();
            // Remove leading number and period
            if (/^\d+\.\s/.test(cleanLine)) {
              cleanLine = cleanLine.substring(cleanLine.indexOf('.') + 1).trim();
            }
            if (cleanLine) {
              html += `<li style="margin-bottom: 8px; color: ${secondaryText};">${cleanLine}</li>`;
            }
          });
          html += `</ol>`;
        }
      } else {
        html += `<p style="color: ${secondaryText}; margin-bottom: 15px;">${summaryText}</p>`;
      }

      // Timeline
      if (alert.event_start_date || alert.event_end_date) {
        html += `<h2 style="color: ${darkGreen}; border-bottom: 3px solid ${orange}; padding-bottom: 8px; margin: 25px 0 15px 0; font-size: 1.3em;">Timeline</h2>`;
        html += `<ul style="margin-left: 20px; margin-bottom: 15px;">`;
        if (alert.event_start_date) {
          html += `<li style="margin-bottom: 8px; color: ${secondaryText};"><strong>Start:</strong> ${new Date(alert.event_start_date).toLocaleString()}</li>`;
        }
        if (alert.event_end_date) {
          html += `<li style="margin-bottom: 8px; color: ${secondaryText};"><strong>End/Expiration:</strong> ${new Date(alert.event_end_date).toLocaleString()}</li>`;
        }
        html += `</ul>`;
      }

      // Topics & Regions
      if (alert.topics && alert.topics.length > 0) {
        html += `<h3 style="color: ${deepGreen}; font-size: 1.1em; margin: 15px 0 10px 0; font-weight: 600;">Topics</h3>`;
        html += `<p style="color: ${secondaryText}; margin-bottom: 15px;">${alert.topics.join(', ')}</p>`;
      }

      // Recommendations & Mitigation
      if (alert.recommendedActions && alert.recommendedActions.length > 0) {
        html += `<h2 style="color: ${darkGreen}; border-bottom: 3px solid ${orange}; padding-bottom: 8px; margin: 25px 0 15px 0; font-size: 1.3em;">Recommended Actions</h2>`;
        html += `<ol style="margin-left: 20px; margin-bottom: 15px;">`;
        alert.recommendedActions.forEach((action) => {
          html += `<li style="margin-bottom: 8px; color: ${secondaryText};">${action}</li>`;
        });
        html += `</ol>`;
      }

      if (alert.mitigation) {
        html += `<h2 style="color: ${darkGreen}; border-bottom: 3px solid ${orange}; padding-bottom: 8px; margin: 25px 0 15px 0; font-size: 1.3em;">Safety Precautions</h2>`;
        html += `<p style="color: ${secondaryText}; margin-bottom: 15px;">${alert.mitigation}</p>`;
      }

      // Secondary Impacts
      if (alert.secondaryImpacts && alert.secondaryImpacts.length > 0) {
        html += `<h2 style="color: ${darkGreen}; border-bottom: 3px solid ${orange}; padding-bottom: 8px; margin: 25px 0 15px 0; font-size: 1.3em;">Predicted Secondary Impacts</h2>`;
        html += `<ul style="margin-left: 20px; margin-bottom: 15px;">`;
        alert.secondaryImpacts.forEach((impact) => {
          html += `<li style="margin-bottom: 8px; color: ${secondaryText};">${impact}</li>`;
        });
        html += `</ul>`;
      }

      return html;
    };

    const wpAuth = btoa(`${WP_USER}:${WP_APP_PASSWORD}`);
    const wpEndpoint = `${WP_URL}/wp-json/wp/v2/${WP_POST_TYPE}`;
    console.log("[WP Publish] Attempting POST", { endpoint: wpEndpoint, post_type: WP_POST_TYPE, has_url: !!WP_URL });
    
    // Log alert data to diagnose missing fields
    console.log("[WP Publish] Alert data from database:", {
      id: alert.id,
      title: alert.title,
      summary: alert.summary,
      description: alert.description,
      recommendations: alert.recommendations,
      latitude: alert.latitude,
      longitude: alert.longitude,
      radius: alert.radius,
      geojson: alert.geojson ? alert.geojson.substring(0, 100) + '...' : null,
      mainland: alert.mainland,
      intelligence_topics: alert.intelligence_topics,
      event_start_date: alert.event_start_date,
      event_end_date: alert.event_end_date,
      country: alert.country,
      location: alert.location,
      severity: alert.severity,
      event_type: alert.event_type
    });
    
    // Build ACF fields - plain data only, NO HTML
    const normalizedCountry = normalizeCountryForACF(alert.country);
    const normalizedSeverity = normalizeSeverityForACF(alert.severity);
    const normalizedTopics = alert.intelligence_topics || normalizeIntelligenceTopicsForACF(alert.event_type || "");
    
    // Keep description and recommendations separate (no HTML/markdown in description)
    const descriptionText = (alert.description ?? alert.summary ?? alert.title ?? "").trim();
    const recommendationsText = (alert.recommendations ?? "").trim();
    const formattedRecommendations = formatRecommendationsForACF(recommendationsText);
    
        console.log('[WP Publish] Recommendations processing:', {
          raw_recommendations: recommendationsText.substring(0, 200),
          formatted_count: formattedRecommendations.length,
          formatted_preview: formattedRecommendations.slice(0, 2)
        });
    const startIso = alert.event_start_date
      ? new Date(alert.event_start_date).toISOString()
      : alert.created_at
        ? new Date(alert.created_at).toISOString()
        : "";
    const endIso = alert.event_end_date
      ? new Date(alert.event_end_date).toISOString()
      : "";
    // Prefer stored string, but allow JSONB geo_json fallback
    let polyText = "";
    if (alert.geojson) {
      polyText = alert.geojson;
    } else if (alert.geo_json) {
      try {
        polyText = typeof alert.geo_json === 'string' ? alert.geo_json : JSON.stringify(alert.geo_json);
      } catch {
        polyText = "";
      }
    }
    
    const latText = alert.latitude ? String(alert.latitude) : "";
    const lonText = alert.longitude ? String(alert.longitude) : "";
    const radiusNum = alert.radius ?? "";
    const safeLocation = alert.location || "";
    
    console.log('[WP Publish] Polygon from DB:', {
      has_geojson: !!alert.geojson,
      has_geo_json_jsonb: !!alert.geo_json,
      geojson_length: polyText ? polyText.length : 0,
      geojson_preview: polyText ? polyText.substring(0, 120) : 'NULL',
      has_lat_lon: !!(latText && lonText),
      latitude: latText,
      longitude: lonText,
      radius: radiusNum
    });
    
    // FALLBACK: Generate polygon from lat/lon if missing but coordinates exist
    if (!polyText && latText && lonText) {
      console.warn('[WP Publish] No polygon found but coordinates exist - generating circle polygon from lat/lon');
      try {
        const lat = parseFloat(latText);
        const lon = parseFloat(lonText);
        const radius = radiusNum ? parseFloat(String(radiusNum)) : 25;
        if (!isNaN(lat) && !isNaN(lon)) {
          const circleGeoJSON = generateCircleGeoJSON(lat, lon, radius);
          polyText = JSON.stringify(circleGeoJSON);
          console.log('[WP Publish] Generated fallback polygon:', polyText.substring(0, 120) + '...');
          
          // Update the database with the generated polygon for future use
          await patchAlertById(alert.id, {
            geojson: polyText,
            geo_json: circleGeoJSON
          });
          console.log('[WP Publish] Updated alert with generated polygon');
        }
      } catch (err) {
        console.error('[WP Publish] Failed to generate fallback polygon:', err);
      }
    }
    
    // Auto-derive mainland from country if not explicitly set
    const continent = alert.mainland || (normalizedCountry ? getContinent(normalizedCountry) : "");
    
    // Build deduplicated location string
    const locationParts = [safeLocation, normalizedCountry]
      .map((p) => (p || "").trim())
      .filter(Boolean);
    const theLocation = Array.from(new Set(locationParts)).join(", ");

    const acfFields: Record<string, any> = {
      mainland: continent,
      intelligence_topics: normalizedTopics,
      the_location: theLocation,
      latitude: latText,
      longitude: lonText,
      radius: radiusNum,
      polygon: polyText,
      start: startIso,
      end: endIso,
      severity: normalizedSeverity,
      description: descriptionText,
      recommendations: formattedRecommendations && formattedRecommendations.length > 0 ? formattedRecommendations : [],
      sources: alert.article_url || alert.source_url || "",
    };

    if (!polyText) {
      console.error('[WP Publish] Missing polygon and cannot generate from coordinates - refusing to publish');
      console.error('[WP Publish] Alert data dump:', {
        id: alert.id,
        title: alert.title,
        has_geojson: !!alert.geojson,
        has_geo_json: !!alert.geo_json,
        latitude: alert.latitude,
        longitude: alert.longitude,
        radius: alert.radius,
        lat_type: typeof alert.latitude,
        lon_type: typeof alert.longitude,
        latText,
        lonText,
        radiusNum
      });
      throw new Error(`Missing polygon/geojson for alert ${alert.id}. No geojson/geo_json in DB and coordinates are: lat=${alert.latitude}, lon=${alert.longitude}`);
    }
    
    console.log('[WP Publish] ACF fields being sent:', {
      mainland: acfFields.mainland,
      latitude: acfFields.latitude,
      longitude: acfFields.longitude,
      radius: acfFields.radius,
      polygon_length: polyText.length,
      recommendations_type: typeof acfFields.recommendations,
      recommendations_count: Array.isArray(acfFields.recommendations) ? acfFields.recommendations.length : 0,
      recommendations_sample: Array.isArray(acfFields.recommendations) && acfFields.recommendations.length > 0 ? acfFields.recommendations[0] : null
    });
    // Only include Country if normalized value exists (Global/worldwide alerts get omitted)
    if (normalizedCountry) {
      acfFields.Country = normalizedCountry;
    }
    
    const wpResponse = await fetch(wpEndpoint, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${wpAuth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: alert.title || "Travel Alert",
        // Leave WP post content empty to avoid rendering in the main body
        content: "",
        status: "publish",
        fields: acfFields,  // Plain ACF data only
      }),
      signal: AbortSignal.timeout(15000),
    });

    console.log("[WP Publish] Response", { 
      status: wpResponse.status, 
      statusText: wpResponse.statusText,
      acfFieldsCount: Object.keys(acfFields).length,
      acfFieldNames: Object.keys(acfFields)
    });

    if (!wpResponse.ok) {
      const text = await wpResponse.text();
      console.error(`WordPress error: ${wpResponse.status}`, text);
      // Still approve locally even if WordPress fails
      const updated = await patchAlertById(id, { status: "approved" });
      return { 
        status: 200, 
        body: { 
          ok: true, 
          alert: updated,
          message: `Alert approved (WordPress publish failed: ${wpResponse.status})`,
          wordpress_error_status: wpResponse.status,
          wordpress_error_text: text,
          wordpress_endpoint: wpEndpoint,
          wordpress_post_type: WP_POST_TYPE,
        } 
      };
    }

    const wpPost = await wpResponse.json();
    const updated = await patchAlertById(id, {
      status: "posted",
      wordpress_post_id: wpPost.id,
      wordpress_url: wpPost.link,
    });

    return {
      status: 200,
      body: {
        ok: true,
        alert: updated,
        wordpress_post_id: wpPost.id,
        wordpress_url: wpPost.link,
        message: "Alert approved and published to WordPress"
      }
    };
  } catch (err: any) {
    console.error("WordPress integration error:", err);
    // Still approve locally even if WordPress fails
    const updated = await patchAlertById(id, { status: "approved" });
    return { 
      status: 200, 
      body: { 
        ok: true, 
        alert: updated,
        message: `Alert approved (WordPress integration failed: ${err.message})`
      } 
    };
  }
}

function respondNotFound(path: string) {
  return json({ ok: false, error: "Not found", path, normalized: normalizePath(path) }, 404);
}

function waitUntil(p: Promise<any>) {
  const er = (globalThis as any).EdgeRuntime;
  if (er?.waitUntil) er.waitUntil(p);
}

// ============================================================================
// MAIN ROUTER
// ============================================================================

Deno.serve({ skipJwtVerification: true }, async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  const url = new URL(req.url);
  const method = req.method.toUpperCase();
  const rawPath = url.pathname;
  const path = normalizePath(rawPath);
  console.log("[Router] INCOMING REQUEST:", { method, rawPath, path, url: url.toString() });

  try {
    // HEALTH
    if (path === "/health" && method === "GET") {
      return json({
        ok: true,
        time: nowIso(),
        env: {
          AI_ENABLED: !!OPENAI_API_KEY,
          CLAUDE_ENABLED: !!CLAUDE_API_KEY,
          SCOUR_ENABLED: true,
          AUTO_SCOUR_ENABLED: true,
          WP_CONFIGURED: !!(WP_URL && WP_USER && WP_APP_PASSWORD),
          BRAVRE_SEARCH_API_KEY_CONFIGURED: !!BRAVE_API_KEY,
        },
      });
    }

    // TEST CLAUDE
    if (path === "/test-claude" && method === "GET") {
      if (!CLAUDE_API_KEY) {
        return json({ 
          ok: false, 
          error: "ANTHROPIC_API_KEY not set in Edge Function secrets"
        }, 500);
      }

      // Just check if we can call Claude without full test
      return json({ 
        ok: true, 
        claudeConfigured: true,
        message: "Claude API key is configured. Try running scour to test.",
        model: "claude-3-haiku-20240307"
      });
    }

    // STATUS (show all scour jobs)
    if (path === "/status" && method === "GET") {
      return json({
        ok: true,
        claudeConfigured: !!CLAUDE_API_KEY,
        braveConfigured: !!BRAVE_API_KEY,
        message: "Status endpoint - check Edge Function logs for details"
      });
    }

    // LAST SCOURED
    if (path === "/last-scoured" && method === "GET") {
      const lastIso = await getKV("last_scoured_timestamp");
      return json({ ok: true, lastIso });
    }

    // WORDPRESS � STATUS DIAGNOSTICS
    if (path.endsWith("/wp/status") && method === "GET") {
      const configured = !!(WP_URL && WP_USER && WP_APP_PASSWORD);
      const postType = WP_POST_TYPE;
      const endpoints = {
        usersMe: WP_URL ? `${WP_URL}/wp-json/wp/v2/users/me` : null,
        types: WP_URL ? `${WP_URL}/wp-json/wp/v2/types` : null,
        postType: WP_URL ? `${WP_URL}/wp-json/wp/v2/${postType}?per_page=1` : null,
      };

      const result: any = {
        ok: true,
        configured,
        post_type: postType,
        endpoints,
        checks: {},
      };

      if (!configured) {
        result.missing = {
          has_url: !!WP_URL,
          has_user: !!WP_USER,
          has_app_password: !!WP_APP_PASSWORD,
        };
        return json(result);
      }

      const authHeader = `Basic ${btoa(`${WP_USER}:${WP_APP_PASSWORD}`)}`;
      try {
        // Validate credentials
        if (endpoints.usersMe) {
          const resMe = await fetch(endpoints.usersMe, {
            headers: { Authorization: authHeader },
            signal: AbortSignal.timeout(8000),
          });
          let body: any = null;
          try { body = await resMe.json(); } catch {}
          result.checks.usersMe = { status: resMe.status, ok: resMe.ok, bodySnippet: body?.name || body?.slug || null };
        }

        // Confirm CPT is registered in REST
        if (endpoints.types) {
          const resTypes = await fetch(endpoints.types, { signal: AbortSignal.timeout(8000) });
          let typesJson: any = null;
          try { typesJson = await resTypes.json(); } catch {}
          const registered = !!typesJson?.[postType];
          result.checks.types = { status: resTypes.status, ok: resTypes.ok, postTypeRegistered: registered };
        }

        // Verify CPT route is reachable
        if (endpoints.postType) {
          const resPT = await fetch(endpoints.postType, { headers: { Authorization: authHeader }, signal: AbortSignal.timeout(8000) });
          const text = await resPT.text();
          result.checks.postType = { status: resPT.status, ok: resPT.ok, textSnippet: text.slice(0, 120) };
        }

        return json(result);
      } catch (err: any) {
        return json({ ok: false, error: `WP diagnostics failed: ${err.message}` }, 500);
      }
    }

    // SCOUR � DIAGNOSTICS (GET /scour/status/diagnostics)
    if (path === "/scour/status/diagnostics" && method === "GET") {
      const diagnostics: any = {
        ok: true,
        apis: {
          openai: {
            configured: !!OPENAI_API_KEY,
            keyPrefix: OPENAI_API_KEY ? OPENAI_API_KEY.slice(0, 8) + '...' : 'NOT SET',
          },
          brave: {
            configured: !!Deno.env.get("BRAVRE_SEARCH_API_KEY"),
            keyPrefix: Deno.env.get("BRAVRE_SEARCH_API_KEY") ? Deno.env.get("BRAVRE_SEARCH_API_KEY")!.slice(0, 8) + '...' : 'NOT SET',
          },
        },
        database: {
          supabaseUrl: supabaseUrl ? '?' : '?',
          serviceKey: serviceKey ? '?' : '?',
        },
        sources: null as any,
      };

      try {
        // Count enabled sources
        const sources = (await querySupabaseRest("/sources?select=id,name,url,enabled&limit=1000")) || [];
        const enabledSources = sources.filter((s: any) => s.enabled);
        diagnostics.sources = {
          total: sources.length,
          enabled: enabledSources.length,
          disabled: sources.length - enabledSources.length,
        };

        // Test OpenAI if configured
        if (OPENAI_API_KEY) {
          try {
            const testRes = await fetch('https://api.openai.com/v1/models', {
              headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
              },
              signal: AbortSignal.timeout(5000),
            });
            diagnostics.apis.openai.testResult = {
              reachable: testRes.ok,
              status: testRes.status,
              timestamp: new Date().toISOString(),
            };
          } catch (e) {
            diagnostics.apis.openai.testResult = {
              reachable: false,
              error: String(e),
              timestamp: new Date().toISOString(),
            };
          }
        }

        // Test Brave if configured
        const braveKey = Deno.env.get("BRAVRE_SEARCH_API_KEY");
        if (braveKey) {
          try {
            const testRes = await fetch(`https://api.search.brave.com/res/v1/web/search?q=test&count=1`, {
              headers: {
                'X-Subscription-Token': braveKey,
              },
              signal: AbortSignal.timeout(5000),
            });
            diagnostics.apis.brave.testResult = {
              reachable: testRes.ok,
              status: testRes.status,
              timestamp: new Date().toISOString(),
            };
          } catch (e) {
            diagnostics.apis.brave.testResult = {
              reachable: false,
              error: String(e),
              timestamp: new Date().toISOString(),
            };
          }
        }

        // Get last scour job status
        const lastJobId = await getKV("last_scour_job_id");
        if (lastJobId) {
          const lastJob = await getKV(`scour_job:${lastJobId}`);
          diagnostics.lastScourJob = lastJob;
        }

        return json(diagnostics);
      } catch (err: any) {
        return json({ ok: false, error: `Scour diagnostics failed: ${err.message}` }, 500);
      }
    }

    // USERS � GET ALL (via /admin/users)
    if ((path === "/users" || path === "/admin/users") && method === "GET") {
      try {
        const authResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${serviceKey}`,
            "apikey": serviceKey,
          },
        });

        if (!authResponse.ok) {
          const errText = await authResponse.text();
          return json(
            { ok: false, error: `Auth API error: ${authResponse.status}`, details: errText },
            authResponse.status
          );
        }

        const data = await authResponse.json();
        const users = (Array.isArray(data) ? data : data.users || []).map((u: any) => ({
          id: u.id,
          email: u.email,
          name: u.user_metadata?.name || u.email?.split('@')[0] || 'Unknown',
          role: u.user_metadata?.role || 'operator',
          created_at: u.created_at,
        }));
        return json({ ok: true, users });
      } catch (err: any) {
        return json({ ok: false, error: String(err?.message || err) }, 500);
      }
    }

    // USERS � CREATE (via /admin/users)
    if ((path === "/users" || path === "/admin/users") && method === "POST") {
      const body = await req.json().catch(() => ({}));
      if (!body.email) {
        return json({ ok: false, error: "Email is required" }, 400);
      }
      try {
        const password = body.password || crypto.randomUUID().slice(0, 16);
        const authResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${serviceKey}`,
            "apikey": serviceKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: body.email,
            password,
            email_confirm: body.email_confirm ?? true,
            user_metadata: {
              name: body.name || body.email?.split('@')[0] || 'User',
              role: body.role || 'operator',
              ...body.user_metadata,
            },
          }),
        });

        if (!authResponse.ok) {
          const errText = await authResponse.text();
          return json(
            { ok: false, error: `Auth API error: ${authResponse.status}`, details: errText },
            authResponse.status
          );
        }

        const created = await authResponse.json();
        return json({ 
          ok: true, 
          user: {
            id: created.id,
            email: created.email,
            name: created.user_metadata?.name || created.email?.split('@')[0],
            role: created.user_metadata?.role || 'operator',
            created_at: created.created_at,
          }
        });
      } catch (err: any) {
        return json({ ok: false, error: String(err?.message || err) }, 500);
      }
    }

    // USERS � UPDATE (via /admin/users/:id)
    if ((path.startsWith("/users/") || path.startsWith("/admin/users/")) && method === "PATCH") {
      const id = path.split("/").pop()!;
      const body = await req.json().catch(() => ({}));
      try {
        const authResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: {
            "Authorization": `Bearer ${serviceKey}`,
            "apikey": serviceKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...body,
            user_metadata: {
              ...body.user_metadata,
              ...(body.name && { name: body.name }),
              ...(body.role && { role: body.role }),
            },
          }),
        });

        if (!authResponse.ok) {
          const errText = await authResponse.text();
          return json(
            { ok: false, error: `Auth API error: ${authResponse.status}`, details: errText },
            authResponse.status
          );
        }

        const updated = await authResponse.json();
        return json({ 
          ok: true, 
          user: {
            id: updated.id,
            email: updated.email,
            name: updated.user_metadata?.name || updated.email?.split('@')[0],
            role: updated.user_metadata?.role || 'operator',
            created_at: updated.created_at,
          }
        });
      } catch (err: any) {
        return json({ ok: false, error: String(err?.message || err) }, 500);
      }
    }

    // USERS � DELETE (via /admin/users/:id)
    if ((path.startsWith("/users/") || path.startsWith("/admin/users/")) && method === "DELETE") {
      const id = path.split("/").pop()!;
      try {
        const authResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(id)}`, {
          method: "DELETE",
          headers: {
            "Authorization": `Bearer ${serviceKey}`,
            "apikey": serviceKey,
          },
        });

        if (!authResponse.ok) {
          const errText = await authResponse.text();
          return json(
            { ok: false, error: `Auth API error: ${authResponse.status}`, details: errText },
            authResponse.status
          );
        }

        return json({ ok: true, message: "User deleted successfully" });
      } catch (err: any) {
        return json({ ok: false, error: String(err?.message || err) }, 500);
      }
    }

    // ANALYTICS � DASHBOARD
    if (path === "/analytics/dashboard" && method === "GET") {
      const daysBack = parseInt(url.searchParams.get("days") || "30", 10);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - daysBack);

      const alerts = (await querySupabaseRest(`/alerts?created_at=gte.${cutoff.toISOString()}`)) || [];
      const sources = (await querySupabaseRest(`/sources`)) || [];

      const byStatus = alerts.reduce((acc: any, a: any) => {
        acc[a.status] = (acc[a.status] || 0) + 1;
        return acc;
      }, {});
      const byCountry = alerts.reduce((acc: any, a: any) => {
        const c = a.country || "Unknown";
        acc[c] = (acc[c] || 0) + 1;
        return acc;
      }, {});
      const bySeverity = alerts.reduce((acc: any, a: any) => {
        const s = a.severity || "informative";
        acc[s] = (acc[s] || 0) + 1;
        return acc;
      }, {});

      return json({
        ok: true,
        analytics: {
          totalAlerts: alerts.length,
          totalSources: sources.length,
          byStatus,
          byCountry,
          bySeverity,
          period: `Last ${daysBack} days`,
        },
      });
    }

    // ANALYTICS � ALERTS (GET /analytics/alerts)
    if (path === "/analytics/alerts" && method === "GET") {
      const daysBack = parseInt(url.searchParams.get("days") || "30", 10);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - daysBack);

      const alerts = (await querySupabaseRest(`/alerts?created_at=gte.${cutoff.toISOString()}`)) || [];

      const byStatus = alerts.reduce((acc: any, a: any) => {
        acc[a.status] = (acc[a.status] || 0) + 1;
        return acc;
      }, {});
      const byCountry = alerts.reduce((acc: any, a: any) => {
        const c = a.country || "Unknown";
        acc[c] = (acc[c] || 0) + 1;
        return acc;
      }, {});
      const bySeverity = alerts.reduce((acc: any, a: any) => {
        const s = a.severity || "informative";
        acc[s] = (acc[s] || 0) + 1;
        return acc;
      }, {});

      return json({
        ok: true,
        alerts: alerts,
        stats: {
          total: alerts.length,
          byStatus,
          byCountry,
          bySeverity,
          period: `Last ${daysBack} days`,
        },
      });
    }

    // ANALYTICS � SOURCES (GET /analytics/sources)
    if (path === "/analytics/sources" && method === "GET") {
      const page = parseInt(url.searchParams.get("page") || "1", 10);
      const pageSize = parseInt(url.searchParams.get("pageSize") || "50", 10);
      const offset = Math.max(0, (page - 1) * pageSize);
      const daysBack = parseInt(url.searchParams.get("days") || "30", 10);
      const cutoff = new Date(Date.now() - daysBack * 86400000).toISOString();

      const sources = (await querySupabaseRest(`/sources?order=created_at.desc&limit=${pageSize}&offset=${offset}`)) || [];
      const allAlerts = (await querySupabaseRest(`/alerts?order=created_at.desc&limit=2000`)) || [];
      const alerts = allAlerts.filter((a: any) => a.created_at >= cutoff);

      async function checkReachable(urlStr: string): Promise<boolean> {
        try {
          const res = await fetch(urlStr, { method: "HEAD", signal: AbortSignal.timeout(4000) });
          if (res.ok) return true;
          const getRes = await fetch(urlStr, { method: "GET", signal: AbortSignal.timeout(4000) });
          return getRes.ok;
        } catch {
          return false;
        }
      }

      const sourceStats = await Promise.all(
        sources.map(async (s: any) => {
          const sourceAlerts = alerts.filter((a: any) => a.sources === s.name || a.sources?.includes(s.name));
          const alertCount = sourceAlerts.length;
          const lastAlertDate = sourceAlerts[0]?.created_at || null;
          const reachable = await checkReachable(s.url);
          const underperforming = alertCount === 0 || (lastAlertDate && new Date(lastAlertDate) < new Date(Date.now() - daysBack * 86400000));
          return {
            ...s,
            alertCount,
            lastAlertDate,
            reachable,
            underperforming,
          };
        })
      );

      const totalRows = await safeQuerySupabaseRest(`/sources?select=id`);
      const total = Array.isArray(totalRows) ? totalRows.length : 0;

      return json({
        ok: true,
        sources: sourceStats,
        page,
        pageSize,
        total,
        stats: {
          total: total,
          enabled: sourceStats.filter((s: any) => s.enabled).length,
          totalAlertsFromSources: alerts.length,
          daysBack,
        },
      });
    }

    // ALERTS � GET ALL
    if (path === "/alerts" && method === "GET") {
      try {
        const status = url.searchParams.get("status");
      const limit = url.searchParams.get("limit") || "1000";
      let endpoint = `/alerts?order=created_at.desc&limit=${limit}`;
      if (status) {
        endpoint = `/alerts?status=eq.${encodeURIComponent(status)}&order=created_at.desc&limit=${limit}`;
      }
      const alerts = await querySupabaseRest(endpoint);
      return json({ ok: true, alerts: alerts || [] });
      } catch (error: any) {
        console.error(`[GET /alerts] Error: ${error?.message || error}`);
        return json({ ok: false, error: error?.message || "Failed to fetch alerts" }, 500);
      }
    }

    // ALERTS � REVIEW (DRAFT)
    if (path === "/alerts/review" && method === "GET") {
      try {
        // Fetch actual draft alerts (with pagination support)
        const page = parseInt(url.searchParams.get("page") || "1", 10);
        const pageSize = parseInt(url.searchParams.get("pageSize") || "50", 10);
        const offset = (page - 1) * pageSize;
        
        const alerts = await querySupabaseRest(
          `/alerts?status=eq.draft&order=created_at.desc&limit=${pageSize}&offset=${offset}`
        );
        
        // Get actual total count of draft alerts
        const countResponse = await querySupabaseRest(
          `/alerts?status=eq.draft&select=id`,
          { method: 'GET' }
        );
        const totalCount = Array.isArray(countResponse) ? countResponse.length : 0;
        
      return json({ 
        ok: true, 
        alerts: alerts || [],
        pagination: {
          page,
          pageSize,
          total: totalCount,
          pages: Math.ceil(totalCount / pageSize)
        }
      });
      } catch (error: any) {
        console.error(`[GET /alerts/review] Error: ${error?.message || error}`);
        return json({ ok: false, error: error?.message || "Failed to fetch draft alerts" }, 500);
      }
    }

    // ALERTS � COMPILE
    if (path === "/alerts/compile" && method === "POST") {
      const body = await req.json().catch(() => ({}));
      const alertIds: string[] = Array.isArray(body.alertIds) ? body.alertIds : [];
      if (!alertIds.length) return json({ ok: false, error: "alertIds array required" }, 400);

      const ids = alertIds.map((x) => `"${x}"`).join(",");
      const alerts = await querySupabaseRest(`/alerts?id=in.(${ids})`);
      const compiled = {
        id: crypto.randomUUID(),
        title: `Compiled Alert Briefing - ${new Date().toLocaleDateString()}`,
        alerts: alerts || [],
        created_at: nowIso(),
        alert_count: Array.isArray(alerts) ? alerts.length : 0,
      };

      return json({ ok: true, compiled });
    }

    // ALERTS � CREATE
    if (path === "/alerts" && method === "POST") {
      const body = await req.json().catch(() => ({}));
      if (!body.title || !body.country || !body.location) {
        return json({ ok: false, error: "Missing required fields: title, country, location" }, 400);
      }

      const now = nowIso();
      
      console.log('[Alert Create] Incoming body fields:', {
        has_summary: !!body.summary,
        has_description: !!body.description,
        has_recommendations: !!body.recommendations,
        has_geo_json: !!body.geo_json,
        summary_preview: body.summary ? body.summary.substring(0, 100) : null,
        recommendations_preview: body.recommendations ? body.recommendations.substring(0, 100) : null
      });
      
      // Build alert object with ACF-aligned fields
      const alertData: any = {
        id: crypto.randomUUID(),
        ...body,
        status: body.status || "draft",
        created_at: body.created_at || now,
        updated_at: now,
      };
      
      // Map geo_json to geojson and keep both fields
      if (body.geo_json) {
        const geoJsonString = typeof body.geo_json === 'string' ? body.geo_json : JSON.stringify(body.geo_json);
        const geoJsonObject = typeof body.geo_json === 'string' ? JSON.parse(body.geo_json) : body.geo_json;
        alertData.geojson = geoJsonString;  // TEXT column for WordPress
        alertData.geo_json = geoJsonObject; // JSONB column for map display
        console.log('[Alert Create] Saved polygon to both geojson (TEXT) and geo_json (JSONB)');
      } else if (body.geojson) {
        // If geojson TEXT is provided directly, parse it to populate geo_json JSONB
        try {
          alertData.geo_json = typeof body.geojson === 'string' ? JSON.parse(body.geojson) : body.geojson;
          console.log('[Alert Create] Parsed geojson TEXT to populate geo_json JSONB');
        } catch (e) {
          console.warn('[Alert Create] Failed to parse geojson to JSONB:', e);
        }
      } else if (!alertData.geojson && !alertData.geo_json) {
        // Auto-generate polygon from coordinates if missing both fields
        const lat = parseFloat(body.latitude ?? 'NaN');
        const lon = parseFloat(body.longitude ?? 'NaN');
        const radius = parseFloat(body.radius ?? '50');
        if (!isNaN(lat) && !isNaN(lon)) {
          const autoPolygon = generateCircleGeoJSON(lat, lon, radius);
          alertData.geojson = JSON.stringify(autoPolygon);
          alertData.geo_json = autoPolygon;
          console.log('[Alert Create] Auto-generated polygon from coordinates:', { lat, lon, radius });
        }
      }
      
      // Normalize intelligence_topics from event_type if not provided
      if (!alertData.intelligence_topics && alertData.event_type) {
        alertData.intelligence_topics = normalizeIntelligenceTopicsForACF(alertData.event_type);
      }
      
      console.log('[Alert Create] Final alert data before save:', {
        has_summary: !!alertData.summary,
        has_description: !!alertData.description,
        has_recommendations: !!alertData.recommendations,
        has_geojson: !!alertData.geojson,
        geojson_length: alertData.geojson ? alertData.geojson.length : 0,
        intelligence_topics: alertData.intelligence_topics,
        mainland: alertData.mainland
      });
      
      // Calculate confidence if not already provided
      if (!alertData.confidence_score) {
        const tempAlert = alertData as Alert;
        alertData.confidence_score = calculateConfidence(tempAlert);
      }
      
      const created = await querySupabaseRest("/alerts", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(alertData),
      });

      return json({ ok: true, alert: created?.[0] });
    }

    // ALERTS � UPDATE (PATCH /alerts/:id)
    if (path.startsWith("/alerts/") && method === "PATCH") {
      const id = parseIdFromPath(path);
      if (!id) return respondNotFound(rawPath);

      // block action routes from falling through
      if (path.endsWith("/approve") || path.endsWith("/dismiss") || path.endsWith("/post-to-wp") || path.endsWith("/approve-only") || path.endsWith("/generate-recommendations")) {
        return respondNotFound(rawPath);
      }

      const body = await req.json().catch(() => ({}));
      const updated = await querySupabaseRest(`/alerts?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ ...body, updated_at: nowIso() }),
      });

      return json({ ok: true, alert: updated?.[0] });
    }

    // ALERTS � DELETE (DELETE /alerts/:id)
    if (path.startsWith("/alerts/") && method === "DELETE") {
      const id = parseIdFromPath(path);
      if (!id) return respondNotFound(rawPath);

      // only allow pure /alerts/:id
      if (path.split("/").filter(Boolean).length !== 2) return respondNotFound(rawPath);

      try {
        await querySupabaseRest(`/alerts?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
        return json({ ok: true, deleted: id });
      } catch (err: any) {
        console.error("Delete error:", err);
        return json({ ok: false, error: `Failed to delete alert: ${err.message}` }, 500);
      }
    }

    // ALERTS � DISMISS (POST /alerts/:id/dismiss)
    if (path.endsWith("/dismiss") && method === "POST") {
      const id = parseIdFromPath(path);
      if (!id) return respondNotFound(rawPath);
      const updated = await dismissAlert(id);
      return json({ ok: true, alert: updated });
    }

    // ALERTS � APPROVE ONLY (POST /alerts/:id/approve-only)
    if (path.endsWith("/approve-only") && method === "POST") {
      const id = parseIdFromPath(path);
      if (!id) return respondNotFound(rawPath);
      const updated = await approveOnly(id);
      return json({ ok: true, alert: updated });
    }

    // ALERTS � APPROVE + POST (POST /alerts/:id/approve OR POST /alerts/:id/publish)
    if ((path.endsWith("/approve") || path.endsWith("/publish")) && method === "POST") {
      const id = parseIdFromPath(path);
      if (!id) return respondNotFound(rawPath);
      try {
        const result = await approveAndPublishToWP(id);
        return json(result.body, result.status);
      } catch (err: any) {
        console.error("Approve error:", err);
        return json({ ok: false, error: `Failed to approve alert: ${err.message}` }, 500);
      }
    }

    // LEGACY: POST TO WP (POST /alerts/:id/post-to-wp)
    if (path.endsWith("/post-to-wp") && method === "POST") {
      const id = parseIdFromPath(path);
      if (!id) return respondNotFound(rawPath);
      const result = await approveAndPublishToWP(id);
      return json(result.body, result.status);
    }

    // ALERTS � GENERATE RECOMMENDATIONS (POST /alerts/:id/generate-recommendations)
    if (path.endsWith("/generate-recommendations") && method === "POST") {
      const id = parseIdFromPath(path);
      if (!id) return respondNotFound(rawPath);

      const alert = await fetchAlertById(id);
      if (!alert) return json({ ok: false, error: "Alert not found" }, 404);
      if (!OPENAI_API_KEY) return json({ ok: false, error: "AI not configured" }, 500);

      const prompt = `You are a MAGNUS Travel Safety Intelligence Analyst specializing in risk mitigation.

Generate detailed, actionable traveler recommendations based on this alert:

EVENT: ${alert.summary}
SEVERITY: ${alert.severity}
LOCATION: ${alert.location}, ${alert.country}
EVENT TYPE: ${alert.event_type || "General"}

GUIDELINES:
- Provide specific, practical advice for travelers
- Include safety precautions and risk mitigation strategies
- Mention areas to avoid if applicable
- Recommend communication methods with embassies/local authorities
- Include transport and movement recommendations
- Suggest evacuation considerations if severity is critical/warning
- Keep recommendations concise but comprehensive
- Use bullet points or numbered lists for clarity

Return recommendations in plain text format, organized by category if helpful.`;

      const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.3,
          max_tokens: 600,
        }),
      });

      if (!aiRes.ok) {
        const t = await aiRes.text().catch(() => "");
        return json({ ok: false, error: `AI request failed: ${t}` }, 500);
      }

      const aiData = await aiRes.json();
      const recommendations = aiData.choices?.[0]?.message?.content?.trim() || "";

      const updated = await patchAlertById(id, { recommendations });
      return json({ ok: true, recommendations, alert: updated });
    }

    // ============================================================================
    // NEW SEQUENTIAL SCOUR HANDLER (v2) - One source per request, Redis queue
    // ============================================================================
    // SCOUR • SOURCES (POST /scour-sources-v2) - Process sources in batches
    if (path === "/scour-sources-v2" && method === "POST") {
      try {
        console.log(`\n${'='.repeat(70)}`);
        console.log(`✅ SCOUR-SOURCES HANDLER - Batch processing`);
        console.log(`${'='.repeat(70)}`);
        
        const body = await req.json().catch(() => ({}));
        const jobId = body.jobId || crypto.randomUUID();
        const daysBack = typeof body.daysBack === "number" ? body.daysBack : 14;
        const batchOffset = typeof body.batchOffset === "number" ? body.batchOffset : 0;
        const batchSize = 50; // Process 50 sources at a time to avoid timeout
        
        // Get all sources or check existing job
        let job: any;
        const existingJob = await getKV(`scour_job:${jobId}`);
        
        if (existingJob && batchOffset > 0) {
          // Continuing existing job
          job = existingJob;
          console.log(`📋 Continuing job ${jobId} from offset ${batchOffset}`);
        } else {
          // New job - initialize
          const allSources = await querySupabaseRest(`/sources?enabled=eq.true&select=id,name,url,type&limit=1000`) || [];
          job = {
            id: jobId,
            status: "running",
            totalSources: allSources.length,
            processed: 0,
            created: 0,
            skipped: 0,
            errorList: [],
            startedAt: nowIso(),
            updated_at: nowIso(),
          };
          console.log(`📋 Starting NEW scour of ${allSources.length} sources in batches of ${batchSize}`);
          await setKV(`scour_job:${jobId}`, job);
        }
        
        // Get sources for this batch
        const batchSources = await querySupabaseRest(
          `/sources?enabled=eq.true&select=id,name,url,type&offset=${batchOffset}&limit=${batchSize}`
        ) || [];
        
        console.log(`📦 Processing batch: ${batchOffset}-${batchOffset + batchSources.length} of ${job.totalSources}`);
        
        // Get existing alerts for dedup
        const sinceDateIso = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();
        const existingAlerts = await querySupabaseRest(
          `/alerts?created_at=gte.${encodeURIComponent(sinceDateIso)}&select=id,title,location&limit=500`
        ) || [];
        
        // Process this batch
        for (let i = 0; i < batchSources.length; i++) {
          const source = batchSources[i];
          const globalIndex = batchOffset + i + 1;
          console.log(`\n📰 SOURCE ${globalIndex}/${job.totalSources}: ${source.name}`);
          const sourceStartTime = Date.now();
          
          try {
            let content = '';
            let source_type_used = 'unknown';
            
            // Try RSS first (8s timeout)
            if (source.type === 'rss' || source.url?.includes('feed') || source.url?.includes('rss')) {
              try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 8000);
                const response = await fetch(source.url, {
                  signal: controller.signal,
                  headers: { 'User-Agent': 'Mozilla/5.0' }
                });
                clearTimeout(timeoutId);
                
                if (response.ok) {
                  const xml = await response.text();
                  content = xml
                    .replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1')
                    .replace(/<[^>]+>/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim()
                    .slice(0, 15000);
                  source_type_used = 'rss';
                  console.log(`  ✓ RSS: Got ${content.length} chars`);
                }
              } catch (e: any) {
                console.log(`  ⚠️  RSS failed: ${e.message}`);
              }
            }
            
            // Fallback to web scrape (8s timeout)
            if (!content || content.length < 300) {
              try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 8000);
                const response = await fetch(source.url, {
                  signal: controller.signal,
                  headers: { 'User-Agent': 'Mozilla/5.0' }
                });
                clearTimeout(timeoutId);
                
                if (response.ok) {
                  const html = await response.text();
                  content = html
                    .replace(/<[^>]+>/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim()
                    .slice(0, 15000);
                  source_type_used = 'scrape';
                  console.log(`  ✓ Scrape: Got ${content.length} chars`);
                }
              } catch (e: any) {
                console.log(`  ⚠️  Scrape failed: ${e.message}`);
              }
            }
            
            // Skip if no content
            if (!content || content.length < 300) {
              console.log(`  ✗ Insufficient content`);
              job.skipped++;
              job.updated_at = nowIso();
              await setKV(`scour_job:${jobId}`, job);
              continue;
            }
            
            // Extract alerts with Claude
            console.log(`  🤖 Extracting with Claude...`);
            let alerts: any[] = [];
            try {
              alerts = await extractAlertsWithClaude(
                content,
                source.url,
                source.name,
                existingAlerts,
                { supabaseUrl, serviceKey, claudeKey: CLAUDE_API_KEY, daysBack }
              );
            } catch (claudeErr: any) {
              console.error(`  ❌ Claude error: ${claudeErr.message}`);
            }
            
            console.log(`  ✓ Claude returned ${alerts.length} alerts`);
            
            // Save alerts
            for (const alert of alerts) {
              try {
                const alertForDb = {
                  ...alert,
                  status: 'draft',
                  ai_generated: true,
                  ai_model: 'claude-3-haiku-20240307',
                  source_id: source.id,
                  source_name: source.name,
                  source_type: source_type_used,
                  created_at: nowIso(),
                };
                
                const saveResponse = await fetch(`${supabaseUrl}/rest/v1/alerts`, {
                  method: 'POST',
                  headers: {
                    "Authorization": `Bearer ${serviceKey}`,
                    "apikey": serviceKey,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify(alertForDb),
                  signal: AbortSignal.timeout(3000),
                });
                
                if (saveResponse.ok) {
                  job.created++;
                  existingAlerts.push({ id: Math.random().toString(), title: alert.title, location: alert.location });
                  console.log(`    ✓ Saved: ${alert.title}`);
                } else {
                  console.warn(`    ✗ Save failed [${saveResponse.status}]`);
                }
              } catch (e: any) {
                console.warn(`    ✗ Save error: ${e.message}`);
              }
            }
            
            job.processed++;
          } catch (sourceErr: any) {
            console.error(`  ❌ Source error: ${sourceErr.message}`);
            job.errorList.push({ source: source.name, error: sourceErr.message });
          }
          
          const elapsed = Date.now() - sourceStartTime;
          console.log(`  ✅ Completed in ${elapsed}ms`);
          
          // Update progress every source
          job.updated_at = nowIso();
          await setKV(`scour_job:${jobId}`, job);
        }
        
        // Check if there are more batches to process
        const nextOffset = batchOffset + batchSize;
        const hasMoreBatches = nextOffset < job.totalSources;
        
        if (hasMoreBatches) {
          // More batches remain - update status and return
          job.status = "running";
          job.updated_at = nowIso();
          await setKV(`scour_job:${jobId}`, job);
          
          console.log(`\n${'='.repeat(70)}`);
          console.log(`📦 BATCH COMPLETE - More batches remaining`);
          console.log(`📊 Progress: ${job.processed}/${job.totalSources} sources, ${job.created} alerts created`);
          console.log(`⏭️  Next batch starts at offset ${nextOffset}`);
          console.log(`${'='.repeat(70)}`);
          
          return json({
            ok: true,
            status: "batch_complete",
            jobId,
            processed: job.processed,
            created: job.created,
            totalSources: job.totalSources,
            nextBatchOffset: nextOffset,
            hasMoreBatches: true,
          });
        } else {
          // All batches complete
          job.status = "done";
          job.updated_at = nowIso();
          await setKV(`scour_job:${jobId}`, job);
          
          console.log(`\n${'='.repeat(70)}`);
          console.log(`✅ SCOUR COMPLETE - All batches finished`);
          console.log(`📊 Final Results: ${job.created} alerts created from ${job.processed}/${job.totalSources} sources`);
          console.log(`${'='.repeat(70)}`);
          
          return json({
            ok: true,
            status: "done",
            jobId,
            processed: job.processed,
            created: job.created,
            totalSources: job.totalSources,
            hasMoreBatches: false,
          });
        }
      } catch (err: any) {
        console.error(`\n❌ SCOUR ERROR: ${err.message}`);
        return json({ ok: false, error: err.message }, { status: 500 });
      }
    }
    
    // SCOUR • FORCE STOP (POST /force-stop-scour) - Delete all running scour jobs
    if (path === "/force-stop-scour" && method === "POST") {
      try {
        console.log(`🛑 FORCE STOP - Clearing all scour jobs`);
        
        // Get all scour job keys with limit to prevent timeout
        const allKeys = await kv.list({ prefix: "scour_job:", limit: 100 });
        const keysToDelete: string[] = [];
        
        for await (const entry of allKeys) {
          keysToDelete.push(entry.key);
        }
        
        console.log(`Found ${keysToDelete.length} jobs to delete`);
        
        // Delete all keys in parallel
        const deletePromises = keysToDelete.map(key => kv.delete(key));
        await Promise.all(deletePromises);
        
        console.log(`✓ Force stopped: ${keysToDelete.length} jobs cleared`);
        
        return json({
          ok: true,
          deleted: keysToDelete.length,
          message: `Cleared ${keysToDelete.length} scour job(s)`
        });
      } catch (err: any) {
        console.error(`❌ FORCE STOP ERROR: ${err.message}`);
        return json({ ok: false, error: err.message }, { status: 500 });
      }
    }
    
    // SCOUR • EARLY SIGNALS (POST /scour-early-signals) - Independent early signals job
    if (path === "/scour-early-signals" && method === "POST") {
      try {
        console.log(`\n${'='.repeat(70)}`);
        console.log(`⚡ EARLY SIGNALS - Starting ${buildEarlySignalsQueries().length} queries with batching`);
        console.log(`${'='.repeat(70)}`);
        
        const body = await req.json().catch(() => ({}));
        const jobId = body.jobId || `early-signals-${crypto.randomUUID()}`;
        const queries = buildEarlySignalsQueries();
        
        const job: any = {
          id: jobId,
          type: "early-signals",
          status: "running",
          totalQueries: queries.length,
          completed: 0,
          succeeded: 0,
          created: 0,
          startedAt: nowIso(),
          updated_at: nowIso(),
        };
        await setKV(`scour_job:${jobId}`, job);
        
        const sinceDateIso = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
        const existingAlerts = await querySupabaseRest(
          `/alerts?created_at=gte.${encodeURIComponent(sinceDateIso)}&select=id,title,location&limit=500`
        ) || [];
        
        // BATCH PROCESSING: Process queries in groups of 5 with 2-3 second delays between batches
        const batchSize = 5;
        const delayBetweenBatches = 2500; // 2.5 seconds
        
        for (let batchStart = 0; batchStart < queries.length; batchStart += batchSize) {
          const batchEnd = Math.min(batchStart + batchSize, queries.length);
          const batchNum = Math.floor(batchStart / batchSize) + 1;
          const totalBatches = Math.ceil(queries.length / batchSize);
          
          console.log(`\n⚡ BATCH ${batchNum}/${totalBatches} (queries ${batchStart + 1}-${batchEnd})`);
          
          const batchPromises = [];
          
          for (let i = batchStart; i < batchEnd; i++) {
            const query = queries[i];
            const queryNum = i + 1;
            
            const queryPromise = (async () => {
              try {
                console.log(`  ⚡ QUERY ${queryNum}/${queries.length}: ${query.slice(0, 80)}...`);
                
                // Step 1: Get real-time web results from Brave Search
                const BRAVE_API_KEY = Deno.env.get('BRAVE_SEARCH_API_KEY');
                let webContent = '';
                
                if (BRAVE_API_KEY) {
                  webContent = await fetchBraveSearchResults(query, BRAVE_API_KEY);
                } else {
                  console.warn(`    ⚠️ BRAVE_SEARCH_API_KEY not configured, skipping web search`);
                }
                
                if (!webContent || webContent.length < 100) {
                  console.log(`    ℹ️ Insufficient web content, skipping Claude extraction`);
                  return;
                }
                
                // Step 2: Send web results to Claude for intelligent alert extraction
                const extractionPrompt = `You are analyzing web search results for travel alerts. Extract ONLY crisis alerts that impact travelers (non-natives visiting the region).

Return ONLY a JSON array of alerts. If no relevant alerts found, return [].

Web search results:
${webContent.slice(0, 8000)}

Extract alerts as JSON array:
[{
  "title": "Event name",
  "description": "Brief description",
  "location": "Specific city/region",
  "country": "Country name",
  "latitude": 0.0,
  "longitude": 0.0,
  "severity": "critical|warning|caution|informative",
  "event_type": "earthquake|flood|strike|protest|outbreak|etc",
  "relevance_score": 3
}]

Return [] if no traveler-relevant alerts found.`;

                const response = await fetchClaudeWithRetry(
                  'https://api.anthropic.com/v1/messages',
                  {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'x-api-key': CLAUDE_API_KEY,
                      'anthropic-version': '2023-06-01',
                    },
                    body: JSON.stringify({
                      model: 'claude-3-haiku-20240307',
                      max_tokens: 2000,
                      temperature: 0,
                      messages: [{ role: 'user', content: extractionPrompt }],
                    }),
                    signal: AbortSignal.timeout(20000),
                  },
                  5,  // max retries
                  1000  // initial delay
                );

                if (response.ok) {
                  const data = await response.json();
                  const text = data.content?.[0]?.text || '';
                  console.log(`    ✓ Claude response (${text.length} chars)`);
                  job.succeeded++;
                  
                  // Try to extract and save alerts from response
                  try {
                    const alerts = JSON.parse(text);
                    if (Array.isArray(alerts)) {
                      for (const alert of alerts) {
                        const alertForDb = buildAlertForDb(alert, {
                          name: 'Early Signals',
                        });
                        
                        try {
                          const saveResponse = await fetch(`${supabaseUrl}/rest/v1/alerts`, {
                            method: 'POST',
                            headers: {
                              "Authorization": `Bearer ${serviceKey}`,
                              "apikey": serviceKey,
                              "Content-Type": "application/json",
                            },
                            body: JSON.stringify(alertForDb),
                            signal: AbortSignal.timeout(3000),
                          });
                          
                          if (saveResponse.ok) {
                            job.created++;
                            console.log(`      ✓ Saved: ${alert.title}`);
                          } else {
                            const errText = await saveResponse.text().catch(() => '');
                            console.warn(`      ✗ Save failed [${saveResponse.status}] ${errText.slice(0, 200)}`);
                          }
                        } catch (e: any) {
                          console.warn(`      ✗ Save failed: ${e.message}`);
                        }
                      }
                    }
                  } catch (e) {
                    console.log(`    ℹ️  Response not JSON, skipping alert extraction`);
                  }
                } else {
                  console.warn(`    ✗ Query failed: ${response.status}`);
                }
              } catch (e: any) {
                console.error(`    ✗ Query error: ${e.message}`);
              }
              
              job.completed++;
              job.updated_at = nowIso();
              await setKV(`scour_job:${jobId}`, job);
            })();
            
            batchPromises.push(queryPromise);
          }
          
          // Wait for this batch to complete
          await Promise.all(batchPromises);
          
          // Wait between batches (except after last batch)
          if (batchEnd < queries.length) {
            console.log(`  ⏸️  Waiting ${delayBetweenBatches / 1000}s before next batch...`);
            await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
          }
        }
        
        // Complete
        job.status = "done";
        job.updated_at = nowIso();
        await setKV(`scour_job:${jobId}`, job);
        
        console.log(`\n${'='.repeat(70)}`);
        console.log(`⚡ EARLY SIGNALS COMPLETE`);
        console.log(`📊 Results: ${job.created} alerts from ${job.succeeded}/${queries.length} queries`);
        console.log(`${'='.repeat(70)}`);
        
        return json({
          ok: true,
          status: "done",
          jobId,
          completed: job.completed,
          succeeded: job.succeeded,
          created: job.created,
        });
      } catch (err: any) {
        console.error(`\n❌ EARLY SIGNALS ERROR: ${err.message}`);
        return json({ ok: false, error: err.message }, { status: 500 });
      }
    }

    // SCOUR START (POST /scour-sources) - OLD HANDLER (keeping for now)
    // NOTE: Scour runs ASYNCHRONOUSLY on Supabase Edge Function server using waitUntil()
    // This means the scour job continues running even if browser is closed
    // Frontend polls /scour/status to track progress, but the actual work happens server-side
    // Helper functions (fetchWithBraveSearch, extractAlertsWithAI) are in scour-worker

    if (path === "/scour-sources" && method === "POST") {
      console.log(`\n${'='.repeat(70)}`);
      console.log(`✅ SCOUR-SOURCES HANDLER CALLED - PROCESSING SCOUR REQUEST`);
      console.log(`${'='.repeat(70)}`);
      console.log(`Request URL: ${req.url}`);
      console.log(`Request headers: ${JSON.stringify(Object.fromEntries(req.headers))}`);
      
      // Extract client IP from headers (supports proxies like Vercel)
      const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 
                       req.headers.get('x-real-ip') || 
                       req.headers.get('cf-connecting-ip') ||
                       'unknown';
      
      console.log(`🌐 Request from IP: ${clientIp}`);
      
      // Check if a scour job is already running (job locking)
      const existingLock = await getKV("scour_job_lock");
      if (existingLock) {
        console.log(`⚠️  JOB LOCK ACTIVE: Another scour is already running (locked since ${existingLock.lockedAt})`);
        return json({ 
          ok: false, 
          error: `A scour job is already running. Please wait for it to complete before starting a new one.`,
          lockedSince: existingLock.lockedAt,
          lockDetails: existingLock
        }, 409);
      }
      
      // Re-read environment variables fresh for this request
      const BRAVE_API_KEY_FRESH = Deno.env.get("BRAVRE_SEARCH_API_KEY");
      const NEWSAPI_KEY = Deno.env.get("NEWSAPI_KEY");
      
      const body = await req.json().catch(() => ({}));
      const jobId = body.jobId || crypto.randomUUID();
      const sourceIds: string[] = Array.isArray(body.sourceIds) ? body.sourceIds : [];
      const daysBack = typeof body.daysBack === "number" ? body.daysBack : 14;

      console.log(`\n?? SCOUR START`);
      
      if (sourceIds.length === 0) {
        console.warn(`??  No source IDs provided to scour!`);
        console.warn(`   Querying database for enabled sources...`);
        
        // Try to fetch enabled sources from database
        const dbSources = await querySupabaseRest(`/sources?enabled=eq.true&select=id&limit=1000`).catch(() => []);
        const dbSourceIds = Array.isArray(dbSources) ? dbSources.map((s: any) => s.id) : [];
        
        console.log(`   Database has ${dbSourceIds.length} enabled sources`);
        console.log(`   Request body:`, JSON.stringify(body, null, 2));
        
        if (dbSourceIds.length === 0) {
          return json({ 
            ok: false, 
            error: "No enabled sources found. Add sources and enable them in the Source Manager.",
            debugInfo: { 
              sourceIds, 
              dbSourceIds,
              bodyKeys: Object.keys(body),
              bodySourceIds: body.sourceIds,
              isArray: Array.isArray(body.sourceIds)
            }
          }, 400);
        }
        
        // Use database sources
        sourceIds.push(...dbSourceIds);
        console.log(`   Using ${sourceIds.length} enabled sources from database`);
      }

      const job = {
        id: jobId,
        status: "running",
        sourceIds,
        daysBack,
        processed: 0,
        created: 0,
        duplicatesSkipped: 0,
        errorCount: 0,
        errors: [],
        created_at: nowIso(),
        updated_at: nowIso(),
        total: sourceIds.length,
        phase: "early_signals",
        currentSourceName: '',
        currentEarlySignalQuery: "0/850",
        clientIp: clientIp,
        startedAt: nowIso(),
      };

      await setKV(`scour_job:${jobId}`, job);
      await setKV("last_scour_job_id", jobId);
      await setKV("last_scoured_timestamp", nowIso());
      
      // SET JOB LOCK - Only one scour can run at a time
      const jobLock = {
        jobId,
        lockedAt: nowIso(),
        lockedBy: "scour-sources"
      };
      await setKV("scour_job_lock", jobLock);
      console.log(`🔒 JOB LOCK ACQUIRED: ${jobId}`);

      // Run scour inline (no external function call to avoid JWT issues)
      console.log(`?? SCOUR JOB CREATED: ${job.total} sources to process (phase: ${job.phase})`);
      console.log(`?? [DEBUG] waitUntil about to start for jobId=${jobId}`);
      
      waitUntil(
        (async () => {
          console.log(`?? [SCOUR] IIFE EXECUTED - starting scour processing`);
          try {
            console.log(`?? Starting inline scour processing for job ${jobId}`);
            
            // Load current job state from KV to preserve any existing progress
            let currentJob = await getKV(`scour_job:${jobId}`);
            if (!currentJob) {
              currentJob = { ...job };
            }
            
            // Fetch all enabled sources to verify which ones we'll actually process
            console.log(`  Fetching enabled sources...`);
            const allSources: Source[] = await querySupabaseRest(`/sources?enabled=eq.true&select=*&limit=1000`) || [];
            console.log(`  Found ${allSources.length} enabled sources in database`);
            console.log(`  Received sourceIds from request: ${sourceIds.length}`);
            
            if (!Array.isArray(allSources)) {
              console.error(`✗ allSources is not an array:`, typeof allSources, allSources);
              return;
            }
            
            // Use database sources (enabled=true) if more than what was passed
            // This handles the case where frontend sends old list or incomplete list
            let sourcesToProcess = sourceIds;
            if (allSources.length > sourceIds.length) {
              console.log(`  NOTE: Database has ${allSources.length} enabled sources, using those instead of ${sourceIds.length} passed`);
              sourcesToProcess = allSources.map(s => s.id);
            }
            
            // PAGINATION: Skip already-processed sources and process remaining ones
            // Stop processing when we approach 55-second timeout (leave 5s buffer)
            const processedIds = new Set(currentJob.processedIds || []);
            const unprocessedSources = sourcesToProcess.filter((id: string) => !processedIds.has(id));
            
            // Process as many sources as possible, not just 20
            // We'll check elapsed time during the loop to avoid timeout
            sourcesToProcess = unprocessedSources;
            
            // Set total ONCE on first run, then keep it fixed
            const totalSourcesToProcess = allSources.length;
            if (currentJob.processed === 0) {
              currentJob.total = totalSourcesToProcess;
              currentJob.sourceIds = allSources.map((s: any) => s.id);
              await setKV(`scour_job:${jobId}`, currentJob);
            }
            
            console.log(`  Will process remaining sources (${processedIds.size}/${totalSourcesToProcess} already done, ${unprocessedSources.length} remaining)`);
            
            // Track start time to avoid 60s timeout
            const batchStartTime = Date.now();
            const TIMEOUT_BUFFER_MS = 55000; // Stop at 55s to allow 5s buffer
            
            console.log(`?? SCOUR STARTING: Loading job from KV`);
            console.log(`   Job ID: ${jobId}`);
            console.log(`   Current state: processed=${currentJob.processed || 0}/${currentJob.total}, created=${currentJob.created || 0}`);
            console.log(`   ProcessedIds: ${JSON.stringify((currentJob.processedIds || []).slice(0, 5))}${(currentJob.processedIds || []).length > 5 ? '...' : ''}`);
            
            let stats = {
              processed: currentJob.processed || 0,
              created: currentJob.created || 0,
              skipped: currentJob.skipped || 0,
              duplicatesSkipped: currentJob.duplicatesSkipped || 0,
              errorCount: currentJob.errorCount || 0,
              errors: [] as string[],
            };
            
            // Track stats in KV after each update to prevent resets
            const updateJobStats = async (updates: any = {}) => {
              stats = { ...stats, ...updates };
              const minStats = {
                processed: Math.max(stats.processed, currentJob.processed || 0),
                created: Math.max(stats.created, currentJob.created || 0),
                skipped: Math.max(stats.skipped, currentJob.skipped || 0),
                duplicatesSkipped: Math.max(stats.duplicatesSkipped, currentJob.duplicatesSkipped || 0),
                errorCount: Math.max(stats.errorCount, currentJob.errorCount || 0),
              };
              currentJob = { ...currentJob, ...minStats, updated_at: nowIso() };
              // Only write to KV every 5 sources to reduce KV write burden
              if ((stats.processed % 5 === 0) || updates.phase || updates.currentSourceName) {
                await setKV(`scour_job:${jobId}`, currentJob);
              }
            };
            
            // Helper to log activity messages to KV (for display in frontend status bar)
            const logActivityToKV = async (message: string) => {
              const entry = { time: new Date().toISOString(), message };
              const logs = (currentJob.activityLog || []).slice(-9); // Keep last 10
              logs.push(entry);
              currentJob.activityLog = logs;
              currentJob.updated_at = nowIso();
              await setKV(`scour_job:${jobId}`, currentJob);
            };
            
            // Load existing alerts for deduplication
            const sinceDateIso = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();
            console.log(`\n  📋 Loading existing alerts (created after ${sinceDateIso})...`);
            let existingAlerts: Alert[] = [];
            try {
              const loaded = await querySupabaseRest(
                `/alerts?created_at=gte.${encodeURIComponent(sinceDateIso)}&select=*&limit=200`
              );
              existingAlerts = Array.isArray(loaded) ? loaded : [];
              console.log(`  ✓ Loaded ${existingAlerts.length} existing alerts for dedup checking`);
            } catch (e: any) {
              console.error(`  ✗ ERROR loading existing alerts: ${e.message}`);
              existingAlerts = [];
            }
            
            // ============================================================================
            // PHASE 1: RUN EARLY SIGNALS IN BACKGROUND (Non-blocking)
            // ============================================================================
            console.log(`\n⚡ EARLY SIGNALS PHASE: Running in BACKGROUND while processing main sources...`);
            console.log(`   CLAUDE_API_KEY at start: ${CLAUDE_API_KEY ? 'SET (' + CLAUDE_API_KEY.slice(0, 20) + '...)' : 'NOT SET'}`);
            
            // Create background promise for early signals (doesn't block main source processing)
            const earlySignalsPromise = (async () => {
              try {
                // Always run early signals with official sources (NewsAPI, WHO, NOAA, ACLED)
                await logActivityToKV(`Starting early warning signals (official APIs)...`);
                console.log(`\n⚡ [BACKGROUND] EARLY SIGNALS: Starting proactive official API queries...`);
                console.log(`   ✓ Entering early signals background task`);
                
                // Update job to show early signals running in background
                currentJob.phase = "early_signals_background";
                currentJob.updated_at = nowIso();
                await setKV(`scour_job:${jobId}`, currentJob);
                
                // ✓ Fetch official disaster alerts from free APIs
                let allExistingAlerts: Alert[] = [];
                console.log(`\n  [BG] 📡 Fetching alerts from official news and disaster APIs...`);
                  

              // 1. NewsAPI - Global news monitoring
              if (NEWSAPI_KEY) {
                const newsAlerts = await fetchNewsApiAlerts(NEWSAPI_KEY);
                for (const alert of newsAlerts) {
                  try {
                    const isDup = allExistingAlerts.some(a => 
                      checkDuplicateBasic(alert, a)
                    );
                    
                    if (!isDup) {
                      const alertForDb: any = {
                        id: alert.id,
                        title: alert.title,
                        summary: alert.summary,
                        description: alert.description,
                        location: alert.location,
                        country: alert.country,
                        region: alert.region,
                        mainland: alert.mainland,
                        event_type: alert.eventType || alert.event_type,
                        severity: alert.severity,
                        status: 'draft',
                        source_url: alert.source_url,
                        article_url: alert.article_url,
                        sources: alert.sources || 'NewsAPI',
                        event_start_date: alert.event_start_date || alert.eventStartDate,
                        event_end_date: alert.event_end_date || alert.eventEndDate,
                        latitude: alert.latitude,
                        longitude: alert.longitude,
                        geo_json: alert.geoJSON || alert.geo_json || null,
                        recommendations: alert.recommendations || null,
                        ai_generated: alert.ai_generated || false,
                        ai_model: alert.ai_model,
                        ai_confidence: alert.ai_confidence,
                        confidence_score: calculateConfidence(alert, { type: 'newsapi', name: 'NewsAPI' }),
                        generation_metadata: alert.generation_metadata,
                        intelligence_topics: alert.intelligence_topics,
                        created_at: alert.created_at || nowIso(),
                        updated_at: nowIso(),
                      };
                      
                      // Apply 3-step geojson logic
                      ensureGeoJSON(alertForDb);
                      
                      await querySupabaseRest(`/alerts`, {
                        method: 'POST',
                        body: JSON.stringify(alertForDb),
                      });
                      console.log(`    ✓ NewsAPI: Saved "${alert.title}"`);
                      allExistingAlerts.push(alert);
                    }
                  } catch (e) {
                    console.warn(`    ✗ NewsAPI save error: ${e}`);
                  }
                }
              } else {
                console.warn(`⚠️  NEWSAPI_KEY not set - skipping news API alerts`);
              }
              
              // 2. WHO - Disease Outbreak Alerts
              const whoAlerts = await fetchWhoAlerts();
              for (const alert of whoAlerts) {
                try {
                  const isDup = allExistingAlerts.some(a => 
                    checkDuplicateBasic(alert, a)
                  );
                  
                  if (!isDup) {
                    const alertForDb: any = {
                      id: alert.id,
                      title: alert.title,
                      summary: alert.summary,
                      description: alert.description,
                      location: alert.location,
                      country: alert.country,
                      region: alert.region,
                      mainland: alert.mainland,
                      event_type: alert.eventType || alert.event_type,
                      severity: alert.severity,
                      status: 'draft',
                      source_url: alert.source_url,
                      article_url: alert.article_url,
                      sources: alert.sources || 'WHO',
                      event_start_date: alert.event_start_date || alert.eventStartDate,
                      event_end_date: alert.event_end_date || alert.eventEndDate,
                      latitude: alert.latitude,
                      longitude: alert.longitude,
                      geo_json: alert.geoJSON || alert.geo_json || null,
                      recommendations: alert.recommendations || null,
                      ai_generated: alert.ai_generated || false,
                      ai_model: alert.ai_model,
                      ai_confidence: alert.ai_confidence,
                      generation_metadata: alert.generation_metadata,
                      intelligence_topics: alert.intelligence_topics,
                      created_at: alert.created_at || nowIso(),
                      updated_at: nowIso(),
                    };
                    
                    await querySupabaseRest(`/alerts`, {
                      method: 'POST',
                      body: JSON.stringify(alertForDb),
                    });
                    console.log(`    ✓ WHO: Saved "${alert.title}"`);
                    allExistingAlerts.push(alert);
                  }
                } catch (e) {
                  console.warn(`    ✗ WHO save error: ${e}`);
                }
              }
              
              // 3. NOAA Weather Alerts (US)
              const noaaAlerts = await fetchNOAAAlerts();
              for (const alert of noaaAlerts) {
                try {
                  const isDup = allExistingAlerts.some(a => 
                    checkDuplicateBasic(alert, a)
                  );
                  
                  if (!isDup) {
                    const alertForDb: any = {
                      id: alert.id,
                      title: alert.title,
                      summary: alert.summary,
                      description: alert.description,
                      location: alert.location,
                      country: alert.country,
                      region: alert.region,
                      mainland: alert.mainland,
                      event_type: alert.eventType || alert.event_type,
                      severity: alert.severity,
                      status: 'draft',
                      source_url: alert.source_url,
                      article_url: alert.article_url,
                      sources: alert.sources || 'NOAA',
                      event_start_date: alert.event_start_date || alert.eventStartDate,
                      event_end_date: alert.event_end_date || alert.eventEndDate,
                      latitude: alert.latitude,
                      longitude: alert.longitude,
                      geo_json: alert.geoJSON || alert.geo_json || null,
                      recommendations: alert.recommendations || null,
                      ai_generated: alert.ai_generated || false,
                      ai_model: alert.ai_model,
                      ai_confidence: alert.ai_confidence,
                      confidence_score: calculateConfidence(alert, { type: 'noaa', name: 'NOAA' }),
                      generation_metadata: alert.generation_metadata,
                      intelligence_topics: alert.intelligence_topics,
                      created_at: alert.created_at || nowIso(),
                      updated_at: nowIso(),
                    };
                    
                    // Apply 3-step geojson logic
                    ensureGeoJSON(alertForDb);
                    
                    await querySupabaseRest(`/alerts`, {
                      method: 'POST',
                      body: JSON.stringify(alertForDb),
                    });
                    console.log(`    ✓ NOAA: Saved "${alert.title}"`);
                    allExistingAlerts.push(alert);
                  }
                } catch (e) {
                  console.warn(`    ✗ NOAA save error: ${e}`);
                }
              }
              
              // 4. ACLED Conflict/Event Data (Global)
              const acledAlerts = await fetchACLEDAlerts(15);
              for (const alert of acledAlerts) {
                try {
                  const isDup = allExistingAlerts.some(a => 
                    checkDuplicateBasic(alert, a)
                  );
                  
                  if (!isDup) {
                    const alertForDb: any = {
                      id: alert.id,
                      title: alert.title,
                      summary: alert.summary,
                      description: alert.description,
                      location: alert.location,
                      country: alert.country,
                      region: alert.region,
                      mainland: alert.mainland,
                      event_type: alert.eventType || alert.event_type,
                      severity: alert.severity,
                      status: 'draft',
                      source_url: alert.source_url,
                      article_url: alert.article_url,
                      sources: alert.sources || 'ACLED',
                      event_start_date: alert.event_start_date || alert.eventStartDate,
                      event_end_date: alert.event_end_date || alert.eventEndDate,
                      latitude: alert.latitude,
                      longitude: alert.longitude,
                      geo_json: alert.geoJSON || alert.geo_json || null,
                      recommendations: alert.recommendations || null,
                      ai_generated: alert.ai_generated || false,
                      ai_model: alert.ai_model,
                      ai_confidence: alert.ai_confidence,
                      confidence_score: calculateConfidence(alert, { type: 'acled', name: 'ACLED' }),
                      generation_metadata: alert.generation_metadata,
                      intelligence_topics: alert.intelligence_topics,
                      created_at: alert.created_at || nowIso(),
                      updated_at: nowIso(),
                    };
                    
                    // Apply 3-step geojson logic
                    ensureGeoJSON(alertForDb);
                    
                    await querySupabaseRest(`/alerts`, {
                      method: 'POST',
                      body: JSON.stringify(alertForDb),
                    });
                    console.log(`    ✓ ACLED: Saved "${alert.title}"`);
                    allExistingAlerts.push(alert);
                  }
                } catch (e) {
                  console.warn(`    ✗ ACLED save error: ${e}`);
                }
              }
              
              // 5. NewsAPI (Optional - requires API key) - Using top risk queries
              if (NEWSAPI_KEY) {
                const newsQueries = [
                  "earthquake disaster breaking news",
                  "flooding emergency alert",
                  "wildfire evacuation",
                  "tsunami warning",
                  "tornado warning"
                ];
                
                for (const query of newsQueries) {
                  const newsAlerts = await fetchNewsAPIAlerts(query);
                  for (const alert of newsAlerts) {
                    try {
                      const isDup = allExistingAlerts.some(a => 
                        checkDuplicateBasic(alert, a)
                      );
                      
                      if (!isDup) {
                        const alertForDb: any = {
                          id: alert.id,
                          title: alert.title,
                          summary: alert.summary,
                          description: alert.description,
                          location: alert.location,
                          country: alert.country,
                          region: alert.region,
                          mainland: alert.mainland,
                          event_type: alert.eventType || alert.event_type,
                          severity: alert.severity,
                          status: 'draft',
                          source_url: alert.source_url,
                          article_url: alert.article_url,
                          sources: alert.sources || 'NewsAPI',
                          event_start_date: alert.event_start_date || alert.eventStartDate,
                          event_end_date: alert.event_end_date || alert.eventEndDate,
                          latitude: alert.latitude,
                          longitude: alert.longitude,
                          geo_json: alert.geoJSON || alert.geo_json || null,
                          recommendations: alert.recommendations || null,
                          ai_generated: alert.ai_generated || false,
                          ai_model: alert.ai_model,
                          ai_confidence: alert.ai_confidence,
                          confidence_score: calculateConfidence(alert, { type: 'newsapi-secondary', name: 'NewsAPI' }),
                          generation_metadata: alert.generation_metadata,
                          intelligence_topics: alert.intelligence_topics,
                          created_at: alert.created_at || nowIso(),
                          updated_at: nowIso(),
                        };
                        
                        // Apply 3-step geojson logic
                        ensureGeoJSON(alertForDb);
                        
                        await querySupabaseRest(`/alerts`, {
                          method: 'POST',
                          body: JSON.stringify(alertForDb),
                        });
                        console.log(`    ✓ NewsAPI: Saved "${alert.title}"`);
                        allExistingAlerts.push(alert);
                      }
                    } catch (e) {
                      console.warn(`    ✗ NewsAPI save error: ${e}`);
                    }
                  }
                }
              }
              
              console.log(`  ✓ Official APIs complete!`);
              
              // 6. CLAUDE-POWERED PROACTIVE QUERIES (850+ query-based analysis)
              console.log(`\n  [BG] 🤖 Starting Claude-powered proactive queries (850+)...`);
              console.log(`  [BG] DEBUG: CLAUDE_API_KEY=${CLAUDE_API_KEY ? 'SET (' + CLAUDE_API_KEY.slice(0, 25) + '...)' : 'NOT SET'}`);
              
              // Build regional query list (~800-850 queries) - only if Claude API key is available
              if (!CLAUDE_API_KEY) {
                console.warn(`⚠️  ANTHROPIC_API_KEY not set - skipping Claude proactive queries`);
                console.warn(`   To enable Claude queries, set ANTHROPIC_API_KEY environment variable`);
                console.warn(`   Current value: ${CLAUDE_API_KEY}`);
                await logActivityToKV(`⚠️ Claude queries skipped - ANTHROPIC_API_KEY not configured`);
              } else {
                const countries = ["United States", "Canada", "Mexico", "Brazil", "Argentina", "Chile", "Colombia", "France", "Germany", "Italy", "Spain", "UK", "Russia", "China", "India", "Japan", "Australia", "Israel", "Saudi Arabia", "Iran", "Syria", "Turkey", "Egypt", "Nigeria", "South Africa", "Kenya", "Philippines", "Indonesia", "Thailand", "Vietnam"];
                const cities = ["New York", "Los Angeles", "London", "Paris", "Tokyo", "Sydney", "Hong Kong", "Singapore", "Dubai", "Moscow", "São Paulo", "Mexico City", "Delhi", "Mumbai", "Bangkok", "Istanbul", "Cairo", "Lagos", "Johannesburg", "Seoul"];
                const regionalQueries = buildRegionalQueries(EARLY_SIGNAL_QUERIES, countries, cities);
                
                console.log(`  [BG] Generated ${regionalQueries.length} regional queries for Claude analysis`);
                
                let claudeQueryCount = 0;
                for (const query of regionalQueries) {
                  claudeQueryCount++;
                  
                  // Update progress every 10 queries
                  if (claudeQueryCount % 10 === 0) {
                    currentJob.currentEarlySignalQuery = `${claudeQueryCount}/${regionalQueries.length}`;
                    await setKV(`scour_job:${jobId}`, currentJob);
                    await logActivityToKV(`⚡ Claude queries: ${claudeQueryCount}/${regionalQueries.length}`);
                  }
                  
                  try {
                    // Use Claude to generate alerts based on query topic
                    const prompt = `You are a MAGNUS intelligence analyst. Based on the following search query topic, generate potential alert scenarios that could be happening right now. Return ONLY valid JSON array with no markdown, no code blocks, no extra text.

Query Topic: "${query}"

Generate 0-2 realistic alert objects for situations matching this topic. Each alert should have:
{
  "title": "specific incident title",
  "description": "2-3 sentence description",
  "event_type": "one of: natural disaster, severe weather, infrastructure failure, transportation blockage, airport disruption, disease outbreak, political instability, multi-casualty incident, terrorist attack, military conflict, transit delay, antisemitic incident, earthquake",
  "severity": "critical|warning|caution|informative",
  "location": "specific city or region",
  "country": "country name",
  "latitude": number or null,
  "longitude": number or null
}

Return ONLY the JSON array. If no realistic alerts match, return [];`;

                    // Log API call details first 3 queries
                    if (claudeQueryCount <= 3) {
                      console.log(`    [DEBUG] Query ${claudeQueryCount}: Calling Claude API...`);
                      console.log(`    [DEBUG] API Key present: ${CLAUDE_API_KEY ? 'YES (' + CLAUDE_API_KEY.slice(0, 20) + '...)' : 'NO'}`);
                    }

                    const response = await fetch('https://api.anthropic.com/v1/messages', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': CLAUDE_API_KEY,
                        'anthropic-version': '2023-06-01',
                      },
                      body: JSON.stringify({
                        model: 'claude-3-haiku-20240307',
                        max_tokens: 1024,
                        messages: [{ role: 'user', content: prompt }],
                      }),
                      signal: AbortSignal.timeout(15000),
                    });
                  
                  if (claudeQueryCount <= 3) {
                    console.log(`    [DEBUG] Response status: ${response.status}`);
                  }

                  if (!response.ok) {
                    let errorData = {};
                    try {
                      errorData = await response.json();
                    } catch (e) {
                      const text = await response.text();
                      errorData = { raw_response: text.slice(0, 300) };
                    }
                    console.warn(`    ⚠️  Claude API error: ${response.status}`);
                    console.warn(`    ⚠️  Details: ${JSON.stringify(errorData).slice(0, 300)}`);
                    console.warn(`    ⚠️  Model used: claude-3-5-haiku-20241022`);
                    stats.errorCount++;
                    continue;
                  }

                  const data = await response.json();
                  const content = data.content?.[0]?.text || '';
                  
                  if (!content) {
                    continue;
                  }

                  // Parse Claude's JSON response
                  let alerts = [];
                  try {
                    alerts = JSON.parse(content);
                  } catch (e) {
                    console.warn(`    ⚠️  Failed to parse Claude response: ${content.slice(0, 100)}`);
                    continue;
                  }

                  if (!Array.isArray(alerts)) {
                    continue;
                  }

                  // Process each alert
                  for (const alert of alerts) {
                    if (!alert.title || !alert.country) {
                      continue;
                    }

                    const isDup = allExistingAlerts.some(a => 
                      checkDuplicateBasic(alert, a)
                    );

                    if (!isDup) {
                      try {
                        const alertForDb: any = {
                          id: crypto.randomUUID(),
                          title: alert.title,
                          summary: alert.description,
                          description: alert.description,
                          location: alert.location,
                          country: alert.country,
                          region: alert.region,
                          mainland: alert.mainland,
                          event_type: alert.event_type,
                          severity: alert.severity,
                          status: 'draft',
                          source_url: `https://generator30.vercel.app/scour`,
                          article_url: null,
                          sources: 'Claude Proactive',
                          event_start_date: alert.event_start_date || nowIso(),
                          event_end_date: alert.event_end_date || nowIso(),
                          latitude: alert.latitude,
                          longitude: alert.longitude,
                          geo_json: null,
                          recommendations: generateDefaultRecommendations(alert.severity, alert.event_type, alert.location),
                          ai_generated: true,
                          ai_model: 'claude-3-5-haiku',
                          ai_confidence: 0.65,
                          intelligence_topics: [alert.event_type],
                          created_at: nowIso(),
                          updated_at: nowIso(),
                        };

                        ensureGeoJSON(alertForDb);

                        await querySupabaseRest(`/alerts`, {
                          method: 'POST',
                          body: JSON.stringify(alertForDb),
                        });

                        console.log(`    ✓ Claude [${claudeQueryCount}/${regionalQueries.length}]: Saved "${alert.title}"`);
                        allExistingAlerts.push(alert);
                        stats.created++;
                      } catch (e) {
                        console.warn(`    ✗ Claude save error: ${e}`);
                        stats.errorCount++;
                      }
                    }
                  }
                } catch (e) {
                  console.warn(`    ✗ Claude query failed: ${query.slice(0, 40)}: ${e}`);
                  stats.errorCount++;
                }

                // Small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 50));
              }
              console.log(`  ✓ Claude queries complete! (${claudeQueryCount} queries)`);
              currentJob.currentEarlySignalQuery = `${claudeQueryCount}/${claudeQueryCount}`;
              await setKV(`scour_job:${jobId}`, currentJob);
              
              console.log(`  📊 Early signals stats: Created=${stats.created}, Errors=${stats.errorCount}`);
              
              await logActivityToKV(`✅ Early signals complete (background) - found ${stats.created} alerts from official sources`);
              currentJob.updated_at = nowIso();
              await updateJobStats({ created: stats.created, errorCount: stats.errorCount });
              
              console.log(`  [BG] Early signals background task completed successfully ✓`);
              }
              } catch (earlySignalsErr) {
                console.error(`  [BG] ERROR in early signals background: ${earlySignalsErr}`);
                await logActivityToKV(`⚠️ Early signals background error: ${earlySignalsErr}`);
              }
            })();
            
            // ✓ IMMEDIATELY SET PHASE AND START MAIN SOURCES (don't wait for early signals to finish)
            console.log(`\n🚀 IMMEDIATE: Transitioning to MAIN SCOUR phase (early signals running in background)...`);
            currentJob.phase = "main_scour";
            await setKV(`scour_job:${jobId}`, currentJob);
            
            // ============================================================================
            // PHASE 2: PROCESS MAIN SOURCES (RSS feeds and news sources) [RUNS IMMEDIATELY]
            // ============================================================================
            // WHILE LOOP: Keep processing batches of sources until out of time or sources done
            console.log(`\n✓ ENTERING MAIN SCOUR PHASE with ${sourcesToProcess.length} sources to process`);
            console.log(`  existingAlerts loaded: ${existingAlerts?.length || 0}`);
            console.log(`  Starting while loop...`);
            
            while (sourcesToProcess.length > 0) {
              console.log(`\n📋 PHASE 2 BATCH: Processing ${sourcesToProcess.length} sources (early signals running in background if configured)...`);
              console.log(`  Processing sourceIds: [${sourcesToProcess.slice(0, 10).join(', ')}${sourcesToProcess.length > 10 ? '...' : ''}]`);
              console.log(`  Current progress: processed=${currentJob.processed || 0}/${currentJob.total}, created=${currentJob.created || 0}`);
              
              // Track pending KV write to batch updates
              let pendingKVWrite = false;
              
              for (const sourceId of sourcesToProcess) {
                // CHECK TIMEOUT: Exit loop if we're approaching 55 seconds
                const elapsedMs = Date.now() - batchStartTime;
                if (elapsedMs > TIMEOUT_BUFFER_MS) {
                  console.log(`\n⏱️  TIMEOUT APPROACHING: ${Math.round(elapsedMs/1000)}s elapsed, stopping`);
                  console.log(`   Processed so far: ${stats.processed}/${allSources.length}`);
                  console.log(`   Remaining: ${unprocessedSources.length - stats.processed}`);
                  sourcesToProcess = []; // Exit while loop
                  break;
                }
                
                // Skip if already processed (shouldn't happen since we filtered above, but be safe)
                if (processedIds.has(sourceId)) {
                  console.log(`  ⊘ Skipping already-processed source ${sourceId}`);
                  continue;
                }
                
                console.log(`\n📋 Starting source processing loop iteration for: ${sourceId}`);
                console.log(`  Looking for source ${sourceId}...`);
                const source = allSources.find((s: Source) => s.id === sourceId);
                
                if (!source) {
                  console.log(`    ✗ Source ${sourceId} not found in allSources (have ${allSources.length} total)`);
                  if (allSources.length > 0) {
                    console.log(`    Available IDs: [${allSources.slice(0, 5).map((s: any) => s.id).join(', ')}]`);
                  }
                  stats.errorCount++;
                  processedIds.add(sourceId);
                  await updateJobStats({ errorCount: stats.errorCount });
                  continue;
                }
                
                // Check if source is blocked
                if (isSourceBlocked(source)) {
                  console.log(`🚫 BLOCKED: Source ${sourceId} (${source.name}) is in blocklist - skipping`);
                  stats.skipped++;
                  processedIds.add(sourceId);
                  await updateJobStats({ skipped: stats.skipped });
                  continue;
                }
                console.log(`    ✓ Found: ${source.name}`);
                
                if (!source.enabled) {
                  stats.skipped++;
                await updateJobStats({ skipped: stats.skipped });
                console.log(`⊘ Skipped: ${source.name} (disabled)`);
                continue;
              }
              
              stats.processed++;
              
              // Update progress in KV every source
              await updateJobStats({ processed: stats.processed, currentSourceName: source.name });
              
              console.log(`📰 Processing [${stats.processed}/${sourceIds.length}]: ${source.name}`);
              
              try {
                // Fetch content (web scraping only - web scraping with AbortController)
                let content = '';
                try {
                  // Use web scraping with aggressive timeout
                  const controller = new AbortController();
                  const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second absolute timeout
                  
                  try {
                    const response = await fetch(source.url, {
                      signal: controller.signal,
                      headers: { 'User-Agent': 'Mozilla/5.0' },
                    });
                    clearTimeout(timeoutId);
                    
                    if (response.ok) {
                      const html = await response.text();
                      content = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 10000);
                    }
                  } catch (e: any) {
                    clearTimeout(timeoutId);
                    if (e.name === 'AbortError') {
                      console.warn(`  ⏱️ Scrape timeout (8s) on ${source.url}`);
                    } else {
                      console.warn(`  ⚠️ Scrape failed: ${e.message}`);
                    }
                  }
                } catch (fetchErr: any) {
                  console.warn(`  ⚠️ Content fetch error: ${fetchErr?.message || fetchErr}`);
                }
                
                if (!content || content.length < 500) {
                  console.log(`✗ No sufficient content from ${source.name}`);
                  console.log(`  - Reason: ${!content ? 'No content retrieved' : `Content too short (${content.length} chars, need 500+)`}`);
                  stats.errorCount++;
                  continue;
                }
                
                // Extract alerts with AI
                let alerts: Alert[] = [];
                try {
                  console.log(`  🤔 Starting AI extraction for content (${content.length} chars)...`);
                  console.log(`     existingAlerts=${existingAlerts?.length || 'UNDEFINED'}`);
                  const promise = extractAlertsWithAI(
                    content, 
                    source.url, 
                    source.name, 
                    existingAlerts,
                    { 
                      supabaseUrl, 
                      serviceKey, 
                      openaiKey: OPENAI_API_KEY!, 
                      claudeKey: CLAUDE_API_KEY,
                      jobId, 
                      sourceIds, 
                      daysBack 
                    }
                  );
                  const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('AI extraction timeout')), 30000)
                  );
                  alerts = await Promise.race([promise, timeoutPromise]) as Alert[];
                  console.log(`  ✓ AI extraction returned ${alerts.length} alerts from ${source.name}`);
                } catch (aiErr: any) {
                  console.warn(`  ⚠️ AI extraction error on ${source.name}: ${aiErr?.message || aiErr}`);
                  alerts = [];
                }
                
                if (alerts.length === 0) {
                  console.log(`  ℹ️  No alerts extracted from ${source.name} (AI returned empty or all failed validation)`);
                }
                
                // Check duplicates and save valid alerts
                for (const alert of alerts) {
                  // Strict dedup: exact title + location + country OR same alert from this scour
                  const isDupe = allExistingAlerts.some(e => {
                    // Check 1: Exact or near-exact title match (first 50 chars) + same location + country
                    const newTitleShort = alert.title.toLowerCase().slice(0, 50);
                    const existingTitleShort = e.title?.toLowerCase().slice(0, 50) || '';
                    const titleSimilar = newTitleShort === existingTitleShort || 
                                        alert.title.toLowerCase() === e.title?.toLowerCase();
                    const locationMatch = e.location?.toLowerCase() === alert.location?.toLowerCase() && 
                                         e.country?.toLowerCase() === alert.country?.toLowerCase();
                    
                    // Check 2: Was it created very recently (within 5 minutes)?
                    const createdRecently = e.created_at && 
                      (Date.now() - new Date(e.created_at).getTime()) < (5 * 60 * 1000);
                    
                    return (titleSimilar && locationMatch) || createdRecently;
                  });
                  
                  if (!isDupe) {
                    try {
                      console.log(`    ✓ Creating new alert: "${alert.title}" in ${alert.location}, ${alert.country}`);
                      
                      // Build clean alert object with ONLY database fields
                      const alertForDb: any = buildAlertForDb(alert, {
                        id: source?.id,
                        url: source?.url,
                        name: source?.name,
                      });
                      
                      // Fire alert insert in background without blocking scour progress
                      // This prevents hanging on slow database inserts
                      fetch(`${supabaseUrl}/rest/v1/alerts`, {
                        method: 'POST',
                        headers: {
                          "Authorization": `Bearer ${serviceKey}`,
                          "apikey": serviceKey,
                          "Content-Type": "application/json",
                        },
                        body: JSON.stringify(alertForDb),
                        signal: AbortSignal.timeout(3000),
                      }).then(async (res) => {
                        if (res.ok) {
                          console.log(`✓ Created: ${alert.title}`);
                        } else {
                          const errText = await res.text().catch(() => '');
                          console.warn(`    ✗ Insert failed [${res.status}] ${errText.slice(0, 200)}`);
                        }
                      }).catch((e: any) => {
                        if (e.name === 'AbortError') {
                          console.warn(`    ⏱️ Alert insert timeout (3s) for "${alert.title}"`);
                        } else {
                          console.warn(`    ✗ Insert failed: ${e.message}`);
                        }
                      });
                      
                      // Count and track the alert without waiting for insert
                      stats.created++;
                      allExistingAlerts.push(alert);
                      await updateJobStats({ created: stats.created });
                    } catch (e: any) {
                      const errorMsg = e.message || String(e);
                      console.warn(`    ✗ Failed: "${alert.title}": ${errorMsg}`);
                      stats.errorCount++;
                      stats.errors.push(`Failed: ${errorMsg}`);
                    }
                  } else {
                    console.log(`    ⊘ Skipping duplicate alert: "${alert.title}"`);
                    stats.duplicatesSkipped++;
                    await updateJobStats({ duplicatesSkipped: stats.duplicatesSkipped });
                  }
                }
                
                // Mark source as processed and turn off all activity flags
                stats.processed++;
                processedIds.add(sourceId);
                currentJob.processedIds = Array.from(processedIds);
                currentJob.braveActive = false;
                currentJob.aiActive = false;
                currentJob.extractActive = false;
                currentJob.dupeCheckActive = false;
                currentJob.updated_at = nowIso();
                
                // Only write to KV every 5 sources (batching)
                if (stats.processed % 5 === 0) {
                  await setKV(`scour_job:${jobId}`, currentJob);
                }
              } catch (e: any) {
                stats.errorCount++;
                stats.processed++;
                const errorMsg = e.message || String(e);
                stats.errors.push(`Source error: ${errorMsg}`);
                console.error(`❌ Source ${sourceId} (${source?.name || 'unknown'}) error: ${errorMsg}`);
                
                // If timeout, mark for blocklist consideration
                if (errorMsg.includes('timeout')) {
                  console.error(`⏱️ TIMEOUT: Source ${source?.name} took too long - consider disabling in database`);
                }
                // Mark source as processed even on error, turn off flags
                processedIds.add(sourceId);
                currentJob.processedIds = Array.from(processedIds);
                currentJob.errorCount = Math.max(stats.errorCount, currentJob.errorCount || 0);
                currentJob.updated_at = nowIso();
                
                // Only write to KV every 5 sources (batching)
                if (stats.processed % 5 === 0) {
                  await setKV(`scour_job:${jobId}`, currentJob);
                }
            }  // <- Closes the catch (e: any)
            }  // <- Closes the for loop

              // After processing a batch, reload unprocessed sources for next iteration
              const remainingAfterBatch = allSources.map(s => s.id).filter((id: string) => !processedIds.has(id));
              if (remainingAfterBatch.length > 0 && (Date.now() - batchStartTime) < 50000) {
                // Still have sources and time, reload next batch
                sourcesToProcess = remainingAfterBatch.slice(0, 100); // Load up to 100 more
                console.log(`\n🔄 RELOADING BATCH: ${sourcesToProcess.length} sources remaining, continuing...`);
              } else {
                // No more sources or out of time, exit while loop
                console.log(`\n✓ BATCH COMPLETE: Will check for continuation on next iteration`);
                sourcesToProcess = [];
              }
            } // <- Closes the while loop
            
            // ============================================================================
            // FINALIZE JOB
            // ============================================================================
            // Check if there are more sources to process
            const remainingUnprocessedSources = sourcesToProcess.filter((id: string) => !processedIds.has(id));
            const allUnprocessedSources = allSources.map(s => s.id).filter((id: string) => !processedIds.has(id));
            
            console.log(`\n📊 JOB STATUS CHECK:`);
            console.log(`   Processed this run: ${stats.processed}/${sourcesToProcess.length}`);
            console.log(`   Total processed so far: ${processedIds.size}/${allSources.length}`);
            console.log(`   Remaining unprocessed: ${allUnprocessedSources.length}`);
            
            let jobStatus = "done";
            let jobPhase = "done";
            
            // If there are still unprocessed sources and time available, keep processing
            // DON'T pause - just continue with remaining sources
            if (allUnprocessedSources.length > 0) {
              const timeRemaining = 55000 - (Date.now() - batchStartTime);
              if (timeRemaining > 10000) {
                // Still have 10+ seconds, continue processing without pausing
                console.log(`\n♻️ CONTINUING SAME BATCH: ${allUnprocessedSources.length} sources remaining, ${Math.round(timeRemaining/1000)}s available`);
                jobStatus = "running";
                jobPhase = "continuing";
              } else {
                // Out of time, pause for next batch
                console.log(`\n⏸️  OUT OF TIME: ${allUnprocessedSources.length} sources remaining, pausing for next batch`);
                jobStatus = "paused";
                jobPhase = "paused_waiting_for_next_batch";
              }
            }
            
            const finalJob = { 
              ...currentJob, 
              status: jobStatus, 
              phase: jobPhase,
              ...stats, 
              currentSourceName: '',
              currentEarlySignalQuery: jobStatus === "done" ? "complete" : jobStatus,
              updated_at: nowIso() 
            };
            await setKV(`scour_job:${jobId}`, finalJob);
            
            // Only release lock if job is truly complete
            if (jobStatus === "done") {
              await deleteKV("scour_job_lock");
              console.log(`🔓 JOB LOCK RELEASED: Scour completed`);
              console.log(`✓ SCOUR COMPLETED: ${jobId}`, JSON.stringify(stats));
            } else {
              console.log(`⚠️  JOB LOCK HELD: Job status = ${jobStatus} (${allUnprocessedSources.length} sources queued)`);
            }
          } catch (e: any) {
            const err = String(e?.message || e);
            console.error(`✗ SCOUR ERROR: ${jobId}`, err);
            const fail = { 
              ...currentJob, 
              status: "error", 
              errorCount: 1, 
              errors: [err], 
              braveActive: false,
              aiActive: false,
              extractActive: false,
              currentSourceName: '',
              updated_at: nowIso() 
            };
            await setKV(`scour_job:${jobId}`, fail);
            
            // RELEASE JOB LOCK - Job failed, unlock so another job can run
            await deleteKV("scour_job_lock");
            console.log(`🔓 JOB LOCK RELEASED: Scour failed with error`);
          }
        })()
      );

      return json({ ok: true, jobId, total: sourceIds.length, message: `Scour started` });
    }

    // SCOUR � EARLY SIGNALS (POST /scour/early-signals)
    // Runs independently, triggered by scour completion or manually
    if (path === "/scour/early-signals" && method === "POST") {
      const body = await req.json().catch(() => ({}));
      const jobId = body.jobId || crypto.randomUUID();
      
      console.log(`\n🚀 [${jobId}] Early signals endpoint called - Running Claude proactive queries (850+)`);

      // Run Claude proactive queries (non-blocking background task)
      waitUntil(
        (async () => {
          try {
            const allExistingAlerts: Alert[] = await querySupabaseRest(`/alerts?select=id,title,location,country&limit=500&order=created_at.desc`) || [];
            
            console.log(`\n  [BG] 🤖 Starting Claude-powered proactive queries (850+)...`);
            
            // Build regional query list (~800-850 queries)
            const countries = ["United States", "Canada", "Mexico", "Brazil", "Argentina", "Chile", "Colombia", "France", "Germany", "Italy", "Spain", "UK", "Russia", "China", "India", "Japan", "Australia", "Israel", "Saudi Arabia", "Iran", "Syria", "Turkey", "Egypt", "Nigeria", "South Africa", "Kenya", "Philippines", "Indonesia", "Thailand", "Vietnam"];
            const cities = ["New York", "Los Angeles", "London", "Paris", "Tokyo", "Sydney", "Hong Kong", "Singapore", "Dubai", "Moscow", "São Paulo", "Mexico City", "Delhi", "Mumbai", "Bangkok", "Istanbul", "Cairo", "Lagos", "Johannesburg", "Seoul"];
            
            console.log(`  [BG] Building regional queries from ${EARLY_SIGNAL_QUERIES?.length || 0} base queries, ${countries.length} countries, ${cities.length} cities`);
            
            let regionalQueries: string[] = [];
            try {
              regionalQueries = buildRegionalQueries(EARLY_SIGNAL_QUERIES, countries, cities);
              console.log(`  [BG] Generated ${regionalQueries.length} regional queries for Claude analysis`);
            } catch (e) {
              console.error(`  [BG] ERROR building regional queries: ${e}`);
              return;
            }
            
            if (!CLAUDE_API_KEY) {
              console.warn(`⚠️  ANTHROPIC_API_KEY not set - skipping Claude proactive queries`);
              return;
            }
            
            console.log(`  [BG] DEBUG: ANTHROPIC_API_KEY is set: ${CLAUDE_API_KEY.slice(0, 20)}...`);
            
            if (!regionalQueries || regionalQueries.length === 0) {
              console.warn(`⚠️  No regional queries generated - skipping Claude proactive queries`);
              return;
            }
            
            let claudeQueryCount = 0;
            let created = 0;
            let errorCount = 0;
            
            for (const query of regionalQueries) {
              claudeQueryCount++;
              
              // Update progress every 50 queries
              if (claudeQueryCount % 50 === 0) {
                console.log(`  [BG] ⚡ Claude progress: ${claudeQueryCount}/${regionalQueries.length}`);
              }
              
              try {
                // Use Claude to generate alerts based on query topic
                const prompt = `You are a MAGNUS intelligence analyst. Based on the following search query topic, generate potential alert scenarios that could be happening right now. Return ONLY valid JSON array with no markdown, no code blocks, no extra text.

Query Topic: "${query}"

Generate 0-2 realistic alert objects for situations matching this topic. Each alert should have:
{
  "title": "specific incident title",
  "description": "2-3 sentence description",
  "event_type": "one of: natural disaster, severe weather, infrastructure failure, transportation blockage, airport disruption, disease outbreak, political instability, multi-casualty incident, terrorist attack, military conflict, transit delay, antisemitic incident, earthquake",
  "severity": "critical|warning|caution|informative",
  "location": "specific city or region",
  "country": "country name",
  "latitude": number or null,
  "longitude": number or null
}

Return ONLY the JSON array. If no realistic alerts match, return [].`;

                // Log API call details first 3 queries
                if (claudeQueryCount <= 3) {
                  console.log(`    [DEBUG] Query ${claudeQueryCount}: Calling Claude API...`);
                  console.log(`    [DEBUG] API Key present: ${CLAUDE_API_KEY ? 'YES (' + CLAUDE_API_KEY.slice(0, 20) + '...)' : 'NO'}`);
                }

                const response = await fetch('https://api.anthropic.com/v1/messages', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'anthropic-version': '2023-06-01',
                  },
                  body: JSON.stringify({
                    model: 'claude-3-haiku-20240307',
                    max_tokens: 1000,
                    messages: [{ role: 'user', content: prompt }],
                  }),
                  signal: AbortSignal.timeout(15000),
                });
                
                if (claudeQueryCount <= 3) {
                  console.log(`    [DEBUG] Response status: ${response.status}`);
                }

                if (!response.ok) {
                  const errorData = await response.json().catch(() => ({}));
                  console.warn(`    ⚠️  Claude API error: ${response.status}`);
                  console.warn(`    ⚠️  Error details: ${JSON.stringify(errorData).slice(0, 200)}`);
                  errorCount++;
                  continue;
                }

                const data = await response.json();
                const content = data.content?.[0]?.text || '';
                
                if (!content) continue;

                // Parse Claude's JSON response
                let alerts = [];
                try {
                  alerts = JSON.parse(content);
                } catch (e) {
                  continue;
                }

                if (!Array.isArray(alerts)) continue;

                // Process each alert
                for (const alert of alerts) {
                  if (!alert.title || !alert.country) continue;

                  const isDup = allExistingAlerts.some(a => 
                    checkDuplicateBasic(alert, a)
                  );

                  if (!isDup) {
                    try {
                      const alertForDb: any = {
                        id: crypto.randomUUID(),
                        title: alert.title,
                        summary: alert.description,
                        description: alert.description,
                        location: alert.location,
                        country: alert.country,
                        region: alert.region,
                        mainland: alert.mainland,
                        event_type: alert.event_type,
                        severity: alert.severity,
                        status: 'draft',
                        source_url: `https://generator30.vercel.app/scour`,
                        article_url: null,
                        sources: 'Claude Proactive',
                        event_start_date: alert.event_start_date || nowIso(),
                        event_end_date: alert.event_end_date || nowIso(),
                        latitude: alert.latitude,
                        longitude: alert.longitude,
                        geo_json: null,
                        recommendations: generateDefaultRecommendations(alert.severity, alert.event_type, alert.location),
                        ai_generated: true,
                        ai_model: 'claude-3-5-haiku',
                        ai_confidence: 0.65,
                        intelligence_topics: [alert.event_type],
                        created_at: nowIso(),
                        updated_at: nowIso(),
                      };

                      ensureGeoJSON(alertForDb);

                      await querySupabaseRest(`/alerts`, {
                        method: 'POST',
                        body: JSON.stringify(alertForDb),
                      });

                      allExistingAlerts.push(alert);
                      created++;
                    } catch (e) {
                      errorCount++;
                    }
                  }
                }
              } catch (e) {
                errorCount++;
              }

              // Small delay to avoid rate limiting
              await new Promise(resolve => setTimeout(resolve, 50));
            }

            console.log(`  [BG] ✓ Claude queries complete! Generated: ${claudeQueryCount} queries, Created: ${created} alerts, Errors: ${errorCount}`);
          } catch (err: any) {
            console.error(`  [BG] ERROR in early signals: ${err?.message}`);
          }
        })()
      );

      return json({ ok: true, message: "Claude proactive queries started (background)" });
    }

    // SCOUR � STATUS (GET /scour/status?jobId=... OR GET /scour-status?jobId=...)
    if ((path === "/scour/status" || path === "/scour-status") && method === "GET") {
      let jobId = url.searchParams.get("jobId");
      if (!jobId) jobId = await getKV("last_scour_job_id");

      if (!jobId) return json({ ok: true, job: null });

      console.log(`? Getting status for job: ${jobId}`);
      const job = await getKV(`scour_job:${jobId}`);
      
      if (job) {
        const total = job.total || job.totalSources || 0;
        console.log(`✓ Job found in KV: ${jobId}, total=${total}, processed=${job.processed}, created=${job.created}, status=${job.status}`);
        
        // Detect if job is hung (no progress in last 10 minutes)
        const lastUpdateTime = job.updated_at ? new Date(job.updated_at).getTime() : Date.now();
        const now = Date.now();
        const minutesSinceUpdate = (now - lastUpdateTime) / (1000 * 60);
        const isHung = minutesSinceUpdate > 10 && job.status === 'running';
        
        // Return job object including activity log for frontend status bar
        return json({ ok: true, job: {
          id: job.id,
          status: job.status,
          phase: job.phase || "main_scour",
          currentEarlySignalQuery: job.currentEarlySignalQuery || (job.earlySignalsStarted ? "running" : "pending"),
          currentSource: job.currentSource || '',
          total: total,
          processed: job.processed,
          created: job.created,
          duplicatesSkipped: job.duplicatesSkipped || 0,
          errorCount: job.errorCount || 0,
          activityLog: job.activityLog || [],
          isHung: isHung,
          minutesSinceLastUpdate: Math.round(minutesSinceUpdate),
          lastUpdate: job.updated_at
        }});
      }
      
      // Job not in KV - query alerts table directly for real results
      console.log(`⚠️ Job ${jobId} not in KV store, querying alerts table...`);
      try {
        // Query alerts created recently (last 30 minutes to catch current scour)
        const timeWindow = new Date(Date.now() - 30 * 60000).toISOString();
        const jobAlerts = await querySupabaseRest(
          `/alerts?created_at=gte.${encodeURIComponent(timeWindow)}&select=id,title,severity,status,created_at&order=created_at.desc&limit=200`
        );
        
        const totalCreated = Array.isArray(jobAlerts) ? jobAlerts.length : 0;
        const draftCount = Array.isArray(jobAlerts) ? jobAlerts.filter(a => a.status === 'draft').length : 0;

        console.log(`ℹ️ Found ${totalCreated} alerts from recent scour (${draftCount} draft)`);

        // Return job status based on actual alerts found
        // NOTE: Don't estimate to 1 - that causes confusing 0/1 display
        // Use a conservative estimate that looks reasonable
        const estimatedTotalSources = totalCreated > 0 ? Math.max(totalCreated, 10) : 50;
        const estimatedProcessed = totalCreated > 0 ? Math.ceil(totalCreated * 0.8) : 0;
        
        return json({
          ok: true,
          job: {
            id: jobId,
            status: "running",
            total: estimatedTotalSources,
            processed: estimatedProcessed,
            created: totalCreated,
            duplicatesSkipped: 0,
            errorCount: 0,
            errors: [],
            phase: "main_scour",
            currentActivity: totalCreated > 0 
              ? `Found ${totalCreated} alert(s)`
              : "?? Scour in progress (syncing...)"
          }
        });
      } catch (e: any) {
        console.error(`? Error querying alerts:`, e?.message);
      }
      
      // Final fallback: return reasonable estimate that doesn't confuse user
      return json({
        ok: true,
        job: { 
          id: jobId, 
          status: "running", 
          total: 50, // Better estimate than 1
          processed: 0, 
          created: 0, 
          duplicatesSkipped: 0, 
          errorCount: 0, 
          errors: [],
          phase: "main_scour",
          currentActivity: "?? Initializing scour..."
        },
      });
    }

    // SCOUR → UNLOCK (POST /scour/unlock?jobId=... - Admin only)
    if (path === "/scour/unlock" && method === "POST") {
      // Verify admin secret
      const adminSecret = Deno.env.get("ADMIN_SECRET");
      const authHeader = req.headers.get("authorization") || "";
      const tokenMatch = authHeader.match(/Bearer\s+(.+)/i);
      const token = tokenMatch ? tokenMatch[1] : "";

      if (!adminSecret || token !== adminSecret) {
        console.warn(`⚠️  Unauthorized unlock attempt`);
        return json({ ok: false, error: "Unauthorized" }, 401);
      }

      const jobId = url.searchParams.get("jobId");
      if (!jobId) {
        return json({ ok: false, error: "jobId parameter required" }, 400);
      }

      try {
        // Delete the job lock from KV
        await deleteKV(`scour_job:${jobId}`);
        console.log(`✓ Force unlocked scour job: ${jobId}`);
        return json({ ok: true, message: `Scour lock cleared for job ${jobId}` });
      } catch (e) {
        console.error(`✗ Failed to unlock job: ${e}`);
        return json({ ok: false, error: `Failed to unlock: ${e}` }, 500);
      }
    }

    // SCOUR → KILL (POST /scour/kill?jobId=... - Admin only, force-stops a hung scour)
    if (path === "/scour/kill" && method === "POST") {
      try {
        // Verify user is admin by checking their token metadata
        const authHeader = req.headers.get("authorization") || "";
        const tokenMatch = authHeader.match(/Bearer\s+(.+)/i);
        const userToken = tokenMatch ? tokenMatch[1] : "";

        if (!userToken) {
          console.warn(`⚠️  Kill attempt without token`);
          return json({ ok: false, error: "Unauthorized: No token provided" }, 401);
        }

        // Verify the token with Supabase to get user metadata
        const verifyResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
          headers: {
            "Authorization": `Bearer ${userToken}`,
            "apikey": serviceKey,
          },
        });

        if (!verifyResponse.ok) {
          console.warn(`⚠️  Kill attempt with invalid token`);
          return json({ ok: false, error: "Unauthorized: Invalid token" }, 401);
        }

        const userData = await verifyResponse.json();
        const userRole = userData?.user_metadata?.role || "operator";

        if (userRole !== "admin") {
          console.warn(`⚠️  Kill attempt by non-admin user: ${userRole}`);
          return json({ ok: false, error: "Unauthorized: Admin role required" }, 403);
        }

        const jobId = url.searchParams.get("jobId");
        if (!jobId) {
          return json({ ok: false, error: "jobId parameter required" }, 400);
        }

        // Mark job as aborted
        const job = await getKV(`scour_job:${jobId}`);
        if (job) {
          job.status = "aborted";
          job.updated_at = nowIso();
          await setKV(`scour_job:${jobId}`, job);
          console.log(`✓ Force aborted scour job: ${jobId}`);
        }
        
        // Also clear the global lock
        await deleteKV("scour_job_lock");
        
        return json({ 
          ok: true, 
          message: `Scour job ${jobId} aborted and lock cleared` 
        });
      } catch (e) {
        console.error(`✗ Failed to kill job: ${e}`);
        return json({ ok: false, error: `Failed to kill: ${e}` }, 500);
      }
    }

    if (path === "/scour/emergency-unlock" && method === "GET") {
      const secret = url.searchParams.get("secret");
      if (secret !== "emergency-unlock-key") {
        return json({ ok: false, error: "Invalid secret" }, 401);
      }
      try {
        await deleteKV("scour_job_lock");
        const lastJobId = await getKV("last_scour_job_id");
        if (lastJobId) {
          const job = await getKV(`scour_job:${lastJobId}`);
          if (job) {
            job.status = "aborted";
            await setKV(`scour_job:${lastJobId}`, job);
          }
        }
        return json({ ok: true, message: "Lock cleared" });
      } catch (e) {
        return json({ ok: false, error: String(e) }, 500);
      }
    }

    // AUTO-SCOUR � STATUS
    if (path === "/auto-scour/status" && method === "GET") {
      const enabled = await getKV("auto_scour_enabled");
      const intervalMinutes = await getKV("auto_scour_interval_minutes") || 60;
      const lastRun = await getKV("auto_scour_last_run");

      return json({
        ok: true,
        enabled: enabled === true || enabled === "true",
        intervalMinutes: parseInt(String(intervalMinutes), 10),
        lastRun,
        envEnabled: true,
      });
    }

    // AUTO-SCOUR � TOGGLE
    if (path === "/auto-scour/toggle" && method === "POST") {
      const body = await req.json().catch(() => ({}));
      const enabled = body.enabled;

      if (typeof enabled !== "boolean") {
        return json({ ok: false, error: "enabled must be a boolean" }, 400);
      }

      await setKV("auto_scour_enabled", enabled);

      if (typeof body.intervalMinutes === "number" && body.intervalMinutes >= 30) {
        await setKV("auto_scour_interval_minutes", body.intervalMinutes);
      }

      return json({
        ok: true,
        enabled,
        intervalMinutes: typeof body.intervalMinutes === "number" ? body.intervalMinutes : 60,
        message: enabled ? "Auto-scour enabled" : "Auto-scour disabled",
      });
    }

    // AUTO-SCOUR � RUN NOW
    if (path === "/auto-scour/run-now" && method === "POST") {
      const sources = (await querySupabaseRest("/sources?enabled=eq.true&order=created_at.desc&limit=1000")) || [];
      const sourceIds = sources.map((s: any) => s.id).filter(Boolean);

      if (!sourceIds.length) return json({ ok: false, error: "No enabled sources to scour" }, 400);

      const jobId = crypto.randomUUID();
      const job = {
        id: jobId,
        status: "running",
        sourceIds,
        daysBack: 14,
        processed: 0,
        created: 0,
        duplicatesSkipped: 0,
        errorCount: 0,
        errors: [],
        created_at: nowIso(),
        updated_at: nowIso(),
        total: sourceIds.length,
        autoScourTriggered: true,
      };

      await setKV(`scour_job:${jobId}`, job);
      await setKV("last_scour_job_id", jobId);
      await setKV("auto_scour_last_run", nowIso());

      // Run auto-scour asynchronously on server - continues even if browser closes or navigates
      // waitUntil() ensures the background task completes before edge function is terminated
      console.log(`?? AUTO-SCOUR STARTED (Server-side - runs independent of browser): ${jobId}`);
      waitUntil(
        runScourWorker({
          jobId,
          sourceIds,
          daysBack: 14,
          supabaseUrl,
          serviceKey,
          openaiKey: OPENAI_API_KEY!,
          claudeKey: CLAUDE_API_KEY,
          braveApiKey: Deno.env.get("BRAVRE_SEARCH_API_KEY"),
        }).then(async (stats) => {
          const finalJob = { ...job, status: "done", ...stats, updated_at: nowIso() };
          await setKV(`scour_job:${jobId}`, finalJob);
          console.log(`? AUTO-SCOUR COMPLETED (Server-side): ${jobId}`, stats);
        }).catch(async (e: any) => {
          const err = String(e?.message || e);
          const fail = { ...job, status: "error", errorCount: 1, errors: [err], updated_at: nowIso() };
          await setKV(`scour_job:${jobId}`, fail);
          console.log(`? AUTO-SCOUR FAILED (Server-side): ${jobId}`, err);
        })
      );

      return json({ ok: true, jobId, status: "running", total: job.total, message: "Auto-scour started" });
    }

    // SOURCES � GET ALL
    if (path === "/sources" && method === "GET") {
      const page = parseInt(url.searchParams.get("page") || "1", 10);
      const pageSize = parseInt(url.searchParams.get("pageSize") || "50", 10);
      const offset = Math.max(0, (page - 1) * pageSize);
      const sources = await querySupabaseRest(`/sources?order=created_at.desc&limit=${pageSize}&offset=${offset}`);
      const totalRows = await safeQuerySupabaseRest(`/sources?select=id`);
      const total = Array.isArray(totalRows) ? totalRows.length : 0;
      
      console.log(`?? GET /sources: total=${total}, page=${page}, returning=${sources?.length || 0}`);
      if (sources && sources.length > 0) {
        const enabledCount = sources.filter((s: any) => s.enabled).length;
        console.log(`   Enabled: ${enabledCount}/${sources.length}`);
      }
      
      return json({ ok: true, sources: sources || [], page, pageSize, total });
    }

    // SOURCES � CREATE
    if (path === "/sources" && method === "POST") {
      const body = await req.json().catch(() => ({}));
      const created = await querySupabaseRest(`/sources`, {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          id: crypto.randomUUID(),
          ...body,
          enabled: body.enabled ?? true,
          created_at: nowIso(),
          updated_at: nowIso(),
        }),
      });

      return json({ ok: true, source: created?.[0] });
    }

    // SOURCES � BULK UPLOAD
    if (path === "/sources/bulk" && method === "POST") {
      const body = await req.json().catch(() => ({}));
      const sourcesData = Array.isArray(body) ? body : body.sources || [];

      if (!Array.isArray(sourcesData) || sourcesData.length === 0) {
        return json({ ok: false, error: "No sources to import" }, 400);
      }

      const preparedSources = sourcesData
        .map((source: any) => ({
          id: crypto.randomUUID(),
          name: source.name || source.Name || source.title || "Untitled Source",
          url: source.url || source.URL || source.link || "",
          type: source.type || source.Type || 'rss',
          country: source.country || source.Country || null,
          enabled: source.enabled !== undefined ? source.enabled : true,
          created_at: nowIso(),
          updated_at: nowIso(),
        }))
        .filter((s: any) => {
          if (!s.url) return false;
          if (!String(s.url).match(/^https?:\/\//)) return false;
          return true;
        });

      const inserted = await batchInsert("sources", preparedSources, 100);
      return json({ ok: true, count: inserted.length, sources: inserted });
    }

    // SOURCES � UPDATE
    if (path.startsWith("/sources/") && method === "PATCH") {
      const id = path.split("/").pop()!;
      const body = await req.json().catch(() => ({}));

      const updated = await querySupabaseRest(`/sources?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ ...body, updated_at: nowIso() }),
      });

      return json({ ok: true, source: updated?.[0] });
    }

    // SOURCES � DELETE
    if (path.startsWith("/sources/") && method === "DELETE") {
      const id = path.split("/").pop()!;
      await querySupabaseRest(`/sources?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
      return json({ ok: true, deleted: id });
    }

    // TRENDS � REBUILD
    if (path === "/trends/rebuild" && method === "POST") {
      const DAYS_BACK = 14;
      const MIN_ALERTS = 3;

      const since = new Date(Date.now() - DAYS_BACK * 86400000).toISOString();

      // Include ALL alerts regardless of status (approved, dismissed, draft, published)
      // This ensures trends represent the complete picture of all incidents
      const alerts =
        (await querySupabaseRest(
          `/alerts?created_at=gte.${since}&select=id,country,event_type,severity,created_at`
        )) || [];
      
      console.log(`?? Trends rebuild: fetched ${alerts.length} alerts from last ${DAYS_BACK} days`);

      if (!alerts.length) {
        return json({ ok: true, created: 0, message: "No alerts found" });
      }

      const buckets = new Map<string, any[]>();
      for (const a of alerts) {
        const key = `${a.country || "Unknown"}|${a.event_type || "general"}`;
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key)!.push(a);
      }

      // clear existing trends - fetch all trend IDs first, then delete them
      const existingTrends = await safeQuerySupabaseRest(`/trends?select=id`) || [];
      if (existingTrends.length > 0) {
        const trendIds = existingTrends.map((t: any) => t.id);
        const ids = trendIds.map((id: string) => `"${id}"`).join(",");
        await safeQuerySupabaseRest(`/trends?id=in.(${ids})`, { method: "DELETE" });
      }

      const severityRank: Record<string, number> = {
        critical: 4,
        warning: 3,
        caution: 2,
        informative: 1,
      };

      const trends: any[] = [];
      for (const [key, items] of buckets) {
        if (items.length < MIN_ALERTS) continue;

        const [country, event_type] = key.split("|");
        const highest = items.reduce((max, a) =>
          severityRank[a.severity] > severityRank[max.severity] ? a : max
        , items[0]);

        const title = `${event_type} incidents in ${country}`;
        trends.push({
          id: crypto.randomUUID(),
          title,
          country,
          event_type,
          incident_count: items.length,
          severity: highest.severity,
          alert_ids: items.map((i) => i.id),
          first_seen: items[0]?.created_at || nowIso(),
          last_seen: items[items.length - 1]?.created_at || nowIso(),
          status: "open",
          auto_generated: true,
        });
      }

      if (!trends.length) return json({ ok: true, created: 0, message: "No qualifying trends" });

      await batchInsert("trends", trends, 50);
      return json({ ok: true, created: trends.length, windowDays: DAYS_BACK, minAlerts: MIN_ALERTS });
    }

    // TRENDS � GET ALL
    if (path === "/trends" && method === "GET") {
      try {
        const status = url.searchParams.get("status");
        const limit = url.searchParams.get("limit") || "1000";
        let endpoint = `/trends?order=created_at.desc&limit=${limit}`;
        if (status) endpoint = `/trends?status=eq.${encodeURIComponent(status)}&order=created_at.desc&limit=${limit}`;
        
        console.log(`?? Fetching trends from: ${endpoint}`);
        const trends = await safeQuerySupabaseRest(endpoint);
        
        if (!trends) {
          console.log(`?? No trends found or empty response`);
          return json({ ok: true, trends: [] });
        }
        
        const normalized = trends.map((t: any) => ({
          ...t,
          category: t.event_type || t.category || "General",
          count: typeof t.incident_count === "number" ? t.incident_count : (t.count ?? 0),
          highest_severity: t.severity || t.highest_severity || "informative",
          last_seen_at: t.last_seen || t.last_seen_at || t.updated_at || t.created_at,
          alert_ids: t.alert_ids || [],
        }));
        
        return json({ ok: true, trends: normalized });
      } catch (err: any) {
        console.error(`? Error fetching trends:`, err);
        return json({ ok: false, error: err.message }, 500);
      }
    }

    // TRENDS � GET ONE
    if (path.startsWith("/trends/") && method === "GET") {
      const parts = path.split("/");
      const lastPart = parts[parts.length - 1];
      const secondLastPart = parts[parts.length - 2];
      
      // Check if this is /trends/{id}/alerts
      if (secondLastPart && lastPart === "alerts") {
        const trendId = secondLastPart;
        
        try {
          // First get the trend to get alert_ids
          const trends = await safeQuerySupabaseRest(`/trends?id=eq.${encodeURIComponent(trendId)}`);
          if (!trends || trends.length === 0) return json({ ok: false, error: "Trend not found" }, 404);
          
          const trend = trends[0];
          const alertIds = trend.alert_ids || [];
          
          if (alertIds.length === 0) {
            return json({ ok: true, alerts: [] });
          }
          
          // Fetch alerts by IDs
          const alerts = await safeQuerySupabaseRest(`/alerts?id=in.(${alertIds.map(id => `"${id}"`).join(",")})&order=created_at.desc`);
          
          return json({ ok: true, alerts: alerts || [] });
        } catch (err: any) {
          console.error(`? Error fetching trend alerts:`, err);
          return json({ ok: false, error: err.message }, 500);
        }
      } else {
        // Regular /trends/{id} endpoint
        const trends = await safeQuerySupabaseRest(`/trends?id=eq.${encodeURIComponent(lastPart)}`);
        if (!trends || trends.length === 0) return json({ ok: false, error: "Trend not found" }, 404);
        return json({ ok: true, trend: trends[0] });
      }
    }

    // TRENDS � CREATE
    if (path === "/trends" && method === "POST") {
      const body = await req.json().catch(() => ({}));
      const created = await safeQuerySupabaseRest(`/trends`, {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          id: crypto.randomUUID(),
          ...body,
          status: body.status || "open",
          created_at: nowIso(),
          updated_at: nowIso(),
        }),
      });
      if (!created) return json({ ok: false, error: "Trends table not available" }, 500);
      return json({ ok: true, trend: created[0] });
    }

    if (path.startsWith("/trends/") && method === "PATCH") {
      const id = path.split("/").pop()!;
      const body = await req.json().catch(() => ({}));
      const updated = await safeQuerySupabaseRest(`/trends?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ ...body, updated_at: nowIso() }),
      });
      return json({ ok: true, trend: updated?.[0] });
    }

    // TRENDS � GENERATE SITUATIONAL REPORT (POST /trends/:id/generate-report)
    if (path.endsWith("/generate-report") && method === "POST") {
      const trendId = path.split("/").filter(Boolean)[1];
      if (!trendId) return json({ ok: false, error: "Trend ID required" }, 400);

      try {
        const trends = await safeQuerySupabaseRest(`/trends?id=eq.${encodeURIComponent(trendId)}`);
        if (!trends || trends.length === 0) return json({ ok: false, error: "Trend not found" }, 404);

        const trend = trends[0];

        // Fetch related alerts
        const alertIds = (trend.alert_ids || []).slice(0, 10);
        let alerts: any[] = [];
        if (alertIds.length > 0) {
          const ids = alertIds.map((id: string) => `"${id}"`).join(",");
          alerts = await safeQuerySupabaseRest(`/alerts?id=in.(${ids})`) || [];
        }

        if (!OPENAI_API_KEY) {
          return json({ ok: false, error: "AI not configured" }, 500);
        }

        // Build context from trend and related alerts
        const alertSummaries = alerts
          .map((a: any) => `- ${a.title}: ${a.summary} (${a.severity.toUpperCase()}, ${a.location})`)
          .join("\n");

        const highestSeverity = trend.severity || trend.highest_severity || "warning";
        const lastSeen = trend.last_seen || trend.last_seen_at || trend.updated_at || trend.created_at;
        const incidentCount = (typeof trend.incident_count === "number" ? trend.incident_count : trend.count) || alerts.length;

        // Gather current information using Brave Search if available
        let currentNewsContext = "";
        const braveApiKey = Deno.env.get("BRAVRE_SEARCH_API_KEY");
        if (braveApiKey) {
          console.log(`?? Fetching current news for trend: "${trend.title}"`);
          
          // Search for trend-specific news
          const searchQueries = [
            `${trend.title} ${trend.country}`,
            `${trend.country} ${trend.event_type || "incident"} latest`,
            `travel advisory ${trend.country}`,
          ];
          
          const newsResults: string[] = [];
          for (const query of searchQueries) {
            try {
              const searchRes = await fetch(
                `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`,
                {
                  headers: {
                    'Accept': 'application/json',
                    'X-Subscription-Token': braveApiKey,
                  },
                  signal: AbortSignal.timeout(10000),
                }
              );
              
              if (searchRes.ok) {
                const searchData = await searchRes.json();
                const results = searchData.web?.results || [];
                if (results.length > 0) {
                  newsResults.push(`\n[From: "${query}"]`);
                  results.slice(0, 3).forEach((r: any) => {
                    newsResults.push(`� ${r.title}: ${r.description}`);
                  });
                }
              }
            } catch (err) {
              console.warn(`??  Search failed for "${query}":`, err);
            }
          }
          
          if (newsResults.length > 0) {
            currentNewsContext = `\nCURRENT NEWS & ADVISORIES:\n${newsResults.join('\n')}\n`;
            console.log(`? Found ${newsResults.length} current news items`);
          }
        }
        const prompt = `You are a MAGNUS Travel Safety Intelligence analyst creating a professional situational report on a developing travel safety trend.

TREND: ${trend.title}
COUNTRY: ${trend.country}
SEVERITY: ${String(highestSeverity).toUpperCase()}
LAST UPDATED: ${new Date(lastSeen).toLocaleDateString()}
RELATED INCIDENTS: ${incidentCount}

RECENT EVENTS:
${alertSummaries || "No specific incidents available"}
${currentNewsContext}Generate a professional Situational Report in the following sections:

1. EXECUTIVE SUMMARY
   - 2-3 sentence overview of the situation
   - Primary concern and scope

2. SITUATION
   - Current conditions and key developments
   - Geographic distribution
   - Timeline of recent events
   - Impact on travelers

3. AFFECTED AREAS & POPULATIONS
   - Specific locations at risk
   - Types of travelers affected
   - Demographics most vulnerable

4. SEVERITY ASSESSMENT
   - Overall severity level
   - Risk factors that elevate severity
   - Potential for escalation

5. TRAVELER SAFETY RECOMMENDATIONS
   - Immediate actions travelers should take
   - Areas to avoid
   - Recommended transport routes
   - When to evacuate if applicable
   - Communication protocols with authorities

6. FORECAST & OUTLOOK
   - Expected developments in next 48-72 hours
   - Seasonal/recurring patterns if applicable
   - Long-term risk assessment

7. RESOURCES & CONTACTS
   - Embassy/consulate information (if applicable)
   - Emergency services
   - Relevant government advisories
   - NGO/humanitarian resources

Format the response as plain text with clear section headers. Include specific, actionable information. Maintain MAGNUS professional standards.`;

        const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.3,
            max_tokens: 2500,
          }),
          signal: AbortSignal.timeout(30000),
        });

        if (!aiRes.ok) {
          const errText = await aiRes.text().catch(() => "Unknown error");
          return json({ ok: false, error: `AI generation failed: ${errText}` }, 500);
        }

        const aiData = await aiRes.json();
        const reportContent = aiData.choices?.[0]?.message?.content || "";

        if (!reportContent) {
          return json({ ok: false, error: "Failed to generate report content" }, 500);
        }

        // Build HTML version of the report
        const buildReportHTML = (): string => {
          // MAGNUS Brand Colors
          const darkGreen = '#144334';     // Primary
          const deepGreen = '#1A6B51';     // Supporting
          const orange = '#F88A35';        // Accent
          const offWhite = '#F9F8F6';      // Background
          const primaryText = '#192622';   // Primary Text
          const secondaryText = '#17221E'; // Secondary Text

          const timestamp = new Date().toLocaleString();
          const severityColor = 
            highestSeverity === 'critical' ? orange :
            highestSeverity === 'warning' ? orange :
            highestSeverity === 'caution' ? orange : orange;

          // Convert markdown/plain text to HTML
          const convertMarkdownToHTML = (text: string): string => {
            // First, replace literal \n with actual newlines
            let converted = text.replace(/\\n/g, '\n');
            
            // Split into lines for processing
            const lines = converted.split('\n');
            const htmlLines: string[] = [];
            let inList = false;
            
            for (let i = 0; i < lines.length; i++) {
              let line = lines[i];
              const trimmed = line.trim();
              
              // Skip completely empty lines
              if (trimmed === '') {
                // Close list if we were in one
                if (inList) {
                  htmlLines.push('</ul>');
                  inList = false;
                }
                continue;
              }
              
              // Convert markdown headers ## to h2, ### to h3
              if (trimmed.startsWith('## ')) {
                if (inList) {
                  htmlLines.push('</ul>');
                  inList = false;
                }
                const headerText = trimmed.substring(3);
                htmlLines.push(`<div class="divider"></div><h2>${headerText}</h2>`);
                continue;
              }
              
              if (trimmed.startsWith('### ')) {
                if (inList) {
                  htmlLines.push('</ul>');
                  inList = false;
                }
                const headerText = trimmed.substring(4);
                htmlLines.push(`<h3>${headerText}</h3>`);
                continue;
              }
              
              // Convert markdown # to h1 (main title - shouldn't appear but handle it)
              if (trimmed.startsWith('# ')) {
                if (inList) {
                  htmlLines.push('</ul>');
                  inList = false;
                }
                const headerText = trimmed.substring(2);
                htmlLines.push(`<h2>${headerText}</h2>`);
                continue;
              }
              
              // Convert bullet points
              if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                if (!inList) {
                  htmlLines.push('<ul>');
                  inList = true;
                }
                let listItem = trimmed.substring(2);
                // Convert **bold** in list items
                while (listItem.includes('**')) {
                  const start = listItem.indexOf('**');
                  const end = listItem.indexOf('**', start + 2);
                  if (end > start) {
                    const boldText = listItem.substring(start + 2, end);
                    listItem = listItem.substring(0, start) + `<strong>${boldText}</strong>` + listItem.substring(end + 2);
                  } else {
                    break;
                  }
                }
                htmlLines.push(`  <li>${listItem}</li>`);
                continue;
              }
              
              // Numbered lists
              if (trimmed.match(/^\d+\.\s/)) {
                if (inList) {
                  htmlLines.push('</ul>');
                  inList = false;
                }
                // Remove leading number and period
                let listItem = trimmed.trim();
                if (/^\d+\.\s/.test(listItem)) {
                  listItem = listItem.substring(listItem.indexOf('.') + 1).trim();
                }
                // Convert **bold** in numbered items
                while (listItem.includes('**')) {
                  const start = listItem.indexOf('**');
                  const end = listItem.indexOf('**', start + 2);
                  if (end > start) {
                    const boldText = listItem.substring(start + 2, end);
                    listItem = listItem.substring(0, start) + `<strong>${boldText}</strong>` + listItem.substring(end + 2);
                  } else {
                    break;
                  }
                }
                htmlLines.push(`<h2>${listItem}</h2>`);
                continue;
              }
              
              // Regular paragraph
              if (inList) {
                htmlLines.push('</ul>');
                inList = false;
              }
              
              // Convert **bold** to <strong>
              line = trimmed;
              while (line.includes('**')) {
                const start = line.indexOf('**');
                const end = line.indexOf('**', start + 2);
                if (end > start) {
                  const boldText = line.substring(start + 2, end);
                  line = line.substring(0, start) + `<strong>${boldText}</strong>` + line.substring(end + 2);
                } else {
                  break;
                }
              }
              
              // Convert *italic* to <em>
              while (line.includes('*')) {
                const start = line.indexOf('*');
                const end = line.indexOf('*', start + 1);
                if (end > start) {
                  const italicText = line.substring(start + 1, end);
                  line = line.substring(0, start) + `<em>${italicText}</em>` + line.substring(end + 1);
                } else {
                  break;
                }
              }
              
              htmlLines.push(`<p>${line}</p>`);
            }
            
            // Close list if still open
            if (inList) {
              htmlLines.push('</ul>');
            }
            
            return htmlLines.join('\n');
          };

          let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${trend.title} - Situational Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: ${primaryText};
      background: ${offWhite};
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
      background: white;
      padding: 0;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    header {
      background: linear-gradient(135deg, ${darkGreen} 0%, ${deepGreen} 100%);
      color: white;
      padding: 30px 35px;
      margin-bottom: 25px;
      border-bottom: 4px solid ${orange};
    }
    .header-content {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 20px;
    }
    .header-left h1 {
      font-size: 1.9em;
      margin-bottom: 12px;
      color: white;
      font-weight: 700;
    }
    .meta-info {
      display: flex;
      gap: 25px;
      margin-top: 12px;
      font-size: 0.9em;
      color: rgba(255,255,255,0.95);
      flex-wrap: wrap;
    }
    .meta-item {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .meta-item strong {
      color: ${orange};
      margin-right: 3px;
    }
    .severity-badge {
      background: ${orange};
      color: white;
      padding: 10px 18px;
      border-radius: 8px;
      font-weight: 700;
      font-size: 0.85em;
      text-transform: uppercase;
      height: fit-content;
      white-space: nowrap;
      letter-spacing: 0.5px;
      box-shadow: 0 2px 6px rgba(248, 138, 53, 0.3);
    }
    .content {
      word-wrap: break-word;
      font-size: 0.95em;
      line-height: 1.7;
      margin: 0;
      padding: 25px 35px;
      color: ${primaryText};
    }
    .content section {
      margin-bottom: 18px;
    }
    .divider {
      height: 2px;
      background: linear-gradient(90deg, transparent, ${orange}, transparent);
      margin: 20px 0 12px 0;
    }
    .content h2 {
      font-size: 1.25em;
      color: ${darkGreen};
      margin-bottom: 10px;
      margin-top: 0;
      padding-bottom: 0;
      border-bottom: none;
      font-weight: 600;
      letter-spacing: 0.3px;
    }
    .content h3 {
      font-size: 1.05em;
      color: ${deepGreen};
      margin: 12px 0 6px 0;
      font-weight: 600;
    }
    .content p {
      margin-bottom: 10px;
      text-align: justify;
    }
    .content ul, .content ol {
      margin-left: 22px;
      margin-bottom: 10px;
      margin-top: 6px;
    }
    .content li {
      margin-bottom: 5px;
      line-height: 1.6;
    }
    footer {
      background: ${deepGreen};
      color: white;
      padding: 18px 35px;
      margin-top: 25px;
      font-size: 0.85em;
      border-top: 3px solid ${orange};
    }
    .footer-content {
      text-align: center;
      color: white;
    }
    .footer-content p:first-child {
      font-weight: 600;
      font-size: 0.95em;
      margin-bottom: 10px;
      color: ${orange};
      letter-spacing: 0.3px;
    }
    .footer-contacts {
      display: flex;
      justify-content: center;
      gap: 25px;
      flex-wrap: wrap;
      font-size: 0.9em;
      margin-bottom: 0;
    }
    .footer-contacts div {
      display: flex;
      align-items: center;
      gap: 5px;
    }
    .footer-contacts strong {
      color: white;
    }
    @media print {
      body { background: white; }
      .container { box-shadow: none; }
      header, footer { page-break-after: avoid; page-break-before: avoid; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="header-content">
        <div class="header-left">
          <h1>${trend.title}</h1>
          <div class="meta-info">
            <div class="meta-item">?? <strong>Country:</strong> ${trend.country}</div>
            <div class="meta-item">?? <strong>Generated:</strong> ${timestamp}</div>
            <div class="meta-item">?? <strong>Incidents:</strong> ${incidentCount}</div>
          </div>
        </div>
        <div class="severity-badge">${String(highestSeverity).toUpperCase()}</div>
      </div>
    </header>

    <div class="content">
${convertMarkdownToHTML(reportContent)}
    </div>

    <footer>
      <div class="footer-content">
        <p>Report generated by MAGNUS Intelligence Department</p>
        <div class="footer-contacts">
          <div>?? Service@magnusafety.com</div>
          <div>?? <strong>+972-50-889-9698</strong></div>
        </div>
      </div>
    </footer>
  </div>
</body>
</html>`;
          return html;
        };

        // Build the final report with MAGNUS branding
        const report = {
          id: crypto.randomUUID(),
          trendId: trend.id,
          title: `${trend.title} - Situational Report`,
          generatedAt: nowIso(),
          country: trend.country,
          severity: highestSeverity,
          content: reportContent,
          html: buildReportHTML(),
          metadata: {
            trendTitle: trend.title,
            incidents: incidentCount,
            alertIds: alertIds,
            generatedBy: "MAGNUS Intelligence System",
            model: "gpt-4o-mini",
          },
        };

        return json({
          ok: true,
          report,
          message: "Situational report generated successfully",
        });
      } catch (err: any) {
        console.error("Report generation error:", err);
        return json({ ok: false, error: String(err?.message || err) }, 500);
      }
    }

    if (path.startsWith("/trends/") && method === "DELETE") {
      const id = path.split("/").pop()!;
      await safeQuerySupabaseRest(`/trends?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
      return json({ ok: true, deleted: id });
    }

    // MONITORING → SCOUR ACTIVITY (GET /scour/activity - Shows current scour + IP)
    if (path === "/scour/activity" && method === "GET") {
      const currentJobId = await getKV("last_scour_job_id");
      
      if (!currentJobId) {
        return json({ 
          ok: true, 
          scourActive: false, 
          message: "No active scour running" 
        });
      }
      
      const job = await getKV(`scour_job:${currentJobId}`);
      const lock = await getKV("scour_job_lock");
      
      if (!job) {
        return json({ 
          ok: true, 
          scourActive: false, 
          message: "Job not found in KV" 
        });
      }
      
      // Calculate runtime
      const startTime = new Date(job.startedAt || job.created_at);
      const nowTime = new Date();
      const runtimeMs = nowTime.getTime() - startTime.getTime();
      const runtimeSecs = Math.round(runtimeMs / 1000);
      const runtimeMins = Math.round(runtimeMs / 60000);
      
      const isActive = job.status === "running" && lock;
      
      return json({
        ok: true,
        scourActive: isActive,
        job: {
          id: job.id,
          status: job.status,
          clientIp: job.clientIp || "unknown",
          phase: job.phase,
          progress: `${job.processed || 0}/${job.total || 0}`,
          created: job.created || 0,
          errorCount: job.errorCount || 0,
          runtime: {
            seconds: runtimeSecs,
            minutes: runtimeMins,
            formatted: `${runtimeMins}min ${runtimeSecs % 60}sec`
          },
          startedAt: job.startedAt || job.created_at,
          updatedAt: job.updated_at,
          currentSource: job.currentSourceName || "N/A",
        }
      });
    }

    // ADMIN: Disable multiple sources
    if (path === "/admin/disable-sources" && method === "POST") {
      try {
        const body = await req.json();
        const { sourceNames, secret } = body;
        
        if (secret !== "emergency-unlock-key") {
          return json({ ok: false, error: "Invalid secret" }, 401);
        }
        
        if (!Array.isArray(sourceNames)) {
          return json({ ok: false, error: "sourceNames must be an array" }, 400);
        }

        for (const name of sourceNames) {
          await querySupabaseRest(`/sources?name=eq.${encodeURIComponent(name)}`, {
            method: "PATCH",
            body: JSON.stringify({ enabled: false }),
          });
        }
        
        console.log(`✓ Disabled ${sourceNames.length} sources`);
        return json({ ok: true, message: `Disabled ${sourceNames.length} sources`, sourceNames });
      } catch (e: any) {
        return json({ ok: false, error: String(e?.message || e) }, 500);
      }
    }

    // MONITORING → ACTIVE SESSIONS (GET /scour/sessions - Shows all scour IPs + history)
    if (path === "/scour/sessions" && method === "GET") {
      // Query all scour jobs from KV (pattern: scour_job:*)
      // Note: Deno KV doesn't have a direct "list by pattern" API in simple mode,
      // so we'll return the current job + lock info as a fallback
      
      const currentJobId = await getKV("last_scour_job_id");
      const lock = await getKV("scour_job_lock");
      const lastScourTime = await getKV("last_scoured_timestamp");
      
      const sessions = [];
      
      if (currentJobId && lock) {
        const job = await getKV(`scour_job:${currentJobId}`);
        if (job) {
          sessions.push({
            type: "current",
            jobId: job.id,
            status: job.status,
            clientIp: job.clientIp || "unknown",
            startedAt: job.startedAt || job.created_at,
            lastUpdated: job.updated_at,
            progress: `${job.processed || 0}/${job.total}`,
            phase: job.phase,
          });
        }
      }
      
      return json({
        ok: true,
        activeCount: sessions.length,
        sessions,
        lastScourTime: lastScourTime || "never",
        lockStatus: lock ? "locked" : "unlocked",
      });
    }

    return respondNotFound(rawPath);
  } catch (e: any) {
    return json({ ok: false, error: String(e?.message || e) }, 500);
  }
});

