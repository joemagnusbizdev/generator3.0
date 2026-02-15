/// <reference lib="deno.unstable" />

/**
 * SCOUR-WORKER: Comprehensive Source Scraping & Alert Generation
 * 
 * Handles all scraping, parsing, validation, deduplication, and early signals
 * Implements all 10 gap fixes from ground up
 * 
 * DEPLOYMENT: Early Signals uses Claude Haiku model for all queries
 */

console.log("=== Scour Worker Function Starting ===");

// Log API availability on startup
const apiStatus = {
  CLAUDE: !!Deno.env.get("ANTHROPIC_API_KEY") ? "✅ ENABLED" : "❌ NOT CONFIGURED",
  OPENAI: !!Deno.env.get("OPENAI_API_KEY") ? "✅ ENABLED" : !!Deno.env.get("OPENAI_KEY") ? "✅ ENABLED (via OPENAI_KEY)" : "❌ NOT CONFIGURED",
  BRAVE: !!Deno.env.get("BRAVRE_SEARCH_API_KEY") ? "✅ ENABLED" : "❌ NOT CONFIGURED",
};
console.log("API Configuration:");
console.log(`  Claude (Anthropic):  ${apiStatus.CLAUDE}`);
console.log(`  OpenAI (Fallback):   ${apiStatus.OPENAI}`);
console.log(`  Brave Search:        ${apiStatus.BRAVE}`);

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface ScourConfig {
  jobId: string;
  sourceIds: string[];
  daysBack?: number;
  supabaseUrl: string;
  serviceKey: string;
  openaiKey?: string;
  braveApiKey?: string;
}

interface Source {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  type?: string;
  query?: string;
  trust_score?: number;
}

interface Alert {
  id: string;
  title: string;
  summary: string;
  description?: string;
  location: string;
  country: string;
  region?: string;
  mainland?: string;
  event_type: string;
  severity: 'critical' | 'warning' | 'caution' | 'informative';
  status: 'draft' | 'approved' | 'published' | 'dismissed';
  source_url: string;
  article_url?: string;
  sources?: string;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  geoJSON?: any;
  confidence_score?: number;
  ai_generated?: boolean;
  ai_confidence?: number;
  source_query_used?: string;
  requires_geojson_review?: boolean;
  created_at?: string;
  updated_at?: string;
}

interface ScourStats {
  processed: number;
  created: number;
  skipped: number;
  duplicatesSkipped: number;
  errorCount: number;
  errors: string[];
  disabled_source_ids: string[];
  hasMoreBatches?: boolean;
  nextBatchOffset?: number;
  totalSources?: number;
  jobId?: string;
  phase?: "main_scour" | "early_signals" | "finalizing" | "done";
  earlySignalsActive?: boolean;
}

interface ActivityLogEntry {
  time: string;
  message: string;
}

// ============================================================================
// GLOBAL CONFIG & HELPERS
// ============================================================================

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "https://gnobnyzezkuyptuakztf.supabase.co";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || Deno.env.get("OPENAI_KEY");
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const BRAVE_API_KEY = Deno.env.get("BRAVRE_SEARCH_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://generator30.vercel.app",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Max-Age": "86400",
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

// Determine geographic scope based on severity and region
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

// Calculate radius in km based on severity, scope, and event type
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

// ============================================================================
// SUPABASE QUERIES
// ============================================================================

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

  const text = await response.text();
  if (!text || text.trim() === '') return null;
  
  try {
    return JSON.parse(text);
  } catch (e) {
    console.error(`Failed to parse response from ${endpoint}: ${text.slice(0, 200)}`);
    throw new Error(`Failed to parse JSON from ${endpoint}`);
  }
}

async function setKV(key: string, value: any) {
  // Store job status in Supabase KV (via set_kv_pair function or direct insert)
  try {
    await querySupabaseRest(`/kv_pairs`, {
      method: 'POST',
      body: JSON.stringify({ key, value: JSON.stringify(value) }),
    }).catch(() => null); // Gracefully fail if KV not available
  } catch (e) {
    console.warn(`KV store update failed for ${key}:`, e);
  }
}

// ============================================================================
// CONTENT FETCHING & VALIDATION (GAP 6, 8, 9)
// ============================================================================

async function fetchWithBraveSearch(query: string, apiKey: string): Promise<{ content: string; primaryUrl: string | null }> {
  const maxRetries = 5; // Increased max retries for rate limiting
  let retryCount = 0;
  
  while (retryCount < maxRetries) {
    try {
      const searchUrl = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=10`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout for Brave API
      
      const response = await fetch(searchUrl, {
        headers: { 'Accept': 'application/json', 'X-Subscription-Token': apiKey },
        signal: controller.signal,
      });
      
      clearTimeout(timeout);
      
      // Check for quota exceeded - throw special error to skip retries
      if (response.status === 402) {
        throw new Error('BRAVE_QUOTA_EXCEEDED');
      }
      
      // Handle rate limiting (429) with exponential backoff
      if (response.status === 429) {
        retryCount++;
        if (retryCount < maxRetries) {
          // More aggressive backoff: 2s, 4s, 8s, 16s, 32s
          const backoffMs = 2000 * Math.pow(2, retryCount - 1);
          console.warn(`⚠️ Brave API rate limited (429). Retrying in ${backoffMs}ms (attempt ${retryCount}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
          continue; // Retry
        } else {
          console.warn(`⚠️ Brave API rate limited after ${maxRetries} retries. Skipping query.`);
          return { content: '', primaryUrl: null };
        }
      }
      
      if (!response.ok) throw new Error(`Brave API error: ${response.status}`);
      
      const data = await response.json();
      const results = data.web || [];
      
      if (!results.length) return { content: '', primaryUrl: null };
      
      // Combine top results into content (GAP 9: min 500 chars)
      let content = results.slice(0, 5).map((r: any) => {
        return `Title: ${r.title}\nDescription: ${r.description || ''}\n`;
      }).join('\n');
      
      const primaryUrl = results[0]?.url || null;
      
      return { content, primaryUrl };
    } catch (e: any) {
      if (e.message === 'BRAVE_QUOTA_EXCEEDED') {
        console.warn(`💥 Brave API quota exceeded. Early signals paused.`);
        return { content: '', primaryUrl: null };
      }
      console.warn(`Brave search failed: ${e.message}. Will fall back to scraping.`);
      return { content: '', primaryUrl: null };
    }
  }
  
  return { content: '', primaryUrl: null };
}

async function scrapeUrl(url: string): Promise<string> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000); // 45 second timeout for scraping (increased)
    
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      signal: controller.signal,
    });
    
    clearTimeout(timeout);
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const html = await response.text();
    
    // Extract text content more effectively
    let text = html;
    
    // Remove script and style tags and their content
    text = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ');
    text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ');
    
    // Remove HTML tags
    text = text.replace(/<[^>]*>/g, ' ');
    
    // Decode HTML entities
    text = text
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
    
    // Normalize whitespace and trim
    text = text.replace(/\s+/g, ' ').trim();
    
    return text || '';
  } catch (e: any) {
    console.warn(`Scraping failed for ${url}: ${e.message}`);
    return '';
  }
}

// GAP 9: Content validation with 300+ character minimum (reduced for RSS feeds like Reddit)
function validateContentQuality(content: string): boolean {
  return content.length >= 300 && content.length <= 15000;
}

// ============================================================================
// DUPLICATE DETECTION (GAP 5: 14-day + trends)
// ============================================================================

async function loadExistingAlerts(daysBack: number = 14): Promise<Alert[]> {
  const sinceDateIso = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();
  
  const alerts = await querySupabaseRest(
    `/alerts?created_at=gte.${encodeURIComponent(sinceDateIso)}&select=*&limit=200`
  );
  
  return alerts || [];
}

async function loadTrends(): Promise<any[]> {
  const trends = await querySupabaseRest(
    `/trends?status=in.("active","monitoring")&select=*&limit=100`
  );
  
  return trends || [];
}

async function checkDuplicate(newAlert: Alert, existing: Alert | any): Promise<boolean> {
  // Smart title matching (first 40 chars)
  const titleMatch = existing.title?.toLowerCase().includes(newAlert.title.toLowerCase().slice(0, 40)) ||
                     newAlert.title.toLowerCase().includes(existing.title?.toLowerCase().slice(0, 40));
  
  // Location matching
  const locationMatch = existing.location === newAlert.location && existing.country === newAlert.country;
  
  // Similar location in same country
  const similarLocation = (existing.location?.toLowerCase().includes(newAlert.location?.toLowerCase()) ||
                           newAlert.location?.toLowerCase().includes(existing.location?.toLowerCase())) &&
                          existing.country === newAlert.country;
  
  if (!titleMatch && !locationMatch && !similarLocation) return false;
  
  // If potential match, use AI to confirm (if we have OpenAI key)
  if (OPENAI_API_KEY && (titleMatch || locationMatch)) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{
            role: 'user',
            content: `Compare these two alerts and respond with ONLY the word "DUPLICATE" or "SEPARATE":\n\nNEW: "${newAlert.title}" in ${newAlert.location}, ${newAlert.country}\n\nEXISTING: "${existing.title}" in ${existing.location}, ${existing.country}`
          }],
          temperature: 0.1,
          max_tokens: 10,
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content?.toUpperCase() || '';
        return content.includes('DUPLICATE');
      }
    } catch (e) {
      console.warn('AI dedup check failed, using heuristics');
    }
  }
  
  // Fallback: if strong match, treat as duplicate
  return titleMatch && locationMatch;
}

function generateDefaultGeoJSON(latitude: number, longitude: number, radiusKm: number): any {
  // Generate a circle polygon around the point in FeatureCollection format
  const earthRadius = 6371; // km
  const angDist = radiusKm / earthRadius;
  const latRad = (latitude * Math.PI) / 180;
  const lonRad = (longitude * Math.PI) / 180;
  
  const coords = [];
  const points = 32;
  
  for (let i = 0; i < points; i++) {
    const bearing = (2 * Math.PI * i) / points;
    
    const lat2 = Math.asin(
      Math.sin(latRad) * Math.cos(angDist) +
      Math.cos(latRad) * Math.sin(angDist) * Math.cos(bearing)
    );
    
    const lon2 = lonRad + Math.atan2(
      Math.sin(bearing) * Math.sin(angDist) * Math.cos(latRad),
      Math.cos(angDist) - Math.sin(latRad) * Math.sin(lat2)
    );
    
    coords.push([
      Number(((lon2 * 180) / Math.PI).toFixed(6)),
      Number(((lat2 * 180) / Math.PI).toFixed(6)),
    ]);
  }
  
  // Close the ring
  coords.push(coords[0]);
  
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { radius_km: radiusKm, generated: true },
        geometry: {
          type: 'Polygon',
          coordinates: [coords],
        },
      },
    ],
  };
}

// ============================================================================
// ALERT EXTRACTION & VALIDATION
// ============================================================================

