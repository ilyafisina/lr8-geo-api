import geohash from 'ngeohash';
import * as turf from '@turf/turf';
import { LatLng, GeohashResult } from '../types';

/**
 * Encodes coordinates into geohashes of lengths 5, 7, and 9, and computes their boundaries.
 */
export function calculateGeohash(lat: number, lng: number): GeohashResult {
  const hash5 = geohash.encode(lat, lng, 5);
  const hash7 = geohash.encode(lat, lng, 7);
  const hash9 = geohash.encode(lat, lng, 9);
  
  // Center coordinates of the finest geohash (precision 9)
  const decoded9 = geohash.decode(hash9);
  
  return {
    hash5,
    hash7,
    hash9,
    lat,
    lng,
    center: {
      lat: decoded9.latitude,
      lng: decoded9.longitude
    }
  };
}

/**
 * Returns the boundary polygon coordinates of a geohash as a Leaflet-friendly array of LatLngs.
 */
export function getGeohashBounds(hash: string): [number, number][] {
  const bbox = geohash.decode_bbox(hash); // [min_lat, min_lon, max_lat, max_lon]
  const minLat = bbox[0];
  const minLon = bbox[1];
  const maxLat = bbox[2];
  const maxLon = bbox[3];
  
  return [
    [minLat, minLon],
    [minLat, maxLon],
    [maxLat, maxLon],
    [maxLat, minLon]
  ];
}

/**
 * Standard EPSG:3857 Web Mercator Tile calculations
 * (Converts longitude to Tile X index)
 */
export function lon2tile(lon: number, zoom: number): number {
  return Math.floor(((lon + 180) / 360) * Math.pow(2, zoom));
}

/**
 * Standard EPSG:3857 Web Mercator Tile calculations
 * (Converts latitude to Tile Y index, where projection is inverted and goes North-to-South)
 */
export function lat2tile(lat: number, zoom: number): number {
  const latRad = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) *
      Math.pow(2, zoom)
  );
}

/**
 * Inverse Web Mercator conversions: returns longitude of tile boundary x for zoom z
 */
export function tile2lon(x: number, z: number): number {
  return (x / Math.pow(2, z)) * 360 - 180;
}

/**
 * Inverse Web Mercator conversions: returns latitude of tile boundary y for zoom z
 */
export function tile2lat(y: number, z: number): number {
  const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, z);
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

/**
 * Computes list of tiles over a given Bounding Box at a particular zoom level
 * BBox representation: [minLon, minLat, maxLon, maxLat]
 */
export function getTilesForBbox(
  bbox: [number, number, number, number],
  zoom: number
): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  count: number;
  list: { x: number; y: number; z: number; url: string }[];
} {
  const [minLon, minLat, maxLon, maxLat] = bbox;

  // X tile index limits
  const tileMinX = lon2tile(minLon, zoom);
  const tileMaxX = lon2tile(maxLon, zoom);

  // Y tile index limits (Note: higher latitude maps to smaller Y index)
  const tileMinY = lat2tile(maxLat, zoom);
  const tileMaxY = lat2tile(minLat, zoom);

  const list: { x: number; y: number; z: number; url: string }[] = [];

  // Limit loop generation range to prevent browser freezing if huge area is chosen
  const maxXIndex = Math.min(tileMaxX, tileMinX + 100);
  const maxYIndex = Math.min(tileMaxY, tileMinY + 100);

  for (let x = tileMinX; x <= maxXIndex; x++) {
    for (let y = tileMinY; y <= maxYIndex; y++) {
      list.push({
        x,
        y,
        z: zoom,
        url: `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`
      });
    }
  }

  // Calculate actual total count, even if we clamped list generation
  const countX = Math.max(0, tileMaxX - tileMinX + 1);
  const countY = Math.max(0, tileMaxY - tileMinY + 1);
  const count = countX * countY;

  return {
    minX: tileMinX,
    maxX: tileMaxX,
    minY: tileMinY,
    maxY: tileMaxY,
    count,
    list
  };
}

/**
 * Computes bounding box dimensions in kilometers (width and height)
 */
