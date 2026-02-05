import { useScour } from "./ScourContext";
import React, { useEffect, useState } from "react";
import GeoJsonPreview from "./GeoJsonPreview";
import GeoJSONGeneratorModal from "./GeoJSONGeneratorModal";
import MAGNUS_COLORS from "../styles/magnus-colors";
import ScourManagementInline from "./ScourManagementInline";


// =========================
// Types
// =========================

export type PermissionSet = {
  canReview: boolean;
  canScour: boolean;
  canApproveAndPost: boolean;
  canDismiss: boolean;
  canDelete: boolean;
  canEditAlerts: boolean;
};

export interface Alert {
  id: string;
  title: string;
  summary: string;
  description?: string;
  recommendations?: string;
  location: string;
  country: string;
  region?: string;
  mainland?: string;
  intelligence_topics?: string;
  event_type?: string;
  severity: "critical" | "warning" | "caution" | "informative";
  status: string;
  latitude?: string;
  longitude?: string;
  radius?: number | null;
  source_url?: string;
  article_url?: string;
  sources?: any;
  event_start_date?: string;
  event_end_date?: string;
  geo_json?: any;
  geojson?: any;
  ai_generated?: boolean;
  confidence_score?: number;  // Factal-style confidence (0.0-1.0)
  source_query_used?: string;
  created_at: string;
}

import { getApiUrl } from "../lib/supabase/api";

/* =========================
  Config
========================= */

const API_BASE = getApiUrl("");

const MAINLAND_OPTIONS = [
  "",
  "Africa",
  "Antarctica",
  "Asia",
  "Europe",
  "North America",
  "Australia (Oceania)",
  "South America",
];

const INTELLIGENCE_TOPIC_OPTIONS = [
  "",
  "Armed Conflict", "Air Incidents", "Air Raid Sirens", "Avalanches", "Bomb Threats",
  "Building Collapses", "Chemical Weapons", "Coronavirus", "Drought", "Earthquakes",
  "Elections", "Evacuations", "Explosions", "Fires", "Floods", "Health", "Heat Waves",
  "Internet Outages", "Kidnappings", "Landslides", "Lockdowns", "Nuclear Weapons",
  "Outbreaks", "Police Shootings", "Power Outages", "Protests", "Civil Unrest",
  "Rail Incidents", "Road Incidents", "Robberies", "Shootings", "Stabbings",
  "Strike Actions", "Suspicious Packages", "Terrorism", "Traffic", "Transportation Incidents",
  "Tornadoes", "Tropical Cyclones", "Tsunamis", "Volcanoes", "Wildland Fires",
  "Water Quality", "Winter Storms", "Severe Weather", "Security", "Safety",
  "Flight Disruptions", "Gas Leaks", "Pro-Palestinian Protest",
];

// Helper function to map country to mainland
function getMainlandFromCountry(country?: string): string {
  if (!country) return "";
  
  const countryToMainland: Record<string, string> = {
    // Africa
    "Algeria": "Africa", "Angola": "Africa", "Benin": "Africa", "Botswana": "Africa", "Burkina Faso": "Africa",
    "Burundi": "Africa", "Cameroon": "Africa", "Cape Verde": "Africa", "Central African Republic": "Africa", "Chad": "Africa",
    "Comoros": "Africa", "Congo": "Africa", "Democratic Republic of Congo": "Africa", "Djibouti": "Africa", "Egypt": "Africa",
    "Equatorial Guinea": "Africa", "Eritrea": "Africa", "Ethiopia": "Africa", "Gabon": "Africa", "Gambia": "Africa",
    "Ghana": "Africa", "Guinea": "Africa", "Guinea-Bissau": "Africa", "Ivory Coast": "Africa", "Kenya": "Africa",
    "Lesotho": "Africa", "Liberia": "Africa", "Libya": "Africa", "Madagascar": "Africa", "Malawi": "Africa",
    "Mali": "Africa", "Mauritania": "Africa", "Mauritius": "Africa", "Morocco": "Africa", "Mozambique": "Africa",
    "Namibia": "Africa", "Niger": "Africa", "Nigeria": "Africa", "Rwanda": "Africa", "Sao Tome and Principe": "Africa",
    "Senegal": "Africa", "Seychelles": "Africa", "Sierra Leone": "Africa", "Somalia": "Africa", "South Africa": "Africa",
    "South Sudan": "Africa", "Sudan": "Africa", "Tanzania": "Africa", "Togo": "Africa", "Tunisia": "Africa",
    "Uganda": "Africa", "Zambia": "Africa", "Zimbabwe": "Africa",
    
    // Asia
    "Afghanistan": "Asia", "Armenia": "Asia", "Azerbaijan": "Asia", "Bahrain": "Asia", "Bangladesh": "Asia",
    "Bhutan": "Asia", "Brunei": "Asia", "Cambodia": "Asia", "China": "Asia", "Cyprus": "Asia",
    "Georgia": "Asia", "Hong Kong": "Asia", "India": "Asia", "Indonesia": "Asia", "Iran": "Asia",
    "Iraq": "Asia", "Israel": "Asia", "Japan": "Asia", "Jordan": "Asia", "Kazakhstan": "Asia",
    "North Korea": "Asia", "South Korea": "Asia", "Kuwait": "Asia", "Kyrgyzstan": "Asia", "Laos": "Asia",
    "Lebanon": "Asia", "Malaysia": "Asia", "Maldives": "Asia", "Mongolia": "Asia", "Myanmar": "Asia",
    "Nepal": "Asia", "Oman": "Asia", "Pakistan": "Asia", "Palestine": "Asia", "Philippines": "Asia",
    "Qatar": "Asia", "Saudi Arabia": "Asia", "Singapore": "Asia", "Sri Lanka": "Asia", "Syria": "Asia",
    "Taiwan": "Asia", "Tajikistan": "Asia", "Thailand": "Asia", "East Timor": "Asia", "Turkey": "Asia",
    "Turkmenistan": "Asia", "United Arab Emirates": "Asia", "Uzbekistan": "Asia", "Vietnam": "Asia",
    "Yemen": "Asia",
    
    // Europe
    "Albania": "Europe", "Andorra": "Europe", "Austria": "Europe", "Belarus": "Europe", "Belgium": "Europe",
    "Bosnia and Herzegovina": "Europe", "Bulgaria": "Europe", "Croatia": "Europe", "Czech Republic": "Europe", "Czechia": "Europe",
    "Denmark": "Europe", "Estonia": "Europe", "Finland": "Europe", "France": "Europe", "Germany": "Europe",
    "Greece": "Europe", "Hungary": "Europe", "Iceland": "Europe", "Ireland": "Europe", "Italy": "Europe",
    "Kosovo": "Europe", "Latvia": "Europe", "Liechtenstein": "Europe", "Lithuania": "Europe", "Luxembourg": "Europe",
    "Malta": "Europe", "Moldova": "Europe", "Monaco": "Europe", "Montenegro": "Europe", "Netherlands": "Europe",
    "Norway": "Europe", "Poland": "Europe", "Portugal": "Europe", "Romania": "Europe", "Russia": "Europe",
    "San Marino": "Europe", "Serbia": "Europe", "Slovakia": "Europe", "Slovenia": "Europe", "Spain": "Europe",
    "Sweden": "Europe", "Switzerland": "Europe", "Ukraine": "Europe", "United Kingdom": "Europe",
    
    // North America
    "Antigua and Barbuda": "North America", "Bahamas": "North America", "Barbados": "North America", "Belize": "North America",
    "Canada": "North America", "Costa Rica": "North America", "Cuba": "North America", "Dominica": "North America",
    "Dominican Republic": "North America", "El Salvador": "North America", "Grenada": "North America", "Guatemala": "North America",
    "Haiti": "North America", "Honduras": "North America", "Jamaica": "North America", "Mexico": "North America",
    "Nicaragua": "North America", "Panama": "North America", "Saint Kitts and Nevis": "North America",
    "Saint Lucia": "North America", "Saint Vincent and the Grenadines": "North America", "Trinidad and Tobago": "North America",
    "United States": "North America", "USA": "North America",
    
    // South America
    "Argentina": "South America", "Bolivia": "South America", "Brazil": "South America", "Chile": "South America",
    "Colombia": "South America", "Ecuador": "South America", "Guyana": "South America", "Paraguay": "South America",
    "Peru": "South America", "Suriname": "South America", "Uruguay": "South America", "Venezuela": "South America",
    
    // Oceania / Australia
    "Australia": "Australia (Oceania)", "Fiji": "Australia (Oceania)", "Kiribati": "Australia (Oceania)",
    "Marshall Islands": "Australia (Oceania)", "Micronesia": "Australia (Oceania)", "Nauru": "Australia (Oceania)",
    "New Zealand": "Australia (Oceania)", "Palau": "Australia (Oceania)", "Papua New Guinea": "Australia (Oceania)",
    "Samoa": "Australia (Oceania)", "Solomon Islands": "Australia (Oceania)", "Tonga": "Australia (Oceania)",
    "Tuvalu": "Australia (Oceania)", "Vanuatu": "Australia (Oceania)",
  };
  
  return countryToMainland[country] || "";
}

