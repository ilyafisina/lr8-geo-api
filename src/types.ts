export type TabId = 'geocoding' | 'tiling' | 'geohash' | 'routing' | 'isochrones' | 'individual' | 'tests';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface GeocodingResult {
  address: string;
  lat: number;
  lon: number;
  displayName: string;
  source: string;
}

export interface GeohashResult {
  hash5: string;
  hash7: string;
  hash9: string;
  lat: number;
  lng: number;
  center: LatLng;
}

export interface RouteResult {
  distance: number; // in meters
  duration: number; // in seconds
  geometry: any; // GeoJSON LineString
  coordinates: [number, number][]; // coordinates for Leaflet polyline
  from: LatLng;
  to: LatLng;
}

export interface IsochroneResult {
  polygon: any; // Turf.js circle GeoJSON
  center: LatLng;
  timeMin: number;
  speedKmh: number;
  radiusKm: number;
}

export interface IndividualResult {
  geojson: any; // Parsed GeoJSON Feature / FeatureCollection
  geometryType: 'LineString' | 'Polygon' | 'Unknown';
  bbox: [number, number, number, number]; // [minLon, minLat, maxLon, maxLat]
  bboxPolygon: any; // GeoJSON bbox Polygon via Turf.js
  bboxWidthKm: number;
  bboxHeightKm: number;
  polygonAreaSqM?: number;
  tileCount: number;
  tileCoordinates: {
    zoom: number;
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    list: { x: number; y: number; z: number; url: string }[];
  };
  errorMessage?: string;
  originalFileName?: string;
}