export function getBboxDimensions(bbox: [number, number, number, number]): {
  widthKm: number;
  heightKm: number;
} {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  
  // Turf distance along latitude and longitude lines
  const widthKm = turf.distance(
    turf.point([minLon, minLat]),
    turf.point([maxLon, minLat]),
    { units: 'kilometers' }
  );
  
  const heightKm = turf.distance(
    turf.point([minLon, minLat]),
    turf.point([minLon, maxLat]),
    { units: 'kilometers' }
  );
  
  return {
    widthKm: parseFloat(widthKm.toFixed(3)),
    heightKm: parseFloat(heightKm.toFixed(3))
  };
}

/**
 * Parses user-uploaded file content to ensure valid GeoJSON Polygon or LineString.
 * Computes all required GIS details: Bounding Box, Turf area, scale bounds, and tile lists.
 */
export function processRunGeoJSON(
  geojsonString: string,
  fileName: string = 'import.geojson'
): {
  geojson: any;
  geometryType: 'LineString' | 'Polygon' | 'Unknown';
  bbox: [number, number, number, number];
  bboxPolygon: any;
  bboxWidthKm: number;
  bboxHeightKm: number;
  polygonAreaSqM?: number;
  tileCount: number;
  tileCoordinates: any;
} {
  let parsed: any;
  try {
    parsed = JSON.parse(geojsonString);
  } catch (error) {
    throw new Error('Строка не является корректным JSON-форматом. Проверьте синтаксис.');
  }

  // Validates basic GeoJSON requirements
  if (!parsed.type) {
    throw new Error('Объект не содержит обязательное поле "type" спецификации GeoJSON.');
  }

  // Handle FeatureCollection, Feature, or raw Geometry
  let geom: any = null;
  let featuresToAnalyze: any[] = [];

  if (parsed.type === 'FeatureCollection') {
    if (!parsed.features || parsed.features.length === 0) {
      throw new Error('Отредактируйте GeoJSON: массив "features" пуст или отсутствует.');
    }
    // Find the first valid Polygon or LineString feature, or aggregate them
    const validFeatures = parsed.features.filter((f: any) => 
      f.geometry && (f.geometry.type === 'LineString' || f.geometry.type === 'Polygon')
    );
    
    if (validFeatures.length === 0) {
      throw new Error('В FeatureCollection не найдено геометрий типа LineString или Polygon.');
    }
    geom = validFeatures[0].geometry;
    featuresToAnalyze = validFeatures;
  } else if (parsed.type === 'Feature') {
    if (!parsed.geometry || (parsed.geometry.type !== 'LineString' && parsed.geometry.type !== 'Polygon')) {
      throw new Error('Объект Feature должен содержать геометрию типа LineString или Polygon.');
    }
    geom = parsed.geometry;
    featuresToAnalyze = [parsed];
  } else if (parsed.type === 'LineString' || parsed.type === 'Polygon') {
    geom = parsed;
    featuresToAnalyze = [turf.feature(parsed)];
  } else {
    throw new Error(`Неподдерживаемый тип GeoJSON: ${parsed.type}. Поддерживаются LineString, Polygon, Feature и FeatureCollection.`);
  }

  const geometryType = geom.type as 'LineString' | 'Polygon';

  // Calculate bounding box using Turf.js
  const turfCollection = turf.featureCollection(featuresToAnalyze);
  const bbox = turf.bbox(turfCollection) as [number, number, number, number]; // [minLon, minLat, maxLon, maxLat]

  // Create bounding box polygon for map representation
  const bboxPolygon = turf.bboxPolygon(bbox);

  // Calculate bbox physical size
  const { widthKm, heightKm } = getBboxDimensions(bbox);

  // Calculate polygon area if it is a Polygon
  let polygonAreaSqM: number | undefined;
  if (geometryType === 'Polygon') {
    polygonAreaSqM = turf.area(geom);
  } else {
    // If it's a LineString but has multiple parts, compute raw path length
    // Let's compute area as 0 or undefined for LineString
    polygonAreaSqM = undefined;
  }

  // Determine tiles on default zoom level (e.g. Zoom 14 is very descriptive for runs)
  const defaultZoom = 14;
  const tileInfo = getTilesForBbox(bbox, defaultZoom);

  return {
    geojson: parsed,
    geometryType,
    bbox,
    bboxPolygon,
    bboxWidthKm: widthKm,
    bboxHeightKm: heightKm,
    polygonAreaSqM,
    tileCount: tileInfo.count,
    tileCoordinates: tileInfo
  };
}
