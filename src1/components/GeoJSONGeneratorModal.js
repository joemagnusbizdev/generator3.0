import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useRef, useEffect, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import { normalizeGeoJsonForACF } from "../lib/utils";
const MODAL_STYLE = {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100vw",
    height: "100vh",
    background: "rgba(0,0,0,0.5)",
    zIndex: 1000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
};
const CONTAINER_STYLE = {
    width: 500,
    height: 500,
    background: "#fff",
    borderRadius: 8,
    boxShadow: "0 2px 16px rgba(0,0,0,0.2)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
};
const MAP_STYLE = {
    flex: 1,
};
const GeoJSONGeneratorModal = ({ mapboxToken, onClose }) => {
    const mapContainer = useRef(null);
    const [geojson, setGeojson] = useState("");
    const [copied, setCopied] = useState(false);
    const [address, setAddress] = useState("");
    const mapRef = useRef(null);
    const drawRef = useRef(null);
    // Check if we have a valid Mapbox token
    const hasValidToken = mapboxToken && mapboxToken.startsWith('pk.') && !mapboxToken.includes('example');
    useEffect(() => {
        if (!hasValidToken || !mapContainer.current)
            return;
        mapboxgl.accessToken = mapboxToken;
        if (!mapContainer.current)
            return;
        const map = new mapboxgl.Map({
            container: mapContainer.current,
            style: "mapbox://styles/mapbox/streets-v11",
            center: [-98, 39],
            zoom: 3,
        });
        mapRef.current = map;
        const draw = new MapboxDraw({
            displayControlsDefault: false,
            controls: { polygon: true, trash: true },
            defaultMode: "draw_polygon",
        });
        drawRef.current = draw;
        map.addControl(draw);
        map.addControl(new mapboxgl.NavigationControl());
        map.on("draw.create", updateGeojson);
        map.on("draw.update", updateGeojson);
        map.on("draw.delete", updateGeojson);
        return () => {
            map.remove();
        };
        // eslint-disable-next-line
    }, []);
    const updateGeojson = () => {
        if (!drawRef.current)
            return;
        const data = drawRef.current.getAll();
        if (data.features.length > 0) {
            const { geojson } = normalizeGeoJsonForACF(data);
            setGeojson(geojson);
        }
        else {
            setGeojson("");
        }
    };
    const handleCopy = async () => {
        if (!geojson)
            return;
        try {
            // Try modern clipboard API first
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(geojson);
            }
            else {
                // Fallback for older browsers
                const textArea = document.createElement('textarea');
                textArea.value = geojson;
                textArea.style.position = 'fixed';
                textArea.style.left = '-999999px';
                textArea.style.top = '-999999px';
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
            }
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
        }
        catch (err) {
            console.error('Failed to copy text: ', err);
            // Fallback: try to select and let user copy manually
            alert('Copy failed. Please select the text and use Ctrl+C manually.');
        }
    };
    const handleSelectAll = () => {
        const textArea = document.querySelector('textarea');
        if (textArea) {
            textArea.select();
            textArea.focus();
        }
    };
    const handleAddressSearch = async () => {
        if (!address)
            return;
        // Check if we have a valid Mapbox token
        if (!mapboxToken || !mapboxToken.startsWith('pk.')) {
            alert('Address search requires a valid Mapbox access token. Please configure MAPBOX_ACCESS_TOKEN in your environment.');
            return;
        }
        // Use Mapbox Geocoding API
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${mapboxToken}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.features && data.features.length > 0) {
            const [lng, lat] = data.features[0].center;
            mapRef.current?.flyTo({ center: [lng, lat], zoom: 15 });
        }
    };
    return (_jsx("div", { style: MODAL_STYLE, children: _jsxs("div", { style: CONTAINER_STYLE, children: [_jsxs("div", { style: { padding: 12, borderBottom: "1px solid #eee", display: "flex", alignItems: "center", gap: 8 }, children: [_jsx("input", { type: "text", placeholder: "Enter address or place...", value: address, onChange: e => setAddress(e.target.value), style: { flex: 1, padding: 6, border: "1px solid #ccc", borderRadius: 4 }, onKeyDown: e => { if (e.key === "Enter")
                                handleAddressSearch(); }, disabled: !hasValidToken }), _jsx("button", { onClick: handleAddressSearch, style: { padding: "6px 12px" }, disabled: !hasValidToken, children: "Go" }), _jsx("button", { onClick: onClose, style: { marginLeft: 8, padding: "6px 12px" }, children: "Close" })] }), hasValidToken ? (_jsx("div", { ref: mapContainer, style: MAP_STYLE })) : (_jsx("div", { style: { ...MAP_STYLE, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#f5f5f5", border: "2px dashed #ccc" }, children: _jsxs("div", { style: { textAlign: "center", padding: "20px" }, children: [_jsx("h3", { style: { margin: "0 0 10px 0", color: "#666" }, children: "Map Unavailable" }), _jsx("p", { style: { margin: "0 0 15px 0", color: "#888", fontSize: "14px" }, children: "Configure a valid Mapbox access token to enable interactive map drawing." }), _jsx("textarea", { placeholder: 'Enter GeoJSON manually:\n\n{\n  "type": "Feature",\n  "geometry": {\n    "type": "Polygon",\n    "coordinates": [[[lng, lat], [lng, lat], [lng, lat]]]\n  },\n  "properties": {}\n}', value: geojson, onChange: e => setGeojson(e.target.value), style: { width: "100%", height: "200px", padding: "8px", border: "1px solid #ccc", borderRadius: "4px", fontFamily: "monospace", fontSize: "12px", resize: "none" }, readOnly: !hasValidToken, spellCheck: false, onFocus: (e) => e.target.select() })] }) })), _jsxs("div", { style: { padding: 12, borderTop: "1px solid #eee", display: "flex", alignItems: "center", gap: 8 }, children: [_jsx("button", { onClick: handleSelectAll, disabled: !geojson, style: { padding: "6px 12px" }, children: "Select All" }), _jsx("button", { onClick: handleCopy, disabled: !geojson, style: { padding: "6px 12px" }, children: copied ? "Copied!" : "Copy GeoJSON" }), _jsx("span", { style: { fontSize: 12, color: geojson ? "#333" : "#aaa" }, children: geojson ? `${geojson.length} chars` : "Enter or draw GeoJSON to enable copy" })] })] }) }));
};
export default GeoJSONGeneratorModal;