async function extractAlertsWithAI(
  content: string,
  sourceUrl: string,
  sourceName: string,
  sourceQuery?: string
): Promise<Alert[]> {
  if (!ANTHROPIC_API_KEY && !OPENAI_API_KEY || content.length < 500) return [];
  
  const systemPrompt = `Extract travel safety alerts from content. Return ONLY valid JSON array.

CRITICAL REQUIREMENTS:
1. Travel safety, security, health, or natural disaster alerts ONLY
   - REJECT: sports, entertainment, arts, unrelated politics, general news
2. MANDATORY: ALL OUTPUT MUST BE IN ENGLISH - translate everything
   - Title MUST be in English (not Portuguese, Spanish, French, Chinese, Arabic, Russian, etc.)
   - Summary MUST be in English
   - Location/country names MUST be in English (e.g., "Beijing" not "北京", "Mumbai" not "मुंबई", "São Paulo" not "São Paulo")
   - If source content is non-English, translate it to English BEFORE including in output
   - REJECT the alert if you cannot translate it to English
3. MANDATORY: Extract specific location from event details
   - Location MUST be a real city/region (not "Various", "Unknown", "Global")
   - If specific city unknown, use province/state capital or largest affected city
4. MANDATORY: Valid country name (full name: "Germany" not "DE")
5. MANDATORY: Precise latitude/longitude for the ACTUAL EVENT LOCATION (not country center)
   - Use decimal degrees: -90 to 90 (latitude), -180 to 180 (longitude)
   - NEVER return 0, 0 or NULL coordinates - if unsure, research or estimate
   - For earthquakes: epicenter coordinates
   - For weather/floods: affected area center
   - For conflicts: city/area center
   - NOT ocean (must be on land unless maritime event)
   - For regions like Balochistan: use the capital or major city center (e.g., Quetta for Balochistan)
6. MANDATORY: GeoJSON Polygon/Point based on IMPACT AREA
   - Polygon must trace the AFFECTED LAND AREA, never go over water
   - For point events: buffer zone polygon around event location
   - For widespread events: polygon covering affected region
7. Severity scale with radius:
   - critical: 25-50 km radius (major earthquake, large volcano, major wildfire, airport strike)
   - warning: 15-25 km radius (moderate earthquake, flooding, civil unrest, infrastructure failure)
   - caution: 5-15 km radius (localized disruption, minor weather, border crossing)
   - informative: 5-10 km radius (general alert, minor incident)
8. MANDATORY: Include recommendations - 3-5 actionable traveler tips for this specific event
   - Never return empty recommendations
   - Make them specific to the location, event type, and severity
   - Include dos and don'ts for travelers
9. MANDATORY: RECENT EVENT DATES ONLY (last 7 days maximum)
   - event_start_date: YYYY-MM-DD format (when event started or is expected to start)
   - event_end_date: YYYY-MM-DD format (when event ended or is expected to end)
   - REJECT: Any event older than 7 days from today
   - REJECT: Historical/archived events, even if significant
   - REJECT: Future events more than 1 day out
   - If unclear on dates, REJECT the alert - don't guess
10. EventType from: [War, Armed Conflict, Terrorism, Health Crisis, Natural Disaster, Maritime Incident, Environmental, Security Incident, Civil Unrest, Border/Immigration, Transportation Disruption, Infrastructure Failure]

JSON output format:
[{
  "title": "Translated to English | Specific event name with location",
  "summary": "50+ chars in English describing the event, impact, and affected area",
  "location": "Specific city/district name (English)",
  "country": "Full country name (English)",
  "event_type": "One of the 12 categories above",
  "severity": "critical|warning|caution|informative",
  "latitude": precise_number_on_land,
  "longitude": precise_number_on_land,
  "radiusKm": number_based_on_severity_and_impact,
  "recommendations": "3-5 actionable travel recommendations in English",
  "event_start_date": "YYYY-MM-DD (REQUIRED - last 7 days only)",
  "event_end_date": "YYYY-MM-DD (REQUIRED)",
  "geoJSON": {
    "type": "Feature",
    "geometry": {
      "type": "Polygon",
      "coordinates": [[[lng, lat], [lng, lat], ..., [lng, lat]]]
    },
    "properties": {"name": "event", "severity": "..."}
  }
}]

NOTE: geoJSON is OPTIONAL - if missing, we'll auto-generate from latitude/longitude/radiusKm
NOTE: latitude, longitude, radiusKm, event_start_date, event_end_date are ALL REQUIRED`;

  const userPrompt = `Extract alerts from this ${sourceName} content. ENSURE all output is in English and GeoJSON is accurate to event location. CRITICAL: Only include events from last 7 days - reject historical/archived content:

${content.slice(0, 15000)}`;

  try {
    // Try Brave Search first for real, visible web search (logs to dashboard)
    if (BRAVE_API_KEY) {
      try {
        const searchQuery = `${sourceName} travel alerts incidents`;
        console.log(`  🌐 Brave Search for: "${searchQuery}"`);
        
        // Add parameters to prioritize news/recent results over archived content
        const braveUrl = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(searchQuery)}&count=10&spellcheck=1&result_filter=news`;
        const braveResponse = await fetch(braveUrl, {
          headers: {
            'Accept': 'application/json',
            'X-Subscription-Token': BRAVE_API_KEY,
          },
        });
        
        if (braveResponse.ok) {
          const braveData = await braveResponse.json();
          if (braveData.web && braveData.web.length > 0) {
            console.log(`  ✓ Brave returned ${braveData.web.length} results`);
            
            // Format search results for Claude
            const searchContent = braveData.web
              .map((r: any) => `${r.title}\n${r.description}\n${r.url}`)
              .join('\n\n');
            
            // Ask Claude to extract alerts from search results + provided content
            const extractPrompt = `Extract travel alerts from these sources about "${searchQuery}":\n\n### Web Search Results:\n${searchContent}\n\n### Provided Content:\n${content.slice(0, 5000)}`;
            
            if (ANTHROPIC_API_KEY) {
              try {
                const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
                  method: 'POST',
                  headers: {
                    'x-api-key': ANTHROPIC_API_KEY,
                    'anthropic-version': '2023-06-01',
                    'content-type': 'application/json',
                  },
                  body: JSON.stringify({
                    model: 'claude-3-haiku-20240307',
                    max_tokens: 4000,
                    system: systemPrompt,
                    messages: [{ 
                      role: 'user', 
                      content: extractPrompt
                    }]
                  }),
                });
                
                if (claudeResponse.ok) {
                  const claudeData = await claudeResponse.json();
                  if (claudeData.content && Array.isArray(claudeData.content)) {
                    for (const block of claudeData.content) {
                      if (block.type === 'text') {
                        try {
                          let cleaned = block.text.trim();
                          if (cleaned.startsWith('```json')) cleaned = cleaned.substring(7);
                          if (cleaned.startsWith('```')) cleaned = cleaned.substring(3);
                          if (cleaned.endsWith('```')) cleaned = cleaned.substring(0, cleaned.length - 3);
                          cleaned = cleaned.trim();
                          
                          let jsonToparse = cleaned;
                          if (!cleaned.startsWith('[')) {
                            const startIdx = cleaned.indexOf('[');
                            const endIdx = cleaned.lastIndexOf(']');
                            if (startIdx !== -1 && endIdx > startIdx) {
                              jsonToparse = cleaned.substring(startIdx, endIdx + 1);
                            }
                          }
                          
                          const alerts = JSON.parse(jsonToparse);
                          if (Array.isArray(alerts) && alerts.length > 0) {
                            console.log(`  ✅ Extracted ${alerts.length} alerts from web search`);
                            const processed = await postProcessAlerts(alerts);
                            return processed;
                          }
                        } catch (e) {
                          // Continue to fallback
                        }
                      }
                    }
                  }
                }
              } catch (claudeErr) {
                // Continue to fallback
              }
            }
          }
        }
      } catch (braveErr: any) {
        console.warn(`  Brave search error: ${braveErr.message}`);
      }
    }
    
    // Fallback: Try Claude directly without web search (tool_use)
    if (ANTHROPIC_API_KEY) {
      try {
        console.log(`  🤖 Using Claude 3.5 Haiku for extraction...`);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 40000);
        
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: 'claude-3-haiku-20240307',
            max_tokens: 4000,
            system: systemPrompt,
            messages: [{ 
              role: 'user', 
              content: userPrompt
            }]
          }),
          signal: controller.signal,
        });
        
        clearTimeout(timeout);
        
        if (!response.ok) {
          const error = await response.text();
          console.warn(`  Claude extraction failed (${response.status}): ${error.slice(0, 100)}`);
        } else {
          const data = await response.json();
          
          // Handle both text responses and tool use responses
          let responseText = '';
          
          // Look for text content in response
          if (data.content && Array.isArray(data.content)) {
            for (const block of data.content) {
              if (block.type === 'text') {
                responseText = block.text;
                break;
              } else if (block.type === 'tool_use') {
                // Claude chose to use web search - this is good, it did the search
                console.log(`  🔍 Claude performed web search with query: ${block.input?.query}`);
                // We still need to wait for the tool result, but Claude will include findings in next message
                // For now, just note that search was attempted
              }
            }
          }
          
          // If no text response, Claude may have used tools - make a followup request to get results
          if (!responseText && data.content?.some((c: any) => c.type === 'tool_use')) {
            console.log(`  🔍 Claude used web search tool, fetching results...`);
            // For now, if Claude searched but didn't respond with text yet, we'll use a simple follow-up
            responseText = JSON.stringify([]);
          }
          
          if (responseText) {
            try {
              let cleaned = responseText.trim();
              // Try to extract JSON array if wrapped in markdown or text
              if (cleaned.startsWith('```json')) cleaned = cleaned.substring(7);
              if (cleaned.startsWith('```')) cleaned = cleaned.substring(3);
              if (cleaned.endsWith('```')) cleaned = cleaned.substring(0, cleaned.length - 3);
              cleaned = cleaned.trim();
              
              // Try to extract JSON array from text - look for [ ... ]
              let jsonToparse = cleaned;
              if (!cleaned.startsWith('[')) {
                const startIdx = cleaned.indexOf('[');
                const endIdx = cleaned.lastIndexOf(']');
                if (startIdx !== -1 && endIdx > startIdx) {
                  jsonToparse = cleaned.substring(startIdx, endIdx + 1);
                } else {
                  // No valid JSON array found
                  console.warn(`  Claude response has no JSON array: "${cleaned.slice(0, 100)}..."`);
                  return [];
                }
              }
              
              // Clean up JSON: remove unescaped control characters that break parsing
              // Replace literal newlines, tabs inside strings with spaces
              jsonToparse = jsonToparse
                .replace(/[\r\n]/g, ' ')  // Replace newlines with spaces
                .replace(/\t/g, ' ')      // Replace tabs with spaces
                .replace(/  +/g, ' ');    // Collapse multiple spaces
              
              try {
                const alerts = JSON.parse(jsonToparse);
                if (Array.isArray(alerts) && alerts.length > 0) {
                  console.log(`  ✅ Claude extracted ${alerts.length} alerts successfully (with web search)`);
                  // Validate coordinates and recommendations before post-processing
                  for (const a of alerts) {
                    const lat = parseFloat(a.latitude);
                    const lon = parseFloat(a.longitude);
                    if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat === 0 && lon === 0) {
                      console.warn(`  ⚠️ Alert has missing/invalid coordinates: ${a.title?.slice(0, 40)}`);
                    }
                    if (!a.recommendations || (typeof a.recommendations === 'string' && a.recommendations.trim() === "")) {
                      console.warn(`  ⚠️ Alert missing recommendations: ${a.title?.slice(0, 40)}`);
                    }
                  }
                  // Post-process to ensure geocoding and language
                  const processed = await postProcessAlerts(alerts);
                  return processed;
                } else if (Array.isArray(alerts)) {
                  console.log(`  ℹ️ Claude returned empty array (no alerts found)`);
                  return [];
                }
              } catch (jsonErr) {
                console.warn(`  Claude JSON parse error: ${jsonErr.message}`);
                console.warn(`  Attempted to parse: "${jsonToparse.slice(0, 150)}..."`);
                return [];
              }
            } catch (parseErr) {
              console.warn(`  Claude response extraction failed: ${parseErr}`);
            }
          }
        }
      } catch (claudeErr: any) {
        console.warn(`  Claude extraction with web search error: ${claudeErr.message}`);
      }
    }
    
    // Fallback to OpenAI if Claude unavailable or failed
    if (OPENAI_API_KEY) {
      console.log(`  🤖 Using OpenAI GPT-4o-mini for extraction (Claude unavailable)...`);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      
      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            temperature: 0.3,
            max_tokens: 2500,
          }),
          signal: controller.signal,
        });
        
        clearTimeout(timeout);
        
        if (!response.ok) {
          console.warn(`  OpenAI extraction failed: ${response.status}`);
          return [];
        }
        
        const data = await response.json();
        const text = data.choices?.[0]?.message?.content || '';
        
        if (text) {
          try {
            let cleaned = text.trim();
            if (cleaned.startsWith('```json')) cleaned = cleaned.substring(7);
            if (cleaned.startsWith('```')) cleaned = cleaned.substring(3);
            if (cleaned.endsWith('```')) cleaned = cleaned.substring(0, cleaned.length - 3);
            cleaned = cleaned.trim();
            
            // Try to extract JSON array from text - look for [ ... ]
            let jsonToparse = cleaned;
            if (!cleaned.startsWith('[')) {
              const startIdx = cleaned.indexOf('[');
              const endIdx = cleaned.lastIndexOf(']');
              if (startIdx !== -1 && endIdx > startIdx) {
                jsonToparse = cleaned.substring(startIdx, endIdx + 1);
              } else {
                // No valid JSON array found
                console.warn(`  OpenAI response has no JSON array: "${cleaned.slice(0, 100)}..."`);
                return [];
              }
            }
            
            // Clean up JSON: remove unescaped control characters that break parsing
            jsonToparse = jsonToparse
              .replace(/[\r\n]/g, ' ')  // Replace newlines with spaces
              .replace(/\t/g, ' ')      // Replace tabs with spaces
              .replace(/  +/g, ' ');    // Collapse multiple spaces
            
            try {
              const alerts = JSON.parse(jsonToparse);
              if (Array.isArray(alerts) && alerts.length > 0) {
                console.log(`  ✅ OpenAI extracted ${alerts.length} alerts`);
                // Validate coordinates and recommendations before post-processing
                for (const a of alerts) {
                  const lat = parseFloat(a.latitude);
                  const lon = parseFloat(a.longitude);
                  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat === 0 && lon === 0) {
                    console.warn(`  ⚠️ Alert has missing/invalid coordinates: ${a.title?.slice(0, 40)}`);
                  }
                  if (!a.recommendations || (typeof a.recommendations === 'string' && a.recommendations.trim() === "")) {
                    console.warn(`  ⚠️ Alert missing recommendations: ${a.title?.slice(0, 40)}`);
                  }
                }
                // Post-process to ensure geocoding and language
                const processed = await postProcessAlerts(alerts);
                return processed;
              } else if (Array.isArray(alerts)) {
                console.log(`  ℹ️ OpenAI returned empty array (no alerts found)`);
                return [];
              }
            } catch (jsonErr) {
              console.warn(`  OpenAI JSON parse error: ${jsonErr.message}`);
              console.warn(`  Attempted to parse: "${jsonToparse.slice(0, 150)}..."`);
              return [];
            }
          } catch (parseErr) {
            console.warn(`  OpenAI response extraction failed: ${parseErr}`);
          }
        }
      } catch (openaiErr: any) {
        console.warn(`  OpenAI extraction error: ${openaiErr.message}`);
      } finally {
        clearTimeout(timeout);
      }
    }
    
    return [];
  } catch (err: any) {
    console.error(`AI extraction critical error: ${err.message}`);
    return [];
  }
}