const SEVERITY_META: Record<
  Alert["severity"],
  { emoji: string; label: string; color: string; bgColor?: string }
> = {
  critical: { emoji: "", label: "CRITICAL", color: "text-white px-3 py-1 rounded-full font-semibold", bgColor: MAGNUS_COLORS.critical },
  warning: { emoji: "", label: "WARNING", color: "text-white px-3 py-1 rounded-full font-semibold", bgColor: MAGNUS_COLORS.warning },
  caution: { emoji: "", label: "CAUTION", color: "text-white px-3 py-1 rounded-full font-semibold", bgColor: MAGNUS_COLORS.caution },
  informative: { emoji: "", label: "INFO", color: "text-white px-3 py-1 rounded-full font-semibold", bgColor: MAGNUS_COLORS.informative },
};

function formatEventTime(a: Alert) {
  if (!a.event_start_date) return "Date not specified";
  
  const start = new Date(a.event_start_date);
  const formatted = start.toLocaleString('en-US', { 
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
  
  return formatted;
}

function formatDateRange(a: Alert) {
  // Format event dates
  const start = a.event_start_date || "";
  const end = a.event_end_date || "";

  if (start && end) {
    return `${new Date(start).toLocaleDateString()} - ${new Date(end).toLocaleDateString()}`;
  } else if (start) {
    return `From ${new Date(start).toLocaleDateString()}`;
  } else if (end) {
    return `Until ${new Date(end).toLocaleDateString()}`;
  }
  return "No dates specified";
}

// Confidence Score Badge Component (Factal-style)
function ConfidenceBadge({ score }: { score: number }) {
  let category: string;
  let bgColor: string;
  let textColor: string;
  let emoji: string;

  if (score < 0.4) {
    category = "Noise";
    bgColor = "#f3f4f6"; // light gray
    textColor = "#6b7280"; // dark gray
    emoji = "❌";
  } else if (score < 0.6) {
    category = "Early Signal";
    bgColor = "#fef3c7"; // light amber
    textColor = "#92400e"; // dark amber
    emoji = "🔶";
  } else if (score < 0.7) {
    category = "Review";
    bgColor = "#dbeafe"; // light blue
    textColor = "#1e40af"; // dark blue
    emoji = "👁️";
  } else if (score < 0.85) {
    category = "Publish";
    bgColor = "#dcfce7"; // light green
    textColor = "#166534"; // dark green
    emoji = "✓";
  } else {
    category = "Verified";
    bgColor = "#86efac"; // bright green
    textColor = "#15803d"; // darker green
    emoji = "✅";
  }

  return (
    <span
      className="text-xs font-semibold px-2 py-1 rounded whitespace-nowrap"
      style={{ backgroundColor: bgColor, color: textColor }}
      title={`Confidence: ${(score * 100).toFixed(1)}%`}
    >
      {emoji} {(score * 100).toFixed(0)}% {category}
    </span>
  );
}

// Normalize recommendations to a clean string list regardless of storage format (array, JSON string, CSV, or free text)
function normalizeRecommendations(raw?: string | string[] | null): string[] {
  if (!raw) return [];

  // If already an array, normalize items
  if (Array.isArray(raw)) {
    return raw
      .map((item) => (typeof item === "string" ? item : String(item || "")).trim())
      .filter(Boolean);
  }

  const text = raw.trim();
  if (!text) return [];

  // Try JSON arrays first
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => (typeof item === "string" ? item : String(item || "")).trim())
        .filter(Boolean);
    }
    if (Array.isArray((parsed as any)?.recommendations)) {
      return (parsed as any).recommendations
        .map((item: any) => (typeof item === "string" ? item : String(item || "")).trim())
        .filter(Boolean);
    }
  } catch {
    // not JSON
  }

  // Split on newlines or commas
  const fromLines = text
    .split(/\r?\n|,/)
    .map((line) => line.replace(/^[-*\d\.\)\s]+/, "").trim())
    .filter(Boolean);
  if (fromLines.length > 1) return fromLines;

  // Fallback: try to extract numbered segments like "1. foo 2. bar"
  const numbered: string[] = [];
  const regex = /(\d+[\.\)]\s*)([^\d]+)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const item = (match[2] || "").trim();
    if (item) numbered.push(item);
  }
  if (numbered.length > 0) return numbered;

  // Last resort: single item
  return [text];
}

