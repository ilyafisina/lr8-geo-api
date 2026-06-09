import { GeocodingResult, RouteResult, LatLng } from '../types';

/**
 * Service for working with local Express Proxy for OSM Nominatim and OSRM Services.
 * This completely prevents CORS errors, 403 blocks and browser fetches failing.
 */

export async function geocodeAddress(address: string): Promise<GeocodingResult[]> {
  if (!address.trim()) return [];
  
  // Appends "Ростов-на-Дону" to ensure results are in the target city
  const searchQuery = address.toLowerCase().includes('ростов') 
    ? address 
    : `${address}, Ростов-на-Дону`;

  const url = `/api/geocode?q=${encodeURIComponent(searchQuery)}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Nominatim proxy error: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    
    return data.map((item: any) => ({
      address: item.display_name,
      lat: parseFloat(item.lat),
      lon: parseFloat(item.lon),
      displayName: item.name || item.display_name.split(',')[0],
      source: 'Nominatim Proxy API'
    }));
  } catch (error) {
    console.error('Error in geocodeAddress:', error);
    throw error;
  }
}

export async function reverseGeocode(lat: number, lon: number): Promise<GeocodingResult> {
  const url = `/api/reverse?lat=${lat}&lon=${lon}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Nominatim proxy error: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    
    return {
      address: data.display_name,
      lat: parseFloat(data.lat),
      lon: parseFloat(data.lon),
      displayName: data.name || data.display_name.split(',')[0],
      source: 'Nominatim Proxy API (Reverse)'
    };
  } catch (error) {
    console.error('Error in reverseGeocode:', error);
    throw error;
  }
}

export async function getRoute(from: LatLng, to: LatLng, profile: 'driving' | 'walking' | 'cycling' = 'driving'): Promise<RouteResult> {
  const url = `/api/route?fromLat=${from.lat}&fromLng=${from.lng}&toLat=${to.lat}&toLng=${to.lng}&profile=${profile}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`OSRM proxy error: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    
    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      throw new Error(data.message || 'Маршрут не найден между указанными точками.');
    }
    
    const route = data.routes[0];
    
    // Convert GeoJSON coordinates [lon, lat] used by OSRM to [lat, lon] used directly by Leaflet Polylines
    const leafletCoordinates = route.geometry.coordinates.map(
      (coord: [number, number]) => [coord[1], coord[0]] as [number, number]
    );

    return {
      distance: route.distance, // in meters
      duration: route.duration, // in seconds
      geometry: route.geometry, // GeoJSON LineString
      coordinates: leafletCoordinates,
      from,
      to
    };
  } catch (error) {
    console.error('Error in getRoute:', error);
    throw error;
  }
}