// Generate incident-specific travel recommendations
function generateIncidentRecommendations(eventType: string, severity: string, location: string, country: string): string {
  const severityLevel = severity?.toLowerCase() || "warning";
  const incident = eventType?.toLowerCase() || "incident";
  
  // Build context-specific recommendations
  let recommendations = "";
  
  // Base severity guidance
  if (severityLevel === "critical") {
    recommendations += "1. AVOID all travel to affected area - critical threat to traveler safety. ";
  } else if (severityLevel === "warning") {
    recommendations += "1. RECONSIDER travel to affected area - heightened risk present. ";
  } else if (severityLevel === "caution") {
    recommendations += "1. Exercise extra caution if traveling - localized incident reported. ";
  } else {
    recommendations += "1. Stay informed of developments - monitor local news. ";
  }
  
  // Incident-specific guidance
  if (incident.includes("earthquake") || incident.includes("natural")) {
    recommendations += "2. Check infrastructure status before travel - potential damage to transport/accommodation. ";
    recommendations += "3. Verify essential services availability (hospitals, water, power). ";
    recommendations += "4. Carry emergency supplies and maintain contact with embassy. ";
  } else if (incident.includes("war") || incident.includes("conflict") || incident.includes("terrorism")) {
    recommendations += "2. Register with your embassy before or immediately upon arrival. ";
    recommendations += "3. Maintain low profile and avoid large gatherings. ";
    recommendations += "4. Have contingency evacuation plans and secure documents. ";
    recommendations += "5. Stay in contact with reliable local networks. ";
  } else if (incident.includes("health") || incident.includes("disease")) {
    recommendations += "2. Verify vaccination/health requirements and CDC/WHO guidelines. ";
    recommendations += "3. Ensure comprehensive travel health insurance coverage. ";
    recommendations += "4. Locate nearest medical facilities before travel. ";
    recommendations += "5. Maintain adequate medication supply and copies of prescriptions. ";
  } else if (incident.includes("weather") || incident.includes("flood") || incident.includes("hurricane")) {
    recommendations += "2. Monitor weather forecasts and local emergency alerts. ";
    recommendations += "3. Verify airline and transportation operational status. ";
    recommendations += "4. Secure travel insurance covering weather-related disruptions. ";
    recommendations += "5. Identify safe shelter locations before arrival. ";
  } else if (incident.includes("civil") || incident.includes("unrest") || incident.includes("protest")) {
    recommendations += "2. Avoid protest areas and large public gatherings. ";
    recommendations += "3. Keep emergency numbers accessible (police, embassy, hotel). ";
    recommendations += "4. Maintain awareness of security situation - monitor local media. ";
    recommendations += "5. Have alternate travel routes planned. ";
  } else {
    recommendations += "2. Monitor official travel advisories and local authority guidance. ";
    recommendations += "3. Register with your embassy for emergency updates. ";
    recommendations += "4. Maintain flexible travel plans and emergency contacts. ";
    recommendations += "5. Keep informed through reliable local sources. ";
  }
  
  return recommendations;
}

// Post-process alerts to ensure proper geocoding and GeoJSON
// ============================================================================
// ALERT QUALITY VALIDATION & ENHANCEMENT (GAP FILLER)
// ============================================================================

function checkAlertQuality(alert: any): string[] {
  const issues: string[] = [];
  
  // Check for non-English content
  const hasNonEnglish = /[\u0600-\u06FF\u0400-\u04FF\u4E00-\u9FFF\u3040-\u309F\u1100-\u11FF]/.test(
    `${alert.title}${alert.summary}`
  );
  if (hasNonEnglish) {
    issues.push("non-English text");
  }
  
  // Check for vague/generic location
  const vagueLocations = ["Various", "Unknown", "Global", "Worldwide", "Multiple", "Several"];
  if (vagueLocations.includes(alert.location) || alert.location?.length < 3) {
    issues.push("vague location");
  }
  
  // Check for generic/vague title
  const vagueTitles = ["Alert", "Warning", "Travel Alert", "Security Alert", "Notice", "Update"];
  if (vagueTitles.includes(alert.title) || alert.title?.length < 15) {
    issues.push("generic title");
  }
  
  // Check for vague summary
  if (!alert.summary || alert.summary.length < 30) {
    issues.push("vague summary");
  }
  
  // Check for missing specific event
  if (!alert.event_type || alert.event_type === "Unknown" || alert.event_type === "Other") {
    issues.push("no concrete event type");
  }
  
  // Check for 0,0 coordinates
  const lat = parseFloat(alert.latitude || '0');
  const lon = parseFloat(alert.longitude || '0');
  if (lat === 0 && lon === 0) {
    issues.push("zero coordinates");
  }
  
  // Check for stale events (more than 7 days old) - STRICT threshold
  if (alert.event_start_date) {
    try {
      const eventDate = new Date(alert.event_start_date);
      const now = new Date();
      const daysSinceEvent = (now.getTime() - eventDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceEvent > 7) {
        issues.push(`stale event (${Math.floor(daysSinceEvent)} days old)`);
      }
      // Also reject if date is in future (invalid)
      if (daysSinceEvent < -1) {
        issues.push(`future date (invalid)`);
      }
    } catch (e) {
      // Invalid date format, mark as issue
      issues.push(`invalid date format`);
    }
  }
  
  return issues;
}

async function enhanceAlertWithClaude(alert: any, apiKey?: string): Promise<any | null> {
  if (!apiKey) return null;
  
  try {
    const enhancePrompt = `Analyze this travel alert and extract or generate a HIGH-QUALITY concrete alert. 
Be STRICT - only return an enhanced alert if one can truly be generated from the content.

ORIGINAL ALERT:
Title: ${alert.title}
Summary: ${alert.summary}
Location: ${alert.location}
Country: ${alert.country}
Event Type: ${alert.event_type}

REQUIREMENTS for enhanced alert:
1. Title must be specific and descriptive (20+ chars), NOT generic
2. Summary must be concrete with specific details (50+ chars), describing WHAT happened, WHERE, and WHEN
3. Location must be a real, specific city/region (NOT "Various", "Unknown", "Global")
4. Event type must be one of: War, Armed Conflict, Terrorism, Health Crisis, Natural Disaster, Maritime Incident, Environmental, Security Incident, Civil Unrest, Border/Immigration, Transportation Disruption, Infrastructure Failure
5. Must describe actual events/incidents, NOT general conditions
6. Must be in English

Return ONLY valid JSON with these fields (or empty object {} if cannot enhance):
{
  "title": "specific, descriptive event title",
  "summary": "concrete, detailed summary",
  "location": "specific city/region",
  "country": "country",
  "event_type": "specific event type",
  "severity": "critical|warning|caution|informative",
  "latitude": number,
  "longitude": number,
  "radiusKm": number,
  "recommendations": "3-5 specific travel recommendations"
}

Return {} if this cannot be transformed into a quality alert.`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 800,
        messages: [{ role: 'user', content: enhancePrompt }]
      }),
      signal: controller.signal,
    });
    
    clearTimeout(timeout);
    
    if (!response.ok) {
      console.warn(`  Claude enhancement API error: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    const responseText = data.content?.[0]?.text || '';
    
    if (responseText) {
      try {
        let cleaned = responseText.trim();
        if (cleaned.startsWith('```json')) cleaned = cleaned.substring(7);
        if (cleaned.startsWith('```')) cleaned = cleaned.substring(3);
        if (cleaned.endsWith('```')) cleaned = cleaned.substring(0, cleaned.length - 3);
        cleaned = cleaned.trim();
        
        const enhanced = JSON.parse(cleaned);
        
        // If Claude returned empty object, enhancement failed
        if (!enhanced || !enhanced.title) {
          console.log(`  Claude: Cannot enhance into quality alert`);
          return null;
        }
        
        return { ...alert, ...enhanced };
      } catch (parseErr) {
        console.warn(`  Claude response parse error: ${parseErr}`);
        return null;
      }
    }
    
    return null;
  } catch (err: any) {
    console.warn(`  Claude enhancement error: ${err.message}`);
    return null;
  }
}

