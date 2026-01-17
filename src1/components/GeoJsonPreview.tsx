import { MapContainer as RLMapContainer, TileLayer, GeoJSON } from "react-leaflet";

/**
 * Type escape for react-leaflet MapContainer
 * (fixes TS mismatch without affecting runtime)
 */
const MapContainer = RLMapContainer as unknown as React.FC<any>;

type Props = {
  geojson: any;
};

export default function GeoJsonPreview({ geojson }: Props) {
  if (!geojson) return null;

  return (
    <div className="h-64 w-full border rounded overflow-hidden">
      <MapContainer
        style={{ height: "100%", width: "100%" }}
        center={[20, 0]}
        zoom={2}
        scrollWheelZoom={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <GeoJSON data={geojson} />
      </MapContainer>
    </div>
  );
}



