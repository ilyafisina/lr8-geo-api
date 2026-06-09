import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { LatLng, TabId } from '../types';

// Standard Leaflet marker asset fixes
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
});

interface MainMapProps {
  activeTab: TabId;
  center: LatLng;
  zoom: number;
  onMapClick?: (latlng: LatLng) => void;
  onMapMove?: (zoom: number, center: LatLng, bbox: [number, number, number, number]) => void;
  geocodingMarker?: LatLng | null;
  geocodingAddress?: string | null;
  geohashBounds?: [number, number][] | null;
  geohashCenter?: LatLng | null;
  routingStart?: LatLng | null;
  routingEnd?: LatLng | null;
  routingRoute?: any | null; // GeoJSON
  isochroneCenter?: LatLng | null;
  isochronePolygon?: any | null; // GeoJSON Circle Polygon
  isochroneRadius?: number;
  runGeojson?: any | null; // GeoJSON from uploaded run / test preset
  runBboxPolygon?: any | null; // Bounding box polygon
  isTestMode?: boolean;
}

export default function MainMap({
  activeTab,
  center,
  zoom,
  onMapClick,
  onMapMove,
  geocodingMarker,
  geocodingAddress,
  geohashBounds,
  geohashCenter,
  routingStart,
  routingEnd,
  routingRoute,
  isochroneCenter,
  isochronePolygon,
  runGeojson,
  runBboxPolygon,
  isTestMode
}: MainMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  // Layer groups to easily clear/redraw specific geometry overlays on tab actions
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  // Maintain fresh callbacks via refs to bypass stale Leaflet event subscription closures
  const onMapClickRef = useRef(onMapClick);
  const onMapMoveRef = useRef(onMapMove);

  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);

  useEffect(() => {
    onMapMoveRef.current = onMapMove;
  }, [onMapMove]);

  // 1. Initialize map once
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Use preferCanvas: true for rendering tiles to canvas
    const map = L.map(mapContainerRef.current, {
      center: [center.lat, center.lng],
      zoom: zoom,
      preferCanvas: true,
      zoomControl: true,
    });

    // Add standard OpenStreetMap tiles
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      crossOrigin: true // Important for CORS/Screenshot captures
    }).addTo(map);

    const layerGroup = L.layerGroup().addTo(map);
    layerGroupRef.current = layerGroup;
    mapRef.current = map;

    // Set up map click handler
    map.on('click', (e: L.LeafletMouseEvent) => {
      if (onMapClickRef.current) {
        onMapClickRef.current({ lat: e.latlng.lat, lng: e.latlng.lng });
      }
    });

    // Set up map drag / zoom monitoring
    const handleMapMovement = () => {
      if (onMapMoveRef.current) {
        const curZoom = map.getZoom();
        const curCent = map.getCenter();
        const bounds = map.getBounds();
        const bbox: [number, number, number, number] = [
          bounds.getWest(),
          bounds.getSouth(),
          bounds.getEast(),
          bounds.getNorth(),
        ];
        onMapMoveRef.current(curZoom, { lat: curCent.lat, lng: curCent.lng }, bbox);
      }
    };

    map.on('moveend', handleMapMovement);
    map.on('zoomend', handleMapMovement);

    // Initial values trigger
    setTimeout(() => {
      handleMapMovement();
    }, 100);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // 2. Drive map camera views externally (when central coordinates or zoom modifications occur programmatically)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const currentCenter = map.getCenter();
    const currentZoom = map.getZoom();

    // Check if difference is meaningful to prevent recursive map dragging loops
    const latDiff = Math.abs(currentCenter.lat - center.lat);
    const lngDiff = Math.abs(currentCenter.lng - center.lng);

    if (latDiff > 0.0001 || lngDiff > 0.0001 || currentZoom !== zoom) {
      map.setView([center.lat, center.lng], zoom, { animate: true });
    }
  }, [center, zoom]);

  // 3. Render markers, trails, overlays whenever active tabs or values change
  useEffect(() => {
    const map = mapRef.current;
    const layerGroup = layerGroupRef.current;
    if (!map || !layerGroup) return;

    // Clear previously displayed items
    layerGroup.clearLayers();

    // SECTION 1: GEOCODING OVERLAY
    if (activeTab === 'geocoding' && geocodingMarker) {
      const marker = L.marker([geocodingMarker.lat, geocodingMarker.lng])
        .bindPopup(geocodingAddress || `Выбранная точка: ${geocodingMarker.lat.toFixed(5)}, ${geocodingMarker.lng.toFixed(5)}`)
        .addTo(layerGroup);
      marker.openPopup();
      map.panTo([geocodingMarker.lat, geocodingMarker.lng]);
    }

    // SECTION 2: TILING OVERLAY (visualize bounding box if requested, default to none or a subtle border)
    // Tiling doesn't require a persistent overlay since it's displaying the current visible bounding box

    // SECTION 3: GEOHASH OVERLAY
    if (activeTab === 'geohash') {
      if (geohashCenter) {
        L.circleMarker([geohashCenter.lat, geohashCenter.lng], {
          radius: 6,
          color: '#ef4444', // red-500
          fillColor: '#ef4444',
          fillOpacity: 0.8
        }).bindPopup('Центр геохеша (Precision 9)').addTo(layerGroup);
      }
      if (geohashBounds && geohashBounds.length > 0) {
        // Construct standard polygon for bounds
        const polyCoords = geohashBounds.map(b => [b[0], b[1]] as [number, number]);
        L.polygon(polyCoords, {
          color: '#3b82f6', // blue-500
          weight: 2,
          fillColor: '#3b82f6',
          fillOpacity: 0.15
        }).addTo(layerGroup);
      }
    }

    // SECTION 4: ROUTING OVERLAY
    if (activeTab === 'routing') {
      if (routingStart) {
        L.marker([routingStart.lat, routingStart.lng], {
          icon: L.divIcon({
            html: '<div class="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-xs ring-4 ring-white shadow">A</div>',
            className: 'custom-div-icon',
            iconSize: [32, 32],
            iconAnchor: [16, 16]
          })
        }).bindPopup('Точка старта А').addTo(layerGroup);
      }
      if (routingEnd) {
        L.marker([routingEnd.lat, routingEnd.lng], {
          icon: L.divIcon({
            html: '<div class="w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center font-bold text-xs ring-4 ring-white shadow">B</div>',
            className: 'custom-div-icon',
            iconSize: [32, 32],
            iconAnchor: [16, 16]
          })
        }).bindPopup('Точка финиша B').addTo(layerGroup);
      }
      if (routingRoute) {
        L.geoJSON(routingRoute, {
          style: {
            color: '#3b82f6',
            weight: 5,
            opacity: 0.85
          }
        }).addTo(layerGroup);
      }
    }

    // SECTION 5: ISOCHRONES OVERLAY
    if (activeTab === 'isochrones') {
      if (isochroneCenter) {
        L.circleMarker([isochroneCenter.lat, isochroneCenter.lng], {
          radius: 7,
          color: '#a855f7', // purple-500
          fillColor: '#ffffff',
          weight: 3,
          fillOpacity: 1
        }).bindPopup('Центр изохроны').addTo(layerGroup).openPopup();
      }
      if (isochronePolygon) {
        L.geoJSON(isochronePolygon, {
          style: {
            color: '#a855f7',
            weight: 2,
            fillColor: '#a855f7',
            fillOpacity: 0.2
          }
        }).addTo(layerGroup);
      }
    }

    // SECTION 6 OR 7: WORKOUT INDIVIDUAL RUN / PRESETS OVERLAYS
    if ((activeTab === 'individual' || activeTab === 'tests') && runGeojson) {
      try {
        // Draw the primary GeoJSON track
        const mainOverlay = L.geoJSON(runGeojson, {
          style: (feature) => {
            const isPolygon = feature?.geometry?.type === 'Polygon';
            return {
              color: isPolygon ? '#06b6d4' : '#ec4899', // cyan-500 or pink-500
              weight: 4,
              opacity: 0.9,
              fillColor: '#06b6d4',
              fillOpacity: 0.15
            };
          }
        }).addTo(layerGroup);

        // Draw bounding box polygon
        if (runBboxPolygon) {
          L.geoJSON(runBboxPolygon, {
            style: {
              color: '#64748b', // slate-500
              weight: 1.5,
              dashArray: '5, 5',
              fillOpacity: 0.03,
              fillColor: '#000000'
            }
          }).addTo(layerGroup);
        }

        // Fit map bounds to show route perfectly
        if (mainOverlay.getBounds().isValid()) {
          map.fitBounds(mainOverlay.getBounds(), { padding: [40, 40], animate: true });
        }
      } catch (err) {
        console.error('Error drawing GeoJSON layers: ', err);
      }
    }

  }, [
    activeTab,
    geocodingMarker,
    geocodingAddress,
    geohashBounds,
    geohashCenter,
    routingStart,
    routingEnd,
    routingRoute,
    isochroneCenter,
    isochronePolygon,
    runGeojson,
    runBboxPolygon,
    isTestMode
  ]);

  return (
    <div className="relative w-full h-full shadow-inner rounded-2xl overflow-hidden border border-slate-200">
      <div id="map-element" ref={mapContainerRef} className="w-full h-full" />
      
      {/* Mini Helper Overlay Info on map */}
      <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur px-3 py-1.5 rounded-lg shadow-sm border border-slate-200 text-[11px] text-slate-500 select-none z-[1000] flex items-center gap-1.5 font-mono">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
        OSM Тайлы • Ростов-на-Дону
      </div>
    </div>
  );
}
