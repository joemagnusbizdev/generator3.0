import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";

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
