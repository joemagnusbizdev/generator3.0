/// <reference lib="deno.unstable" />

console.log("=== Clever Function starting ===");

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
  'France': [2.3522, 48.8566],
  'Germany': [13.4050, 52.5200],
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

// Determine geo scope based on severity and description
function determineGeoScope(
  severity: string,
  country: string,
  region?: string
): 'local' | 'city' | 'regional' | 'national' | 'multinational' {
  if (!region) return 'national';
  const isLocal = region.length < 50 && !region.includes(',');
  if (severity === 'critical') return 'regional';
  if (severity === 'warning') return isLocal ? 'city' : 'regional';
  return 'local';
}

// Determine radius in km based on severity and scope
function getRadiusFromSeverity(severity: string, scope: string, eventType?: string): number {
  // Base radius by geoScope
  const scopeRadius: Record<string, number> = {
    'local': 8,
    'city': 25,
    'regional': 75,
    'national': 200,
    'multinational': 500,
  };
  
  // Multiplier by severity and event type
  let baseRadius = scopeRadius[scope] || 25;
  
  // Apply severity multiplier
  const severityMultiplier: Record<string, number> = {
    'critical': 1.8,
    'warning': 1.3,
    'caution': 0.9,
    'informative': 0.7,
  };
  baseRadius *= severityMultiplier[severity] || 1.0;
  
  // Additional multiplier by event type impact
  const eventTypeMultiplier: Record<string, number> = {
    'Natural Disaster': 1.5,
    'War': 1.6,
    'Terrorism': 1.4,
    'Aviation': 0.8,
    'Maritime': 1.2,
    'Crime': 0.6,
    'Health': 1.3,
    'Environmental': 1.4,
    'Infrastructure': 0.9,
    'Political': 1.1,
    'Transportation': 1.0,
  };
  
  const multiplier = eventType ? (eventTypeMultiplier[eventType] || 1.0) : 1.0;
  baseRadius *= multiplier;
  
  // Cap the result between 5-800 km
  return Math.max(5, Math.min(800, Math.round(baseRadius)));
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

// Convert recommendations string/array to ACF repeater format (array of objects)
function formatRecommendationsForACF(recs: string | string[] | null | undefined): Array<Record<string, any>> {
  if (!recs) return [];
  
  let recArray: string[] = [];
  if (typeof recs === 'string') {
    // Split by newline, bullet, or number patterns
    recArray = recs
      .split(/\n|;/)
      .map((rec: string) => rec.replace(/^[\d+.•\-*]\s*/, '').trim())
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
  
  // Generic sources (RSS, feeds, etc.)
  if (sourceType && ['rss', 'atom', 'feed', 'web'].includes(sourceType)) {
    return 0.55;
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
        const cleaned = aiResponse.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '');
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

async function fetchWithBraveSearch(query: string, braveApiKey: string): Promise<{ content: string; primaryUrl: string | null }> {
  try {
    console.log(`?? Brave Search: "${query}" (API key: ${braveApiKey ? braveApiKey.slice(0, 8) + '...' : 'MISSING'})`);
    
    if (!braveApiKey) {
      console.warn('?? Brave API key not provided - skipping Brave Search');
      return { content: '', primaryUrl: null };
    }
    
    const response = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=10&freshness=pd`,
      {
        headers: {
          'Accept': 'application/json',
          'X-Subscription-Token': braveApiKey,
        },
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'unknown error');
      console.error(`? Brave Search failed: ${response.status} - ${errorText}`);
      throw new Error(`Brave Search failed: ${response.status}`);
    }

    const data = await response.json();
    const results = data.web?.results || [];
    console.log(`? Brave Search returned ${results.length} results for "${query}"`);
    
    const primaryUrl = results[0]?.url || null;
    const content = results.map((r: any) => `Title: ${r.title}\nDescription: ${r.description}\nURL: ${r.url}\n\n`).join('');
    return { content, primaryUrl };
  } catch (err) {
    console.error('? Brave Search error:', err);
    return { content: '', primaryUrl: null };
  }
}

// ----------------------------------------------------------------------------
// Structured Source Parsers (USGS Atom, NWS CAP, Generic RSS/Atom)
// ----------------------------------------------------------------------------

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
    const mag = magnitudeFromTitle(title);
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
    const pub = parseText('pubDate', e) || parseText('updated', e) || now;
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
        console.warn(`   ??  HTTP ${response.status} (blocked/rate-limited) - ${url}`);
        console.log(`   ?? Will use Brave Search as fallback`);
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
  const severityRecommendations: Record<string, string> = {
    critical: `Travel to ${location} is not recommended at this time. Avoid all non-essential travel and monitor official government advisories closely. If currently in the area, follow local authority guidance and evacuation orders.`,
    warning: `Exercise increased caution when traveling to ${location}. Monitor the situation regularly, maintain travel insurance, keep emergency contacts accessible, and follow official guidance from your embassy or consulate.`,
    caution: `Exercise normal precautions when traveling to ${location}. Stay aware of your surroundings, register with your embassy, and maintain communication with reliable sources for updates on the situation.`,
    informative: `Standard travel precautions apply when visiting ${location}. Review current conditions before travel and maintain awareness of local developments that may affect tourism or movement.`,
  };

  return severityRecommendations[severity] || severityRecommendations.informative;
}

async function extractAlertsWithAI(
  content: string,
  source_url: string,
  sourceName: string,
  existingAlerts: Alert[],
  config: ScourConfig
): Promise<Alert[]> {
  const currentDate = new Date().toISOString().split('T')[0];
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - config.daysBack);
  const cutoffStr = cutoffDate.toISOString().split('T')[0];

  const existingAlertsStr = existingAlerts.slice(0, 50).map(a => 
    `- ${a.title} (${a.location}, ${a.country}) [${a.status}]`
  ).join('\n');

  const systemPrompt = `You are MAGNUS travel safety intelligence analyst. Current date: ${currentDate}.

CRITICAL RULES:
1. ONLY extract events from ${cutoffStr} onwards (last ${config.daysBack} days)
2. REJECT any event from 2023 or earlier
3. DO NOT create alerts similar to these existing ones:
${existingAlertsStr}

DO NOT EXTRACT ALERTS FOR (Auto-Reject):
- Arts, entertainment, culture, music, film, theater, fashion, lifestyle
- Sports events, games, tournaments, athlete news, team announcements
- Science discoveries, research, academic papers, space exploration (unless direct safety impact)
- Business news, corporate earnings, stock markets, mergers, company announcements
- Technology product launches, app releases, gadget reviews
- Celebrity news, personal stories, human interest stories without safety relevance
- Political speeches, election campaigns, policy debates (unless causing unrest/violence)
- Historical anniversaries, memorials, commemorations
- General tourism promotion, destination marketing, travel tips
- Food reviews, restaurant openings, culinary trends
- Real estate, property markets, construction projects (unless collapse/safety incident)
- Education news, school openings, academic calendars

EXTRACT ALERTS FOR ANY EVENT THAT COULD IMPACT TRAVELER SAFETY:

PRIORITY EVENTS (Always Extract):
- Natural disasters: earthquakes, tsunamis, hurricanes, typhoons, floods, wildfires, volcanic eruptions
- Severe weather: extreme heat/cold, heavy snow, dangerous storms, monsoons
- Infrastructure failures: power outages, water shortages, bridge/road collapses
- Transportation disruptions: airport closures, flight cancellations, train strikes, road blockades
- Health emergencies: disease outbreaks, medical facility closures, public health alerts
- Political instability: coups, government collapses, mass protests, civil unrest, riots
- Security incidents: terrorist attacks, mass shootings, bombings, kidnappings
- Armed conflict: war zones, active combat, airstrikes, military operations, border conflicts
- Border issues: border closures, visa suspensions, entry restrictions, deportations
- Crime waves: increased violence, gang activity, tourist targeting, safety warnings
- Aviation incidents: plane crashes, airport attacks, airspace closures
- Maritime incidents: port closures, piracy, ferry disasters, cruise ship emergencies
- Hate crimes and discrimination: targeted violence, xenophobic attacks, religious persecution
- Event cancellations: major festivals/conferences cancelled due to safety concerns
- Evacuations: mass evacuations, embassy warnings to leave, travel bans

ALSO CONSIDER (If Relevant to Travelers):
- Major government policy changes affecting visitors
- Currency crises or economic instability
- Food/water safety alerts
- Environmental hazards (pollution, radiation, toxic spills)
- Wildlife hazards (animal attacks, disease-carrying insects)
- Infrastructure strikes (utilities, communications, transport workers)

OUTPUT: JSON array of alerts with these MANDATORY fields:
{
  "severity": "critical"|"warning"|"caution"|"informative",
  "country": "SPECIFIC country name (NEVER use 'Global', 'Worldwide', 'International' - list affected countries as separate alerts or use specific regions)",
  "eventType": "MUST be one of: Armed Conflict, Air Incidents, Air Raid Sirens, Avalanches, Bomb Threats, Building Collapses, Chemical Weapons, Coronavirus, Drought, Earthquakes, Elections, Evacuations, Explosions, Fires, Floods, Health, Heat Waves, Internet Outages, Kidnappings, Landslides, Lockdowns, Nuclear Weapons, Outbreaks, Police Shootings, Power Outages, Protests, Civil Unrest, Rail Incidents, Road Incidents, Robberies, Shootings, Stabbings, Strike Actions, Suspicious Packages, Terrorism, Traffic, Transportation Incidents, Tornadoes, Tropical Cyclones, Tsunamis, Volcanoes, Wildland Fires, Water Quality, Winter Storms, Severe Weather, Security, Safety, Flight Disruptions, Gas Leaks, Pro-Palestinian Protest",
  "title": "Clear, specific alert headline",
  "location": "SPECIFIC city/location (NEVER generic like 'Various locations' - be specific: 'Cairo', 'Tokyo', or 'Mexico City to Cancun' if multiple specific places)",
  "latitude": decimal degrees (REQUIRED - must be specific coordinate, not null),
  "longitude": decimal degrees (REQUIRED - must be specific coordinate, not null),
  "radiusKm": "Estimated radius of impact in kilometers (local/small area: 5-20, city: 20-50, regional: 50-200, national: 200-500, multinational: 500+)",
  "region": "Broader regional context",
  "geoScope": "local"|"city"|"regional"|"national"|"multinational",
  "geoJSON": {REQUIRED GeoJSON object: FeatureCollection with polygon or point features covering the affected area. Example: {"type":"FeatureCollection","features":[{"type":"Feature","geometry":{"type":"Polygon","coordinates":[[[-73.935242,40.730610],[-73.935242,40.780610],[-73.885242,40.780610],[-73.885242,40.730610],[-73.935242,40.730610]]]},"properties":{"name":"Affected Area"}}]}. MUST be valid GeoJSON or alert will be rejected.},
  "summary": "What happened, when, where, current status - 2-3 sentences under 150 words",
  "recommendations": "Specific, actionable advice for travelers - what to do/avoid",
  "mitigation": "Safety precautions, official guidance, and protective measures",
  "secondaryImpacts": ["predicted downstream effect 1", "effect 2"],
  "eventStartDate": "2026-01-14T12:00:00Z",
  "eventEndDate": "2026-01-17T12:00:00Z"
}

SEVERITY GUIDELINES:
- CRITICAL: Imminent danger to life, active conflict, major disasters, urgent evacuations
- WARNING: Significant risk, developing situations, protests turning violent, serious disruptions
- CAUTION: Elevated risk, ongoing monitoring needed, minor disruptions, heightened security
- INFORMATIVE: Awareness advisories, resolved situations, general travel considerations

CRITICAL REQUIREMENTS:
- COUNTRY: MUST be specific country name. REJECT any alert with 'Global', 'Worldwide', 'International', or 'Multiple'. If event affects multiple countries, create separate alerts per country.
- LOCATION: MUST be specific city or region name. REJECT vague locations like 'Various locations' or 'Nationwide'. If nationwide, use capital city + radius. For multi-city events, list specific cities.
- LATITUDE/LONGITUDE: REQUIRED and MUST NOT be null. Provide decimal degrees for the affected area's center.
- GEOJSON: REQUIRED for all alerts. Must be valid GeoJSON FeatureCollection with polygon(s) or point(s) covering affected area. No null values.

CRITICAL DATES:
- eventEndDate: Critical=72h from start, Warning=48h, Caution=36h, Informative=24h (adjust based on event duration if specified)
- Format: ISO 8601 timestamp

REJECT CRITERIA - DO NOT INCLUDE ALERTS WITH:
- country = "Global", "Worldwide", "International", "Multiple", null, or undefined
- location = null, undefined, vague descriptions like "Various locations"
- latitude or longitude = null, undefined, 0, or missing
- geoJSON = null, undefined, invalid JSON, or missing
- Content about: arts, sports, entertainment, business, science, technology, celebrity news, culture, lifestyle, food, real estate, education (unless direct safety impact)
- If any of these are missing, skip the alert entirely

If NO travel-safety-relevant events are found, return an empty array: []

Return ONLY valid JSON array, no markdown formatting, no explanatory text.`;

  try {
    console.log(`?? OpenAI API ? Calling gpt-4o-mini (API key: ${config.openaiKey ? config.openaiKey.slice(0, 8) + '...' : 'MISSING'})`);
    
    if (!config.openaiKey) {
      console.error('? OpenAI API key is missing - cannot extract alerts');
      return [];
    }

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

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'unknown error');
      console.error(`? OpenAI failed: ${response.status} - ${errorText}`);
      throw new Error(`OpenAI failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0]?.message?.content || '[]';
    
    console.log(`? OpenAI returned response (${aiResponse.length} chars)`);
    console.log(`   Preview: ${aiResponse.slice(0, 200)}`);

    let alerts: any[] = [];
    try {
      const cleaned = aiResponse.trim().replace(/^```json\s*/,'').replace(/\s*```$/,'');
      alerts = JSON.parse(cleaned);
    } catch {
      try {
        const match = aiResponse.match(/\[[\s\S]*\]/);
        if (match) {
          alerts = JSON.parse(match[0]);
        }
      } catch (e) {
        console.error('? Failed to parse AI response:', e);
        return [];
      }
    }

    if (!Array.isArray(alerts)) {
      console.warn(`? AI response is not an array, got: ${typeof alerts}`);
      return [];
    }

    // VALIDATION: Filter out alerts that don't meet mandatory requirements
    const validAlerts = alerts.filter((alert: any) => {
      const issues: string[] = [];
      
      // Check country - MUST NOT be Global/Worldwide/International/Multiple
      const country = alert.country?.trim().toLowerCase() || '';
      const invalidCountries = ['global', 'worldwide', 'international', 'multiple', 'various'];
      if (!alert.country || invalidCountries.includes(country)) {
        issues.push(`Invalid country: "${alert.country}"`);
      }
      
      // Check location - MUST be specific
      const location = alert.location?.trim().toLowerCase() || '';
      const invalidLocations = ['various', 'various locations', 'multiple locations', 'nationwide', 'countrywide', 'unknown'];
      if (!alert.location || invalidLocations.includes(location)) {
        issues.push(`Invalid location: "${alert.location}"`);
      }
      
      // Check coordinates - MUST NOT be null/undefined/zero
      const lat = parseFloat(alert.latitude ?? 'NaN');
      const lon = parseFloat(alert.longitude ?? 'NaN');
      if (isNaN(lat) || isNaN(lon) || lat === 0 && lon === 0) {
        issues.push(`Invalid coordinates: lat=${alert.latitude}, lon=${alert.longitude}`);
      }
      
      // Check geoJSON - MUST be present and valid
      if (!alert.geoJSON) {
        issues.push('Missing geoJSON');
      } else {
        try {
          const gj = typeof alert.geoJSON === 'string' ? JSON.parse(alert.geoJSON) : alert.geoJSON;
          if (!gj.type || !gj.features) {
            issues.push('Invalid geoJSON structure');
          }
        } catch (e) {
          issues.push('geoJSON parse error');
        }
      }
      
      // Check eventType - MUST be one of the valid ACF enum values (will be normalized if not)
      // Note: We normalize invalid values, so just log a warning if it's very wrong
      if (!alert.eventType || alert.eventType.trim() === '') {
        issues.push(`Missing eventType`);
      }
      
      if (issues.length > 0) {
        console.warn(`? Filtering out alert "${alert.title}": ${issues.join(', ')}`);
        return false;
      }
      return true;
    });

    if (validAlerts.length < alerts.length) {
      console.log(`? Filtered ${alerts.length} alerts → ${validAlerts.length} valid (${alerts.length - validAlerts.length} rejected for missing required fields)`);
    }

    const now = new Date().toISOString();
    return validAlerts.map((alert: any) => {
      const lat = alert.latitude || 0;
      const lon = alert.longitude || 0;
      const severity = alert.severity || 'informative';
      const geoScope = alert.geoScope || determineGeoScope(severity, alert.country, alert.region);
      const eventType = alert.eventType || 'General';
      const radiusKm = alert.radiusKm || getRadiusFromSeverity(severity, geoScope, eventType);
      
      // Use geoJSON from AI response (validation ensures it exists)
      let geoJSON = null;
      if (alert.geoJSON) {
        try {
          geoJSON = typeof alert.geoJSON === 'string' ? JSON.parse(alert.geoJSON) : alert.geoJSON;
        } catch (e) {
          console.warn(`Failed to parse geoJSON for "${alert.title}", will generate fallback`);
          geoJSON = generateCircleGeoJSON(lat, lon, radiusKm);
        }
      } else {
        // Validation should have prevented this, but fallback just in case
        geoJSON = lat && lon ? generateCircleGeoJSON(lat, lon, radiusKm) : generatePointGeoJSON(lat, lon);
      }
      
      // Generate default recommendations if missing
      const recommendations = alert.recommendations?.trim() || generateDefaultRecommendations(severity, alert.eventType, alert.location);
      
      console.log(`?? Alert "${alert.title}" - Location: ${alert.location}, Country: ${alert.country}, GeoJSON: YES, Recommendations: ${recommendations ? 'YES (' + recommendations.slice(0, 50) + '...)' : 'NO - using fallback'}`);

      return {
        id: crypto.randomUUID(),
        title: alert.title,
        summary: alert.summary,
        description: alert.summary || '',  // ACF field
        location: alert.location,
        country: alert.country,
        region: alert.region,
        mainland: alert.mainland || null,  // ACF field
        intelligence_topics: normalizeIntelligenceTopicsForACF(alert.eventType),  // ACF field
        event_type: alert.eventType || alert.event_type,
        severity,
        status: 'draft' as const,
        source_url,
        article_url: source_url,
        sources: sourceName,
        event_start_date: alert.eventStartDate || alert.event_start_date,
        event_end_date: alert.eventEndDate || alert.event_end_date,
        latitude: lat ? String(lat) : null,  // ACF field (as string)
        longitude: lon ? String(lon) : null,  // ACF field (as string)
        radius: radiusKm || null,  // ACF field
        geojson: geoJSON ? JSON.stringify(geoJSON) : null,  // ACF polygon field (stringified GeoJSON)
        recommendations: alert.recommendations || alert.mitigation || '',  // ACF field
        ai_generated: true,
        ai_model: 'gpt-4o-mini',
        ai_confidence: 0.85,
        geo_json: geoJSON,
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
          recommendedActions: alert.recommendedActions || [],
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
  const logActivity = async (message: string) => {
    const entry = { time: new Date().toISOString(), message };
    activityLog.push(entry);
    // Keep only last 10 entries to avoid bloat
    if (activityLog.length > 10) activityLog.shift();
    
    try {
      const currentJob = await getKV(`scour_job:${config.jobId}`) || {};
      await setKV(`scour_job:${config.jobId}`, {
        ...currentJob,
        activityLog: activityLog.slice(), // Clone array
        updated_at: new Date().toISOString(),
      });
    } catch (e) {
      // Non-critical: log update failed
    }
  };

  console.log(`\n?? Starting scour ${config.jobId} with ${config.sourceIds.length} sources`);
  console.log(`?? Config: daysBack=${config.daysBack}, OpenAI=${config.openaiKey ? '?' : '?'}, Brave=${config.braveApiKey ? '?' : '?'}`);
  if (config.braveApiKey) {
    console.log(`?? Brave API Key configured: ${config.braveApiKey.slice(0, 12)}...`);
  } else {
    console.log(`?? WARNING: No Brave API Key in config!`);
  }
  
  await logActivity(`Starting scour with ${config.sourceIds.length} sources`);

  try {
    // Only check against recent alerts (last 7 days) to reduce false duplicates
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const existingAlerts: Alert[] = await querySupabaseForWorker(
      `${config.supabaseUrl}/rest/v1/alerts?select=id,title,location,country,status,summary&created_at=gte.${encodeURIComponent(sevenDaysAgo)}&limit=100&order=created_at.desc`,
      config.serviceKey
    );

    console.log(`?? Found ${existingAlerts.length} existing alerts (last 7 days) for deduplication`);
    await logActivity(`Loaded ${existingAlerts.length} recent alerts for dedup check`);

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

        // Increment processed count at the start of processing
        stats.processed++;

        console.log(`\n?? [${stats.processed}/${config.sourceIds.length}] Processing: ${source.name}`);
        await logActivity(`📰 Scouring: ${source.name}`);

        // Update status: Starting source
        await setKV(`scour_job:${config.jobId}`, {
          id: config.jobId,
          status: 'running',
          total: config.sourceIds.length,
          processed: stats.processed,
          created: stats.created,
          duplicatesSkipped: stats.duplicates,
          errorCount: stats.errors.length,
          currentSource: source.name,
          currentActivity: 'Fetching content',
          activityLog: activityLog.slice(),
          updated_at: new Date().toISOString(),
        }).catch(() => {});

        let content = '';
        let articleUrl: string | null = null;
        
        console.log(`  Config - Query: "${source.query || 'NONE'}", BraveAPI: ${config.braveApiKey ? '?' : '?'}`);
        
        // Try Brave Search first if configured
        if (config.braveApiKey && source.query) {
          await logActivity(`🔎 Brave searching: "${source.query.slice(0, 40)}..."`);
          await setKV(`scour_job:${config.jobId}`, {
            id: config.jobId,
            status: 'running',
            total: config.sourceIds.length,
            processed: stats.processed,
            created: stats.created,
            duplicatesSkipped: stats.duplicates,
            errorCount: stats.errors.length,
            currentSource: source.name,
            currentActivity: '🔎 Brave Search',
            activityLog: activityLog.slice(),
            updated_at: new Date().toISOString(),
          }).catch(() => {});
          console.log(`  ?? Brave Search ? "${source.query}"`);
          const br = await fetchWithBraveSearch(source.query, config.braveApiKey);
          content = br.content;
          articleUrl = br.primaryUrl;
          console.log(`  ? Brave: ${content.length} chars, URL: ${articleUrl ? '?' : '?'}`);
          await logActivity(`✓ Found ${content.length} characters from Brave`);
        } else {
          if (!config.braveApiKey) console.warn(`  ? No Brave API key - cannot search`);
          if (!source.query) console.warn(`  ? No search query configured`);
        }
        
        // Fall back to scraping if Brave didn't provide enough content
        if (!content || content.length < 100) {
          await logActivity(`🌐 Web scraping ${source.name}...`);
          await setKV(`scour_job:${config.jobId}`, {
            id: config.jobId,
            status: 'running',
            total: config.sourceIds.length,
            processed: stats.processed,
            created: stats.created,
            duplicatesSkipped: stats.duplicates,
            errorCount: stats.errors.length,
            currentSource: source.name,
            currentActivity: '🌐 Web scraping',
            activityLog: activityLog.slice(),
            updated_at: new Date().toISOString(),
          }).catch(() => {});
          console.log(`  ?? Scraping source: ${source.url}`);
          const scraped = await scrapeUrl(source.url);
          if (scraped && scraped.length >= 100) {
            content = scraped;
            articleUrl = articleUrl || source.url;
            console.log(`  ? Scraped: ${content.length} chars`);
            await logActivity(`✓ Scraped ${content.length} characters`);
          } else {
            // Scrape failed or returned too little - use Brave as primary fallback
            if (config.braveApiKey && source.query) {
              console.log(`  ?? Scrape blocked/failed - retrying Brave Search`);
              const br = await fetchWithBraveSearch(source.query, config.braveApiKey);
              if (br.content && br.content.length >= 100) {
                content = br.content;
                articleUrl = br.primaryUrl || articleUrl || source.url;
                console.log(`  ? Brave (retry): ${content.length} chars`);
              }
            }
            
            // Final fallback: try Brave with source name if no query
            if ((!content || content.length < 100) && config.braveApiKey && !source.query) {
              console.log(`  ?? No query configured - searching by source name`);
              const br = await fetchWithBraveSearch(source.name, config.braveApiKey);
              if (br.content && br.content.length >= 100) {
                content = br.content;
                articleUrl = br.primaryUrl;
                console.log(`  ? Brave (by name): ${content.length} chars`);
              }
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

        // Fallback to Brave Search + AI if no structured parser or it returned nothing
        if (!extractedAlerts.length) {
          console.log(`  ?? No alerts from structured parser (or none attempted) - fetching content for AI...`);
          
          // Try Brave Search first if configured
          if (config.braveApiKey && source.query) {
            await setKV(`scour_job:${config.jobId}`, {
              id: config.jobId,
              status: 'running',
              total: config.sourceIds.length,
              processed: stats.processed,
              created: stats.created,
              duplicatesSkipped: stats.duplicates,
              errorCount: stats.errors.length,
              currentSource: source.name,
              currentActivity: '?? Brave Search',
              updated_at: new Date().toISOString(),
            }).catch(() => {});
            console.log(`  ?? Brave Search ? "${source.query}"`);
            const br = await fetchWithBraveSearch(source.query, config.braveApiKey);
            content = br.content;
            articleUrl = br.primaryUrl;
            console.log(`  ? Brave: ${content.length} chars, URL: ${articleUrl ? '?' : '?'}`);
          } else {
            if (!config.braveApiKey) console.warn(`  ? No Brave API key - cannot search`);
            if (!source.query) console.warn(`  ? No search query configured`);
          }
          
          // Fall back to scraping if Brave didn't provide enough content
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
            console.log(`  ?? Scraping source: ${source.url}`);
            const scraped = await scrapeUrl(source.url);
            if (scraped && scraped.length >= 100) {
              content = scraped;
              articleUrl = articleUrl || source.url;
              console.log(`  ? Scraped: ${content.length} chars`);
            } else {
              // Scrape failed or returned too little - use Brave as primary fallback
              if (config.braveApiKey && source.query) {
                console.log(`  ?? Scrape blocked/failed - retrying Brave Search`);
                const br = await fetchWithBraveSearch(source.query, config.braveApiKey);
                if (br.content && br.content.length >= 100) {
                  content = br.content;
                  articleUrl = br.primaryUrl || articleUrl || source.url;
                  console.log(`  ? Brave (retry): ${content.length} chars`);
                }
              }
              
              // Final fallback: try Brave with source name if no query
              if ((!content || content.length < 100) && config.braveApiKey && !source.query) {
                console.log(`  ?? No query configured - searching by source name`);
                const br = await fetchWithBraveSearch(source.name, config.braveApiKey);
                if (br.content && br.content.length >= 100) {
                  content = br.content;
                  articleUrl = br.primaryUrl;
                  console.log(`  ? Brave (by name): ${content.length} chars`);
                }
              }
            }
          }
          
          if (!content || content.length < 50) {
            stats.errors.push(`No content from ${source.name}`);
            console.log(`  ? No content extracted from any source`);
            continue;
          }

          await logActivity(`🤖 AI analyzing content...`);
          await setKV(`scour_job:${config.jobId}`, {
            id: config.jobId,
            status: 'running',
            total: config.sourceIds.length,
            processed: stats.processed,
            created: stats.created,
            duplicatesSkipped: stats.duplicates,
            errorCount: stats.errors.length,
            currentSource: source.name,
            currentActivity: '🤖 AI analyzing content',
            activityLog: activityLog.slice(),
            updated_at: new Date().toISOString(),
          }).catch(() => {});
          console.log(`  ?? OpenAI Analysis ? Extracting alerts (${config.openaiKey ? 'API ready' : 'NO API KEY'})...`);
          try {
            extractedAlerts = await extractAlertsWithAI(
              content,
              articleUrl || source.url,
              source.name,
              existingAlerts,
              config
            );
            console.log(`  ? AI extraction completed: ${extractedAlerts.length} alerts`);
          } catch (aiErr: any) {
            console.error(`  !! AI extraction failed: ${aiErr.message}`);
            await logActivity(`⚠️ AI extraction failed: ${aiErr.message}`);
            extractedAlerts = [];
          }
        }

        console.log(`  ? Extracted ${extractedAlerts.length} alerts`);
        if (extractedAlerts.length === 0) {
          console.log(`  ??  No alerts found in content - AI may have rejected or found no travel-relevant events`);
          await logActivity(`No relevant alerts found in content`);
        } else {
          await logActivity(`✓ Extracted ${extractedAlerts.length} potential alerts`);
        }

        for (const alert of extractedAlerts) {
          let isDuplicate = false;

          await setKV(`scour_job:${config.jobId}`, {
            id: config.jobId,
            status: 'running',
            total: config.sourceIds.length,
            processed: stats.processed,
            created: stats.created,
            duplicatesSkipped: stats.duplicates,
            errorCount: stats.errors.length,
            currentSource: source.name,
            currentActivity: `🔍 Checking: ${alert.title.slice(0, 40)}...`,
            activityLog: activityLog.slice(),
            updated_at: new Date().toISOString(),
          }).catch(() => {});

          console.log(`    ?? Checking: "${alert.title}" (${alert.location}, ${alert.country})`);

          // Check against both existing alerts (from before scour) AND alerts created in this scour run
          const allExistingAlerts = [...existingAlerts];

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
              
              existingAlerts.push(alert);
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
        await setKV(`scour_job:${config.jobId}`, {
          id: config.jobId,
          status: 'running',
          total: config.sourceIds.length,
          processed: stats.processed,
          created: stats.created,
          duplicatesSkipped: stats.duplicates,
          errorCount: stats.errors.length,
          currentSource: source.name,
          currentActivity: `✅ Completed: ${source.name}`,
          activityLog: activityLog.slice(),
          updated_at: new Date().toISOString(),
        }).catch(() => {});

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
          currentSource: source.name,
          currentActivity: `❌ Error: ${source.name}`,
          activityLog: activityLog.slice(),
          updated_at: new Date().toISOString(),
        }).catch(() => {});
      }
    }

    // Run proactive Brave Search signals each cycle (early detection)
    // Runs asynchronously and doesn't block scour completion
    if (config.braveApiKey) {
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
    }
    
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
// Try multiple possible names for the Brave API key (handle typos and variants)
const BRAVE_API_KEY = Deno.env.get("BRAVRE_SEARCH_API_KEY") || Deno.env.get("BRAVE_API_KEY") || Deno.env.get("BRAVE_SEARCH_API_KEY");
const WP_URL = Deno.env.get("WP_URL");
const WP_USER = Deno.env.get("WP_USER");
const WP_APP_PASSWORD = Deno.env.get("WP_APP_PASSWORD");
const WP_POST_TYPE = Deno.env.get("WP_POST_TYPE") || "rss-feed"; // REST-enabled CPT slug

// Log startup config (only once per function instance)
console.log(`Edge function initialized:`);
if (!serviceKey) console.warn("WARNING: SUPABASE_SERVICE_ROLE_KEY not set!");
console.log(`   OpenAI: ${OPENAI_API_KEY ? 'OK' : 'NOT SET'}`);
console.log(`   Brave: ${BRAVE_API_KEY ? 'OK' : 'NOT SET'}`);
console.log(`   WordPress: ${WP_URL ? 'OK' : 'NOT SET'}`);console.log(`   WordPress: ${WP_URL ? '✓' : '✗'}`);

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

async function querySupabaseRest(endpoint: string, options: RequestInit = {}) {
  const url = `${supabaseUrl}/rest/v1${endpoint}`;
  const response = await fetch(url, {
    ...options,
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
    console.log(`✓ KV GET: ${key}`);
    return result[0]?.value ?? null;
  } catch (e: any) {
    console.error(`✗ KV GET ERROR: ${key}`, e?.message || e);
    return null;
  }
}

async function setKV(key: string, value: any) {
  const data = { key, value, updated_at: nowIso() };
  try {
    const patchRes = await querySupabaseRest(`/app_kv?key=eq.${encodeURIComponent(key)}`, {
      method: "PATCH",
      body: JSON.stringify(data),
      headers: { "Prefer": "return=representation" }
    });
    console.log(`? KV PATCH: ${key}`);
    return patchRes;
  } catch (e: any) {
    console.log(`  KV PATCH failed, trying POST: ${key}`, e?.message);
    try {
      const postRes = await querySupabaseRest("/app_kv", {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "Prefer": "return=representation" }
      });
      console.log(`? KV POST: ${key}`);
      return postRes;
    } catch (e2: any) {
      console.error(`? KV SAVE FAILED: ${key}`, e2?.message);
      throw e2;
    }
  }
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
            const cleanLine = line.replace(/^\d+\.\s*/, '').trim();
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
      recommendations: formattedRecommendations.length > 0 ? formattedRecommendations : false,
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  const url = new URL(req.url);
  const method = req.method.toUpperCase();
  const rawPath = url.pathname;
  const path = normalizePath(rawPath);
  console.log("[Router]", { method, rawPath, path });

  try {
    // HEALTH
    if (path === "/health" && method === "GET") {
      return json({
        ok: true,
        time: nowIso(),
        env: {
          AI_ENABLED: !!OPENAI_API_KEY,
          SCOUR_ENABLED: true,
          AUTO_SCOUR_ENABLED: true,
          WP_CONFIGURED: !!(WP_URL && WP_USER && WP_APP_PASSWORD),
          BRAVE_CONFIGURED: !!BRAVE_API_KEY,
        },
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
        const alerts = await querySupabaseRest("/alerts?status=eq.draft&order=created_at.desc&limit=200");
      return json({ ok: true, alerts: alerts || [] });
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

    // SCOUR � START (POST /scour-sources)
    // NOTE: Scour runs ASYNCHRONOUSLY on Supabase Edge Function server using waitUntil()
    // This means the scour job continues running even if:
    // - Browser tab is closed
    // - User navigates away
    // - User logs out
    // - Internet connection drops
    // Frontend polls /scour/status to track progress, but the actual work happens server-side
    if (path === "/scour-sources" && method === "POST") {
      const body = await req.json().catch(() => ({}));
      const jobId = body.jobId || crypto.randomUUID();
      const sourceIds: string[] = Array.isArray(body.sourceIds) ? body.sourceIds : [];
      const daysBack = typeof body.daysBack === "number" ? body.daysBack : 14;

      console.log(`\n?? SCOUR START REQUEST: jobId=${jobId}`);
      console.log(`   sourceIds received: ${sourceIds.length} [${sourceIds.slice(0, 3).join(', ')}${sourceIds.length > 3 ? '...' : ''}]`);
      console.log(`   daysBack: ${daysBack}`);
      console.log(`   body keys: ${Object.keys(body).join(', ')}`);
      
      if (sourceIds.length === 0) {
        console.warn(`??  No source IDs provided to scour!`);
        console.warn(`   Request body:`, JSON.stringify(body, null, 2));
        return json({ 
          ok: false, 
          error: "No source IDs provided. Cannot start scour with 0 sources.",
          debugInfo: { 
            sourceIds, 
            bodyKeys: Object.keys(body),
            bodySourceIds: body.sourceIds,
            isArray: Array.isArray(body.sourceIds)
          }
        }, 400);
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
      };

      await setKV(`scour_job:${jobId}`, job);
      await setKV("last_scour_job_id", jobId);
      await setKV("last_scoured_timestamp", nowIso());

      // Run scour asynchronously on server - continues even if browser closes or navigates
      // waitUntil() ensures the background task completes before edge function is terminated
      console.log(`?? SCOUR JOB CREATED: ${job.total} sources to process`);
      console.log(`?? Passing Brave API to worker: ${BRAVE_API_KEY ? BRAVE_API_KEY.slice(0, 12) + '...' : 'NOT SET'}`);
      waitUntil(
        runScourWorker({
          jobId,
          sourceIds,
          daysBack,
          supabaseUrl,
          serviceKey,
          openaiKey: OPENAI_API_KEY!,
          braveApiKey: BRAVE_API_KEY,
        }).then(async (stats) => {
          const finalJob = { ...job, status: "done", ...stats, updated_at: nowIso() };
          await setKV(`scour_job:${jobId}`, finalJob);
          console.log(`✓ SCOUR COMPLETED (Server-side): ${jobId}`, stats);
          console.log(`✓ Brave API available: ${BRAVE_API_KEY ? 'YES' : 'NO'}`);
          
          // Trigger early signals if Brave API is configured
          if (BRAVE_API_KEY) {
            console.log(`✓ Triggering early-signal Brave queries for job ${jobId}...`);
            try {
              const signalRes = await fetch(`${supabaseUrl}/functions/v1/clever-function/scour/early-signals`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${serviceKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ jobId }),
              });
              console.log(`✓ Early signals response: ${signalRes.status} ${signalRes.statusText}`);
              if (!signalRes.ok) {
                const errText = await signalRes.text().catch(() => 'unknown');
                console.error(`✗ Early signals endpoint error: ${errText}`);
              }
            } catch (e) {
              console.error(`✗ Early signals fetch failed:`, e);
            }
          } else {
            console.warn(`⚠️ Brave API key not available - skipping early signals`);
          }
        }).catch(async (e: any) => {
          const err = String(e?.message || e);
          const fail = { ...job, status: "error", errorCount: 1, errors: [err], updated_at: nowIso() };
          await setKV(`scour_job:${jobId}`, fail);
          console.log(`✗ SCOUR FAILED (Server-side): ${jobId}`, err);
        })
      );

      return json({ ok: true, jobId, total: sourceIds.length, message: `Scour job started with ${sourceIds.length} sources` });
    }

    // SCOUR � EARLY SIGNALS (POST /scour/early-signals)
    // Runs independently, triggered by scour completion or manually
    if (path === "/scour/early-signals" && method === "POST") {
      const body = await req.json().catch(() => ({}));
      const jobId = body.jobId || crypto.randomUUID();
      
      console.log(`\n??? [${jobId}] Early signals endpoint called, Brave API: ${BRAVE_API_KEY ? '✓' : '✗'}`);
      
      if (!BRAVE_API_KEY) {
        console.error(`✗ Brave API key not available`);
        return json({ ok: false, error: "Brave API key not configured" }, 500);
      }

      console.log(`\n??? [${jobId}] Starting early-signal Brave queries`);

      // Run asynchronously with waitUntil
      waitUntil(
        (async () => {
          try {
            const existingAlerts: Alert[] = await querySupabaseRest(`/alerts?select=id,title,location,country,status,summary&limit=500&order=created_at.desc`) || [];
            
            const countries = Array.from(new Set(existingAlerts.map(a => a.country).filter(Boolean))).slice(0, 30);
            const cities = Array.from(new Set(existingAlerts.map(a => a.location).filter(Boolean))).slice(0, 40);
            const queries = buildRegionalQueries(EARLY_SIGNAL_QUERIES, countries, cities);
            
            console.log(`?? Built ${queries.length} early-signal queries (countries=${countries.length}, cities=${cities.length})`);

            let created = 0;
            let duplicates = 0;
            
            // Process in smaller batches to avoid timeout
            const batchSize = 10;
            const batches = Math.ceil(Math.min(queries.length, 30) / batchSize);
            
            for (let b = 0; b < batches; b++) {
              const batch = queries.slice(b * batchSize, (b + 1) * batchSize);
              console.log(`  ?? Batch ${b + 1}/${batches}: ${batch.length} queries`);
              
              for (const q of batch) {
                try {
                  const { content, primaryUrl } = await fetchWithBraveSearch(q, BRAVE_API_KEY!);
                  if (!content || content.length < 100) continue;

                  const extractedAlerts = await extractAlertsWithAI(
                    content,
                    primaryUrl || 'https://api.search.brave.com',
                    'Early Signal',
                    existingAlerts,
                    { 
                      supabaseUrl, 
                      serviceKey, 
                      openaiKey: OPENAI_API_KEY!, 
                      jobId, 
                      sourceIds: [], 
                      daysBack: 7 
                    }
                  );

                  for (const alert of extractedAlerts) {
                    let isDuplicate = false;
                    for (const existing of existingAlerts) {
                      const titleMatch = existing.title.toLowerCase().includes(alert.title.toLowerCase().slice(0, 30));
                      const locationMatch = existing.location === alert.location && existing.country === alert.country;
                      if (titleMatch || locationMatch) {
                        const duplicate = await checkDuplicate(alert, existing, OPENAI_API_KEY!);
                        if (duplicate) { isDuplicate = true; duplicates++; break; }
                      }
                    }

                    if (!isDuplicate) {
                      await querySupabaseRest(`/alerts`, {
                        method: 'POST',
                        body: JSON.stringify(alert),
                        headers: { 'Prefer': 'return=representation' },
                      });
                      existingAlerts.push(alert);
                      created++;
                      console.log(`    ? Created (Early): "${alert.title}" (${alert.location}, ${alert.country})`);
                    }
                  }
                } catch (e: any) {
                  console.warn(`  ??  Query failed: "${q}" ? ${String(e?.message || e)}`);
                }
              }
            }
            
            console.log(`? Early signals complete: ${created} created, ${duplicates} duplicates`);
          } catch (err: any) {
            console.error(`? Early signals error:`, err);
          }
        })()
      );

      return json({ ok: true, message: "Early-signal queries started in background" });
    }

    // SCOUR � STATUS (GET /scour/status?jobId=... OR GET /scour-status?jobId=...)
    if ((path === "/scour/status" || path === "/scour-status") && method === "GET") {
      let jobId = url.searchParams.get("jobId");
      if (!jobId) jobId = await getKV("last_scour_job_id");

      if (!jobId) return json({ ok: true, job: null });

      const job = await getKV(`scour_job:${jobId}`);
      
      if (job) {
        console.log(`? Job found: ${jobId}, total=${job.total}, processed=${job.processed}, status=${job.status}`);
        return json({ ok: true, job });
      }
      
      // Job not in KV - query alerts table directly for real results
      console.log(`?? Job ${jobId} not in KV store, querying alerts table for real results...`);
      try {
        // Query alerts created recently (last 30 minutes to catch current scour)
        const timeWindow = new Date(Date.now() - 30 * 60000).toISOString();
        const jobAlerts = await querySupabaseRest(
          `/alerts?created_at=gte.${encodeURIComponent(timeWindow)}&select=id,title,severity,status,created_at&order=created_at.desc&limit=200`
        );
        
        const totalCreated = Array.isArray(jobAlerts) ? jobAlerts.length : 0;
        const draftCount = Array.isArray(jobAlerts) ? jobAlerts.filter(a => a.status === 'draft').length : 0;

        console.log(`? Found ${totalCreated} alerts from recent scour (${draftCount} draft)`);

        // Return job status based on actual alerts found - assume 10 sources for progress calculation
        const estimatedTotalSources = 10; // Conservative estimate
        const estimatedProcessed = Math.min(estimatedTotalSources, Math.max(1, Math.round(totalCreated * 1.5)));
        
        return json({
          ok: true,
          job: {
            id: jobId,
            status: totalCreated > 0 ? "running" : "running",
            total: estimatedTotalSources,
            processed: estimatedProcessed,
            created: totalCreated,
            duplicatesSkipped: 0,
            errorCount: 0,
            errors: [],
            currentActivity: totalCreated > 0 
              ? `?? Found ${totalCreated} alert(s) so far`
              : "?? Scour in progress"
          }
        });
      } catch (e: any) {
        console.error(`? Error querying alerts:`, e?.message);
      }
      
      // Fallback: still return running status
      return json({
        ok: true,
        job: { 
          id: jobId, 
          status: "running", 
          total: 10, // Conservative estimate
          processed: 1, 
          created: 0, 
          duplicatesSkipped: 0, 
          errorCount: 0, 
          errors: [],
          currentActivity: "?? Scour in progress"
        },
      });
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
        } else {
          console.warn(`??  No Brave API key - skipping current news gathering`);
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
                listItem = listItem.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
                htmlLines.push(`  <li>${listItem}</li>`);
                continue;
              }
              
              // Numbered lists
              if (trimmed.match(/^\d+\.\s/)) {
                if (inList) {
                  htmlLines.push('</ul>');
                  inList = false;
                }
                let listItem = trimmed.replace(/^\d+\.\s/, '');
                // Convert **bold** in numbered items
                listItem = listItem.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
                htmlLines.push(`<h2>${listItem}</h2>`);
                continue;
              }
              
              // Regular paragraph
              if (inList) {
                htmlLines.push('</ul>');
                inList = false;
              }
              
              // Convert **bold** to <strong>
              line = trimmed.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
              
              // Convert *italic* to <em>
              line = line.replace(/\*(.+?)\*/g, '<em>$1</em>');
              
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

    return respondNotFound(rawPath);
  } catch (e: any) {
    return json({ ok: false, error: String(e?.message || e) }, 500);
  }
});

