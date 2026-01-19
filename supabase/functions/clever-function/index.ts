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
function getRadiusFromSeverity(severity: string, scope: string): number {
  const severityRadius: Record<string, number> = {
    critical: 150,
    warning: 75,
    caution: 25,
    informative: 10,
  };
  return severityRadius[severity] || 10;
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
  additionalSources?: string[];
  sourceCount?: number;
  event_start_date?: string;
  eventStartDate?: string;
  event_end_date?: string;
  eventEndDate?: string;
  ai_generated: boolean;
  ai_model: string;
  ai_confidence?: number;
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
      throw new Error(`Brave Search failed: ${response.status}`);
    }

    const data = await response.json();
    const results = data.web?.results || [];
    const primaryUrl = results[0]?.url || null;
    const content = results.map((r: any) => `Title: ${r.title}\nDescription: ${r.description}\nURL: ${r.url}\n\n`).join('');
    return { content, primaryUrl };
  } catch (err) {
    console.error('Brave Search error:', err);
    return { content: '', primaryUrl: null };
  }
}

async function scrapeUrl(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      throw new Error(`Scrape failed: ${response.status}`);
    }

    const html = await response.text();
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 15000);
  } catch (err) {
    console.error(`Scrape error for ${url}:`, err);
    return '';
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

PRIORITY TOPICS (Extract Individual Alerts):
- Natural disasters, severe weather, infrastructure disruptions
- Transportation disruptions, medical emergencies, political instability
- Mass casualty incidents, terrorism, war/armed conflict
- Hate crimes, ANY Critical/Warning severity events

OUTPUT: JSON array of alerts with these MANDATORY fields:
{
  "severity": "critical"|"warning"|"caution"|"informative",
  "country": "Country name",
  "countryFlag": "Country flag emoji",
  "eventType": "Category (Natural Disaster, Transportation, Medical Emergency, Political, Terrorism, War, Hate Crime, etc)",
  "title": "Alert headline",
  "location": "City/location",
  "latitude": decimal degrees,
  "longitude": decimal degrees,
  "region": "Broader regional context",
  "geoScope": "local"|"city"|"regional"|"national"|"multinational",
  "eventSummary": "2-3 sentences under 150 words",
  "recommendations": "Practical advice for travelers in 2-3 sentences",
  "mitigation": "Safety precautions and official recommendations",
  "recommendedActions": ["action 1", "action 2", "action 3"],
  "topics": ["relevant", "topics", "for", "indexing"],
  "regions": ["affected", "regions"],
  "alertType": "Current"|"Forecast"|"Escalation Watch"|"Emerging Pattern"|"Seasonal Risk",
  "escalationLikelihood": "low"|"medium"|"high",
  "secondaryImpacts": ["predicted downstream effect 1", "effect 2"],
  "eventStartDate": "2026-01-14T12:00:00Z",
  "eventEndDate": "2026-01-17T12:00:00Z"
}

CRITICAL DATES:
- eventEndDate: Critical=72h from start, Warning=48h, Caution=36h, Informative=24h
- Format: ISO 8601 timestamp

COORDINATES:
- latitude/longitude: Required! Provide best estimate if not exact
- For countries: Use capital city coordinates if location not specific

Return ONLY JSON array, no markdown.`;

  try {
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
      throw new Error(`OpenAI failed: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0]?.message?.content || '[]';
    
    console.log(`AI extracted for ${sourceName}:`, aiResponse.slice(0, 300));

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
        console.error('Parse failed:', e);
        return [];
      }
    }

    if (!Array.isArray(alerts)) {
      return [];
    }

    const now = new Date().toISOString();
    return alerts.map((alert: any) => {
      const lat = alert.latitude || 0;
      const lon = alert.longitude || 0;
      const severity = alert.severity || 'informative';
      const geoScope = alert.geoScope || determineGeoScope(severity, alert.country, alert.region);
      const radiusKm = alert.radiusKm || getRadiusFromSeverity(severity, geoScope);
      const geoJSON = lat && lon ? generateCircleGeoJSON(lat, lon, radiusKm) : generatePointGeoJSON(lat, lon);

      return {
        id: crypto.randomUUID(),
        title: alert.title,
        summary: alert.eventSummary || alert.summary,
        eventSummary: alert.eventSummary || alert.summary,
        location: alert.location,
        country: alert.country,
        countryFlag: alert.countryFlag || '🌍',
        region: alert.region,
        latitude: lat,
        longitude: lon,
        radiusKm,
        geoScope,
        geoJSON,
        event_type: alert.eventType || alert.event_type,
        eventType: alert.eventType || alert.event_type,
        severity,
        status: 'draft' as const,
        source_url,
        article_url: source_url,
        sources: sourceName,
        additionalSources: [sourceName],
        sourceCount: 1,
        event_start_date: alert.eventStartDate || alert.event_start_date,
        eventStartDate: alert.eventStartDate || alert.event_start_date,
        event_end_date: alert.eventEndDate || alert.event_end_date,
        eventEndDate: alert.eventEndDate || alert.event_end_date,
        ai_generated: true,
        ai_model: 'gpt-4o-mini',
        ai_confidence: 0.85,
        recommendations: alert.recommendations,
        mitigation: alert.mitigation,
        recommendedActions: alert.recommendedActions || [],
        topics: alert.topics || [],
        regions: alert.regions || [alert.region].filter(Boolean),
        alertType: alert.alertType || 'Current',
        escalationLikelihood: alert.escalationLikelihood || 'low',
        secondaryImpacts: alert.secondaryImpacts || [],
        generation_metadata: JSON.stringify({
          extracted_at: now,
          source_name: sourceName,
          days_back: config.daysBack,
          model: 'gpt-4o-mini',
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

  console.log(`Starting scour ${config.jobId} with ${config.sourceIds.length} sources`);

  try {
    const existingAlerts: Alert[] = await querySupabaseForWorker(
      `${config.supabaseUrl}/rest/v1/alerts?select=id,title,location,country,status,summary&limit=500&order=created_at.desc`,
      config.serviceKey
    );

    console.log(`Found ${existingAlerts.length} existing alerts`);

    for (const sourceId of config.sourceIds) {
      try {
        const sources = await querySupabaseForWorker(
          `${config.supabaseUrl}/rest/v1/sources?id=eq.${sourceId}&select=*`,
          config.serviceKey
        );
        const source = sources[0];

        if (!source?.url) {
          stats.errors.push(`Source ${sourceId} not found`);
          continue;
        }

        console.log(`Processing ${source.name}...`);

        let content = '';
        let articleUrl: string | null = null;
        if (config.braveApiKey && source.query) {
          const br = await fetchWithBraveSearch(source.query, config.braveApiKey);
          content = br.content;
          articleUrl = br.primaryUrl;
        }
        
        if (!content || content.length < 100) {
          content = await scrapeUrl(source.url);
          articleUrl = articleUrl || source.url;
        }

        if (!content || content.length < 50) {
          stats.errors.push(`No content from ${source.name}`);
          continue;
        }

        const extractedAlerts = await extractAlertsWithAI(
          content,
          articleUrl || source.url,
          source.name,
          existingAlerts,
          config
        );

        console.log(`Extracted ${extractedAlerts.length} alerts`);

        for (const alert of extractedAlerts) {
          let isDuplicate = false;

          for (const existing of existingAlerts) {
            const titleMatch = existing.title.toLowerCase().includes(alert.title.toLowerCase().slice(0, 30));
            const locationMatch = existing.location === alert.location && existing.country === alert.country;

            if (titleMatch || locationMatch) {
              const duplicate = await checkDuplicate(alert, existing, config.openaiKey);
              if (duplicate) {
                isDuplicate = true;
                stats.duplicates++;
                break;
              }
            }
          }

          if (!isDuplicate) {
            try {
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
              console.log(`Created: ${alert.title}`);
            } catch (insertErr: any) {
              stats.errors.push(`Insert failed: ${insertErr.message}`);
            }
          }
        }

        stats.processed++;

      } catch (sourceErr: any) {
        stats.errors.push(`Source error: ${sourceErr.message}`);
      }
    }

    return stats;

  } catch (err: any) {
    console.error(`Fatal scour error:`, err);
    throw err;
  }
}

// ============================================================================
// GLOBAL CONFIG & HELPERS
// ============================================================================

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || Deno.env.get("OPENAI_KEY");
const WP_URL = Deno.env.get("WP_URL");
const WP_USER = Deno.env.get("WP_USER");
const WP_APP_PASSWORD = Deno.env.get("WP_APP_PASSWORD");
const WP_POST_TYPE = Deno.env.get("WP_POST_TYPE") || "rss-feed"; // REST-enabled CPT slug

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

  return response.json();
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
    return result[0]?.value ?? null;
  } catch {
    return null;
  }
}

async function setKV(key: string, value: any) {
  const data = { key, value, updated_at: nowIso() };
  try {
    await querySupabaseRest(`/app_kv?key=eq.${encodeURIComponent(key)}`, {
      method: "PATCH",
      body: JSON.stringify(data),
      headers: { "Prefer": "return=representation" }
    });
  } catch {
    await querySupabaseRest("/app_kv", {
      method: "POST",
      body: JSON.stringify(data),
      headers: { "Prefer": "return=representation" }
    });
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
      let html = '';
      
      // Title & Status
      html += `<div style="padding: 20px; background: #f5f5f5; border-left: 4px solid #ff6b6b; margin-bottom: 20px;">`;
      html += `<h1>${alert.title || "Travel Alert"}</h1>`;
      html += `<p><strong>Severity:</strong> <span style="color: ${
        alert.severity === 'critical' ? '#ff6b6b' : 
        alert.severity === 'warning' ? '#ffa94d' : 
        alert.severity === 'caution' ? '#ffd43b' : '#4c6ef5'
      }; font-weight: bold;">${alert.severity?.toUpperCase() || 'INFO'}</span></p>`;
      html += `<p><strong>Status:</strong> ${alert.status?.toUpperCase()}</p>`;
      html += `</div>`;

      // Location & Geography
      html += `<h2>Location & Geography</h2>`;
      html += `<ul>`;
      html += `<li><strong>Country:</strong> ${alert.countryFlag || '🌍'} ${alert.country}</li>`;
      if (alert.location) html += `<li><strong>City/Location:</strong> ${alert.location}</li>`;
      if (alert.region) html += `<li><strong>Region:</strong> ${alert.region}</li>`;
      if (alert.latitude && alert.longitude) {
        html += `<li><strong>Coordinates:</strong> ${alert.latitude.toFixed(4)}, ${alert.longitude.toFixed(4)}</li>`;
      }
      if (alert.geoScope) html += `<li><strong>Geographic Scope:</strong> ${alert.geoScope}</li>`;
      if (alert.radiusKm) html += `<li><strong>Affected Radius:</strong> ~${Math.round(alert.radiusKm)} km</li>`;
      html += `</ul>`;

      // Event Details
      html += `<h2>Event Details</h2>`;
      if (alert.eventType) html += `<p><strong>Event Type:</strong> ${alert.eventType}</p>`;
      if (alert.alertType) html += `<p><strong>Alert Type:</strong> ${alert.alertType}</p>`;
      if (alert.escalationLikelihood) html += `<p><strong>Escalation Likelihood:</strong> ${alert.escalationLikelihood}</p>`;

      // Summary
      html += `<h2>Summary</h2>`;
      html += `<p>${alert.summary || alert.eventSummary || 'No summary available'}</p>`;

      // Timeline
      if (alert.eventStartDate || alert.eventEndDate) {
        html += `<h2>Timeline</h2>`;
        html += `<ul>`;
        if (alert.eventStartDate) {
          html += `<li><strong>Start:</strong> ${new Date(alert.eventStartDate).toLocaleString()}</li>`;
        }
        if (alert.eventEndDate) {
          html += `<li><strong>End/Expiration:</strong> ${new Date(alert.eventEndDate).toLocaleString()}</li>`;
        }
        html += `</ul>`;
      }

      // Topics & Regions
      if (alert.topics && alert.topics.length > 0) {
        html += `<h3>Topics</h3>`;
        html += `<p>${alert.topics.join(', ')}</p>`;
      }

      // Recommendations & Mitigation
      if (alert.recommendedActions && alert.recommendedActions.length > 0) {
        html += `<h2>Recommended Actions</h2>`;
        html += `<ol>`;
        alert.recommendedActions.forEach((action) => {
          html += `<li>${action}</li>`;
        });
        html += `</ol>`;
      }

      if (alert.mitigation) {
        html += `<h2>Safety Precautions</h2>`;
        html += `<p>${alert.mitigation}</p>`;
      }

      if (alert.recommendations) {
        html += `<h2>Additional Recommendations</h2>`;
        html += `<p>${alert.recommendations}</p>`;
      }

      // Secondary Impacts
      if (alert.secondaryImpacts && alert.secondaryImpacts.length > 0) {
        html += `<h2>Predicted Secondary Impacts</h2>`;
        html += `<ul>`;
        alert.secondaryImpacts.forEach((impact) => {
          html += `<li>${impact}</li>`;
        });
        html += `</ul>`;
      }

      // Metadata
      html += `<hr style="margin: 30px 0;">`;
      html += `<p style="font-size: 12px; color: #666;">`;
      html += `<strong>Generated by MAGNUS Travel Safety Intelligence</strong><br/>`;
      html += `AI Model: ${alert.ai_model || 'gpt-4o-mini'}<br/>`;
      html += `Confidence: ${((alert.ai_confidence || 0.8) * 100).toFixed(0)}%<br/>`;
      html += `Generated: ${new Date(alert.created_at).toLocaleString()}`;
      html += `</p>`;

      return html;
    };

    const wpAuth = btoa(`${WP_USER}:${WP_APP_PASSWORD}`);
    const wpEndpoint = `${WP_URL}/wp-json/wp/v2/${WP_POST_TYPE}`;
    console.log("[WP Publish] Attempting POST", { endpoint: wpEndpoint, post_type: WP_POST_TYPE, has_url: !!WP_URL });
    
    // Map alert severity to ACF color codes
    const severityMap: Record<string, string> = {
      critical: "darkred",
      warning: "orange",
      caution: "yellow",
      informative: "green",
    };
    const acfSeverity = severityMap[alert.severity] || "yellow";
    
    const wpResponse = await fetch(wpEndpoint, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${wpAuth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: alert.title || "Travel Alert",
        content: buildContent(),
        status: "publish",
        // ACF Fields for RSS-FEED custom post type
        acf: {
          country: alert.country,
          severity: acfSeverity,
          event_type: alert.eventType || alert.event_type,
          location: alert.location,
          latitude: alert.latitude,
          longitude: alert.longitude,
          geo_scope: alert.geoScope,
          geo_json: alert.geoJSON,
        },
      }),
      signal: AbortSignal.timeout(15000),
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
      status: "published",
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
        },
      });
    }

    // LAST SCOURED
    if (path === "/last-scoured" && method === "GET") {
      const lastIso = await getKV("last_scoured_timestamp");
      return json({ ok: true, lastIso });
    }

    // WORDPRESS — STATUS DIAGNOSTICS
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

    // USERS — GET ALL (via /admin/users)
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

    // USERS — CREATE (via /admin/users)
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

    // USERS — UPDATE (via /admin/users/:id)
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

    // USERS — DELETE (via /admin/users/:id)
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

    // ANALYTICS — DASHBOARD
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

    // ANALYTICS — ALERTS (GET /analytics/alerts)
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

    // ANALYTICS — SOURCES (GET /analytics/sources)
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

    // ALERTS — GET ALL
    if (path === "/alerts" && method === "GET") {
      const status = url.searchParams.get("status");
      const limit = url.searchParams.get("limit") || "1000";
      let endpoint = `/alerts?order=created_at.desc&limit=${limit}`;
      if (status) {
        endpoint = `/alerts?status=eq.${encodeURIComponent(status)}&order=created_at.desc&limit=${limit}`;
      }
      const alerts = await querySupabaseRest(endpoint);
      return json({ ok: true, alerts: alerts || [] });
    }

    // ALERTS — REVIEW (DRAFT)
    if (path === "/alerts/review" && method === "GET") {
      const alerts = await querySupabaseRest("/alerts?status=eq.draft&order=created_at.desc&limit=200");
      return json({ ok: true, alerts: alerts || [] });
    }

    // ALERTS — COMPILE
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

    // ALERTS — CREATE
    if (path === "/alerts" && method === "POST") {
      const body = await req.json().catch(() => ({}));
      if (!body.title || !body.country || !body.location) {
        return json({ ok: false, error: "Missing required fields: title, country, location" }, 400);
      }

      const now = nowIso();
      const created = await querySupabaseRest("/alerts", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          id: crypto.randomUUID(),
          ...body,
          status: body.status || "draft",
          created_at: body.created_at || now,
          updated_at: now,
        }),
      });

      return json({ ok: true, alert: created?.[0] });
    }

    // ALERTS — UPDATE (PATCH /alerts/:id)
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

    // ALERTS — DELETE (DELETE /alerts/:id)
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

    // ALERTS — DISMISS (POST /alerts/:id/dismiss)
    if (path.endsWith("/dismiss") && method === "POST") {
      const id = parseIdFromPath(path);
      if (!id) return respondNotFound(rawPath);
      const updated = await dismissAlert(id);
      return json({ ok: true, alert: updated });
    }

    // ALERTS — APPROVE ONLY (POST /alerts/:id/approve-only)
    if (path.endsWith("/approve-only") && method === "POST") {
      const id = parseIdFromPath(path);
      if (!id) return respondNotFound(rawPath);
      const updated = await approveOnly(id);
      return json({ ok: true, alert: updated });
    }

    // ALERTS — APPROVE + POST (POST /alerts/:id/approve OR POST /alerts/:id/publish)
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

    // ALERTS — GENERATE RECOMMENDATIONS (POST /alerts/:id/generate-recommendations)
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

    // SCOUR — START (POST /scour-sources)
    if (path === "/scour-sources" && method === "POST") {
      const body = await req.json().catch(() => ({}));
      const jobId = body.jobId || crypto.randomUUID();
      const sourceIds: string[] = Array.isArray(body.sourceIds) ? body.sourceIds : [];
      const daysBack = typeof body.daysBack === "number" ? body.daysBack : 14;

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

      waitUntil(
        runScourWorker({
          jobId,
          sourceIds,
          daysBack,
          supabaseUrl,
          serviceKey,
          openaiKey: OPENAI_API_KEY!,
          braveApiKey: Deno.env.get("BRAVE_SEARCH_API_KEY"),
        }).then(async (stats) => {
          const finalJob = { ...job, status: "done", ...stats, updated_at: nowIso() };
          await setKV(`scour_job:${jobId}`, finalJob);
          console.log(`Scour ${jobId} done:`, stats);
        }).catch(async (e: any) => {
          const err = String(e?.message || e);
          const fail = { ...job, status: "error", errorCount: 1, errors: [err], updated_at: nowIso() };
          await setKV(`scour_job:${jobId}`, fail);
        })
      );

      return json({ ok: true, jobId, status: "running", total: job.total });
    }

    // SCOUR — STATUS (GET /scour/status?jobId=... OR GET /scour-status?jobId=...)
    if ((path === "/scour/status" || path === "/scour-status") && method === "GET") {
      let jobId = url.searchParams.get("jobId");
      if (!jobId) jobId = await getKV("last_scour_job_id");

      if (!jobId) return json({ ok: true, job: null });

      const job = await getKV(`scour_job:${jobId}`);
      return json({
        ok: true,
        job: job || { id: jobId, status: "running", total: 0, processed: 0, created: 0, duplicatesSkipped: 0, errorCount: 0, errors: [] },
      });
    }

    // AUTO-SCOUR — STATUS
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

    // AUTO-SCOUR — TOGGLE
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

    // AUTO-SCOUR — RUN NOW
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

      waitUntil(
        runScourWorker({
          jobId,
          sourceIds,
          daysBack: 14,
          supabaseUrl,
          serviceKey,
          openaiKey: OPENAI_API_KEY!,
          braveApiKey: Deno.env.get("BRAVE_SEARCH_API_KEY"),
        }).then(async (stats) => {
          const finalJob = { ...job, status: "done", ...stats, updated_at: nowIso() };
          await setKV(`scour_job:${jobId}`, finalJob);
        }).catch(async (e: any) => {
          const err = String(e?.message || e);
          const fail = { ...job, status: "error", errorCount: 1, errors: [err], updated_at: nowIso() };
          await setKV(`scour_job:${jobId}`, fail);
        })
      );

      return json({ ok: true, jobId, status: "running", total: job.total, message: "Auto-scour started" });
    }

    // SOURCES — GET ALL
    if (path === "/sources" && method === "GET") {
      const page = parseInt(url.searchParams.get("page") || "1", 10);
      const pageSize = parseInt(url.searchParams.get("pageSize") || "50", 10);
      const offset = Math.max(0, (page - 1) * pageSize);
      const sources = await querySupabaseRest(`/sources?order=created_at.desc&limit=${pageSize}&offset=${offset}`);
      const totalRows = await safeQuerySupabaseRest(`/sources?select=id`);
      const total = Array.isArray(totalRows) ? totalRows.length : 0;
      return json({ ok: true, sources: sources || [], page, pageSize, total });
    }

    // SOURCES — CREATE
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

    // SOURCES — BULK UPLOAD
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

    // SOURCES — UPDATE
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

    // SOURCES — DELETE
    if (path.startsWith("/sources/") && method === "DELETE") {
      const id = path.split("/").pop()!;
      await querySupabaseRest(`/sources?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
      return json({ ok: true, deleted: id });
    }

    // TRENDS — REBUILD
    if (path === "/trends/rebuild" && method === "POST") {
      const DAYS_BACK = 14;
      const MIN_ALERTS = 3;

      const since = new Date(Date.now() - DAYS_BACK * 86400000).toISOString();

      const alerts =
        (await querySupabaseRest(
          `/alerts?created_at=gte.${since}&status=neq.dismissed&select=id,country,event_type,severity,created_at`
        )) || [];

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

    // TRENDS — GET ALL
    if (path === "/trends" && method === "GET") {
      const status = url.searchParams.get("status");
      const limit = url.searchParams.get("limit") || "1000";
      let endpoint = `/trends?order=created_at.desc&limit=${limit}`;
      if (status) endpoint = `/trends?status=eq.${encodeURIComponent(status)}&order=created_at.desc&limit=${limit}`;
      const trends = await safeQuerySupabaseRest(endpoint);
      const normalized = (trends || []).map((t: any) => ({
        ...t,
        category: t.event_type || t.category || "General",
        count: typeof t.incident_count === "number" ? t.incident_count : (t.count ?? 0),
        highest_severity: t.severity || t.highest_severity || "informative",
        last_seen_at: t.last_seen || t.last_seen_at || t.updated_at || t.created_at,
      }));
      return json({ ok: true, trends: normalized });
    }

    // TRENDS — GET ONE
    if (path.startsWith("/trends/") && method === "GET") {
      const id = path.split("/").pop()!;
      const trends = await safeQuerySupabaseRest(`/trends?id=eq.${encodeURIComponent(id)}`);
      if (!trends || trends.length === 0) return json({ ok: false, error: "Trend not found" }, 404);
      return json({ ok: true, trend: trends[0] });
    }

    // TRENDS — CREATE
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

    // TRENDS — GENERATE SITUATIONAL REPORT (POST /trends/:id/generate-report)
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
        const prompt = `You are a MAGNUS Travel Safety Intelligence analyst creating a professional situational report on a developing travel safety trend.

TREND: ${trend.title}
COUNTRY: ${trend.country}
SEVERITY: ${String(highestSeverity).toUpperCase()}
LAST UPDATED: ${new Date(lastSeen).toLocaleDateString()}
RELATED INCIDENTS: ${incidentCount}

RECENT EVENTS:
${alertSummaries || "No specific incidents available"}

Generate a professional Situational Report in the following sections:

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

        // Build the final report with MAGNUS branding
        const report = {
          id: crypto.randomUUID(),
          trendId: trend.id,
          title: `${trend.title} - Situational Report`,
          generatedAt: nowIso(),
          country: trend.country,
          severity: highestSeverity,
          content: reportContent,
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

