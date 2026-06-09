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
    let response = await fetch(url);
    let data;

    // Direct fallback if proxy is missing (e.g. static host / GitHub Pages deployment)
    if (response.status === 404) {
      console.warn('Proxy returned 404. Falling back to direct Nominatim request...');
      const directUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5&addressdetails=1`;
      response = await fetch(directUrl, {
        headers: {
          'Accept': 'application/json'
        }
      });
      if (!response.ok) {
        throw new Error(`Direct Nominatim error: ${response.status} ${response.statusText}`);
      }
    } else if (!response.ok) {
      throw new Error(`Nominatim proxy error: ${response.status} ${response.statusText}`);
    }

    data = await response.json();
    
    return data.map((item: any) => ({
      address: item.display_name,
      lat: parseFloat(item.lat),
      lon: parseFloat(item.lon),
      displayName: item.name || item.display_name.split(',')[0],
      source: response.url.includes('/api/') ? 'Nominatim Proxy API' : 'Direct Nominatim API'
    }));
  } catch (error) {
    console.error('Error in geocodeAddress, trying emergency direct fallback...', error);
    try {
      const directUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5&addressdetails=1`;
      const response = await fetch(directUrl, {
        headers: {
          'Accept': 'application/json'
        }
      });
      if (!response.ok) {
        throw new Error(`Direct fallback error: ${response.status}`);
      }
      const data = await response.json();
      return data.map((item: any) => ({
        address: item.display_name,
        lat: parseFloat(item.lat),
        lon: parseFloat(item.lon),
        displayName: item.name || item.display_name.split(',')[0],
        source: 'Direct Nominatim API (Emergency)'
      }));
    } catch (fallbackErr) {
      console.error('Direct fallback also failed:', fallbackErr);
      throw error;
    }
  }
}

export async function reverseGeocode(lat: number, lon: number): Promise<GeocodingResult> {
  const url = `/api/reverse?lat=${lat}&lon=${lon}`;
  
  try {
    let response = await fetch(url);
    let data;

    // Direct fallback if proxy is missing (e.g. static host / GitHub Pages deployment)
    if (response.status === 404) {
      console.warn('Proxy returned 404. Falling back to direct reverse geocoding request...');
      const directUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`;
      response = await fetch(directUrl, {
        headers: {
          'Accept': 'application/json'
        }
      });
      if (!response.ok) {
        throw new Error(`Direct reverse error: ${response.status} ${response.statusText}`);
      }
    } else if (!response.ok) {
      throw new Error(`Nominatim proxy error: ${response.status} ${response.statusText}`);
    }

    data = await response.json();
    
    return {
      address: data.display_name,
      lat: parseFloat(data.lat),
      lon: parseFloat(data.lon),
      displayName: data.name || data.display_name.split(',')[0],
      source: response.url.includes('/api/') ? 'Nominatim Proxy API (Reverse)' : 'Direct Nominatim API (Reverse)'
    };
  } catch (error) {
    console.error('Error in reverseGeocode, trying emergency direct fallback...', error);
    try {
      const directUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`;
      const response = await fetch(directUrl, {
        headers: {
          'Accept': 'application/json'
        }
      });
      if (!response.ok) {
        throw new Error(`Direct fallback reverse error: ${response.status}`);
      }
      const data = await response.json();
      return {
        address: data.display_name,
        lat: parseFloat(data.lat),
        lon: parseFloat(data.lon),
        displayName: data.name || data.display_name.split(',')[0],
        source: 'Direct Nominatim API (Emergency Reverse)'
      };
    } catch (fallbackErr) {
      console.error('Direct fallback reverse also failed:', fallbackErr);
      throw error;
    }
  }
}

export async function getRoute(from: LatLng, to: LatLng, profile: 'driving' | 'walking' | 'cycling' = 'driving'): Promise<RouteResult> {
  const url = `/api/route?fromLat=${from.lat}&fromLng=${from.lng}&toLat=${to.lat}&toLng=${to.lng}&profile=${profile}`;
  
  const getDirectUrl = (p: typeof profile) => {
    if (p === 'walking') {
      return `https://routing.openstreetmap.de/routed-foot/route/v1/foot/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
    } else if (p === 'cycling') {
      return `https://routing.openstreetmap.de/routed-bike/route/v1/bicycle/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
    } else {
      return `https://routing.openstreetmap.de/routed-car/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
    }
  };
  const fallbackUrl = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;

  try {
    let response = await fetch(url);
    let data;

    // Direct fallback if proxy is missing (e.g. static host / GitHub Pages deployment)
    if (response.status === 404) {
      console.warn('Proxy returned 404. Falling back to direct OSRM routing request...');
      const directUrl = getDirectUrl(profile);
      try {
        response = await fetch(directUrl);
      } catch (e) {
        if (profile === 'driving') {
          response = await fetch(fallbackUrl);
        } else {
          throw e;
        }
      }

      if (!response.ok) {
        if (profile === 'driving') {
          response = await fetch(fallbackUrl);
        }
        if (!response.ok) {
          throw new Error(`Direct OSRM route error: ${response.status} ${response.statusText}`);
        }
      }
    } else if (!response.ok) {
      throw new Error(`OSRM proxy error: ${response.status} ${response.statusText}`);
    }

    data = await response.json();
    
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
    console.error('Error in getRoute, trying emergency direct fallback...', error);
    try {
      const directUrl = getDirectUrl(profile);
      let response;
      try {
        response = await fetch(directUrl);
      } catch (e) {
        response = await fetch(fallbackUrl);
      }
      if (!response.ok) {
        response = await fetch(fallbackUrl);
      }
      if (!response.ok) {
        throw new Error(`Direct fallback routing error: ${response.status}`);
      }
      const data = await response.json();
      if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
        throw new Error(data.message || 'Маршрут не найден.');
      }
      const route = data.routes[0];
      const leafletCoordinates = route.geometry.coordinates.map(
        (coord: [number, number]) => [coord[1], coord[0]] as [number, number]
      );
      return {
        distance: route.distance,
        duration: route.duration,
        geometry: route.geometry,
        coordinates: leafletCoordinates,
        from,
        to
      };
    } catch (fallbackErr) {
      console.error('Direct fallback routing also failed:', fallbackErr);
      throw error;
    }
  }
}
