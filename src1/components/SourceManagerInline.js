import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { apiFetchJson, apiPatchJson, apiPostJson } from "../lib/utils/api";
import { useScour } from "./ScourContext";
import { SourceBulkUpload } from "./SourceBulkUpload";
import { OPMLImport } from "./OPMLImport";
import ScourStatusBarInline from "./ScourStatusBarInline";
import { AutoScourSettings } from "./AutoScourSettings";
import MAGNUS_COLORS from "../styles/magnus-colors";
/* =========================
   Component
========================= */
const SourceManagerInline = ({ accessToken, permissions, }) => {
    const [sources, setSources] = useState([]);
    const [search, setSearch] = useState("");
    const [editingId, setEditingId] = useState(null);
    const [draft, setDraft] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);
    const [total, setTotal] = useState(0);
    const [enabledTotal, setEnabledTotal] = useState(0);
    const [showAddForm, setShowAddForm] = useState(false);
    const [newSource, setNewSource] = useState({ name: "", url: "", country: "" });
    const [addingSource, setAddingSource] = useState(false);
    const [runningEarlySignals, setRunningEarlySignals] = useState(false);
    const { isScouring, startScour, stopScour } = useScour();
    const canManage = permissions?.canManageSources !== false;
    const canScour = permissions?.canScour !== false;
    /* =========================
       Load Sources
    ========================= */
    async function loadSources() {
        try {
            setLoading(true);
            const searchParam = search.trim() ? `&search=${encodeURIComponent(search.trim())}` : '';
            const res = await apiFetchJson(`/analytics/sources?page=${page}&pageSize=${pageSize}${searchParam}`, accessToken);
            if (res.ok) {
                setSources(res.sources || []);
                setTotal(res.total || 0);
                setEnabledTotal(res.stats?.enabled || 0);
            }
            else {
                setSources([]);
            }
        }
        catch (e) {
            setError(e.message || "Failed to load sources");
        }
        finally {
            setLoading(false);
        }
    }
    useEffect(() => {
        loadSources();
    }, [accessToken, page, pageSize, search]);
    // Reset to page 1 when search changes
    useEffect(() => {
        if (search.trim()) {
            setPage(1);
        }
    }, [search]);
    /* =========================
       Search / Filter
    ========================= */
    // Remove client-side filtering since search is now server-side
    const filteredSources = sources;
    /* =========================
       Scour
    ========================= */
    async function runScour() {
        console.log(`[UI] Run Scour clicked, enabledTotal=${enabledTotal}`);
        // Use global enabledTotal to reflect all enabled sources, not just filtered
        if (enabledTotal === 0) {
            alert("No enabled sources available to scour");
            return;
        }
        console.log(`[UI] Calling startScour()`);
        // Start scour with no sourceIds to use all enabled sources globally
        await startScour(accessToken, {
            daysBack: 14,
        });
    }
    async function runEarlySignals() {
        if (runningEarlySignals)
            return;
        setRunningEarlySignals(true);
        try {
            const res = await apiPostJson("/scour-early-signals", {}, accessToken);
            if (res.ok) {
                alert(res.message || "Early signals started");
            }
            else {
                alert(`Early signals failed: ${res.error || 'Unknown error'}`);
            }
        }
        catch (e) {
            console.error(`Early signals error:`, e);
            alert(`Early signals error: ${e.message}`);
        }
        finally {
            setRunningEarlySignals(false);
        }
    }
    // Force stop: Kill all scour jobs via backend endpoint
    async function forceStopScour() {
        if (!confirm("Force stop all running scour jobs?")) {
            return;
        }
        try {
            // Call backend endpoint to force clear all jobs
            const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/clever-function/force-stop-scour`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            });
            const data = await response.json().catch(() => ({}));
            if (response.ok) {
                console.log('[ForceStop] Backend cleared jobs:', data);
                stopScour(); // Stop local polling
                alert(`✓ Force stopped: ${data.deleted || 'all'} jobs cleared`);
            }
            else {
                console.error('[ForceStop] Backend error:', data);
                alert(`⚠️ Error: ${data.error || 'Unknown error'}`);
            }
        }
        catch (e) {
            console.error('[ForceStop] Request failed:', e);
            alert(`❌ Error: ${e.message}`);
        }
    }
    /* =========================
       Edit / Delete
    ========================= */
    function startEdit(source) {
        setEditingId(source.id);
        setDraft({
            name: source.name,
            url: source.url,
            country: source.country,
            enabled: source.enabled,
        });
    }
    async function saveEdit() {
        if (!editingId)
            return;
        await apiPatchJson(`/sources/${editingId}`, draft, accessToken);
        setEditingId(null);
        setDraft({});
        loadSources();
    }
    async function deleteSource(id) {
        if (!confirm("Delete this source?"))
            return;
        await apiFetchJson(`/sources/${id}`, accessToken, {
            method: "DELETE",
        });
        loadSources();
    }
    async function addSingleSource() {
        if (!newSource.url.trim()) {
            alert("URL is required");
            return;
        }
        setAddingSource(true);
        try {
            const res = await apiPostJson("/sources", newSource, accessToken);
            if (res.ok) {
                setNewSource({ name: "", url: "", country: "" });
                setShowAddForm(false);
                loadSources();
                alert(`Source ${res.action === 'updated' ? 'updated' : 'added'} successfully!`);
            }
            else {
                alert(`Error: ${res.error || 'Failed to add source'}`);
            }
        }
        catch (e) {
            alert(`Error: ${e.message}`);
        }
        finally {
            setAddingSource(false);
        }
    }
    /* =========================
       Render
    ========================= */
    return (_jsxs("div", { className: "space-y-4", children: [canManage && (_jsx(AutoScourSettings, { accessToken: accessToken, isAdmin: true })), canManage && (_jsx(OPMLImport, { accessToken: accessToken, onImportComplete: loadSources })), canManage && (_jsx(SourceBulkUpload, { accessToken: accessToken, onUploadComplete: loadSources })), canManage && (_jsxs("div", { className: "border rounded-lg p-4", style: { backgroundColor: MAGNUS_COLORS.offWhite, borderColor: MAGNUS_COLORS.deepGreen }, children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsx("h3", { className: "font-semibold", style: { color: MAGNUS_COLORS.darkGreen }, children: "\u2795 Add Individual Source" }), _jsx("button", { onClick: () => setShowAddForm(!showAddForm), className: "text-sm px-3 py-1 rounded", style: {
                                    backgroundColor: showAddForm ? MAGNUS_COLORS.caution : MAGNUS_COLORS.deepGreen,
                                    color: 'white'
                                }, children: showAddForm ? 'Cancel' : 'Add Source' })] }), showAddForm && (_jsxs("div", { className: "space-y-3 mt-3", children: [_jsxs("div", { children: [_jsxs("label", { className: "block text-sm font-medium mb-1", style: { color: MAGNUS_COLORS.darkGreen }, children: ["Source URL ", _jsx("span", { style: { color: MAGNUS_COLORS.critical }, children: "*" })] }), _jsx("input", { type: "url", value: newSource.url, onChange: (e) => setNewSource({ ...newSource, url: e.target.value }), placeholder: "https://example.com/rss", className: "w-full px-3 py-2 border rounded", style: { borderColor: MAGNUS_COLORS.deepGreen } })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", style: { color: MAGNUS_COLORS.darkGreen }, children: "Source Name" }), _jsx("input", { type: "text", value: newSource.name, onChange: (e) => setNewSource({ ...newSource, name: e.target.value }), placeholder: "News Source Name", className: "w-full px-3 py-2 border rounded" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", style: { color: MAGNUS_COLORS.darkGreen }, children: "Country" }), _jsx("input", { type: "text", value: newSource.country, onChange: (e) => setNewSource({ ...newSource, country: e.target.value }), placeholder: "e.g., US, UK, FR", className: "w-full px-3 py-2 border rounded" })] })] }), _jsx("button", { onClick: addSingleSource, disabled: addingSource || !newSource.url.trim(), className: "px-4 py-2 rounded text-white font-semibold disabled:opacity-50", style: { backgroundColor: MAGNUS_COLORS.deepGreen }, children: addingSource ? 'Adding...' : 'Add Source' })] }))] })), _jsx(ScourStatusBarInline, {}), _jsxs("div", { className: "flex flex-wrap gap-3 items-center", children: [_jsx("button", { onClick: runScour, disabled: isScouring || !canScour, className: "px-3 py-1 rounded text-white disabled:opacity-50 font-semibold transition hover:opacity-90", style: { backgroundColor: MAGNUS_COLORS.darkGreen }, children: isScouring ? "Scouring…" : "Run Scour" }), _jsx("button", { onClick: runEarlySignals, disabled: runningEarlySignals || isScouring, className: "px-3 py-1 rounded text-white disabled:opacity-50 font-semibold transition hover:opacity-90", style: { backgroundColor: MAGNUS_COLORS.deepGreen }, children: runningEarlySignals ? "Early Signals…" : "Run Early Signals" }), _jsx("button", { onClick: forceStopScour, className: "px-3 py-1 rounded text-white font-semibold transition hover:opacity-90", style: { backgroundColor: MAGNUS_COLORS.orange }, children: "\u2297 Force Stop" }), _jsx("input", { value: search, onChange: (e) => setSearch(e.target.value), placeholder: "Search sources\u2026", className: "border px-2 py-1 rounded text-sm" }), _jsxs("span", { className: "text-sm", style: { color: MAGNUS_COLORS.secondaryText }, children: [enabledTotal, " / ", total, " enabled"] })] }), error && _jsx("div", { style: { color: MAGNUS_COLORS.critical }, children: error }), loading && _jsx("div", { className: "text-sm", style: { color: MAGNUS_COLORS.secondaryText }, children: "Loading\u2026" }), _jsx("div", { className: "border rounded divide-y", children: filteredSources.map((s) => (_jsx("div", { className: "flex items-center gap-2 p-2 text-sm", children: editingId === s.id ? (_jsxs(_Fragment, { children: [_jsx("input", { value: draft.name || "", onChange: (e) => setDraft((d) => ({ ...d, name: e.target.value })), className: "border px-1 w-40" }), _jsx("input", { value: draft.url || "", onChange: (e) => setDraft((d) => ({ ...d, url: e.target.value })), className: "border px-1 flex-1" }), _jsx("input", { value: draft.country || "", onChange: (e) => setDraft((d) => ({ ...d, country: e.target.value })), className: "border px-1 w-28" }), _jsxs("label", { className: "flex items-center gap-1", children: [_jsx("input", { type: "checkbox", checked: !!draft.enabled, onChange: (e) => setDraft((d) => ({
                                            ...d,
                                            enabled: e.target.checked,
                                        })) }), "enabled"] }), _jsx("button", { onClick: saveEdit, className: "font-semibold hover:opacity-80 transition", style: { color: MAGNUS_COLORS.caution }, children: "Save" }), _jsx("button", { onClick: () => setEditingId(null), children: "Cancel" })] })) : (_jsxs(_Fragment, { children: [_jsxs("strong", { className: "w-40 truncate flex items-center gap-2", children: [s.name, s.reachable === false && _jsx("span", { title: "Unreachable", style: { color: MAGNUS_COLORS.critical }, children: "\u274C" }), s.underperforming && _jsx("span", { title: "Underperforming", style: { color: MAGNUS_COLORS.warning }, children: "\u26A0\uFE0F" })] }), _jsx("span", { className: "flex-1 truncate", style: { color: MAGNUS_COLORS.secondaryText }, children: s.url }), _jsx("span", { className: "w-28", children: s.country || "—" }), _jsx("span", { className: "w-28", style: { color: MAGNUS_COLORS.secondaryText }, children: typeof s.alertCount === 'number' ? `${s.alertCount} alerts` : '—' }), _jsx("span", { children: s.enabled ? "✅" : "❌" }), canManage && (_jsxs(_Fragment, { children: [_jsx("button", { onClick: () => startEdit(s), className: "font-semibold hover:opacity-80 transition", style: { color: MAGNUS_COLORS.deepGreen }, children: "Edit" }), _jsx("button", { onClick: () => deleteSource(s.id), className: "font-semibold hover:opacity-80 transition", style: { color: MAGNUS_COLORS.critical }, children: "Delete" })] }))] })) }, s.id))) }), _jsxs("div", { className: "flex items-center gap-3 mt-3 flex-wrap", children: [_jsx("button", { onClick: () => setPage(1), disabled: page <= 1, className: "px-3 py-1 rounded font-semibold transition hover:opacity-90 disabled:opacity-50 text-xs", style: { backgroundColor: MAGNUS_COLORS.offWhite, color: MAGNUS_COLORS.darkGreen }, title: "First page", children: "\u23EE First" }), _jsx("button", { onClick: () => setPage((p) => Math.max(1, p - 1)), disabled: page <= 1, className: "px-3 py-1 rounded font-semibold transition hover:opacity-90 disabled:opacity-50 text-xs", style: { backgroundColor: MAGNUS_COLORS.offWhite, color: MAGNUS_COLORS.darkGreen }, children: "\u23EA Prev" }), _jsxs("span", { className: "text-xs", style: { color: MAGNUS_COLORS.secondaryText }, children: ["Page ", _jsx("strong", { children: page }), " of ", _jsx("strong", { children: Math.ceil(total / pageSize) })] }), _jsx("button", { onClick: () => setPage((p) => (p * pageSize < total ? p + 1 : p)), disabled: page * pageSize >= total, className: "px-3 py-1 rounded font-semibold transition hover:opacity-90 disabled:opacity-50 text-xs", style: { backgroundColor: MAGNUS_COLORS.offWhite, color: MAGNUS_COLORS.darkGreen }, children: "Next \u23E9" }), _jsx("button", { onClick: () => setPage(Math.ceil(total / pageSize)), disabled: page >= Math.ceil(total / pageSize), className: "px-3 py-1 rounded font-semibold transition hover:opacity-90 disabled:opacity-50 text-xs", style: { backgroundColor: MAGNUS_COLORS.offWhite, color: MAGNUS_COLORS.darkGreen }, title: "Last page", children: "Last \u23ED" }), _jsxs("span", { className: "text-xs", style: { color: MAGNUS_COLORS.secondaryText }, children: ["Showing ", (page - 1) * pageSize + 1, "\u2013", Math.min(page * pageSize, total), " of ", _jsx("strong", { children: total })] }), _jsx("select", { value: pageSize, onChange: (e) => { setPageSize(parseInt(e.target.value, 10)); setPage(1); }, className: "border px-2 py-1 rounded text-xs", title: "Items per page", children: [25, 50, 100].map((n) => (_jsxs("option", { value: n, children: [n, "/page"] }, n))) }), _jsx("button", { onClick: loadSources, disabled: loading, className: "px-3 py-1 rounded font-semibold transition hover:opacity-90 disabled:opacity-50 text-xs", style: { backgroundColor: MAGNUS_COLORS.caution, color: 'white' }, title: "Refresh source list and counts", children: "\uD83D\uDD04 Sync" })] })] }));
};
export default SourceManagerInline;
