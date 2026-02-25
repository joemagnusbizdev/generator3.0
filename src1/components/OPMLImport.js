import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { getApiUrl } from "../lib/supabase/api";
import MAGNUS_COLORS from "../styles/magnus-colors";
export const OPMLImport = ({ accessToken, onImportComplete }) => {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const [fileName, setFileName] = useState(null);
    const handleFileSelect = async (e) => {
        const file = e.target.files?.[0];
        if (!file)
            return;
        setFileName(file.name);
        setLoading(true);
        setError(null);
        setResult(null);
        try {
            const formData = new FormData();
            formData.append("file", file);
            const url = getApiUrl("/integrations/opml/import");
            console.log("[OPMLImport] Posting to:", url);
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
                body: formData,
            });
            console.log("OPML Import Response Status:", response.status);
            console.log("OPML Import Response Headers:", response.headers);
            if (!response.ok) {
                const text = await response.text();
                console.error("OPML Import Error Response:", text);
                setError(`Import failed (${response.status}): ${text.substring(0, 100)}`);
                return;
            }
            const text = await response.text();
            console.log("OPML Import Response Text:", text);
            if (!text) {
                setError("Empty response from server");
                return;
            }
            let data;
            try {
                data = JSON.parse(text);
            }
            catch (parseErr) {
                console.error("JSON Parse Error:", parseErr, "Text:", text);
                setError(`Invalid JSON response: ${text.substring(0, 100)}`);
                return;
            }
            if (!data.ok) {
                setError(data.error || "Import failed");
            }
            else {
                setResult(data);
                if (onImportComplete) {
                    onImportComplete();
                }
            }
        }
        catch (err) {
            console.error("OPML Import Catch Error:", err);
            setError(err.message || "Failed to import OPML");
        }
        finally {
            setLoading(false);
        }
    };
    return (_jsxs("div", { className: "p-4 rounded border", style: { backgroundColor: MAGNUS_COLORS.offWhite, borderColor: MAGNUS_COLORS.border }, children: [_jsx("h3", { className: "font-semibold mb-3", style: { color: MAGNUS_COLORS.darkGreen }, children: "\uD83D\uDCE5 Import OPML (Feedly, rss.app, etc.)" }), _jsx("div", { className: "mb-3", children: _jsxs("label", { className: "block w-full p-4 border-2 border-dashed rounded cursor-pointer text-center transition", style: {
                        borderColor: loading ? MAGNUS_COLORS.secondaryText : MAGNUS_COLORS.deepGreen,
                        backgroundColor: loading ? MAGNUS_COLORS.offWhite : "white",
                    }, children: [_jsx("input", { type: "file", accept: ".opml,.xml", onChange: handleFileSelect, disabled: loading, className: "hidden" }), _jsx("div", { style: { color: MAGNUS_COLORS.secondaryText }, children: loading ? (_jsxs(_Fragment, { children: [_jsx("div", { className: "text-sm font-semibold", children: "Processing\u2026" }), _jsx("div", { className: "text-xs mt-1", children: "Validating feeds and checking reachability" })] })) : fileName ? (_jsxs(_Fragment, { children: [_jsx("div", { className: "font-semibold", children: fileName }), _jsx("div", { className: "text-xs mt-1", style: { color: MAGNUS_COLORS.secondaryText }, children: "Click to select a different file" })] })) : (_jsxs(_Fragment, { children: [_jsx("div", { className: "font-semibold", children: "Drop OPML file here or click to select" }), _jsx("div", { className: "text-xs mt-1", style: { color: MAGNUS_COLORS.tertiaryText }, children: "Supported: .opml, .xml from Feedly, rss.app, or any RSS aggregator" })] })) })] }) }), error && (_jsxs("div", { className: "p-3 rounded mb-3 text-sm", style: { backgroundColor: MAGNUS_COLORS.critical, color: "white" }, children: ["\u274C ", error] })), result && (_jsxs("div", { className: "p-3 rounded space-y-2 text-sm", style: { backgroundColor: MAGNUS_COLORS.caution, color: "white" }, children: [_jsxs("div", { children: ["\u2705 ", _jsx("strong", { children: "Import Complete" })] }), _jsxs("div", { children: ["\u2022 ", _jsx("strong", { children: result.imported }), " new feeds imported", result.duplicates > 0 && ` · ${result.duplicates} duplicates skipped`] }), result.unreachable > 0 && (_jsxs("div", { style: { marginTop: "8px", paddingTop: "8px", borderTop: "1px solid rgba(255,255,255,0.3)" }, children: [_jsxs("div", { className: "text-xs opacity-90", children: ["\u26A0\uFE0F ", result.unreachable, " feeds were unreachable and skipped:"] }), result.unreachableExamples?.map((ex, i) => (_jsxs("div", { className: "text-xs mt-1 opacity-75", children: ["\u2022 ", ex.title || ex.url] }, i)))] }))] })), _jsxs("div", { className: "mt-3 text-xs", style: { color: MAGNUS_COLORS.tertiaryText }, children: ["\uD83D\uDCA1 ", _jsx("strong", { children: "How to export OPML:" }), _jsxs("ul", { className: "ml-4 mt-1 space-y-1", children: [_jsxs("li", { children: ["\u2022 ", _jsx("strong", { children: "Feedly:" }), " Settings \u2192 Feeds & Collections \u2192 Export"] }), _jsxs("li", { children: ["\u2022 ", _jsx("strong", { children: "rss.app:" }), " Settings \u2192 Export Subscriptions"] }), _jsxs("li", { children: ["\u2022 ", _jsx("strong", { children: "Other readers:" }), " Look for \"Export\" or \"Backup\" option"] })] })] })] }));
};
export default OPMLImport;
