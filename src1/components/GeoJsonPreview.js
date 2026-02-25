import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { MapContainer as RLMapContainer, TileLayer, GeoJSON } from "react-leaflet";
/**
 * Type escape for react-leaflet MapContainer
 * (fixes TS mismatch without affecting runtime)
 */
const MapContainer = RLMapContainer;
export default function GeoJsonPreview({ geojson }) {
    console.log('GeoJsonPreview received:', geojson);
    if (!geojson) {
        console.log('GeoJsonPreview: No geojson data provided');
        return null;
    }
    // Normalize to get geometry - handle both Feature and FeatureCollection
    let geometry = null;
    if (geojson.type === 'FeatureCollection' && geojson.features?.length > 0) {
        geometry = geojson.features[0].geometry;
    }
    else if (geojson.geometry) {
        geometry = geojson.geometry;
    }
    // Validate geojson structure
    if (!geojson.type || !geometry) {
        console.error('GeoJsonPreview: Invalid geojson structure:', geojson);
        return _jsx("div", { className: "text-red-500 p-2", children: "Invalid GeoJSON format" });
    }
    // Extract center from geojson for better map positioning
    let center = [20, 0];
    let zoom = 2;
    if (geometry.type === 'Point') {
        center = [geometry.coordinates[1], geometry.coordinates[0]];
        zoom = 10;
    }
    else if (geometry.type === 'Polygon' && geometry.coordinates[0]?.length > 0) {
        const coords = geometry.coordinates[0];
        const sumLat = coords.reduce((sum, c) => sum + c[1], 0);
        const sumLon = coords.reduce((sum, c) => sum + c[0], 0);
        center = [sumLat / coords.length, sumLon / coords.length];
        zoom = 8;
    }
    console.log('GeoJsonPreview: Rendering map at', center, 'zoom', zoom);
    return (_jsx("div", { className: "h-64 w-full border rounded overflow-hidden", children: _jsxs(MapContainer, { style: { height: "100%", width: "100%" }, center: center, zoom: zoom, scrollWheelZoom: false, children: [_jsx(TileLayer, { url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" }), _jsx(GeoJSON, { data: geojson })] }) }));
}
