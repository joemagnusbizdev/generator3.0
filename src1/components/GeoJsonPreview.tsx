import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import type { FeatureCollection } from "geojson";

type Props = {
  geojson: FeatureCollection;
};

export default function GeoJsonPreview({ geojson }: Props) {
  return (
    <div className="h-64 w-full border rounded overflow-hidden">
      <MapContainer
        style={{ height: "100%", width: "100%" }}
        bounds={undefined}
        zoom={2}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution="© OpenStreetMap"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <GeoJSON data={geojson} />
      </MapContainer>
    </div>
  );
}