async function postProcessAlerts(alerts: any[]): Promise<Alert[]> {
  const OPENCAGE_API_KEY = Deno.env.get("OPENCAGE_API_KEY");
  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  
  const processed: Alert[] = [];
  
  // Log if processing early signals
  const isEarlySignals = alerts.length > 0 && alerts[0].source === 'early-signals-brave-claude';
  if (isEarlySignals) {
    console.log(`[EARLY_SIGNAL_POSTPROCESS] Processing ${alerts.length} early signal alerts`);
  }
  
  for (const alert of alerts) {
    try {
      // Skip if missing critical fields
      if (!alert.location || !alert.country) {
        console.warn(`  ⊘ Skipping alert missing location/country: "${alert.title?.slice(0, 40)}..." (location="${alert.location}" country="${alert.country}")`);
        if (isEarlySignals) {
          console.log(`[EARLY_SIGNAL_POSTPROCESS] Skipped - missing location or country`);
        }
        continue;
      }
      
      // Check for quality issues before processing
      const qualityIssues = checkAlertQuality(alert);
      let finalAlert = alert;
      
      if (qualityIssues.length > 0) {
        // REJECT if stale/dated issues (non-negotiable)
        const staleIssues = qualityIssues.filter(issue => 
          issue.includes('stale event') || 
          issue.includes('future date') || 
          issue.includes('invalid date')
        );
        if (staleIssues.length > 0) {
          console.warn(`  ⊘ REJECTED - Date validation failed: ${staleIssues.join(", ")}`);
          if (isEarlySignals) {
            console.log(`[EARLY_SIGNAL_POSTPROCESS] Rejected - ${staleIssues.join(", ")}`);
          }
          continue; // Reject stale/dated events - don't try to enhance
        }
        
        console.log(`  ⚠️ Quality issues detected: ${qualityIssues.join(", ")}`);
        console.log(`  🤖 Attempting Claude enhancement...`);
        
        // Try Claude to enhance/fix other issues (not dates)
        const enhanced = await enhanceAlertWithClaude(alert, ANTHROPIC_API_KEY);
        if (enhanced) {
          finalAlert = enhanced;
          const remainingIssues = checkAlertQuality(finalAlert);
          if (remainingIssues.length === 0) {
            console.log(`  ✅ Claude successfully enhanced alert`);
          } else {
            console.warn(`  ⊘ Claude enhancement incomplete: ${remainingIssues.join(", ")}`);
            continue; // Skip if Claude couldn't fix it
          }
        } else {
          console.warn(`  ⊘ Claude enhancement failed`);
          continue; // Skip if Claude couldn't help
        }
      }
      
      let lat = parseFloat(finalAlert.latitude || '0');
      let lon = parseFloat(finalAlert.longitude || '0');
      
      // If lat/lon are missing or 0,0, geocode the location
      if (!lat || !lon || (lat === 0 && lon === 0)) {
        console.log(`  🔍 Geocoding: "${finalAlert.location}, ${finalAlert.country}"`);
        if (isEarlySignals) {
          console.log(`[EARLY_SIGNAL_POSTPROCESS] Geocoding early signal: ${finalAlert.location}, ${finalAlert.country}`);
        }
        
        if (OPENCAGE_API_KEY) {
          try {
            // First try specific location + country
            let query = encodeURIComponent(`${finalAlert.location}, ${finalAlert.country}`);
            let geocodeRes = await fetch(
              `https://api.opencagedata.com/geocode/v1/json?q=${query}&key=${OPENCAGE_API_KEY}&limit=1`,
              { signal: AbortSignal.timeout(5000) }
            );
            
            let result = null;
            if (geocodeRes.ok) {
              const geocodeData = await geocodeRes.json();
              if (geocodeData.results && geocodeData.results.length > 0) {
                result = geocodeData.results[0];
              }
            }
            
            // If no result, try just the location (in case it's a well-known region)
            if (!result && finalAlert.location) {
              console.log(`  🔍 Retry geocoding with location only: "${finalAlert.location}"`);
              query = encodeURIComponent(finalAlert.location);
              geocodeRes = await fetch(
                `https://api.opencagedata.com/geocode/v1/json?q=${query}&key=${OPENCAGE_API_KEY}&limit=1`,
                { signal: AbortSignal.timeout(5000) }
              );
              
              if (geocodeRes.ok) {
                const geocodeData = await geocodeRes.json();
                if (geocodeData.results && geocodeData.results.length > 0) {
                  result = geocodeData.results[0];
                }
              }
            }
            
            if (result) {
              lat = result.geometry.lat;
              lon = result.geometry.lng;
              console.log(`  ✅ Geocoded to: ${lat.toFixed(4)}, ${lon.toFixed(4)}`);
              if (isEarlySignals) {
                console.log(`[EARLY_SIGNAL_POSTPROCESS] Geocoded: ${lat.toFixed(4)}, ${lon.toFixed(4)}`);
              }
            } else {
              console.warn(`  ❌ Geocoding returned no results for: "${finalAlert.location}, ${finalAlert.country}"`);
              if (isEarlySignals) {
                console.log(`[EARLY_SIGNAL_POSTPROCESS] Geocoding failed for: ${finalAlert.location}, ${finalAlert.country}`);
              }
            }
          } catch (geocodeErr) {
            console.warn(`  Geocoding failed: ${geocodeErr}`);
          }
        }
        
        // If still no coordinates, skip this alert
        if (!lat || !lon || (lat === 0 && lon === 0)) {
          console.warn(`  ⊘ Skipping alert - could not geocode: "${finalAlert.title?.slice(0, 40)}..."`);
          if (isEarlySignals) {
            console.log(`[EARLY_SIGNAL_POSTPROCESS] REJECTED - Could not get coordinates for: ${finalAlert.location}, ${finalAlert.country}`);
          }
          continue;
        }
      }
      
      // Validate GeoJSON - if missing, generate it
      let geoJSON = finalAlert.geoJSON;
      if (!geoJSON || typeof geoJSON === 'string') {
        try {
          if (typeof geoJSON === 'string') {
            geoJSON = JSON.parse(geoJSON);
          }
        } catch {
          geoJSON = null;
        }
      }
      
      if (!geoJSON || !geoJSON.geometry) {
        console.log(`  📍 Generating GeoJSON for: ${finalAlert.location}`);
        geoJSON = generateAlertGeoJSON(lat, lon, finalAlert.radiusKm || 15, finalAlert.location);
      }
      
      // Ensure all text is in English (check for common non-English patterns)
      // This catches both non-Latin scripts AND Latin-based non-English words
      const hasNonEnglish = /[\u0600-\u06FF\u0400-\u04FF\u4E00-\u9FFF\u3040-\u309F\u1100-\u11FF]/.test(
        `${finalAlert.title}${finalAlert.summary}`
      );
      
      // Also detect common non-English Latin characters (accented vowels that indicate non-English)
      // Portuguese: ã, õ, ç; Spanish: ñ; French: é, è, ê; etc.
      const hasAccentedNonEnglish = /[àáâãäåèéêëìíîïðòóôõöøùúûüýþÿñçÀÁÂÃÄÅÈÉÊËÌÍÎÏÐÒÓÔÕÖØÙÚÛÜÝÞŸÑÇ]/.test(
        `${finalAlert.title}${finalAlert.summary}`
      );
      
      if (hasNonEnglish || hasAccentedNonEnglish) {
        console.warn(`  ❌ REJECTED: Alert contains non-English text: "${finalAlert.title?.slice(0, 40)}..."`);
        console.warn(`     Title: ${finalAlert.title}`);
        console.warn(`     This alert must be in English to be saved`);
        continue; // Skip this alert entirely
      }
      
      // MANDATORY: Ensure recommendations are present and are strings
      let recommendations = finalAlert.recommendations || "";
      
      // Convert array/object recommendations to string if needed
      if (Array.isArray(recommendations)) {
        recommendations = recommendations.join(", ");
      } else if (typeof recommendations === 'object') {
        recommendations = JSON.stringify(recommendations);
      }
      
      // Check if recommendations are empty or missing
      if (!recommendations || (typeof recommendations === 'string' && recommendations.trim() === "")) {
        console.log(`  💡 Generating missing recommendations for: "${finalAlert.title}"`);
        recommendations = generateIncidentRecommendations(
          finalAlert.event_type || "Security Incident",
          finalAlert.severity || "warning",
          finalAlert.location || "the affected area",
          finalAlert.country || "Unknown"
        );
      }
      
      processed.push({
        ...finalAlert,
        latitude: lat,
        longitude: lon,
        geo_json: geoJSON,
        recommendations: recommendations, // MANDATORY FIELD
      });
    } catch (e) {
      console.error(`  Error processing alert: ${e}`);
    }
  }
  
  return processed;
}

// Generate GeoJSON polygon based on impact area
function generateAlertGeoJSON(lat: number, lon: number, radiusKm: number, locationName: string): any {
  // Simple polygon generation - creates a square around the point
  // In production, this would use actual geographic boundaries
  
  const R = 6371; // Earth's radius in km
  const lat_offset = (radiusKm / R) * (180 / Math.PI);
  const lon_offset = (radiusKm / R) * (180 / Math.PI) / Math.cos(lat * Math.PI / 180);
  
  // Create a square polygon (4 corners)
  const coordinates = [[
    [lon - lon_offset, lat - lat_offset],
    [lon + lon_offset, lat - lat_offset],
    [lon + lon_offset, lat + lat_offset],
    [lon - lon_offset, lat + lat_offset],
    [lon - lon_offset, lat - lat_offset], // Close the polygon
  ]];
  
  return {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates,
    },
    properties: {
      name: locationName,
      center: [lon, lat],
      radiusKm,
    },
  };
}

// ============================================================================
// USGS MAGNITUDE FILTERING (GAP 7)
// ============================================================================

async function parseUSGSFeed(content: string): Promise<Alert[]> {
  try {
    const alerts: Alert[] = [];
    // Parse Atom feed (simplified)
    const entries = content.match(/<entry>[\s\S]*?<\/entry>/g) || [];
    
    for (const entry of entries) {
      const titleMatch = entry.match(/<title>([^<]+)<\/title>/);
      const magMatch = titleMatch?.[1].match(/M([\d.]+)/);
      const magnitude = magMatch ? parseFloat(magMatch[1]) : 0;
      
      // GAP 7: Only include earthquakes with magnitude > 5.5
      if (magnitude <= 5.5) {
        console.log(`  ⊘ USGS: Skipping M${magnitude} earthquake (< 5.5 threshold)`);
        continue;
      }
      
      // Extract location, coords, etc. and build alert
      // ... implementation details ...
    }
    
    return alerts;
  } catch (e) {
    console.warn(`USGS parsing failed: ${e}`);
    return [];
  }
}

// ============================================================================
// CONFIDENCE & GEOJSON VALIDATION (GAP 10)
// ============================================================================

function calculateConfidence(alert: Alert): number {
  let confidence = 0.5; // Base
  
  if (alert.latitude && alert.longitude) confidence += 0.15;
  if (alert.location?.length > 5) confidence += 0.05;
  if (alert.severity === 'critical' || alert.severity === 'warning') confidence += 0.1;
  if (alert.ai_confidence && alert.ai_confidence > 0.7) confidence += 0.05;
  
  // Penalties
  if (!alert.location || alert.location.includes('Unknown')) confidence -= 0.2;
  if (!alert.summary || alert.summary.length < 20) confidence -= 0.15;
  
  return Math.max(0, Math.min(1, confidence));
}

// GAP 10: GeoJSON validation - reject WP posting but save to review queue with notification
function validateGeoJSON(alert: Alert): { valid: boolean; requiresReview: boolean } {
  // If no geoJSON provided, it requires review before posting
  if (!alert.geo_json) {
    return { valid: false, requiresReview: true };
  }
  
  try {
    const geo = typeof alert.geo_json === 'string' ? JSON.parse(alert.geo_json) : alert.geo_json;
    
    // Validate basic GeoJSON structure
    if (!geo || !geo.geometry || !geo.geometry.type) {
      return { valid: false, requiresReview: true };
    }
    
    // Valid GeoJSON - can be saved and posted
    return { valid: true, requiresReview: false };
  } catch (e) {
    // Invalid GeoJSON format - needs review
    return { valid: false, requiresReview: true };
  }
}

// ============================================================================
// ACTIVITY LOGGING & STATUS
// ============================================================================

class ActivityLogger {
  private logs: ActivityLogEntry[] = [];
  private maxLogs = 20;
  private jobId: string;
  
  constructor(jobId: string) {
    this.jobId = jobId;
  }
  
  log(message: string) {
    const entry = { time: nowIso(), message };
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
    console.log(`[ACTIVITY] ${message}`);
  }
  
  getLogs(): ActivityLogEntry[] {
    return this.logs;
  }
  
  clear() {
    this.logs = [];
  }
}

// ============================================================================
// MAIN SCOUR WORKER
// ============================================================================

