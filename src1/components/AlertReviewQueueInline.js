import { jsxs as _jsxs, jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
import { useScour } from "./ScourContext";
import { useEffect, useState } from "react";
import GeoJsonPreview from "./GeoJsonPreview";
import GeoJSONGeneratorModal from "./GeoJSONGeneratorModal";
import MAGNUS_COLORS from "../styles/magnus-colors";
import ScourManagementInline from "./ScourManagementInline";
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
function getMainlandFromCountry(country) {
    if (!country)
        return "";
    const countryToMainland = {
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
const SEVERITY_META = {
    critical: { emoji: "🚩", label: "CRITICAL", color: "text-white px-3 py-1 rounded-full font-semibold", bgColor: MAGNUS_COLORS.critical },
    warning: { emoji: "⚠️", label: "WARNING", color: "text-white px-3 py-1 rounded-full font-semibold", bgColor: MAGNUS_COLORS.warning },
    caution: { emoji: "🟡", label: "CAUTION", color: "text-white px-3 py-1 rounded-full font-semibold", bgColor: MAGNUS_COLORS.caution },
    informative: { emoji: "ℹ️", label: "INFO", color: "text-white px-3 py-1 rounded-full font-semibold", bgColor: MAGNUS_COLORS.informative },
};
function formatEventTime(a) {
    if (!a.event_start_date)
        return "Date not specified";
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
function formatDateRange(a) {
    // Format event dates
    const start = a.event_start_date || "";
    const end = a.event_end_date || "";
    if (start && end) {
        return `${new Date(start).toLocaleDateString()} - ${new Date(end).toLocaleDateString()}`;
    }
    else if (start) {
        return `From ${new Date(start).toLocaleDateString()}`;
    }
    else if (end) {
        return `Until ${new Date(end).toLocaleDateString()}`;
    }
    return "No dates specified";
}
// Confidence Score Badge Component (Factal-style)
function ConfidenceBadge({ score }) {
    let category;
    let bgColor;
    let textColor;
    let emoji;
    if (score < 0.4) {
        category = "Noise";
        bgColor = "#f3f4f6"; // light gray
        textColor = "#6b7280"; // dark gray
        emoji = "❌";
    }
    else if (score < 0.6) {
        category = "Early Signal";
        bgColor = "#fef3c7"; // light amber
        textColor = "#92400e"; // dark amber
        emoji = "🔶";
    }
    else if (score < 0.7) {
        category = "Review";
        bgColor = "#dbeafe"; // light blue
        textColor = "#1e40af"; // dark blue
        emoji = "👁️";
    }
    else if (score < 0.85) {
        category = "Publish";
        bgColor = "#dcfce7"; // light green
        textColor = "#166534"; // dark green
        emoji = "✓";
    }
    else {
        category = "Verified";
        bgColor = "#86efac"; // bright green
        textColor = "#15803d"; // darker green
        emoji = "✅";
    }
    return (_jsxs("span", { className: "text-xs font-semibold px-2 py-1 rounded whitespace-nowrap", style: { backgroundColor: bgColor, color: textColor }, title: `Confidence: ${(score * 100).toFixed(1)}%`, children: [emoji, " ", (score * 100).toFixed(0), "% ", category] }));
}
// Normalize recommendations to a clean string list regardless of storage format (array, JSON string, CSV, or free text)
function normalizeRecommendations(raw) {
    if (!raw)
        return [];
    // If already an array, normalize items
    if (Array.isArray(raw)) {
        return raw
            .map((item) => (typeof item === "string" ? item : String(item || "")).trim())
            .filter(Boolean);
    }
    const text = raw.trim();
    if (!text)
        return [];
    // Try JSON arrays first
    try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
            return parsed
                .map((item) => (typeof item === "string" ? item : String(item || "")).trim())
                .filter(Boolean);
        }
        if (Array.isArray(parsed?.recommendations)) {
            return parsed.recommendations
                .map((item) => (typeof item === "string" ? item : String(item || "")).trim())
                .filter(Boolean);
        }
    }
    catch {
        // not JSON
    }
    // Split on newlines only (not commas - commas are part of normal text)
    const fromLines = text
        .split(/\r?\n/)
        .map((line) => line.replace(/^[-*\d\.\)\s]+/, "").trim())
        .filter(Boolean);
    if (fromLines.length > 1)
        return fromLines;
    // Fallback: try to extract numbered segments like "1. foo 2. bar"
    const numbered = [];
    const regex = /(\d+[\.\)]\s*)([^\d]+)/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
        const item = (match[2] || "").trim();
        if (item)
            numbered.push(item);
    }
    if (numbered.length > 0)
        return numbered;
    // Last resort: single item
    return [text];
}
function parseGeoJsonValue(value) {
    if (!value)
        return null;
    if (typeof value === "object")
        return value;
    if (typeof value === "string") {
        try {
            return JSON.parse(value);
        }
        catch {
            return null;
        }
    }
    return null;
}
function normalizeSources(raw) {
    if (!raw)
        return [];
    if (Array.isArray(raw))
        return raw;
    if (typeof raw === "string") {
        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        }
        catch {
            return [];
        }
    }
    return [];
}
// Helper to check if alert is within acceptable age window
function isAlertWithinTimeWindow(alert) {
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
function trimOrNull(value) {
    const t = typeof value === "string" ? value.trim() : String(value ?? "").trim();
    return t ? t : null;
}
function numberOrNull(value) {
    if (value === null || value === undefined || value === "")
        return null;
    const n = typeof value === "number" ? value : Number(value);
    return Number.isFinite(n) ? n : null;
}
function whatsappTemplate(a) {
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
export default function AlertReviewQueueInline({ permissions, accessToken }) {
    const [alerts, setAlerts] = useState([]);
    const [expanded, setExpanded] = useState({});
    const [editing, setEditing] = useState({});
    const [drafts, setDrafts] = useState({});
    const [selected, setSelected] = useState(new Set());
    const [editingRecommendationsId, setEditingRecommendationsId] = useState(null);
    const [editRecommendations, setEditRecommendations] = useState("");
    const [editingGeoJsonId, setEditingGeoJsonId] = useState(null);
    const [editGeoJson, setEditGeoJson] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showGeoModal, setShowGeoModal] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(50);
    const [pollingPaused, setPollingPaused] = useState(false);
    const { startScour, isScouring } = useScour();
    useEffect(() => {
        if (!permissions.canReview)
            return;
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
                }
                catch {
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
        }
        catch (e) {
            setError(e?.message || "Failed to load alerts");
        }
    }
    function buildPatchFromDraft(draft) {
        const patch = {};
        const textFields = [
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
        if (draft.latitude !== undefined)
            patch.latitude = trimOrNull(draft.latitude);
        if (draft.longitude !== undefined)
            patch.longitude = trimOrNull(draft.longitude);
        if (draft.radius !== undefined)
            patch.radius = numberOrNull(draft.radius);
        if (draft.event_start_date !== undefined)
            patch.event_start_date = draft.event_start_date || null;
        if (draft.event_end_date !== undefined)
            patch.event_end_date = draft.event_end_date || null;
        if (draft.sources !== undefined)
            patch.sources = draft.sources;
        return patch;
    }
    function startEdit(a) {
        setEditing((e) => ({ ...e, [a.id]: true }));
        // Set defaults for mainland and intelligence_topics based on alert
        const defaults = { ...a };
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
    function cancelEdit(id) {
        setEditing((e) => ({ ...e, [id]: false }));
    }
    async function saveEdit(id) {
        const patch = drafts[id];
        if (!patch)
            return;
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
        }
        catch (err) {
            alert(`Save failed: ${err?.message || err}`);
            return;
        }
        setAlerts((a) => a.map((x) => (x.id === id ? { ...x, ...cleaned } : x)));
        setEditing((e) => ({ ...e, [id]: false }));
    }
    async function approve(id, alertData) {
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
        }
        catch (err) {
            alert(`❌ Error: ${err.message}`);
        }
    }
    async function dismiss(id) {
        try {
            console.log(`[DISMISS] Dismissing alert ${id}`);
            const res = await fetch(`${API_BASE}/alerts/${id}/dismiss`, { method: "POST" });
            console.log(`[DISMISS] Response status: ${res.status}`);
            if (!res.ok)
                throw new Error("Dismiss failed");
            // Immediately remove from local state
            setAlerts((a) => a.filter((x) => x.id !== id));
            // Pause polling to prevent refresh
            setPollingPaused(true);
            setTimeout(() => {
                setPollingPaused(false);
                loadAlerts().catch(e => console.warn('Fresh load failed:', e));
            }, 3000);
        }
        catch (err) {
            console.error(`[DISMISS] Error:`, err);
            alert(`❌ Dismiss failed: ${err.message}`);
            setPollingPaused(false);
        }
    }
    async function del(id) {
        if (!window.confirm("Delete alert permanently?"))
            return;
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
        }
        catch (err) {
            console.error(`[DELETE] Error:`, err);
            alert(`❌ Delete failed: ${err.message}`);
            // Resume polling on error
            setPollingPaused(false);
        }
    }
    async function batchDismiss() {
        if (!selected.size)
            return;
        if (!window.confirm(`Dismiss ${selected.size} alerts?`))
            return;
        try {
            await Promise.all([...selected].map((id) => fetch(`${API_BASE}/alerts/${id}/dismiss`, { method: "POST" })));
            setAlerts((a) => a.filter((x) => !selected.has(x.id)));
            setSelected(new Set());
            // Pause polling and do a fresh load
            setPollingPaused(true);
            setTimeout(() => {
                setPollingPaused(false);
                loadAlerts().catch(e => console.warn('Fresh load failed:', e));
            }, 3000);
        }
        catch (err) {
            alert(`❌ Batch dismiss failed: ${err.message}`);
            setPollingPaused(false);
        }
    }
    async function batchDelete() {
        if (!selected.size)
            return;
        if (!window.confirm(`DELETE ${selected.size} alerts?`))
            return;
        try {
            await Promise.all([...selected].map((id) => fetch(`${API_BASE}/alerts/${id}`, { method: "DELETE" })));
            setAlerts((a) => a.filter((x) => !selected.has(x.id)));
            setSelected(new Set());
            // Pause polling and do a fresh load
            setPollingPaused(true);
            setTimeout(() => {
                setPollingPaused(false);
                loadAlerts().catch(e => console.warn('Fresh load failed:', e));
            }, 3000);
        }
        catch (err) {
            alert(`❌ Batch delete failed: ${err.message}`);
            setPollingPaused(false);
        }
    }
    if (!permissions.canReview) {
        return _jsx("div", { className: "p-4", style: { color: MAGNUS_COLORS.secondaryText }, children: "No review permissions" });
    }
    if (loading)
        return _jsx("div", { className: "p-6", children: "Loading alerts" });
    if (error) {
        return (_jsxs("div", { className: "p-4 border rounded", style: { borderColor: MAGNUS_COLORS.critical, backgroundColor: MAGNUS_COLORS.offWhite }, children: [_jsx("div", { className: "mb-2", style: { color: MAGNUS_COLORS.critical }, children: error }), _jsx("button", { className: "px-3 py-1 text-white rounded font-semibold transition hover:opacity-90", style: { backgroundColor: MAGNUS_COLORS.critical }, onClick: () => void loadAlerts(), children: "Retry" })] }));
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
    return (_jsxs("div", { className: "space-y-4", children: [accessToken && _jsx(ScourManagementInline, { accessToken: accessToken }), selected.size > 0 && (_jsxs("div", { className: "sticky top-0 z-10 p-3 border rounded flex gap-3", style: { backgroundColor: MAGNUS_COLORS.offWhite }, children: [_jsxs("strong", { style: { color: MAGNUS_COLORS.darkGreen }, children: [selected.size, " selected"] }), _jsx("button", { onClick: batchDismiss, className: "text-white px-3 py-1 rounded font-semibold transition hover:opacity-90", style: { backgroundColor: MAGNUS_COLORS.orange }, children: "Batch Dismiss" }), _jsx("button", { onClick: batchDelete, className: "text-white px-3 py-1 rounded font-semibold transition hover:opacity-90", style: { backgroundColor: MAGNUS_COLORS.critical }, children: "Batch Delete" })] })), alerts.length > 0 && (_jsxs("div", { className: "flex justify-between items-center p-3 border rounded mb-4", style: { backgroundColor: MAGNUS_COLORS.offWhite }, children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("button", { onClick: () => {
                                    if (selected.size === paginatedAlerts.length) {
                                        setSelected(new Set());
                                    }
                                    else {
                                        const allIds = new Set(paginatedAlerts.map(a => a.id));
                                        setSelected(allIds);
                                    }
                                }, className: "px-3 py-1 rounded text-white font-semibold transition", style: { backgroundColor: MAGNUS_COLORS.darkGreen }, children: selected.size === paginatedAlerts.length && paginatedAlerts.length > 0 ? "Deselect Page" : "Select Page" }), _jsxs("span", { style: { color: MAGNUS_COLORS.secondaryText }, children: [alerts.length, " total alerts"] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("button", { onClick: () => setCurrentPage(p => Math.max(1, p - 1)), disabled: currentPage === 1, className: "px-3 py-1 rounded border font-semibold transition disabled:opacity-50", style: { borderColor: MAGNUS_COLORS.border, color: MAGNUS_COLORS.darkGreen }, children: "\u2190 Prev" }), _jsxs("span", { style: { color: MAGNUS_COLORS.secondaryText }, className: "text-sm", children: ["Page ", currentPage, " of ", totalPages] }), _jsx("button", { onClick: () => setCurrentPage(p => Math.min(totalPages, p + 1)), disabled: currentPage === totalPages, className: "px-3 py-1 rounded border font-semibold transition disabled:opacity-50", style: { borderColor: MAGNUS_COLORS.border, color: MAGNUS_COLORS.darkGreen }, children: "Next \u2192" })] })] })), paginatedAlerts.map((a, index) => {
                const alertNumber = (currentPage - 1) * itemsPerPage + index + 1;
                const severity = drafts[a.id]?.severity || a.severity;
                const meta = SEVERITY_META[severity];
                const open = !!expanded[a.id];
                const edit = !!editing[a.id];
                let d = (drafts[a.id] || a);
                // Ensure mainland is populated (auto-derive from country if missing)
                if (!d.mainland && d.country) {
                    d = { ...d, mainland: getMainlandFromCountry(d.country) };
                }
                const geojson = parseGeoJsonValue(d.geo_json ?? d.geojson);
                const sourcesList = normalizeSources(d.sources);
                return (_jsxs("div", { className: "border-2 rounded-lg bg-white shadow-md overflow-hidden", style: { borderColor: MAGNUS_COLORS.border }, children: [_jsxs("div", { className: "p-4 border-b-2", style: { backgroundColor: MAGNUS_COLORS.offWhite, borderBottomColor: MAGNUS_COLORS.deepGreen }, children: [_jsxs("div", { className: "flex items-start justify-between gap-4 mb-3", children: [_jsxs("div", { className: "flex items-start gap-3 flex-1", children: [_jsx("input", { type: "checkbox", checked: selected.has(a.id), onChange: () => setSelected((s) => {
                                                        const n = new Set(s);
                                                        n.has(a.id) ? n.delete(a.id) : n.add(a.id);
                                                        return n;
                                                    }), className: "mt-1" }), _jsxs("div", { className: "flex-1", children: [_jsxs("div", { className: "flex items-center gap-2 mb-2", children: [_jsxs("span", { className: "text-sm font-semibold px-2 py-1 rounded", style: { backgroundColor: MAGNUS_COLORS.deepGreen, color: 'white' }, children: ["#", alertNumber] }), edit ? (_jsx("input", { type: "text", value: drafts[a.id]?.title || a.title, onChange: (e) => setDrafts((d) => ({ ...d, [a.id]: { ...d[a.id], title: e.target.value } })), className: "flex-1 text-lg font-bold px-2 py-1 border rounded", style: { borderColor: MAGNUS_COLORS.border, color: MAGNUS_COLORS.darkGreen } })) : (_jsx("h3", { className: "text-lg font-bold", style: { color: MAGNUS_COLORS.darkGreen }, children: a.title }))] }), _jsxs("div", { className: "flex gap-2 items-center flex-wrap", children: [edit ? (_jsxs("select", { value: severity, onChange: (e) => setDrafts((d) => ({ ...d, [a.id]: { ...d[a.id], severity: e.target.value } })), className: "text-sm px-2 py-1 border rounded", style: { borderColor: MAGNUS_COLORS.border }, children: [_jsx("option", { value: "critical", children: "CRITICAL" }), _jsx("option", { value: "warning", children: "WARNING" }), _jsx("option", { value: "caution", children: "CAUTION" }), _jsx("option", { value: "informative", children: "INFO" })] })) : (_jsxs("span", { className: `text-sm font-semibold px-3 py-1 rounded-full ${meta.color}`, style: { backgroundColor: meta.bgColor }, children: [meta.emoji, " ", meta.label] })), a.confidence_score !== undefined && (_jsx(ConfidenceBadge, { score: a.confidence_score })), _jsxs("span", { className: "text-sm font-medium", style: { color: MAGNUS_COLORS.secondaryText }, children: ["\uD83D\uDCCD ", d.location, ", ", d.country, d.mainland ? ` (${d.mainland})` : ''] }), _jsxs("span", { className: "text-sm", style: { color: MAGNUS_COLORS.secondaryText }, children: ["\uD83D\uDD50 ", formatDateRange(d)] })] })] })] }), _jsx("button", { className: "text-sm font-semibold whitespace-nowrap hover:opacity-80 transition", style: { color: MAGNUS_COLORS.deepGreen }, onClick: () => setExpanded((e) => ({ ...e, [a.id]: !open })), children: open ? "▼ Collapse" : "▶ Expand" })] }), editing[a.id] ? (_jsx("textarea", { value: drafts[a.id]?.summary || a.summary, onChange: (e) => setDrafts((d) => ({ ...d, [a.id]: { ...d[a.id], summary: e.target.value } })), className: "w-full p-2 border rounded text-sm mb-4", rows: 3 })) : (_jsx("div", { className: "text-sm leading-relaxed mb-4", style: { color: MAGNUS_COLORS.secondaryText }, children: d.summary })), _jsxs("div", { className: "flex gap-2 flex-wrap", children: [permissions.canEditAlerts && (_jsx(_Fragment, { children: editing[a.id] ? (_jsxs(_Fragment, { children: [_jsx("button", { onClick: () => saveEdit(a.id), className: "text-white px-3 py-2 rounded font-semibold text-sm transition hover:opacity-90", style: { backgroundColor: MAGNUS_COLORS.deepGreen }, children: "\u2713 Save" }), _jsx("button", { onClick: () => cancelEdit(a.id), className: "text-white px-3 py-2 rounded font-semibold text-sm transition hover:opacity-90", style: { backgroundColor: MAGNUS_COLORS.orange }, children: "\u2715 Cancel" })] })) : (_jsx("button", { onClick: () => startEdit(a), className: "text-white px-3 py-2 rounded font-semibold text-sm transition hover:opacity-90", style: { backgroundColor: MAGNUS_COLORS.deepGreen }, children: "\u270E Edit" })) })), permissions.canApproveAndPost && !editing[a.id] && (_jsx("button", { onClick: () => approve(a.id, d), className: "text-white px-4 py-2 rounded font-semibold text-sm transition hover:opacity-90", style: { backgroundColor: MAGNUS_COLORS.deepGreen }, children: "\u2713 Approve & Post (+ Copy WhatsApp)" })), permissions.canDismiss && !editing[a.id] && (_jsx("button", { onClick: () => dismiss(a.id), className: "text-white px-4 py-2 rounded font-semibold text-sm transition hover:opacity-90", style: { backgroundColor: MAGNUS_COLORS.orange }, children: "\u2298 Dismiss" })), permissions.canDelete && (_jsx("button", { onClick: () => del(a.id), className: "text-white px-4 py-2 rounded font-semibold text-sm transition hover:opacity-90", style: { backgroundColor: MAGNUS_COLORS.critical }, children: "\uD83D\uDDD1 Delete" }))] })] }), open && (_jsxs("div", { className: "p-4 space-y-2 bg-white", children: [a.region && (_jsxs("div", { children: [_jsx("h4", { className: "font-semibold mb-2", style: { color: MAGNUS_COLORS.darkGreen }, children: "Region" }), _jsx("p", { style: { color: MAGNUS_COLORS.secondaryText }, children: a.region })] })), _jsxs("div", { className: "grid md:grid-cols-2 gap-4", children: [_jsx("div", { className: "space-y-2", children: _jsxs("div", { className: "space-y-2 text-sm", style: { color: MAGNUS_COLORS.secondaryText }, children: [_jsxs("div", { children: [_jsx("span", { className: "font-semibold", children: "Mainland:" }), " ", edit ? (_jsx("select", { value: d.mainland || "", onChange: (e) => setDrafts((draft) => ({ ...draft, [a.id]: { ...draft[a.id], mainland: e.target.value || null } })), className: "border rounded px-2 py-1 text-sm", style: { borderColor: MAGNUS_COLORS.border }, children: MAINLAND_OPTIONS.map((opt) => (_jsx("option", { value: opt, children: opt || "" }, opt || "blank"))) })) : (_jsx("span", { children: d.mainland || "—" }))] }), _jsxs("div", { children: [_jsx("span", { className: "font-semibold", children: "Intelligence Topics:" }), " ", edit ? (_jsx("select", { value: d.intelligence_topics || "", onChange: (e) => setDrafts((draft) => ({ ...draft, [a.id]: { ...draft[a.id], intelligence_topics: e.target.value || null } })), className: "border rounded px-2 py-1 text-sm", style: { borderColor: MAGNUS_COLORS.border }, children: INTELLIGENCE_TOPIC_OPTIONS.map((opt) => (_jsx("option", { value: opt, children: opt || "" }, opt || "blank"))) })) : (_jsx("span", { children: d.intelligence_topics || d.event_type || "—" }))] }), _jsxs("div", { children: [_jsx("span", { className: "font-semibold", children: "Event Type:" }), " ", edit ? (_jsx("input", { value: d.event_type || "", onChange: (e) => setDrafts((draft) => ({ ...draft, [a.id]: { ...draft[a.id], event_type: e.target.value } })), className: "border rounded px-2 py-1 text-sm", style: { borderColor: MAGNUS_COLORS.border } })) : (_jsx("span", { children: d.event_type || "—" }))] })] }) }), _jsxs("div", { className: "space-y-2", children: [_jsx("h4", { className: "font-semibold", style: { color: MAGNUS_COLORS.darkGreen }, children: "Location Details" }), _jsxs("div", { className: "space-y-2 text-sm", style: { color: MAGNUS_COLORS.secondaryText }, children: [_jsxs("div", { children: [_jsx("span", { className: "font-semibold", children: "Location:" }), " ", edit ? (_jsx("input", { value: d.location || "", onChange: (e) => setDrafts((draft) => ({ ...draft, [a.id]: { ...draft[a.id], location: e.target.value } })), className: "border rounded px-2 py-1 text-sm", style: { borderColor: MAGNUS_COLORS.border } })) : (_jsx("span", { children: d.location }))] }), _jsxs("div", { children: [_jsx("span", { className: "font-semibold", children: "Country:" }), " ", edit ? (_jsx("input", { value: d.country || "", onChange: (e) => setDrafts((draft) => ({ ...draft, [a.id]: { ...draft[a.id], country: e.target.value } })), className: "border rounded px-2 py-1 text-sm", style: { borderColor: MAGNUS_COLORS.border } })) : (_jsx("span", { children: d.country }))] }), _jsxs("div", { children: [_jsx("span", { className: "font-semibold", children: "Latitude / Longitude:" }), " ", edit ? (_jsxs("span", { className: "flex gap-2", children: [_jsx("input", { value: d.latitude || "", onChange: (e) => setDrafts((draft) => ({ ...draft, [a.id]: { ...draft[a.id], latitude: e.target.value } })), className: "border rounded px-2 py-1 text-sm", style: { borderColor: MAGNUS_COLORS.border }, placeholder: "lat" }), _jsx("input", { value: d.longitude || "", onChange: (e) => setDrafts((draft) => ({ ...draft, [a.id]: { ...draft[a.id], longitude: e.target.value } })), className: "border rounded px-2 py-1 text-sm", style: { borderColor: MAGNUS_COLORS.border }, placeholder: "lon" })] })) : (_jsx("span", { children: [d.latitude, d.longitude].filter(Boolean).join(", ") || "—" }))] }), _jsxs("div", { children: [_jsx("span", { className: "font-semibold", children: "Radius (km):" }), " ", edit ? (_jsx("input", { type: "number", value: d.radius ?? "", onChange: (e) => setDrafts((draft) => ({ ...draft, [a.id]: { ...draft[a.id], radius: e.target.value ? parseFloat(e.target.value) : null } })), className: "border rounded px-2 py-1 text-sm", style: { borderColor: MAGNUS_COLORS.border }, min: "0", step: "0.1" })) : (_jsx("span", { children: d.radius ?? "—" }))] })] })] })] }), _jsxs("div", { children: [_jsx("h4", { className: "font-semibold mb-2", style: { color: MAGNUS_COLORS.darkGreen }, children: "Timeline" }), edit ? (_jsxs("div", { className: "grid md:grid-cols-2 gap-3 text-sm", children: [_jsxs("label", { className: "flex flex-col gap-1", children: [_jsx("span", { className: "font-semibold", style: { color: MAGNUS_COLORS.secondaryText }, children: "Start" }), _jsx("input", { type: "date", value: (d.event_start_date || "").split("T")[0], onChange: (e) => setDrafts((draft) => ({ ...draft, [a.id]: { ...draft[a.id], event_start_date: e.target.value } })), className: "border rounded px-2 py-1", style: { borderColor: MAGNUS_COLORS.border } })] }), _jsxs("label", { className: "flex flex-col gap-1", children: [_jsx("span", { className: "font-semibold", style: { color: MAGNUS_COLORS.secondaryText }, children: "End" }), _jsx("input", { type: "date", value: (d.event_end_date || "").split("T")[0], onChange: (e) => setDrafts((draft) => ({ ...draft, [a.id]: { ...draft[a.id], event_end_date: e.target.value } })), className: "border rounded px-2 py-1", style: { borderColor: MAGNUS_COLORS.border } })] })] })) : (_jsx("p", { className: "text-sm", style: { color: MAGNUS_COLORS.secondaryText }, children: formatDateRange(d) }))] }), _jsxs("div", { children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsx("h4", { className: "font-semibold text-base", style: { color: MAGNUS_COLORS.darkGreen }, children: "\uD83D\uDCCD Map / GeoJSON" }), permissions.canEditAlerts && editingGeoJsonId !== a.id && (_jsx("button", { onClick: () => {
                                                        setEditingGeoJsonId(a.id);
                                                        if (a.geo_json) {
                                                            setEditGeoJson(typeof a.geo_json === 'string' ? a.geo_json : JSON.stringify(a.geo_json, null, 2));
                                                        }
                                                        else {
                                                            setEditGeoJson('{\n  "type": "Feature",\n  "geometry": {\n    "type": "Polygon",\n    "coordinates": [[[0,0],[1,0],[1,1],[0,1],[0,0]]]\n  },\n  "properties": {}\n}');
                                                        }
                                                    }, className: "text-xs px-2 py-1 rounded hover:bg-gray-100", style: { color: MAGNUS_COLORS.deepGreen }, children: "\u270F\uFE0F Edit" }))] }), editingGeoJsonId === a.id ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "space-y-2", children: [_jsxs("div", { style: { display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }, children: [_jsx("button", { type: "button", onClick: () => setShowGeoModal(true), style: {
                                                                        padding: '6px 12px',
                                                                        fontSize: 13,
                                                                        backgroundColor: '#f0f0f0',
                                                                        border: '1px solid #ccc',
                                                                        borderRadius: 4,
                                                                        cursor: 'pointer',
                                                                        color: MAGNUS_COLORS.deepGreen,
                                                                        fontWeight: 500
                                                                    }, children: "Open GeoJSON Generator" }), _jsx("span", { style: { fontSize: 12, color: MAGNUS_COLORS.secondaryText }, children: "Draw polygon, copy, and paste below" })] }), _jsx("textarea", { value: editGeoJson, onChange: (e) => setEditGeoJson(e.target.value), className: "w-full p-2 border rounded font-mono text-xs", rows: 10, placeholder: '{"type":"Feature","geometry":{"type":"Polygon","coordinates":[[[lon,lat]...]]},"properties":{}}' }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { onClick: async () => {
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
                                                                        }
                                                                        catch (e) {
                                                                            alert('Invalid GeoJSON: ' + e.message);
                                                                        }
                                                                    }, className: "px-3 py-1 rounded text-white font-semibold", style: { backgroundColor: MAGNUS_COLORS.deepGreen }, children: "Save" }), _jsx("button", { onClick: () => setEditingGeoJsonId(null), className: "px-3 py-1 rounded border", style: { color: MAGNUS_COLORS.secondaryText }, children: "Cancel" })] })] }), showGeoModal && (_jsx(GeoJSONGeneratorModal, { mapboxToken: import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || 'pk.eyJ1IjoiZXhhbXBsZSIsImEiOiJjbGV4YW1wbGUifQ.example', onClose: () => setShowGeoModal(false) }))] })) : (geojson ? (_jsx(GeoJsonPreview, { geojson: geojson })) : (_jsx("div", { className: "text-sm", style: { color: MAGNUS_COLORS.secondaryText }, children: "No GeoJSON set. Click Edit to add a polygon." })))] }), _jsxs("div", { children: [_jsx("h4", { className: "font-semibold mb-2", style: { color: MAGNUS_COLORS.darkGreen }, children: "Description" }), edit ? (_jsx("textarea", { value: d.description || "", onChange: (e) => setDrafts((draft) => ({ ...draft, [a.id]: { ...draft[a.id], description: e.target.value } })), className: "w-full p-2 border rounded text-sm", style: { borderColor: MAGNUS_COLORS.border }, rows: 3 })) : (_jsx("p", { className: "text-sm leading-relaxed", style: { color: MAGNUS_COLORS.secondaryText }, children: d.description || "—" }))] }), d.recommendations && (_jsxs("div", { className: "p-4 rounded", style: { backgroundColor: MAGNUS_COLORS.offWhite, borderLeft: `4px solid ${MAGNUS_COLORS.deepGreen}` }, children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsx("h4", { className: "font-semibold text-base", style: { color: MAGNUS_COLORS.darkGreen }, children: "\uD83C\uDFAF Traveler Recommendations" }), permissions.canEditAlerts && editingRecommendationsId !== a.id && (_jsx("button", { onClick: () => {
                                                        setEditingRecommendationsId(a.id);
                                                        setEditRecommendations(d.recommendations || "");
                                                    }, className: "text-xs font-semibold hover:opacity-80 transition", style: { color: MAGNUS_COLORS.deepGreen }, children: "\u270F\uFE0F Edit" }))] }), editingRecommendationsId === a.id ? (_jsxs("div", { className: "space-y-2", children: [_jsx("textarea", { value: editRecommendations, onChange: (e) => setEditRecommendations(e.target.value), className: "w-full border rounded p-2 text-sm", rows: 6, placeholder: "Enter recommendations, one per line\n1. First recommendation\n2. Second recommendation" }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { onClick: () => {
                                                                const updated = drafts[a.id] || {};
                                                                updated.recommendations = editRecommendations;
                                                                setDrafts({ ...drafts, [a.id]: updated });
                                                                setEditingRecommendationsId(null);
                                                            }, className: "text-xs px-3 py-1 rounded font-semibold text-white hover:opacity-90 transition", style: { backgroundColor: MAGNUS_COLORS.deepGreen }, children: "Save" }), _jsx("button", { onClick: () => setEditingRecommendationsId(null), className: "text-xs px-3 py-1 rounded font-semibold hover:opacity-80 transition", style: { color: MAGNUS_COLORS.secondaryText }, children: "Cancel" })] })] })) : (_jsx(_Fragment, { children: normalizeRecommendations(d.recommendations).length > 0 ? (_jsx("ol", { className: "space-y-2 ml-4 list-decimal", children: normalizeRecommendations(d.recommendations)
                                                    .slice(0, 4)
                                                    .map((item, i) => (_jsx("li", { className: "text-sm", style: { color: MAGNUS_COLORS.secondaryText }, children: item }, i))) })) : (_jsx("p", { className: "text-sm", style: { color: MAGNUS_COLORS.secondaryText }, children: d.recommendations })) }))] })), (a.source_url || a.article_url || sourcesList.length > 0) && (_jsxs("div", { children: [_jsx("h4", { className: "font-semibold mb-2", style: { color: MAGNUS_COLORS.darkGreen }, children: "Sources" }), _jsxs("div", { className: "space-y-1", children: [sourcesList.length > 0 && (_jsx("ul", { className: "list-disc ml-4 text-sm", style: { color: MAGNUS_COLORS.secondaryText }, children: sourcesList.map((s, idx) => (_jsx("li", { children: s.title || s.url || JSON.stringify(s) }, idx))) })), a.article_url && (_jsx("a", { href: a.article_url, target: "_blank", rel: "noopener noreferrer", className: "text-blue-600 hover:underline text-sm", children: "\uD83D\uDCC4 View Article" }))] })] })), a.source_query_used && (_jsxs("div", { children: [_jsx("h4", { className: "font-semibold mb-2", style: { color: MAGNUS_COLORS.darkGreen }, children: "Source Query Used" }), _jsxs("p", { className: "text-sm italic", style: { color: MAGNUS_COLORS.secondaryText }, children: ["\"", a.source_query_used, "\""] })] })), _jsxs("div", { className: "p-3 rounded border-l-4", style: { backgroundColor: MAGNUS_COLORS.offWhite, borderLeftColor: MAGNUS_COLORS.secondaryText }, children: [_jsx("p", { className: "text-xs font-semibold mb-2", style: { color: MAGNUS_COLORS.secondaryText }, children: "\u2699 Internal - Not Shared" }), _jsxs("div", { className: "space-y-1 text-sm", children: [_jsxs("div", { style: { color: MAGNUS_COLORS.secondaryText }, children: [_jsx("span", { className: "font-medium", children: "Event Time:" }), " ", formatEventTime(d)] }), _jsxs("div", { style: { color: MAGNUS_COLORS.secondaryText }, children: [_jsx("span", { className: "font-medium", children: "Alert Created:" }), " ", new Date(a.created_at).toLocaleString()] })] })] }), _jsxs("div", { className: "pt-4 border-t", style: { color: MAGNUS_COLORS.tertiaryText, fontSize: "0.75rem" }, children: ["ID: ", a.id] }), _jsxs("div", { className: "pt-4 border-t flex gap-2 flex-wrap", children: [permissions.canApproveAndPost && !editing[a.id] && (_jsx("button", { onClick: () => approve(a.id, d), className: "text-white px-4 py-2 rounded font-semibold text-sm transition hover:opacity-90", style: { backgroundColor: MAGNUS_COLORS.deepGreen }, children: "\u2713 Approve & Post (+ Copy WhatsApp)" })), permissions.canDismiss && !editing[a.id] && (_jsx("button", { onClick: () => dismiss(a.id), className: "text-white px-4 py-2 rounded font-semibold text-sm transition hover:opacity-90", style: { backgroundColor: MAGNUS_COLORS.orange }, children: "\u2298 Dismiss" })), permissions.canDelete && (_jsx("button", { onClick: () => del(a.id), className: "text-white px-4 py-2 rounded font-semibold text-sm transition hover:opacity-90", style: { backgroundColor: MAGNUS_COLORS.critical }, children: "\uD83D\uDDD1 Delete" }))] })] }))] }, a.id));
            })] }));
}
