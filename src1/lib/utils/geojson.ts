// GeoJSON normalization for ACF polygon fields
// Ensures Polygon geometry, closed ring, stripped properties, and returns both JSONB-ready and stringified forms
export function normalizeGeoJsonForACF(input: any): { geo_json: any; geojson: string } {
  const toFeature = (geom: any) => ({
    type: 'Feature',
    properties: {},
    geometry: geom,
  });

  let feature: any;

  // Accept FeatureCollection, Feature, or Polygon geometry
  if (input?.type === 'FeatureCollection') {
    const first = input.features?.[0];
    if (!first?.geometry) throw new Error('FeatureCollection missing geometry');
    feature = first;
  } else if (input?.type === 'Feature') {
    feature = input;
  } else if (input?.type === 'Polygon') {
    feature = toFeature(input);
  } else {
    throw new Error('Unsupported GeoJSON type: expected FeatureCollection, Feature, or Polygon');
  }

  if (feature.geometry?.type !== 'Polygon') {
    throw new Error('GeoJSON must be a Polygon');
  }

  const coords = feature.geometry.coordinates?.[0];
  if (!Array.isArray(coords) || coords.length < 4) {
    throw new Error('Polygon requires at least 4 coordinate pairs');
  }

  // Ensure ring is explicitly closed
  const first = coords[0];
  const last = coords[coords.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    coords.push(first);
  }

  // Strip properties to keep ACF clean
  const cleanFeature = { ...feature, properties: {} };
  const fc = { type: 'FeatureCollection', features: [cleanFeature] };

  return {
    geo_json: fc,
    geojson: JSON.stringify(fc),
  };
}