function parseGeoJsonValue(value: any): any | null {
  if (!value) return null;
  if (typeof value === "object") return value;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  return null;
}

function normalizeSources(raw: any): { url?: string; title?: string }[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as any[];
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

// Helper to check if alert is within acceptable age window
function isAlertWithinTimeWindow(alert: Alert): boolean {
  const now = new Date();
  const createdAt = new Date(alert.created_at);
  
  // Check if alert is from the last 14 days
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  if (createdAt >= fourteenDaysAgo) {
    return true;
  }
  
  // Check if it's related to an ongoing event (event_end_date is in future)
  if (alert.event_end_date) {
    const eventEndDate = new Date(alert.event_end_date);
    if (eventEndDate > now) {
      // Event is ongoing, check if created within last 30 days
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return createdAt >= thirtyDaysAgo;
    }
  }
  
  return false;
}

function trimOrNull(value: any): string | null {
  const t = typeof value === "string" ? value.trim() : String(value ?? "").trim();
  return t ? t : null;
}

function numberOrNull(value: any): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function whatsappTemplate(a: Alert) {
  const s = SEVERITY_META[a.severity];
  const topic = (a.intelligence_topics || a.event_type || "Security").trim();
  const sourceItems = normalizeSources(a.sources);
  const sources = a.article_url || a.source_url || sourceItems.map((x) => x.url || x.title || "").filter(Boolean).join("\n");
  const recs = normalizeRecommendations(a.recommendations);
  const recBlock = recs.length
    ? `*Recommended Actions:*\n${recs.map((r, i) => `${i + 1}. ${r}`).join("\n")}\n\n`
    : "";

  return `🚨 *TRAVEL ALERT* 🚨

*Location:* ${a.location}, ${a.country}
*Severity:* ${s.label}
${a.region ? `*Region:* ${a.region}\n` : ''}*Event Type:* ${topic}
*Timeline:* ${formatDateRange(a)}

*Details:*
${a.summary}

${recBlock}*Sources:*
${sources || "Internal Intelligence"}`.trim();
}

/* =========================
   Component
========================= */

type Props = {
  permissions: PermissionSet;
  accessToken: string;
};

export default function AlertReviewQueueInline({ permissions, accessToken }: Props) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<Record<string, Partial<Alert>>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingRecommendationsId, setEditingRecommendationsId] = useState<string | null>(null);
  const [editRecommendations, setEditRecommendations] = useState("");
  const [editingGeoJsonId, setEditingGeoJsonId] = useState<string | null>(null);
  const [editGeoJson, setEditGeoJson] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showGeoModal, setShowGeoModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);
  const [pollingPaused, setPollingPaused] = useState(false);

  const { startScour, isScouring } = useScour() as any;

  useEffect(() => {
    if (!permissions.canReview) return;
    
    // Load immediately
    void loadAlerts();
    
    // Then poll every 3 seconds for new alerts during active session (unless paused)
    const interval = setInterval(() => {
      if (!pollingPaused) {
        loadAlerts().catch(e => console.warn('Alert poll failed:', e));
      }
    }, 3000);
    
    return () => clearInterval(interval);
  }, [permissions.canReview, pollingPaused]);

  async function loadAlerts() {
    try {
      setLoading(false); // Don't show loading spinner on refresh, only on initial load
      setError(null);
      const res = await fetch(`${API_BASE}/alerts/review`);
      if (!res.ok) {
        // Try to read error message from response body
        try {
          const errorData = await res.json();
          throw new Error(errorData?.error || `Failed to load alerts (${res.status})`);
        } catch {
          throw new Error(`Failed to load alerts (${res.status})`);
        }
      }
      const data = await res.json();
      
      // Filter alerts to only show those from last 14 days (or 30 days if ongoing event)
      const filteredAlerts = Array.isArray(data.alerts) 
        ? data.alerts.filter(isAlertWithinTimeWindow)
        : [];
      
      console.log(`[LOAD_ALERTS] Got ${data.alerts?.length || 0} alerts from server, ${filteredAlerts.length} within time window`);
      setAlerts(filteredAlerts);
    } catch (e: any) {
      setError(e?.message || "Failed to load alerts");
    }
  }

  function buildPatchFromDraft(draft: Partial<Alert>): Record<string, any> {
    const patch: Record<string, any> = {};

    const textFields: (keyof Alert)[] = [
      "title",
      "summary",
      "description",
      "location",
      "country",
      "region",
      "event_type",
      "intelligence_topics",
      "mainland",
      "recommendations",
    ];

    textFields.forEach((key) => {
      if (draft[key] !== undefined) {
        const cleaned = trimOrNull(draft[key]);
        patch[key] = cleaned;
      }
    });

    if (draft.latitude !== undefined) patch.latitude = trimOrNull(draft.latitude);
    if (draft.longitude !== undefined) patch.longitude = trimOrNull(draft.longitude);
    if (draft.radius !== undefined) patch.radius = numberOrNull(draft.radius);
    if (draft.event_start_date !== undefined) patch.event_start_date = draft.event_start_date || null;
    if (draft.event_end_date !== undefined) patch.event_end_date = draft.event_end_date || null;
    if (draft.sources !== undefined) patch.sources = draft.sources;

    return patch;
  }

  function startEdit(a: Alert) {
    setEditing((e) => ({ ...e, [a.id]: true }));
    
    // Set defaults for mainland and intelligence_topics based on alert
    const defaults: Partial<Alert> = { ...a };
    
    // Auto-populate mainland from country if not already set
    if (!defaults.mainland && defaults.country) {
      defaults.mainland = getMainlandFromCountry(defaults.country);
    }
    
    // Auto-populate intelligence_topics from event_type if not already set
    if (!defaults.intelligence_topics && defaults.event_type) {
      defaults.intelligence_topics = defaults.event_type;
    }
    
    setDrafts((ds) => ({ ...ds, [a.id]: defaults }));
  }

  function cancelEdit(id: string) {
    setEditing((e) => ({ ...e, [id]: false }));
  }

  async function saveEdit(id: string) {
    const patch = drafts[id];
    if (!patch) return;

    const cleaned = buildPatchFromDraft(patch);

    try {
      const res = await fetch(`${API_BASE}/alerts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cleaned),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || `Failed to save alert ${id}`);
      }
    } catch (err: any) {
      alert(`Save failed: ${err?.message || err}`);
      return;
    }

    setAlerts((a) => a.map((x) => (x.id === id ? { ...x, ...cleaned } : x)));
    setEditing((e) => ({ ...e, [id]: false }));
  }

  async function approve(id: string, alertData?: Alert) {
    try {
      // Copy to clipboard with approved template if alert data provided
      if (alertData) {
        const template = whatsappTemplate(alertData);
        await navigator.clipboard.writeText(template);
      }
      
      const res = await fetch(`${API_BASE}/alerts/${id}/approve`, { method: "POST" });
      const data = await res.json();
      
      if (!data.ok) {
        const errorMsg = data.error || data.message || 'Failed to approve alert';
        alert(`❌ Error:\n\n${errorMsg}`);
        return;
      }
      
      // Show success message
      const successMsg = alertData 
        ? "✓ Alert approved & posted to WordPress\n✓ WhatsApp template copied to clipboard"
        : "✓ Alert approved & posted to WordPress";
      alert(successMsg);
      
      setAlerts((a) => a.filter((x) => x.id !== id));
    } catch (err: any) {
      alert(`❌ Error: ${err.message}`);
    }
  }

  async function dismiss(id: string) {
    try {
      console.log(`[DISMISS] Dismissing alert ${id}`);
      const res = await fetch(`${API_BASE}/alerts/${id}/dismiss`, { method: "POST" });
      console.log(`[DISMISS] Response status: ${res.status}`);
      
      if (!res.ok) throw new Error("Dismiss failed");
      
      // Immediately remove from local state
      setAlerts((a) => a.filter((x) => x.id !== id));
      
      // Pause polling to prevent refresh
      setPollingPaused(true);
      setTimeout(() => {
        setPollingPaused(false);
        loadAlerts().catch(e => console.warn('Fresh load failed:', e));
      }, 3000);
    } catch (err: any) {
      console.error(`[DISMISS] Error:`, err);
      alert(`❌ Dismiss failed: ${err.message}`);
      setPollingPaused(false);
    }
  }

  async function del(id: string) {
    if (!window.confirm("Delete alert permanently?")) return;
    
    try {
      console.log(`[DELETE] Deleting alert ${id}`);
      // Use POST to /delete endpoint instead of DELETE due to Supabase routing limitations
      const res = await fetch(`${API_BASE}/alerts/${id}/delete`, { 
        method: "POST"
      });
      console.log(`[DELETE] Response status: ${res.status}`);
      
      if (!res.ok) {
        const responseText = await res.text();
        console.error(`[DELETE] Error response:`, responseText);
        throw new Error(`Delete failed with status ${res.status}: ${responseText}`);
      }
      
      const responseData = await res.json();
      console.log(`[DELETE] Response:`, responseData);
      
      // Immediately remove from local state
      console.log(`[DELETE] Removing from local state`);
      setAlerts((a) => {
        const filtered = a.filter((x) => x.id !== id);
        console.log(`[DELETE] Local alerts before: ${a.length}, after: ${filtered.length}`);
        return filtered;
      });
      
      // Pause polling to prevent refresh for 5 seconds
      console.log(`[DELETE] Pausing polling for 5 seconds`);
      setPollingPaused(true);
      setTimeout(() => {
        console.log(`[DELETE] Resuming polling and doing fresh load`);
        setPollingPaused(false);
        // Force a fresh load after the pause
        loadAlerts().catch(e => console.warn('Fresh load failed:', e));
      }, 5000);
    } catch (err: any) {
      console.error(`[DELETE] Error:`, err);
      alert(`❌ Delete failed: ${err.message}`);
      // Resume polling on error
      setPollingPaused(false);
    }
  }

  async function batchDismiss() {
    if (!selected.size) return;
    if (!window.confirm(`Dismiss ${selected.size} alerts?`)) return;

    try {
      await Promise.all(
        [...selected].map((id) =>
          fetch(`${API_BASE}/alerts/${id}/dismiss`, { method: "POST" })
        )
      );

      setAlerts((a) => a.filter((x) => !selected.has(x.id)));
      setSelected(new Set());
      
      // Pause polling and do a fresh load
      setPollingPaused(true);
      setTimeout(() => {
        setPollingPaused(false);
        loadAlerts().catch(e => console.warn('Fresh load failed:', e));
      }, 3000);
    } catch (err: any) {
      alert(`❌ Batch dismiss failed: ${err.message}`);
      setPollingPaused(false);
    }
  }

  async function batchDelete() {
    if (!selected.size) return;
    if (!window.confirm(`DELETE ${selected.size} alerts?`)) return;

    try {
      await Promise.all(
        [...selected].map((id) =>
          fetch(`${API_BASE}/alerts/${id}`, { method: "DELETE" })
        )
      );

      setAlerts((a) => a.filter((x) => !selected.has(x.id)));
      setSelected(new Set());
      
      // Pause polling and do a fresh load
      setPollingPaused(true);
      setTimeout(() => {
        setPollingPaused(false);
        loadAlerts().catch(e => console.warn('Fresh load failed:', e));
      }, 3000);
    } catch (err: any) {
      alert(`❌ Batch delete failed: ${err.message}`);
      setPollingPaused(false);
    }
  }

  if (!permissions.canReview) {
    return <div className="p-4" style={{ color: MAGNUS_COLORS.secondaryText }}>No review permissions</div>;
  }

  if (loading) return <div className="p-6">Loading alerts</div>;

  if (error) {
    return (
      <div className="p-4 border rounded" style={{ borderColor: MAGNUS_COLORS.critical, backgroundColor: MAGNUS_COLORS.offWhite }}>
        <div className="mb-2" style={{ color: MAGNUS_COLORS.critical }}>{error}</div>
        <button
          className="px-3 py-1 text-white rounded font-semibold transition hover:opacity-90"
          style={{ backgroundColor: MAGNUS_COLORS.critical }}
          onClick={() => void loadAlerts()}
        >
          Retry
        </button>
      </div>
    );
  }

  // Pagination calculations
  const totalPages = Math.ceil(alerts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedAlerts = alerts.slice(startIndex, endIndex);

  // Reset to page 1 if current page exceeds total pages
  if (currentPage > totalPages && totalPages > 0) {
    setCurrentPage(1);
  }

  return (
  <div className="space-y-4">
    {/* Scour Management - Main Scour Function (accessible to all users) */}
    {accessToken && <ScourManagementInline accessToken={accessToken} />}

    {/* Batch actions */}
    {selected.size > 0 && (
      <div className="sticky top-0 z-10 p-3 border rounded flex gap-3" style={{ backgroundColor: MAGNUS_COLORS.offWhite }}>
        <strong style={{ color: MAGNUS_COLORS.darkGreen }}>{selected.size} selected</strong>

        <button
          onClick={batchDismiss}
          className="text-white px-3 py-1 rounded font-semibold transition hover:opacity-90"
          style={{ backgroundColor: MAGNUS_COLORS.orange }}
        >
          Batch Dismiss
        </button>

        <button
          onClick={batchDelete}
          className="text-white px-3 py-1 rounded font-semibold transition hover:opacity-90"
          style={{ backgroundColor: MAGNUS_COLORS.critical }}
        >
          Batch Delete
        </button>
      </div>
    )}

    {/* Pagination and Select All Controls */}
    {alerts.length > 0 && (
      <div className="flex justify-between items-center p-3 border rounded mb-4" style={{ backgroundColor: MAGNUS_COLORS.offWhite }}>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (selected.size === paginatedAlerts.length) {
                setSelected(new Set());
              } else {
                const allIds = new Set(paginatedAlerts.map(a => a.id));
                setSelected(allIds);
              }
            }}
            className="px-3 py-1 rounded text-white font-semibold transition"
            style={{ backgroundColor: MAGNUS_COLORS.darkGreen }}
          >
            {selected.size === paginatedAlerts.length && paginatedAlerts.length > 0 ? "Deselect Page" : "Select Page"}
          </button>
          <span style={{ color: MAGNUS_COLORS.secondaryText }}>
            {alerts.length} total alerts
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1 rounded border font-semibold transition disabled:opacity-50"
            style={{ borderColor: MAGNUS_COLORS.border, color: MAGNUS_COLORS.darkGreen }}
          >
            ← Prev
          </button>
          <span style={{ color: MAGNUS_COLORS.secondaryText }} className="text-sm">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-1 rounded border font-semibold transition disabled:opacity-50"
            style={{ borderColor: MAGNUS_COLORS.border, color: MAGNUS_COLORS.darkGreen }}
          >
            Next →
          </button>
        </div>
      </div>
    )}

    {/* Alerts with numbering */}
    {paginatedAlerts.map((a, index) => {
      const alertNumber = (currentPage - 1) * itemsPerPage + index + 1;
      const severity = (drafts[a.id]?.severity as Alert["severity"]) || a.severity;
      const meta = SEVERITY_META[severity];
      const open = !!expanded[a.id];
      const edit = !!editing[a.id];
      let d = (drafts[a.id] || a) as Alert;
      
      // Ensure mainland is populated (auto-derive from country if missing)
      if (!d.mainland && d.country) {
        d = { ...d, mainland: getMainlandFromCountry(d.country) };
      }
      
      const geojson = parseGeoJsonValue(d.geo_json ?? d.geojson);
      const sourcesList = normalizeSources(d.sources);

      return (
        <div key={a.id} className="border-2 rounded-lg bg-white shadow-md overflow-hidden" style={{ borderColor: MAGNUS_COLORS.border }}>
          {/* Header - Always Visible */}
          <div className="p-4 border-b-2" style={{ backgroundColor: MAGNUS_COLORS.offWhite, borderBottomColor: MAGNUS_COLORS.deepGreen }}>
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="flex items-start gap-3 flex-1">
                <input
                  type="checkbox"
                  checked={selected.has(a.id)}
                  onChange={() =>
                    setSelected((s) => {
                      const n = new Set(s);
                      n.has(a.id) ? n.delete(a.id) : n.add(a.id);
                      return n;
                    })
                  }
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-semibold px-2 py-1 rounded" style={{ backgroundColor: MAGNUS_COLORS.deepGreen, color: 'white' }}>
                      #{alertNumber}
                    </span>
                    {edit ? (
                      <input
                        type="text"
                        value={drafts[a.id]?.title || a.title}
                        onChange={(e) => setDrafts((d) => ({ ...d, [a.id]: { ...d[a.id], title: e.target.value } }))}
                        className="flex-1 text-lg font-bold px-2 py-1 border rounded"
                        style={{ borderColor: MAGNUS_COLORS.border, color: MAGNUS_COLORS.darkGreen }}
                      />
                    ) : (
                      <h3 className="text-lg font-bold" style={{ color: MAGNUS_COLORS.darkGreen }}>{a.title}</h3>
                    )}
                  </div>
                  <div className="flex gap-2 items-center flex-wrap">
                  {edit ? (
                    <select
                      value={severity}
                      onChange={(e) => setDrafts((d) => ({ ...d, [a.id]: { ...d[a.id], severity: e.target.value as Alert["severity"] } }))}
                      className="text-sm px-2 py-1 border rounded"
                      style={{ borderColor: MAGNUS_COLORS.border }}
                    >
                      <option value="critical">CRITICAL</option>
                      <option value="warning">WARNING</option>
                      <option value="caution">CAUTION</option>
                      <option value="informative">INFO</option>
                    </select>
                  ) : (
                    <span
                      className={`text-sm font-semibold px-3 py-1 rounded-full ${meta.color}`}
                      style={{ backgroundColor: meta.bgColor }}
                    >
                      {meta.emoji} {meta.label}
                    </span>
                  )}
                  {/* Confidence Score Badge */}
                  {a.confidence_score !== undefined && (
                    <ConfidenceBadge score={a.confidence_score} />
                  )}
                  <span className="text-sm font-medium" style={{ color: MAGNUS_COLORS.secondaryText }}>📍 {d.location}, {d.country}{d.mainland ? ` (${d.mainland})` : ''}</span>
                  <span className="text-sm" style={{ color: MAGNUS_COLORS.secondaryText }}>🕐 {formatDateRange(d)}</span>
                  </div>
                </div>
              </div>
              <button
                className="text-sm font-semibold whitespace-nowrap hover:opacity-80 transition"
                style={{ color: MAGNUS_COLORS.deepGreen }}
                onClick={() =>
                  setExpanded((e) => ({ ...e, [a.id]: !open }))
                }
              >
                {open ? "▼ Collapse" : "▶ Expand"}
              </button>
            </div>

            {/* Summary - Always Visible */}
            {editing[a.id] ? (
              <textarea
                value={drafts[a.id]?.summary || a.summary}
                onChange={(e) => setDrafts((d) => ({ ...d, [a.id]: { ...d[a.id], summary: e.target.value } }))}
                className="w-full p-2 border rounded text-sm mb-4"
                rows={3}
              />
            ) : (
              <div className="text-sm leading-relaxed mb-4" style={{ color: MAGNUS_COLORS.secondaryText }}>
                {d.summary}
              </div>
            )}

            {/* Quick Actions - Always Visible */}
            <div className="flex gap-2 flex-wrap">
              {permissions.canEditAlerts && (
                <>
                  {editing[a.id] ? (
                    <>
                      <button
                        onClick={() => saveEdit(a.id)}
                        className="text-white px-3 py-2 rounded font-semibold text-sm transition hover:opacity-90"
                        style={{ backgroundColor: MAGNUS_COLORS.deepGreen }}
                      >
                        ✓ Save
                      </button>
                      <button
                        onClick={() => cancelEdit(a.id)}
                        className="text-white px-3 py-2 rounded font-semibold text-sm transition hover:opacity-90"
                        style={{ backgroundColor: MAGNUS_COLORS.orange }}
                      >
                        ✕ Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => startEdit(a)}
                      className="text-white px-3 py-2 rounded font-semibold text-sm transition hover:opacity-90"
                      style={{ backgroundColor: MAGNUS_COLORS.deepGreen }}
                    >
                      ✎ Edit
                    </button>
                  )}
                </>
              )}

              {permissions.canApproveAndPost && !editing[a.id] && (
                <button
                  onClick={() => approve(a.id, d)}
                  className="text-white px-4 py-2 rounded font-semibold text-sm transition hover:opacity-90"
                  style={{ backgroundColor: MAGNUS_COLORS.deepGreen }}
                >
                  ✓ Approve & Post (+ Copy WhatsApp)
                </button>
              )}

              {permissions.canDismiss && !editing[a.id] && (
                <button
                  onClick={() => dismiss(a.id)}
                  className="text-white px-4 py-2 rounded font-semibold text-sm transition hover:opacity-90"
                  style={{ backgroundColor: MAGNUS_COLORS.orange }}
                >
                  ⊘ Dismiss
                </button>
              )}

              {permissions.canDelete && (
                <button
                  onClick={() => del(a.id)}
                  className="text-white px-4 py-2 rounded font-semibold text-sm transition hover:opacity-90"
                  style={{ backgroundColor: MAGNUS_COLORS.critical }}
                >
                  🗑 Delete
                </button>
              )}
            </div>
          </div>

          {/* Expanded Content */}
          {open && (
            <div className="p-4 space-y-2 bg-white">
              {a.region && (
                <div>
                  <h4 className="font-semibold mb-2" style={{ color: MAGNUS_COLORS.darkGreen }}>Region</h4>
                  <p style={{ color: MAGNUS_COLORS.secondaryText }}>{a.region}</p>
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="space-y-2 text-sm" style={{ color: MAGNUS_COLORS.secondaryText }}>
                    <div>
                      <span className="font-semibold">Mainland:</span>{" "}
                      {edit ? (
                        <select
                          value={d.mainland || ""}
                          onChange={(e) => setDrafts((draft) => ({ ...draft, [a.id]: { ...draft[a.id], mainland: e.target.value || null } }))}
                          className="border rounded px-2 py-1 text-sm"
                          style={{ borderColor: MAGNUS_COLORS.border }}
                        >
                          {MAINLAND_OPTIONS.map((opt) => (
                            <option key={opt || "blank"} value={opt}>{opt || ""}</option>
                          ))}
                        </select>
                      ) : (
                        <span>{d.mainland || "—"}</span>
                      )}
                    </div>
                    <div>
                      <span className="font-semibold">Intelligence Topics:</span>{" "}
                      {edit ? (
                        <select
                          value={d.intelligence_topics || ""}
                          onChange={(e) => setDrafts((draft) => ({ ...draft, [a.id]: { ...draft[a.id], intelligence_topics: e.target.value || null } }))}
                          className="border rounded px-2 py-1 text-sm"
                          style={{ borderColor: MAGNUS_COLORS.border }}
                        >
                          {INTELLIGENCE_TOPIC_OPTIONS.map((opt) => (
                            <option key={opt || "blank"} value={opt}>{opt || ""}</option>
                          ))}
                        </select>
                      ) : (
                        <span>{d.intelligence_topics || d.event_type || "—"}</span>
                      )}
                    </div>
                    <div>
                      <span className="font-semibold">Event Type:</span>{" "}
                      {edit ? (
                        <input
                          value={d.event_type || ""}
                          onChange={(e) => setDrafts((draft) => ({ ...draft, [a.id]: { ...draft[a.id], event_type: e.target.value } }))}
                          className="border rounded px-2 py-1 text-sm"
                          style={{ borderColor: MAGNUS_COLORS.border }}
                        />
                      ) : (
                        <span>{d.event_type || "—"}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-semibold" style={{ color: MAGNUS_COLORS.darkGreen }}>Location Details</h4>
                  <div className="space-y-2 text-sm" style={{ color: MAGNUS_COLORS.secondaryText }}>
                    <div>
                      <span className="font-semibold">Location:</span>{" "}
                      {edit ? (
                        <input
                          value={d.location || ""}
                          onChange={(e) => setDrafts((draft) => ({ ...draft, [a.id]: { ...draft[a.id], location: e.target.value } }))}
                          className="border rounded px-2 py-1 text-sm"
                          style={{ borderColor: MAGNUS_COLORS.border }}
                        />
                      ) : (
                        <span>{d.location}</span>
                      )}
                    </div>
                    <div>
                      <span className="font-semibold">Country:</span>{" "}
                      {edit ? (
                        <input
                          value={d.country || ""}
                          onChange={(e) => setDrafts((draft) => ({ ...draft, [a.id]: { ...draft[a.id], country: e.target.value } }))}
                          className="border rounded px-2 py-1 text-sm"
                          style={{ borderColor: MAGNUS_COLORS.border }}
                        />
                      ) : (
                        <span>{d.country}</span>
                      )}
                    </div>
                    <div>
                      <span className="font-semibold">Latitude / Longitude:</span>{" "}
                      {edit ? (
                        <span className="flex gap-2">
                          <input
                            value={d.latitude || ""}
                            onChange={(e) => setDrafts((draft) => ({ ...draft, [a.id]: { ...draft[a.id], latitude: e.target.value } }))}
                            className="border rounded px-2 py-1 text-sm"
                            style={{ borderColor: MAGNUS_COLORS.border }}
                            placeholder="lat"
                          />
                          <input
                            value={d.longitude || ""}
                            onChange={(e) => setDrafts((draft) => ({ ...draft, [a.id]: { ...draft[a.id], longitude: e.target.value } }))}
                            className="border rounded px-2 py-1 text-sm"
                            style={{ borderColor: MAGNUS_COLORS.border }}
                            placeholder="lon"
                          />
                        </span>
                      ) : (
                        <span>{[d.latitude, d.longitude].filter(Boolean).join(", ") || "—"}</span>
                      )}
                    </div>
                    <div>
                      <span className="font-semibold">Radius (km):</span>{" "}
                      {edit ? (
                        <input
                          type="number"
                          value={d.radius ?? ""}
                          onChange={(e) => setDrafts((draft) => ({ ...draft, [a.id]: { ...draft[a.id], radius: e.target.value ? parseFloat(e.target.value) : null } }))}
                          className="border rounded px-2 py-1 text-sm"
                          style={{ borderColor: MAGNUS_COLORS.border }}
                          min="0"
                          step="0.1"
                        />
                      ) : (
                        <span>{d.radius ?? "—"}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-2" style={{ color: MAGNUS_COLORS.darkGreen }}>Timeline</h4>
                {edit ? (
                  <div className="grid md:grid-cols-2 gap-3 text-sm">
                    <label className="flex flex-col gap-1">
                      <span className="font-semibold" style={{ color: MAGNUS_COLORS.secondaryText }}>Start</span>
                      <input
                        type="date"
                        value={(d.event_start_date || "").split("T")[0]}
                        onChange={(e) => setDrafts((draft) => ({ ...draft, [a.id]: { ...draft[a.id], event_start_date: e.target.value } }))}
                        className="border rounded px-2 py-1"
                        style={{ borderColor: MAGNUS_COLORS.border }}
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="font-semibold" style={{ color: MAGNUS_COLORS.secondaryText }}>End</span>
                      <input
                        type="date"
                        value={(d.event_end_date || "").split("T")[0]}
                        onChange={(e) => setDrafts((draft) => ({ ...draft, [a.id]: { ...draft[a.id], event_end_date: e.target.value } }))}
                        className="border rounded px-2 py-1"
                        style={{ borderColor: MAGNUS_COLORS.border }}
                      />
                    </label>
                  </div>
                ) : (
                  <p className="text-sm" style={{ color: MAGNUS_COLORS.secondaryText }}>{formatDateRange(d)}</p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-base" style={{ color: MAGNUS_COLORS.darkGreen }}>📍 Map / GeoJSON</h4>
                  {permissions.canEditAlerts && editingGeoJsonId !== a.id && (
                    <button
                      onClick={() => {
                        setEditingGeoJsonId(a.id);
                        if (a.geo_json) {
                          setEditGeoJson(typeof a.geo_json === 'string' ? a.geo_json : JSON.stringify(a.geo_json, null, 2));
                        } else {
                          setEditGeoJson('{\n  "type": "Feature",\n  "geometry": {\n    "type": "Polygon",\n    "coordinates": [[[0,0],[1,0],[1,1],[0,1],[0,0]]]\n  },\n  "properties": {}\n}');
                        }
                      }}
                      className="text-xs px-2 py-1 rounded hover:bg-gray-100"
                      style={{ color: MAGNUS_COLORS.deepGreen }}
                    >
                      ✏️ Edit
                    </button>
                  )}
                </div>

                {editingGeoJsonId === a.id ? (
                  <>
                    <div className="space-y-2">
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                        <button
                          type="button"
                          onClick={() => setShowGeoModal(true)}
                          style={{ 
                            padding: '6px 12px', 
                            fontSize: 13,
                            backgroundColor: '#f0f0f0',
                            border: '1px solid #ccc',
                            borderRadius: 4,
                            cursor: 'pointer',
                            color: MAGNUS_COLORS.deepGreen,
                            fontWeight: 500
                          }}
                        >
                          Open GeoJSON Generator
                        </button>
                        <span style={{ fontSize: 12, color: MAGNUS_COLORS.secondaryText }}>Draw polygon, copy, and paste below</span>
                      </div>
                      <textarea
                        value={editGeoJson}
                        onChange={(e) => setEditGeoJson(e.target.value)}
                        className="w-full p-2 border rounded font-mono text-xs"
                        rows={10}
                        placeholder='{"type":"Feature","geometry":{"type":"Polygon","coordinates":[[[lon,lat]...]]},"properties":{}}'
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={async () => {
                            try {
                              const parsed = JSON.parse(editGeoJson);
                              const geoJsonString = JSON.stringify(parsed);
                              const updated = { ...a, geo_json: parsed, geojson: geoJsonString };
                              await fetch(`${API_BASE}/alerts/${a.id}`, {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ 
                                  geo_json: parsed,
                                  geojson: geoJsonString
                                }),
                              });
                              setAlerts(alerts.map(x => x.id === a.id ? updated : x));
                              setEditingGeoJsonId(null);
                            } catch (e) {
                              alert('Invalid GeoJSON: ' + (e as Error).message);
                            }
                          }}
                          className="px-3 py-1 rounded text-white font-semibold"
                          style={{ backgroundColor: MAGNUS_COLORS.deepGreen }}
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingGeoJsonId(null)}
                          className="px-3 py-1 rounded border"
                          style={{ color: MAGNUS_COLORS.secondaryText }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                    {showGeoModal && (
                      <GeoJSONGeneratorModal
                        mapboxToken={import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || 'pk.eyJ1IjoiZXhhbXBsZSIsImEiOiJjbGV4YW1wbGUifQ.example'}
                        onClose={() => setShowGeoModal(false)}
                      />
                    )}
                  </>
                ) : (
                  geojson ? (
                    <GeoJsonPreview geojson={geojson} />
                  ) : (
                    <div className="text-sm" style={{ color: MAGNUS_COLORS.secondaryText }}>
                      No GeoJSON set. Click Edit to add a polygon.
                    </div>
                  )
                )}
              </div>

              <div>
                <h4 className="font-semibold mb-2" style={{ color: MAGNUS_COLORS.darkGreen }}>Description</h4>
                {edit ? (
                  <textarea
                    value={d.description || ""}
                    onChange={(e) => setDrafts((draft) => ({ ...draft, [a.id]: { ...draft[a.id], description: e.target.value } }))}
                    className="w-full p-2 border rounded text-sm"
                    style={{ borderColor: MAGNUS_COLORS.border }}
                    rows={3}
                  />
                ) : (
                  <p className="text-sm leading-relaxed" style={{ color: MAGNUS_COLORS.secondaryText }}>
                    {d.description || "—"}
                  </p>
                )}
              </div>

              {d.recommendations && (
                <div className="p-4 rounded" style={{ backgroundColor: MAGNUS_COLORS.offWhite, borderLeft: `4px solid ${MAGNUS_COLORS.deepGreen}` }}>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-base" style={{ color: MAGNUS_COLORS.darkGreen }}>🎯 Traveler Recommendations</h4>
                    {permissions.canEditAlerts && editingRecommendationsId !== a.id && (
                      <button
                        onClick={() => {
                          setEditingRecommendationsId(a.id);
                          setEditRecommendations(d.recommendations || "");
                        }}
                        className="text-xs font-semibold hover:opacity-80 transition"
                        style={{ color: MAGNUS_COLORS.deepGreen }}
                      >
                        ✏️ Edit
                      </button>
                    )}
                  </div>

                  {editingRecommendationsId === a.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={editRecommendations}
                        onChange={(e) => setEditRecommendations(e.target.value)}
                        className="w-full border rounded p-2 text-sm"
                        rows={6}
                        placeholder="Enter recommendations, one per line&#10;1. First recommendation&#10;2. Second recommendation"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            const updated = drafts[a.id] || {};
                            updated.recommendations = editRecommendations;
                            setDrafts({ ...drafts, [a.id]: updated });
                            setEditingRecommendationsId(null);
                          }}
                          className="text-xs px-3 py-1 rounded font-semibold text-white hover:opacity-90 transition"
                          style={{ backgroundColor: MAGNUS_COLORS.deepGreen }}
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingRecommendationsId(null)}
                          className="text-xs px-3 py-1 rounded font-semibold hover:opacity-80 transition"
                          style={{ color: MAGNUS_COLORS.secondaryText }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {normalizeRecommendations(d.recommendations).length > 0 ? (
                        <ol className="space-y-2 ml-4 list-decimal">
                          {normalizeRecommendations(d.recommendations)
                            .slice(0, 4)
                            .map((item: string, i: number) => (
                              <li key={i} className="text-sm" style={{ color: MAGNUS_COLORS.secondaryText }}>
                                {item}
                              </li>
                            ))}
                        </ol>
                      ) : (
                        <p className="text-sm" style={{ color: MAGNUS_COLORS.secondaryText }}>{d.recommendations}</p>
                      )}
                    </>
                  )}
                </div>
              )}

              {(a.source_url || a.article_url || sourcesList.length > 0) && (
                <div>
                  <h4 className="font-semibold mb-2" style={{ color: MAGNUS_COLORS.darkGreen }}>Sources</h4>
                  <div className="space-y-1">
                    {sourcesList.length > 0 && (
                      <ul className="list-disc ml-4 text-sm" style={{ color: MAGNUS_COLORS.secondaryText }}>
                        {sourcesList.map((s, idx) => (
                          <li key={idx}>{s.title || s.url || JSON.stringify(s)}</li>
                        ))}
                      </ul>
                    )}
                    {a.article_url && (
                      <a
                        href={a.article_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline text-sm"
                      >
                        📄 View Article
                      </a>
                    )}
                  </div>
                </div>
              )}

              {a.source_query_used && (
                <div>
                  <h4 className="font-semibold mb-2" style={{ color: MAGNUS_COLORS.darkGreen }}>Source Query Used</h4>
                  <p className="text-sm italic" style={{ color: MAGNUS_COLORS.secondaryText }}>"{a.source_query_used}"</p>
                </div>
              )}

              {/* Map inset shown above; avoid duplicate rendering */}

              {/* Internal Metadata - Not exported to WhatsApp/WordPress */}
              <div className="p-3 rounded border-l-4" style={{ backgroundColor: MAGNUS_COLORS.offWhite, borderLeftColor: MAGNUS_COLORS.secondaryText }}>
                <p className="text-xs font-semibold mb-2" style={{ color: MAGNUS_COLORS.secondaryText }}>⚙ Internal - Not Shared</p>
                <div className="space-y-1 text-sm">
                  <div style={{ color: MAGNUS_COLORS.secondaryText }}>
                    <span className="font-medium">Event Time:</span> {formatEventTime(d)}
                  </div>
                  <div style={{ color: MAGNUS_COLORS.secondaryText }}>
                    <span className="font-medium">Alert Created:</span> {new Date(a.created_at).toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t" style={{ color: MAGNUS_COLORS.tertiaryText, fontSize: "0.75rem" }}>
                ID: {a.id}
              </div>

              {/* Action Buttons - Only show when expanded */}
              <div className="pt-4 border-t flex gap-2 flex-wrap">
                {permissions.canApproveAndPost && !editing[a.id] && (
                  <button
                    onClick={() => approve(a.id, d)}
                    className="text-white px-4 py-2 rounded font-semibold text-sm transition hover:opacity-90"
                    style={{ backgroundColor: MAGNUS_COLORS.deepGreen }}
                  >
                    ✓ Approve & Post (+ Copy WhatsApp)
                  </button>
                )}

                {permissions.canDismiss && !editing[a.id] && (
                  <button
                    onClick={() => dismiss(a.id)}
                    className="text-white px-4 py-2 rounded font-semibold text-sm transition hover:opacity-90"
                    style={{ backgroundColor: MAGNUS_COLORS.orange }}
                  >
                    ⊘ Dismiss
                  </button>
                )}

                {permissions.canDelete && (
                  <button
                    onClick={() => del(a.id)}
                    className="text-white px-4 py-2 rounded font-semibold text-sm transition hover:opacity-90"
                    style={{ backgroundColor: MAGNUS_COLORS.critical }}
                  >
                    🗑 Delete
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      );
    })}
  </div>
);


}



