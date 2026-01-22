import React, { useRef, useEffect, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import { normalizeGeoJsonForACF } from "../lib/utils";

interface GeoJSONGeneratorModalProps {
  mapboxToken: string;
  onClose: () => void;
}

const MODAL_STYLE: React.CSSProperties = {
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

const CONTAINER_STYLE: React.CSSProperties = {
  width: 500,
  height: 500,
  background: "#fff",
  borderRadius: 8,
  boxShadow: "0 2px 16px rgba(0,0,0,0.2)",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};

const MAP_STYLE: React.CSSProperties = {
  flex: 1,
};

const GeoJSONGeneratorModal: React.FC<GeoJSONGeneratorModalProps> = ({ mapboxToken, onClose }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const [geojson, setGeojson] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [address, setAddress] = useState("");
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const drawRef = useRef<MapboxDraw | null>(null);

  useEffect(() => {
    mapboxgl.accessToken = mapboxToken;
    if (!mapContainer.current) return;
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
    if (!drawRef.current) return;
    const data = drawRef.current.getAll();
    if (data.features.length > 0) {
      const { geojson } = normalizeGeoJsonForACF(data);
      setGeojson(geojson);
    } else {
      setGeojson("");
    }
  };

  const handleCopy = () => {
    if (geojson) {
      navigator.clipboard.writeText(geojson);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    }
  };

  const handleAddressSearch = async () => {
    if (!address) return;
    
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

  return (
    <div style={MODAL_STYLE}>
      <div style={CONTAINER_STYLE}>
        <div style={{ padding: 12, borderBottom: "1px solid #eee", display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="text"
            placeholder="Enter address or place..."
            value={address}
            onChange={e => setAddress(e.target.value)}
            style={{ flex: 1, padding: 6, border: "1px solid #ccc", borderRadius: 4 }}
            onKeyDown={e => { if (e.key === "Enter") handleAddressSearch(); }}
          />
          <button onClick={handleAddressSearch} style={{ padding: "6px 12px" }}>Go</button>
          <button onClick={onClose} style={{ marginLeft: 8, padding: "6px 12px" }}>Close</button>
        </div>
        <div ref={mapContainer} style={MAP_STYLE} />
        <div style={{ padding: 12, borderTop: "1px solid #eee", display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={handleCopy} disabled={!geojson} style={{ padding: "6px 12px" }}>
            {copied ? "Copied!" : "Copy GeoJSON"}
          </button>
          <span style={{ fontSize: 12, color: geojson ? "#333" : "#aaa" }}>
            {geojson ? `${geojson.length} chars` : "Draw a polygon to enable copy"}
          </span>
        </div>
      </div>
    </div>
  );
};

export default GeoJSONGeneratorModal;