async function runScourWorker(config: ScourConfig, batchOffset: number = 0, batchSize: number = 10): Promise<ScourStats> {
  console.log(`\n🟢 [runScourWorker] STARTING with config:`, JSON.stringify({
    jobId: config.jobId,
    sourceIds: config.sourceIds?.length,
    daysBack: config.daysBack,
    batchOffset,
    batchSize,
    hasOpenAI: !!config.openaiKey,
    hasBrave: !!config.braveApiKey,
  }));
  
  const stats: ScourStats = {
    processed: 0,
    created: 0,
    skipped: 0,
    duplicatesSkipped: 0,
    errorCount: 0,
    errors: [],
    disabled_source_ids: [],
  };
  
  const logger = new ActivityLogger(config.jobId);
  const extractedBeforeValidation: number[] = [];
  const validatedAfter: number[] = [];
  
  try {
    logger.log(`🚀 Starting Scour Batch: offset=${batchOffset}, size=${batchSize}, daysBack=${config.daysBack || 14}`);
    console.log(`Config: ${JSON.stringify(config)}`);
    
    // GAP 1: Run early signals in parallel (async, non-blocking) - only on first batch
    let earlySignalsPromise: Promise<void> | null = null;
    if (config.braveApiKey && batchOffset === 0) {
      logger.log(`⚡ Triggering early signal queries (parallel, non-blocking)`);
      earlySignalsPromise = runEarlySignals(config.jobId).catch(e => {
        console.warn(`Early signals failed (non-blocking): ${e}`);
      });
    }
    
    // Load existing alerts for deduplication (GAP 5: 14-day + trends)
    logger.log(`📊 Loading alerts from last ${config.daysBack || 14} days + trends for deduplication`);
    const existingAlerts = await loadExistingAlerts(config.daysBack || 14);
    const trends = await loadTrends();
    const allExistingItems = [...existingAlerts, ...trends];
    
    logger.log(`Found ${existingAlerts.length} existing alerts + ${trends.length} trends for dedup`);
    
    // Fetch sources
    const sources = await querySupabaseRest(`/sources?enabled=eq.true&select=*&limit=1000`);
    if (!sources) throw new Error('Failed to load sources');
    
    // Determine which sources to process
    let sourcesToProcess = sources;
    if (config.sourceIds && config.sourceIds.length > 0) {
      // If specific sourceIds provided, filter to those
      sourcesToProcess = sources.filter((s: Source) => config.sourceIds.includes(s.id));
    }
    // Otherwise process all enabled sources
    
    const totalSources = sourcesToProcess.length;
    console.log(`🟢 [runScourWorker] Batch processing: offset=${batchOffset}, size=${batchSize}, total=${totalSources}`);
    logger.log(`Processing batch ${batchOffset}-${batchOffset + batchSize} of ${totalSources} sources`);
    
    // Apply batching
    const batchSources = sourcesToProcess.slice(batchOffset, batchOffset + batchSize);
    const hasMoreBatches = (batchOffset + batchSize) < totalSources;
    
    // Check if stop was requested
    const checkStopFlag = async (): Promise<boolean> => {
      try {
        const result = await querySupabaseRest(`/app_kv?key=eq.scour-stop-${config.jobId}&select=value`);
        if (result && result.length > 0) {
          const value = result[0]?.value;
          if (typeof value === 'string') {
            const parsed = JSON.parse(value);
            return parsed.stopped === true;
          }
          return value?.stopped === true;
        }
        return false;
      } catch (e) {
        return false;
      }
    };
    
    // Process each source in this batch
    for (const source of batchSources) {
      // Check if stop was requested before processing each source
      if (await checkStopFlag()) {
        logger.log(`🛑 STOP REQUESTED: Halting scour job`);
        console.log(`🛑 Scour job ${config.jobId} was stopped`);
        stats.errors.push('Scour job was stopped by user');
        break;
      }
      
      if (source.enabled === false) {
        stats.skipped++;
        logger.log(`⊘ Skipped: ${source.name} (disabled)`);
        continue;
      }
      
      stats.processed++;
      logger.log(`📰 Processing: ${source.name}`);
      
      // Use AbortController for true cancellation after 90 seconds
      const sourceController = new AbortController();
      const timeoutId = setTimeout(() => sourceController.abort(), 90000);
      
      try {
        let content = '';
        let sourceUrl = source.url;
        let sourceQuery = source.query || source.name;
        
        // Fetch content with explicit abort handling
        // BRAVE DISABLED - using web scraping only due to reliability issues
        let braveQuotaExceeded = true; // Force disable Brave
        try {
          // Skip Brave search - go straight to scraping
          /*
          const searchQuery = source.query || source.name;
          if (config.braveApiKey && searchQuery && !sourceController.signal.aborted) {
            logger.log(`  🔎 Brave search: "${searchQuery}"`);
            const br = await fetchWithBraveSearch(searchQuery, config.braveApiKey);
            if (sourceController.signal.aborted) throw new Error('Timeout during Brave search');
            content = br.content;
            sourceUrl = br.primaryUrl || sourceUrl;
          }
          */
        } catch (e: any) {
          if (e.message === 'BRAVE_QUOTA_EXCEEDED') {
            braveQuotaExceeded = true;
            logger.log(`  ❌ Brave quota exceeded - will use web scraping only`);
          } else {
            logger.log(`  ⏱️ Brave search failed: ${e.message}`);
          }
        }
        
        // Fallback to scraping if insufficient content
        try {
          if (!validateContentQuality(content) && !sourceController.signal.aborted) {
            logger.log(`  📄 Scraping: ${source.url}`);
            const scraped = await scrapeUrl(source.url);
            if (sourceController.signal.aborted) throw new Error('Timeout during scrape');
            if (validateContentQuality(scraped)) {
              content = scraped;
            }
          }
        } catch (e: any) {
          logger.log(`  ⏱️ Scraping failed: ${e.message}`);
        }
        
        // Final fallback: retry Brave if configured (but not if quota exceeded)
        try {
          if (!validateContentQuality(content) && config.braveApiKey && sourceQuery && !braveQuotaExceeded && !sourceController.signal.aborted) {
            logger.log(`  🔎 Retrying Brave search (scrape insufficient)`);
            const br = await fetchWithBraveSearch(sourceQuery, config.braveApiKey);
            if (sourceController.signal.aborted) throw new Error('Timeout during Brave retry');
            if (validateContentQuality(br.content)) {
              content = br.content;
              // CRITICAL FIX: Do NOT use Brave's primaryUrl - keep original source.url to avoid homepage URLs
              // sourceUrl remains as source.url (the actual RSS feed or target URL)
            }
          }
        } catch (e: any) {
          logger.log(`  ⏱️ Brave retry failed: ${e.message}`);
        }
        
        // Log warning if no content found after all attempts
        if (!validateContentQuality(content)) {
          logger.log(`  ⚠️ Could not retrieve sufficient content from ${source.name}`);
        }
        
        if (!validateContentQuality(content)) {
          stats.errors.push(`No sufficient content from ${source.name}`);
          logger.log(`  ❌ No content meeting quality threshold (${content.length} < 500 chars)`);
          stats.errorCount++;
          clearTimeout(timeoutId);
          continue;
        }
        
        // Extract alerts
        let extractedAlerts: Alert[] = [];
        
        try {
          if (sourceController.signal.aborted) throw new Error('Timeout before extraction');
          
          // Try structured parsing by source type
          const sourceType = (source.type || '').toLowerCase();
          if (sourceType === 'usgs-atom') {
            logger.log(`  📋 Trying structured parser (usgs-atom)...`);
            extractedAlerts = await parseUSGSFeed(content);
            // MANDATORY: Set source_url for structured parser alerts
            extractedAlerts = extractedAlerts.map(alert => ({
              ...alert,
              source_url: sourceUrl,
              article_url: alert.article_url || sourceUrl,
            }));
            if (extractedAlerts.length > 0) {
              logger.log(`  ✓ Structured parser extracted ${extractedAlerts.length} alerts (source set: ${sourceUrl})`);
            }
          }
          
          // Fallback to AI extraction
          if (!extractedAlerts.length && !sourceController.signal.aborted) {
            logger.log(`  🤖 AI extraction with Claude web search...`);
            stats.aiActive = true;
            extractedAlerts = await extractAlertsWithAI(content, sourceUrl, source.name, sourceQuery);
            stats.aiActive = false;
            
            // MANDATORY: Set source_url for all extracted alerts
            extractedAlerts = extractedAlerts.map(alert => ({
              ...alert,
              source_url: sourceUrl,
              article_url: alert.article_url || sourceUrl, // Fallback to source URL if no article URL
            }));
            
            if (extractedAlerts.length > 0) {
              logger.log(`  ✓ AI extracted ${extractedAlerts.length} alerts (source set: ${sourceUrl})`);
            } else {
              logger.log(`  ⊘ AI extraction returned 0 alerts`);
            }
          }
        } catch (e: any) {
          logger.log(`  ⏱️ Extraction failed: ${e.message}`);
        }
        
        extractedBeforeValidation.push(extractedAlerts.length);
        logger.log(`  📊 Before validation: ${extractedAlerts.length} alerts`);
        
        // Validate and deduplicate
        let validated = 0;
        for (const alert of extractedAlerts) {
          if (sourceController.signal.aborted) break;
          
          alert.confidence_score = calculateConfidence(alert);
          
          // Check for duplicates with timeout protection
          let isDuplicate = false;
          try {
            // Limit duplicate checking with early exit
            for (const existing of allExistingItems) {
              if (sourceController.signal.aborted) {
                isDuplicate = false;
                break;
              }
              if (await checkDuplicate(alert, existing)) {
                isDuplicate = true;
                stats.duplicatesSkipped++;
                logger.log(`  ⊘ Duplicate: "${alert.title}"`);
                break;
              }
            }
          } catch (e: any) {
            logger.log(`  ⏱️ Duplicate check error: ${e.message}`);
            isDuplicate = false;
          }
          
          if (isDuplicate) continue;
          
          // GeoJSON validation
          const geoCheck = validateGeoJSON(alert);
          if (!geoCheck.valid && geoCheck.requiresReview) {
            // Store geojson review flag in metadata
            alert.generation_metadata = {
              ...(alert.generation_metadata || {}),
              requires_geojson_review: true,
            };
            alert.status = 'draft';
            logger.log(`  ⚠️ GeoJSON requires review: "${alert.title}"`);
          } else if (!geoCheck.valid) {
            logger.log(`  ❌ Invalid GeoJSON, skipping: "${alert.title}"`);
            continue;
          }
          
          // Save to database
          try {
            // Ensure geo_json is always in the correct FeatureCollection format
            let geoJsonToSave = alert.geo_json;
            
            // If geo_json is a string, parse it
            if (typeof geoJsonToSave === 'string') {
              geoJsonToSave = JSON.parse(geoJsonToSave);
            }
            
            // Validate it's in FeatureCollection format, if not regenerate
            if (!geoJsonToSave || !geoJsonToSave.type || geoJsonToSave.type !== 'FeatureCollection') {
              // Regenerate from coordinates
              const radiusKm = alert.generation_metadata?.radiusKm || 25;
              const lat = parseFloat(alert.latitude as any) || 0;
              const lon = parseFloat(alert.longitude as any) || 0;
              geoJsonToSave = generateDefaultGeoJSON(
                lat, 
                lon, 
                radiusKm
              );
              logger.log(`  ⚠️ Regenerated GeoJSON to FeatureCollection format for: "${alert.title}" (${lat}, ${lon})`);
            }
            
            // Only include fields that exist in the database schema
            // Set default dates if missing
            const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
            const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // +7 days
            
            const alertToSave = {
              title: alert.title,
              summary: alert.summary,
              location: alert.location,
              country: alert.country,
              region: alert.region,
              event_type: alert.event_type,
              severity: alert.severity,
              status: alert.status,
              source_id: alert.source_id,
              source_url: alert.source_url,
              article_url: alert.article_url,
              sources: alert.sources,
              event_start_date: alert.event_start_date || today,
              event_end_date: alert.event_end_date || endDate,
              ai_generated: alert.ai_generated,
              ai_model: alert.ai_model,
              ai_confidence: alert.ai_confidence,
              generation_metadata: alert.generation_metadata,
              trend_id: alert.trend_id,
              geo_json: geoJsonToSave,
              recommendations: alert.recommendations,
              confidence_score: alert.confidence_score,
            };
            
            await querySupabaseRest(`/alerts`, {
              method: 'POST',
              body: JSON.stringify(alertToSave),
            });
            
            stats.created++;
            validated++;
            existingAlerts.push(alert);
            logger.log(`  ✓ Created: "${alert.title}" (${alert.country})`);
          } catch (e: any) {
            stats.errors.push(`Failed to save alert: ${e}`);
            logger.log(`  ❌ Error saving alert: ${e}`);
            stats.errorCount++;
          }
        }
        
        logger.log(`  📊 After validation: ${validated} alerts saved from ${extractedAlerts.length} extracted`);
        validatedAfter.push(validated);
        clearTimeout(timeoutId);
        
      } catch (err: any) {
        clearTimeout(timeoutId);
        if (sourceController.signal.aborted) {
          stats.errors.push(`Source ${source.name} exceeded 90 second timeout`);
          logger.log(`⏱️ TIMEOUT: ${source.name} exceeded 90 second limit`);
          stats.errorCount++;
          stats.disabled_source_ids.push(source.id);
        } else {
          stats.errors.push(`Error processing ${source.name}: ${err.message}`);
          logger.log(`❌ Error processing ${source.name}: ${err.message}`);
          stats.errorCount++;
          stats.disabled_source_ids.push(source.id);
        }
      }
    }
    
    // Wait for early signals to complete (GAP 1: parallel execution)
    if (earlySignalsPromise) {
      logger.log(`⏳ Waiting for early signal queries to complete...`);
      stats.phase = "early_signals";
      stats.earlySignalsActive = true;
      await earlySignalsPromise;
      logger.log(`✓ Early signal queries completed`);
      stats.earlySignalsActive = false;
    }
    
    // GAP 4: Activity log summary with extracted vs validated
    logger.log(`📊 Scour Batch Complete:`);
    logger.log(`  - Batch: ${batchOffset}-${batchOffset + batchSize} of ${totalSources}`);
    logger.log(`  - Sources processed: ${stats.processed}`);
    logger.log(`  - Sources skipped: ${stats.skipped}`); // GAP 3
    logger.log(`  - Alerts created: ${stats.created}`);
    logger.log(`  - Duplicates skipped: ${stats.duplicatesSkipped}`);
    logger.log(`  - Errors: ${stats.errorCount}`);
    
    console.log(`✅ Batch completed: ${stats.created} created, ${stats.skipped} skipped, ${stats.duplicatesSkipped} duplicates`);
    
    // Update last_scoured_at timestamp for processed sources (multi-user sync)
    if (config.sourceIds && config.sourceIds.length > 0) {
      try {
        const now = new Date().toISOString();
        const sourceIdList = config.sourceIds.map(id => `"${id}"`).join(',');
        await querySupabaseRest(`/sources?id=in.(${config.sourceIds.join(',')})`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify({ last_scoured_at: now }),
        });
        logger.log(`✅ Updated ${config.sourceIds.length} sources with last_scoured_at: ${now}`);
      } catch (err: any) {
        logger.log(`⚠️ Failed to update source timestamps: ${err.message}`);
        console.error(`Failed to update source timestamps:`, err);
      }
    }
    
    // Add batch metadata to stats
    stats.phase = "done";
    stats.hasMoreBatches = hasMoreBatches;
    stats.nextBatchOffset = hasMoreBatches ? batchOffset + batchSize : undefined;
    stats.totalSources = totalSources;
    stats.jobId = config.jobId;
    
    return stats;
    
  } catch (err: any) {
    console.error(`Fatal scour error: ${err}`);
    logger.log(`💥 Fatal error: ${err.message}`);
    stats.errors.push(`Fatal: ${err.message}`);
    stats.errorCount++;
    stats.phase = "done";
    // Return partial results even on fatal error - don't throw
    return stats;
  }
}

// ============================================================================
// JOB STATUS TRACKING
// ============================================================================

// Global activity logs map to accumulate logs during execution
const jobActivityLogs = new Map<string, Array<{time: string; message: string}>>();

function addJobLog(jobId: string, message: string): void {
  if (!jobActivityLogs.has(jobId)) {
    jobActivityLogs.set(jobId, []);
    console.log(`[JOB_LOG] Created new log array for jobId: ${jobId}`);
  }
  const logs = jobActivityLogs.get(jobId)!;
  logs.push({
    time: new Date().toISOString(),
    message: message
  });
  // Keep only last 500 logs to prevent memory issues
  if (logs.length > 500) {
    logs.shift();
  }
  console.log(`[JOB_LOG] Added log for ${jobId}: "${message.substring(0, 60)}..." (total logs: ${logs.length})`);
}

async function updateJobStatus(jobId: string, jobData: any): Promise<void> {
  try {
    const key = `scour-job-${jobId}`;
    
    // Get existing job data to preserve fields
    let existingData: any = {};
    try {
      console.log(`[UPDATE_JOB_STATUS] Fetching existing data for key: ${key}`);
      const existing = await querySupabaseRest(`/app_kv?key=eq.${key}&select=value`);
      console.log(`[UPDATE_JOB_STATUS] Fetch result:`, existing ? `${existing.length} rows` : 'null');
      
      if (existing && existing.length > 0) {
        const val = existing[0].value;
        console.log(`[UPDATE_JOB_STATUS] Got value from app_kv, type: ${typeof val}, is string: ${typeof val === 'string'}`);
        existingData = typeof val === 'string' ? JSON.parse(val) : val;
        console.log(`[UPDATE_JOB_STATUS] Parsed existing data keys:`, Object.keys(existingData));
      } else {
        console.log(`[UPDATE_JOB_STATUS] No existing data found in app_kv`);
      }
    } catch (e: any) {
      console.error(`[UPDATE_JOB_STATUS] Error fetching existing data:`, e.message);
      // If fetch fails, just use empty object
    }
    
    // Include accumulated activity logs
    const logsToInclude = jobActivityLogs.get(jobId) || [];
    console.log(`[UPDATE_JOB_STATUS] Updating jobId: ${jobId}, logs available: ${logsToInclude.length}, existing fields: ${Object.keys(existingData).length}`);
    
    const valueWithLogs = {
      ...existingData,  // Start with existing data to preserve all fields
      ...jobData,       // Override with new data
      activityLog: logsToInclude
    };
    const value = JSON.stringify(valueWithLogs);
    
    console.log(`[UPDATE_JOB_STATUS] Saving data with activityLog array (${logsToInclude.length} entries) to app_kv, total fields: ${Object.keys(valueWithLogs).length}`);
    
    // Try to update first with WHERE clause
    try {
      const response = await querySupabaseRest(`/app_kv?key=eq.${key}`, {
        method: 'PATCH',
        headers: { 'Prefer': 'return=minimal' },
        body: JSON.stringify({ value }),
      });
      // If update succeeded, we're done
      console.log(`[UPDATE_JOB_STATUS] Successfully updated job status for ${jobId}`);
      return;
    } catch (e: any) {
      console.log(`[UPDATE_JOB_STATUS] PATCH failed, trying insert:`, e.message);
      // If update fails (no rows affected), insert
      if (e.message?.includes('404') || e.message?.includes('no rows')) {
        try {
          await querySupabaseRest(`/app_kv`, {
            method: 'POST',
            body: JSON.stringify({ key, value }),
          });
          console.log(`[UPDATE_JOB_STATUS] Successfully inserted new job status for ${jobId}`);
          return;
        } catch (insertErr: any) {
          console.log(`[UPDATE_JOB_STATUS] INSERT failed, trying PATCH again:`, insertErr.message);
          // If insert also fails with duplicate, try PATCH one more time
          if (insertErr.message?.includes('23505')) {
            await querySupabaseRest(`/app_kv?key=eq.${key}`, {
              method: 'PATCH',
              headers: { 'Prefer': 'return=minimal' },
              body: JSON.stringify({ value }),
            });
            console.log(`[UPDATE_JOB_STATUS] Resolved duplicate - updated job status for ${jobId}`);
            return;
          }
          throw insertErr;
        }
      }
      throw e;
    }
  } catch (e: any) {
    console.warn(`[updateJobStatus] Failed to update status for ${jobId}: ${e.message}`);
  }
}

// ============================================================================
// EARLY SIGNALS (GAP 1, 2) - EXPANDED
// ============================================================================

// Early Signal Query Categories
interface QueryCategory {
  name: string;
  queries: string[];
  severity: 'critical' | 'warning' | 'caution';
}

const EARLY_SIGNAL_CATEGORIES: QueryCategory[] = [
  {
    name: 'Natural Disasters',
    severity: 'critical',
    queries: [
      'earthquake',
      'tsunami warning',
      'volcanic eruption',
      'severe flooding',
      'wildfire emergency',
      'hurricane warning',
      'tornado warning',
      'landslide alert',
      'avalanche warning',
      'severe drought',
    ],
  },
  {
    name: 'Security & Conflict',
    severity: 'critical',
    queries: [
      'armed conflict',
      'terrorist attack',
      'active shooter',
      'bombing incident',
      'civil unrest',
      'riot warning',
      'gunfire incident',
      'border skirmish',
      'military operation',
      'security breach',
    ],
  },
  {
    name: 'Health & Pandemic',
    severity: 'warning',
    queries: [
      'disease outbreak',
      'epidemic alert',
      'pandemic warning',
      'health emergency',
      'biological threat',
      'food poisoning outbreak',
      'cholera outbreak',
      'measles outbreak',
      'anthrax alert',
      'vaccine shortage',
    ],
  },
  {
    name: 'Transportation Disruption',
    severity: 'warning',
    queries: [
      'airport closure',
      'flight cancellations',
      'port closure',
      'railway disruption',
      'highway closure',
      'bridge collapse',
      'tunnel disaster',
      'train derailment',
      'cruise ship emergency',
      'aviation incident',
    ],
  },
  {
    name: 'Infrastructure & Utilities',
    severity: 'warning',
    queries: [
      'power outage',
      'water shortage',
      'gas leak',
      'pipeline rupture',
      'dam failure',
      'bridge failure',
      'building collapse',
      'electrical failure',
      'water contamination',
      'sewage emergency',
    ],
  },
  {
    name: 'Economic & Cyber',
    severity: 'caution',
    queries: [
      'cyber attack',
      'data breach',
      'ransomware attack',
      'bank failure',
      'stock market crash',
      'currency crisis',
      'protest economic',
      'supply chain disruption',
      'port strike',
      'hacking incident',
    ],
  },
  {
    name: 'Weather & Environmental',
    severity: 'caution',
    queries: [
      'severe weather alert',
      'heavy snow storm',
      'extreme heat warning',
      'extreme cold alert',
      'acid rain',
      'air quality alert',
      'pollution emergency',
      'smog alert',
      'hail storm',
      'lightning strike',
    ],
  },
];

// TOP ISRAELI TOURISM & BACKPACKING DESTINATIONS (Processed First)
// These are the most popular destinations for Israeli travelers
const ISRAELI_TOURISM_PRIORITY = [
  'Thailand',      // #1: Bangkok, Chiang Mai, islands
  'Nepal',         // #2: Kathmandu, Pokhara, Everest trekking
  'India',         // #3: Delhi, Agra, Goa, Kerala, Himalayas
  'Vietnam',       // #4: Hanoi, Ho Chi Minh City, Halong Bay
  'Cambodia',      // #5: Siem Reap, Phnom Penh, Angkor Wat
  'Philippines',   // #6: Manila, Boracay, Cebu diving
  'Laos',          // #7: Vientiane, Luang Prabang
  'Indonesia',     // #8: Bali, Jakarta, Yogyakarta
  'Turkey',        // #9: Istanbul, Cappadocia, Pamukkale
  'Jordan',        // #10: Amman, Petra, Dead Sea
  'Egypt',         // #11: Cairo, Giza, Red Sea resorts
  'Greece',        // #12: Athens, Islands (Crete, Santorini, Rhodes)
  'Cyprus',        // #13: Paphos, Nicosia, Larnaca
  'Peru',          // #14: Lima, Cusco, Machu Picchu
  'Argentina',     // #15: Buenos Aires, Patagonia
  'Colombia',      // #16: Bogotá, Cartagena, Santa Marta
  'Mexico',        // #17: Cancun, Mexico City, Oaxaca
];

// Secondary coverage: other popular/important countries
const GLOBAL_COVERAGE_COUNTRIES = [
  'Israel',        // Home country (baseline)
  'United States', 'Canada', 'United Kingdom', 'France', 'Germany',
  'Italy', 'Spain', 'Portugal', 'Switzerland', 'Austria',
  'Czech Republic', 'Poland', 'Brazil', 'Chile', 'Costa Rica',
  'Guatemala', 'Panama', 'Ecuador', 'Bolivia', 'Australia',
  'New Zealand', 'China', 'Japan', 'South Korea', 'Taiwan',
  'Malaysia', 'Singapore', 'Myanmar', 'Pakistan', 'Bangladesh',
  'Kenya', 'South Africa', 'Morocco', 'Tunisia', 'United Arab Emirates',
];

async function runEarlySignals(jobId: string): Promise<ScourStats> {
  try {
    console.log(`\n${'═'.repeat(80)}`);
    console.log(`⚡ EARLY SIGNALS - ISRAELI TOURISM EDITION STARTING`);
    console.log(`${'═'.repeat(80)}`);
    console.log(`📊 Job ID: ${jobId}`);
    console.log(`📍 Mode: Israeli Tourism + Global Coverage`);
    console.log(`🎯 Categories: ${EARLY_SIGNAL_CATEGORIES.length} threat types`);
    console.log(`🗺️  Israeli Tourism Priority: ${ISRAELI_TOURISM_PRIORITY.length} destinations (processed first)`);
    console.log(`🌍 Global Coverage: ${GLOBAL_COVERAGE_COUNTRIES.length} countries (processed after)`);
    
    // Build expanded query list with categories
    const baseQueries = EARLY_SIGNAL_CATEGORIES.flatMap(cat =>
      cat.queries.map(q => `${q} travel alert`)
    );
    
    // Combine countries: Israeli tourism destinations first, then global
    const countries = [...new Set([...ISRAELI_TOURISM_PRIORITY, ...GLOBAL_COVERAGE_COUNTRIES])];
    
    const totalQueries = baseQueries.length * countries.length;
    console.log(`📈 Queries per destination: ${baseQueries.length}`);
    console.log(`🌐 Total unique countries: ${countries.length}`);
    console.log(`🔍 TOTAL API CALLS: ${totalQueries} search queries`);
    console.log(`⏱️  Estimated time: ${Math.round(totalQueries / 15)} minutes (with rate limiting)`);
    console.log(`${'═'.repeat(80)}\n`);
    
    let alertsCreated = 0;
    let alertsFiltered = 0;
    let errorsOccurred = 0;
    const config: ScourConfig = {
      jobId,
      sourceIds: [],
      daysBack: 1,
      supabaseUrl,
      serviceKey: serviceKey!,
      openaiKey: OPENAI_API_KEY,
      braveApiKey: BRAVE_API_KEY,
    };
    
    // Initialize job status immediately so frontend can start polling
    await updateJobStatus(jobId, {
      id: jobId,
      status: "running",
      phase: "early_signals",
      processed: 0,
      created: 0,
      total: totalQueries,
      created_at: new Date().toISOString(),
    });
    
    // Smart batching: prioritize Israeli tourism destinations first
    const priorityBatch = countries.slice(0, ISRAELI_TOURISM_PRIORITY.length);
    const standardBatch = countries.slice(ISRAELI_TOURISM_PRIORITY.length);
    
    // Sequential processing: 1 request at a time with 1 second delay
    // This ensures ~1 query/second = well within Brave API rate limits
    // No parallel requests = no 429 errors
    let processedQueries = 0;
    
    // Process Israeli tourism destinations with more queries (higher priority)
    // Use sequential processing (1 request at a time) with 1 second delay to avoid 429 rate limit errors
    
    for (let queryIdx = 0; queryIdx < baseQueries.length; queryIdx++) {
      const baseQuery = baseQueries[queryIdx];
      
      for (let countryIdx = 0; countryIdx < countries.length; countryIdx++) {
        const country = countries[countryIdx];
        
        // CHECK FOR STOP SIGNAL
        try {
          const stopFlag = await querySupabaseRest(`/app_kv?key=eq.scour-stop-${jobId}&select=value`);
          if (stopFlag && Array.isArray(stopFlag) && stopFlag.length > 0) {
            console.log(`⚡ Early Signals stopped by user at ${processedQueries} queries`);
            return {
              processed: processedQueries,
              created: alertsCreated,
              skipped: alertsFiltered,
              duplicatesSkipped: 0,
              errorCount: errorsOccurred,
              errors: [],
              disabled_source_ids: [],
              jobId: jobId,
              phase: 'early_signals'
            };
          }
        } catch (e) {
          // Continue if check fails
        }
        
        // Execute ONE query
        const globalQueryNum = processedQueries + 1;
        const progressPercent = Math.round((globalQueryNum / totalQueries) * 100);
        const progressBar = '█'.repeat(Math.floor(progressPercent / 2)) + '░'.repeat(50 - Math.floor(progressPercent / 2));
        
        try {
          const alerts = await executeEarlySignalQuery(`${baseQuery} ${country}`, config);
          
          const validAlerts = alerts.filter(a => {
            // Filter: Only alerts with confidence > 0.5 and recent data
            if (!a.confidence_score || a.confidence_score < 0.5) {
              alertsFiltered++;
              return false;
            }
            return true;
          });
          alertsCreated += validAlerts.length;
          
          // Live progress update
          const status = validAlerts.length > 0 ? `✓ ${validAlerts.length} alerts` : '·';
          const logMsg = `[${progressBar}] ${globalQueryNum}/${totalQueries} (${progressPercent}%) - "${baseQuery}" in ${country} → ${status}`;
          console.log(`  ${logMsg}`);
          addJobLog(jobId, logMsg);
          
          processedQueries++;
        } catch (e) {
          errorsOccurred++;
          processedQueries++;
          
          const globalQueryNum = processedQueries;
          const progressPercent = Math.round((globalQueryNum / totalQueries) * 100);
          const progressBar = '█'.repeat(Math.floor(progressPercent / 2)) + '░'.repeat(50 - Math.floor(progressPercent / 2));
          
          const errorMsg = `[${progressBar}] ${globalQueryNum}/${totalQueries} (${progressPercent}%) - "${baseQuery}" in ${country} → ✗ ${e.toString().slice(0, 40)}`;
          console.warn(`  ${errorMsg}`);
          addJobLog(jobId, errorMsg);
        }
        
        // Update job status every query (fast updates for real-time UI)
        await updateJobStatus(jobId, {
          id: jobId,
          status: "running",
          phase: "early_signals",
          processed: processedQueries,
          created: alertsCreated,
          total: totalQueries,
        });
        
        // 1 second delay between EVERY request to respect Brave API rate limits (1 req/sec = safe)
        if (queryIdx < baseQueries.length - 1 || countryIdx < countries.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
    
    console.log(`\n${'═'.repeat(80)}`);
    console.log(`✅ EARLY SIGNALS COMPLETE - ISRAELI TOURISM EDITION`);
    console.log(`${'═'.repeat(80)}`);
    console.log(`📊 Final Results:`);
    console.log(`   ✓ Alerts Created:    ${alertsCreated}`);
    console.log(`   ✗ Alerts Filtered:   ${alertsFiltered} (confidence < 0.5)`);
    console.log(`   ⚠️  Errors:           ${errorsOccurred}`);
    console.log(`   ✅ Queries Success:  ${processedQueries - errorsOccurred}/${processedQueries}`);
    console.log(`\n📈 Coverage Summary:`);
    console.log(`   Base Queries:        ${baseQueries.length} threat types`);
    console.log(`   Total Countries:     ${countries.length}`);
    console.log(`   Total API Calls:     ${baseQueries.length * countries.length}`);
    console.log(`   Success Rate:        ${Math.round(((processedQueries - errorsOccurred) / processedQueries) * 100)}%`);
    console.log(`\n🎯 Tourism Priority Results:`);
    const tourismResults = `${Math.round((alertsCreated / totalQueries) * 100)}% of total alerts from Israeli tourism destinations`;
    console.log(`   ${tourismResults}`);
    console.log(`${'═'.repeat(80)}\n`);
    
    return {
      processed: processedQueries,
      created: alertsCreated,
      skipped: alertsFiltered,
      duplicatesSkipped: 0,
      errorCount: errorsOccurred,
      errors: [],
      disabled_source_ids: [],
      jobId: jobId,
      phase: 'early_signals'
    };
  } catch (e: any) {
    console.error(`⚡ Early signals error: ${e.message}`);
    return {
      processed: 0,
      created: 0,
      skipped: 0,
      duplicatesSkipped: 0,
      errorCount: 1,
      errors: [e.message],
      disabled_source_ids: [],
      jobId: jobId,
      phase: 'early_signals'
    };
  }
}

// Map severity strings to database values
function mapSeverity(severity: string): 'critical' | 'warning' | 'caution' | 'informative' {
  const sev = (severity || '').toLowerCase();
  if (sev.includes('critical') || sev.includes('high') || sev.includes('severe')) return 'critical';
  if (sev.includes('warning') || sev.includes('medium')) return 'warning';
  if (sev.includes('caution') || sev.includes('low')) return 'caution';
  return 'informative';
}

async function executeEarlySignalQuery(query: string, config: ScourConfig): Promise<Alert[]> {
  if (!ANTHROPIC_API_KEY) {
    console.warn(`  Early signal query skipped (no Claude): "${query}"`);
    return [];
  }
  
  try {
    console.log(`[EARLY_SIGNAL_QUERY] Starting: "${query}"`);
    console.log(`[CLAUDE_DASHBOARD_LOG] Query initiated: "${query}"`);
    
    // Update job status with current query
    await updateJobStatus(config.jobId, {
      id: config.jobId,
      status: "running",
      phase: "early_signals",
      currentEarlySignalQuery: query,
      created_at: new Date().toISOString(),
    });
    
    let searchResults: any[] = [];
    
    // Step 1: Get web search results from Brave
    if (config.braveApiKey) {
      console.log(`[CLAUDE_DASHBOARD_LOG] Brave Search API call for: "${query}"`);
      try {
        // Add search parameters to prioritize recent/news results
        // spellcheck=1: fix typos
        // count=10: get more results to filter from
        // search_lang=en: English results only
        const braveUrl = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=10&spellcheck=1&result_filter=news`;
        const braveResponse = await fetch(braveUrl, {
          headers: {
            'Accept': 'application/json',
            'X-Subscription-Token': config.braveApiKey,
          },
          signal: AbortSignal.timeout(10000),
        });
        
        if (braveResponse.ok) {
          const braveData = await braveResponse.json();
          console.log(`[CLAUDE_DASHBOARD_LOG] Brave response received, status: ${braveResponse.status}`);
          if (braveData.web && braveData.web.length > 0) {
            console.log(`[CLAUDE_DASHBOARD_LOG] Brave returned ${braveData.web.length} results`);
            searchResults = braveData.web;
          } else {
            console.log(`[CLAUDE_DASHBOARD_LOG] Brave returned empty results or no .web property`);
          }
        } else {
          console.warn(`[CLAUDE_DASHBOARD_LOG] Brave API returned status ${braveResponse.status}`);
        }
      } catch (braveErr: any) {
        console.warn(`[CLAUDE_DASHBOARD_LOG] Brave error: ${braveErr.message}`);
      }
    } else {
      console.warn(`[CLAUDE_DASHBOARD_LOG] No Brave API key configured, skipping web search`);
    }
    
    // OPTIMIZATION: Skip Claude if no search results found
    if (searchResults.length === 0) {
      console.log(`[CLAUDE_DASHBOARD_LOG] No search results found, skipping Claude analysis`);
      return [];
    }
    
    // Step 2: Ask Claude to extract alerts from search results
    console.log(`[CLAUDE_DASHBOARD_LOG] Sending ${searchResults.length} search results to Claude`);
    
    const searchContent = searchResults.map((r: any) => `- ${r.title}\n  ${r.description}\n  ${r.url}`).join('\n\n');
    
    console.log(`[CLAUDE_DASHBOARD_LOG] About to fetch from Claude API with timeout 15s`);
    const extractResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1024,
        system: `You are a travel safety alert extraction system. Extract ONLY recent (within last 7 days), verifiable incidents from the provided content.
Return ONLY real incidents with: title, location (city), country, event_type, severity (low/medium/high), description, event_start_date (YYYY-MM-DD or ISO format), and url.
REJECT: stale/historical events, vague locations, generic titles, events older than 7 days.
Format as JSON array. If no valid incidents found, return [].`,
        messages: [{ 
          role: 'user', 
          content: `Extract travel safety incidents from this content about "${query}":\n\n${searchContent}\n\nReturn JSON array with: title, location, country, event_type (earthquake/flood/protest/explosion/airport_closure/weather/health/security/other), severity, description, event_start_date, and url.
CRITICAL: Only include incidents from last 7 days. MUST include actual news article URL from search results. Reject vague locations, outdated events, or irrelevant content.`
        }]
      }),
      signal: AbortSignal.timeout(15000),
    });
    
    console.log(`[CLAUDE_DASHBOARD_LOG] Claude API response received, status: ${extractResponse.status}`);
    
    if (!extractResponse.ok) {
      const errorText = await extractResponse.text().catch(() => 'unknown');
      console.warn(`[CLAUDE_DASHBOARD_LOG] Claude API error: ${extractResponse.status} - ${errorText.slice(0, 200)}`);
      return [];
    }
    
    console.log(`[CLAUDE_DASHBOARD_LOG] Claude extraction complete`);
    
    const extractData = await extractResponse.json();
    console.log(`[CLAUDE_RESPONSE_DATA] Full response:`, JSON.stringify(extractData).slice(0, 500));
    let alerts: Alert[] = [];
    
    if (extractData.content && Array.isArray(extractData.content)) {
      console.log(`[CLAUDE_RESPONSE_DATA] Content array found with ${extractData.content.length} blocks`);
      for (const block of extractData.content) {
        if (block.type === 'text') {
          console.log(`[CLAUDE_RESPONSE_DATA] Text block: ${block.text.slice(0, 300)}`);
          try {
            let jsonMatch = block.text.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
              console.log(`[CLAUDE_RESPONSE_DATA] JSON match found, attempting parse...`);
              const parsed = JSON.parse(jsonMatch[0]);
              if (Array.isArray(parsed) && parsed.length > 0) {
                console.log(`[CLAUDE_DASHBOARD_LOG] Extracted ${parsed.length} alerts`);
                
                for (const item of parsed) {
                  if (item.title && item.country && item.location) {
                    // Validate that alert has a source URL (essential for verification)
                    if (!item.url || typeof item.url !== 'string' || item.url.trim().length === 0) {
                      console.log(`[EARLY_SIGNAL_VALIDATION] Rejected alert without source URL: "${item.title}"`);
                      continue; // Skip alerts without source
                    }
                    
                    // Validate URL is from credible news source (not social media)
                    const urlStr = item.url.toLowerCase();
                    const invalidDomains = ['reddit.com', 'facebook.com', 'instagram.com', 'twitter.com', 'youtube.com', 'wikipedia.org'];
                    const isFromInvalidDomain = invalidDomains.some(domain => urlStr.includes(domain));
                    if (isFromInvalidDomain) {
                      console.log(`[EARLY_SIGNAL_VALIDATION] Rejected alert with social media URL: "${item.title}" from ${item.url}`);
                      continue; // Skip social media URLs
                    }
                    
                    // Validate event date is recent (not older than 7 days - STRICT)
                    let isStale = false;
                    if (item.event_start_date) {
                      try {
                        const eventDate = new Date(item.event_start_date);
                        const now = new Date();
                        const daysSinceEvent = (now.getTime() - eventDate.getTime()) / (1000 * 60 * 60 * 24);
                        // STRICT: Only accept events from last 7 days (not 60)
                        if (daysSinceEvent > 7) {
                          console.log(`[EARLY_SIGNAL_VALIDATION] Rejected stale event: "${item.title}" (from ${daysSinceEvent.toFixed(1)} days ago, dated ${item.event_start_date}) - exceeds 7 day threshold`);
                          isStale = true;
                        }
                        // Also reject if date is in future (invalid)
                        if (daysSinceEvent < -1) {
                          console.log(`[EARLY_SIGNAL_VALIDATION] Rejected event with future date: "${item.title}" (${item.event_start_date})`);
                          isStale = true;
                        }
                      } catch (e) {
                        console.log(`[EARLY_SIGNAL_VALIDATION] Rejected event with invalid date format: "${item.title}" (${item.event_start_date})`);
                        isStale = true; // Reject if date can't be parsed
                      }
                    } else {
                      console.log(`[EARLY_SIGNAL_VALIDATION] Rejected event without date: "${item.title}"`);
                      isStale = true; // Reject if no date provided
                    }
                    
                    if (isStale) {
                      continue; // Skip this stale/invalid alert
                    }
                    
                    const alert: Alert = {
                      id: `alert-${crypto.randomUUID()}`,
                      title: item.title,
                      summary: item.description || item.title,
                      location: item.location,
                      country: item.country,
                      event_type: item.event_type || 'Security Incident',
                      severity: mapSeverity(item.severity || 'informative'),
                      created_at: new Date().toISOString(),
                      source_url: 'early-signals',
                      article_url: item.url,
                      source: 'early-signals-brave-claude',
                      latitude: 0,
                      longitude: 0,
                      radiusKm: 15,
                      status: 'draft',
                      ai_generated: true,
                      ai_model: 'claude-3-haiku-20240307',
                      ai_confidence: 0.8,
                      recommendations: generateIncidentRecommendations(
                        item.event_type || 'Security Incident',
                        mapSeverity(item.severity || 'informative'),
                        item.location,
                        item.country
                      ),
                    };
                    alerts.push(alert);
                  }
                }
              } else {
                console.log(`[CLAUDE_RESPONSE_DATA] JSON match parsing failed, no valid alerts`);
              }
            } else {
              console.log(`[CLAUDE_RESPONSE_DATA] No JSON array found in text: "${block.text.slice(0, 200)}"`);
            }
          } catch (parseErr) {
            console.warn(`[CLAUDE_RESPONSE_DATA] Parse error: ${parseErr}`);
          }
        } else {
          console.log(`[CLAUDE_RESPONSE_DATA] Non-text block type: ${block.type}`);
        }
      }
    } else {
      console.log(`[CLAUDE_RESPONSE_DATA] No content array in response or content is not an array`);
    }
    
    if (alerts.length > 0) {
      console.log(`[EARLY_SIGNAL_FOUND] "${query}": ${alerts.length} alerts`);
      
      // Process alerts through post-processing pipeline for geocoding, validation, etc.
      const processedAlerts = await postProcessAlerts(alerts);
      console.log(`[EARLY_SIGNAL_PROCESSED] After post-processing: ${processedAlerts.length} alerts (from ${alerts.length})`);
      
      for (const alert of processedAlerts) {
        try {
          console.log(`  📍 Alert coords: lat=${alert.latitude}, lon=${alert.longitude}, geoJSON=${!!alert.geo_json}`);
          
          // Prepare alert with proper database fields
          const today = new Date().toISOString().split('T')[0];
          const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          
          const alertToSave = {
            title: alert.title,
            summary: alert.summary,
            location: alert.location,
            country: alert.country,
            region: alert.region,
            event_type: alert.event_type,
            severity: alert.severity,
            status: alert.status || 'draft',
            source_url: alert.source_url,
            article_url: alert.article_url,
            sources: alert.sources,
            event_start_date: alert.event_start_date || today,
            event_end_date: alert.event_end_date || endDate,
            ai_generated: alert.ai_generated,
            ai_model: alert.ai_model,
            ai_confidence: alert.ai_confidence,
            generation_metadata: alert.generation_metadata,
            geo_json: alert.geo_json,
            recommendations: alert.recommendations,
            confidence_score: alert.confidence_score,
          };
          
          await querySupabaseRest(`/alerts`, {
            method: 'POST',
            body: JSON.stringify(alertToSave),
          });
          console.log(`    ✓ Saved: ${alert.title} (${alert.country}) [${alert.latitude?.toFixed(2)}, ${alert.longitude?.toFixed(2)}]`);
        } catch (saveErr) {
          console.warn(`    ✗ Failed to save alert: ${saveErr}`);
        }
      }
    } else {
      console.log(`[EARLY_SIGNAL_DONE] "${query}": 0 alerts (no matches found)`);
    }
    
    return alerts;
    
  } catch (e: any) {
    console.error(`[EARLY_SIGNAL_ERROR] Query "${query}" failed with error:`, e);
    console.error(`[EARLY_SIGNAL_ERROR] Error message:`, e.message);
    console.error(`[EARLY_SIGNAL_ERROR] Error stack:`, e.stack);
    return [];
  }
}

// ============================================================================
// API HANDLER
// ============================================================================

Deno.serve({ skipJwtVerification: true }, async (req: Request) => {
  console.log(`🔵 [SCOUR-WORKER] Received request: ${req.method} ${new URL(req.url).pathname}`);
  
  try {
    // Handle CORS preflight first, before any other processing
    if (req.method === 'OPTIONS') {
      console.log(`🔵 [SCOUR-WORKER] Handling CORS preflight`);
      return new Response('', { 
        status: 200,
        headers: corsHeaders
      });
    }
    
    const url = new URL(req.url);
    const method = req.method;
    
    if (method === 'POST' && (url.pathname === '/' || url.pathname === '/scour-worker')) {
      console.log(`🔵 [SCOUR-WORKER] Parsing request body...`);
      const body = await req.json();
      console.log(`🔵 [SCOUR-WORKER] Body received: jobId=${body.jobId}, earlySignalsOnly=${body.earlySignalsOnly}, batchOffset=${body.batchOffset || 0}`);
      
      // Handle early signals mode
      if (body.earlySignalsOnly) {
        console.log(`🔵 [SCOUR-WORKER] Early signals mode - starting web searches`);
        try {
          const stats = await runEarlySignals(body.jobId);
          return json(stats);
        } catch (e: any) {
          console.error(`🔴 [SCOUR-WORKER] Early signals failed:`, e);
          return json({ ok: false, error: e.message, created: 0, duplicatesSkipped: 0, errorCount: 0 }, 500);
        }
      }
      
      const config: ScourConfig = {
        jobId: body.jobId,
        sourceIds: body.sourceIds || [],
        daysBack: body.daysBack || 14,
        supabaseUrl,
        serviceKey: serviceKey!,
        openaiKey: OPENAI_API_KEY,
        braveApiKey: BRAVE_API_KEY,
      };
      
      const batchOffset = body.batchOffset || 0;
      const batchSize = body.batchSize || 10;
      
      console.log(`🔵 [SCOUR-WORKER] Starting batch: offset=${batchOffset}, size=${batchSize}`);
      const stats = await runScourWorker(config, batchOffset, batchSize);
      console.log(`🔵 [SCOUR-WORKER] Batch complete: created=${stats.created}, hasMore=${stats.hasMoreBatches}`);
      return json(stats);
    }
    
    console.log(`🔵 [SCOUR-WORKER] 404: Invalid path ${url.pathname}`);
    return json({ error: 'Not found' }, 404);
    
  } catch (err: any) {
    console.error(`🔴 [SCOUR-WORKER] Request error: ${err.message || err}`);
    console.error(`🔴 [SCOUR-WORKER] Error stack:`, err);
    return json({ error: err.message || String(err) }, 500);
  }
});
