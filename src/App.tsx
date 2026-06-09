import { useState } from 'react';
import { Search, Layers, Hash, Navigation, Zap, Map, FileCheck2, Info, Compass, HelpCircle } from 'lucide-react';
import { TabId, LatLng, GeohashResult, RouteResult, IsochroneResult, IndividualResult } from './types';
import { reverseGeocode, getRoute } from './services/geoService';
import { calculateGeohash, getGeohashBounds } from './utils/geoUtils';
import * as turf from '@turf/turf';

// Import our modular panels and the map layout component
import MainMap from './components/MainMap';
import GeocodingPanel from './components/GeocodingPanel';
import TilingPanel from './components/TilingPanel';
import GeohashPanel from './components/GeohashPanel';
import RoutingPanel from './components/RoutingPanel';
import IsochronesPanel from './components/IsochronesPanel';
import IndividualPanel from './components/IndividualPanel';
import TestsPanel from './components/TestsPanel';

export default function App() {
  // 1. Core Map and Layout State
  const [activeTab, setActiveTab] = useState<TabId>('geocoding');
  const [mapCenter, setMapCenter] = useState<LatLng>({ lat: 47.2357, lng: 39.7015 }); // Rostov-on-Don centroid
  const [mapZoom, setMapZoom] = useState<number>(12);
  const [visibleBbox, setVisibleBbox] = useState<[number, number, number, number] | null>(null);
  const [lastClickedPoint, setLastClickedPoint] = useState<LatLng | null>(null);

  // 2. Tab-Specific Functional states
  // Tab 1: Geocoding
  const [geocodingMarker, setGeocodingMarker] = useState<LatLng | null>(null);
  const [geocodingAddress, setGeocodingAddress] = useState<string | null>(null);
  const [reverseGeocodeAddress, setReverseGeocodeAddress] = useState<string | null>(null);
  const [isReverseLoading, setIsReverseLoading] = useState(false);

  // Tab 3: Geohashes
  const [geohashResult, setGeohashResult] = useState<GeohashResult | null>(null);

  // Tab 4: Routing OSRM
  const [routingStart, setRoutingStart] = useState<LatLng | null>(null);
  const [routingEnd, setRoutingEnd] = useState<LatLng | null>(null);
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);
  const [routingLoading, setRoutingLoading] = useState(false);
  const [routingErrorMsg, setRoutingErrorMsg] = useState<string | null>(null);
  const [activeSelectionMode, setActiveSelectionMode] = useState<'start' | 'end' | 'none'>('none');
  const [routingProfile, setRoutingProfile] = useState<'driving' | 'walking' | 'cycling'>('driving');

  // Tab 5: Isochrones
  const [isochroneResult, setIsochroneResult] = useState<IsochroneResult | null>(null);

  // Tab 6 & 7: Individual Track or Test presets loader
  const [uploadedRunResult, setUploadedRunResult] = useState<IndividualResult | null>(null);

  // 3. Central Event Callbacks
  const handleMapMove = (zoom: number, center: LatLng, bbox: [number, number, number, number]) => {
    setMapZoom(zoom);
    setMapCenter(center);
    setVisibleBbox(bbox);
  };

  const handleMapClick = async (latlng: LatLng) => {
    setLastClickedPoint(latlng);

    // Contextual handling depending on which tab is active
    if (activeTab === 'geocoding') {
      setGeocodingMarker(latlng);
      setGeocodingAddress(null);
      setReverseGeocodeAddress(null);
      setIsReverseLoading(true);
      try {
        const res = await reverseGeocode(latlng.lat, latlng.lng);
        setGeocodingAddress(res.address);
        setReverseGeocodeAddress(res.address);
      } catch (err) {
        setGeocodingAddress(`Кликнутая точка: ${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`);
      } finally {
        setIsReverseLoading(false);
      }
    } 
    
    else if (activeTab === 'geohash') {
      const computed = calculateGeohash(latlng.lat, latlng.lng);
      setGeohashResult(computed);
    } 
    
    else if (activeTab === 'routing') {
      if (activeSelectionMode === 'start') {
        setRoutingStart(latlng);
        setActiveSelectionMode('none');
        setRouteResult(null); // Clear obsolete paths
      } else if (activeSelectionMode === 'end') {
        setRoutingEnd(latlng);
        setActiveSelectionMode('none');
        setRouteResult(null);
      } else {
        // Sequentially set Start/End if no button selection mode is active
        if (!routingStart) {
          setRoutingStart(latlng);
        } else if (!routingEnd) {
          setRoutingEnd(latlng);
        } else {
          // If both are set, reset and set Start
          setRoutingStart(latlng);
          setRoutingEnd(null);
          setRouteResult(null);
        }
      }
    } 
    
    else if (activeTab === 'isochrones') {
      // Setup default time 15min and speed 5kmh
      const defaultTime = isochroneResult ? isochroneResult.timeMin : 15;
      const defaultSpeed = isochroneResult ? isochroneResult.speedKmh : 5;
      handleCalculateIsochrone(defaultTime, defaultSpeed, latlng);
    }
  };

  // Triggered buttons
  const handleTriggerReverseGeocode = async () => {
    if (!lastClickedPoint) return;
    setIsReverseLoading(true);
    setReverseGeocodeAddress(null);
    try {
      const res = await reverseGeocode(lastClickedPoint.lat, lastClickedPoint.lng);
      setReverseGeocodeAddress(res.address);
    } catch (err: any) {
      setReverseGeocodeAddress('Ошибка обратного геокодирования: ' + (err.message || 'Ошибка Nominatim'));
    } finally {
      setIsReverseLoading(false);
    }
  };

  const handleSelectGeocodingPoint = (coords: LatLng, address: string) => {
    setLastClickedPoint(coords);
    setGeocodingMarker(coords);
    setGeocodingAddress(address);
    setMapCenter(coords);
    setMapZoom(16);
  };

  const handleClearRouting = () => {
    setRoutingStart(null);
    setRoutingEnd(null);
    setRouteResult(null);
    setRoutingErrorMsg(null);
    setActiveSelectionMode('none');
  };

  const handleTriggerRoute = async () => {
    if (!routingStart || !routingEnd) return;
    setRoutingLoading(true);
    setRoutingErrorMsg(null);
    try {
      const route = await getRoute(routingStart, routingEnd, routingProfile);
      setRouteResult(route);
    } catch (err: any) {
      setRoutingErrorMsg(err.message || 'Сбой прокладки маршрута. Проверьте сервера OSRM.');
    } finally {
      setRoutingLoading(false);
    }
  };



  const handleCalculateIsochrone = (timeMin: number, speedKmh: number, clickedPoint: LatLng | null = lastClickedPoint) => {
    const centerPoint = clickedPoint || lastClickedPoint;
    if (!centerPoint) return;

    // Radius in km = speed * (mins / 60)
    const radiusKm = speedKmh * (timeMin / 60);
    const turfPoint = turf.point([centerPoint.lng, centerPoint.lat]);
    
    const circlePolygon = turf.circle(turfPoint, radiusKm, {
      units: 'kilometers',
      steps: 64
    });

    setIsochroneResult({
      polygon: circlePolygon,
      center: centerPoint,
      timeMin,
      speedKmh,
      radiusKm
    });
  };

  const handleClearIsochrone = () => {
    setIsochroneResult(null);
    setLastClickedPoint(null);
  };

  // Tabs metadata definition
  const tabs = [
    { id: 'geocoding', name: 'Геокодирование', icon: Search },
    { id: 'tiling', name: 'Тайлинг', icon: Layers },
    { id: 'geohash', name: 'Геохеш', icon: Hash },
    { id: 'routing', name: 'Маршрутизация', icon: Navigation },
    { id: 'isochrones', name: 'Изохроны', icon: Zap },
    { id: 'individual', name: 'GeoJSON (3 вариант)', icon: Map },
  ];

  const handleTabChange = (id: TabId) => {
    setActiveTab(id);
    setActiveSelectionMode('none');
    // Keep Rostov-on-Don centered if switching tabs,
    // but keep loaded workout routes visible in tests / individual assignment tabs
    if (id !== 'individual' && id !== 'tests') {
      setUploadedRunResult(null);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden font-sans bg-[#f8fafc] text-slate-900">
      
      {/* 1. Header Toolbar in Clean Minimalism Theme */}
      <header className="h-14 border-b border-slate-200 bg-white flex items-center justify-between px-6 shrink-0 text-slate-800 gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white font-bold text-sm tracking-tight shadow-sm shadow-blue-100">G</div>
          <div className="flex items-baseline gap-2">
            <h1 className="text-base font-semibold tracking-tight text-slate-800">
              Ростов На Дону - GIS
            </h1>
            <span className="text-slate-300 mx-2 hidden md:inline">|</span>
            <p className="text-xs text-slate-500 font-normal hidden md:inline">
              Лабораторная работа 8
            </p>
          </div>
        </div>
        
      </header>

      {/* 2. Main content split-screen dashboard layout */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden p-6 md:p-8 gap-6">
        
        {/* Left Side: Modular control panels */}
        <section className="w-full lg:w-[480px] xl:w-[500px] flex flex-col bg-white border border-slate-200 rounded-2xl h-full shadow-sm overflow-hidden shrink-0">
          
          {/* Subnavigation Tabs bar - Clean Minimalism style */}
          <nav className="flex overflow-x-auto border-b border-slate-100 bg-slate-50/50 p-2 gap-1.5 scrollbar-none shrink-0">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id as TabId)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap cursor-pointer border ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 border-blue-100 shadow-xs'
                      : 'text-slate-600 border-transparent hover:bg-slate-150 hover:text-slate-900'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{tab.name}</span>
                </button>
              );
            })}
          </nav>

          {/* Action Config panels */}
          <div className="flex-1 overflow-y-auto p-5 md:p-6 bg-white">
            {activeTab === 'geocoding' && (
              <GeocodingPanel
                onSelectPoint={handleSelectGeocodingPoint}
                lastClickedPoint={lastClickedPoint}
                reverseGeocodeAddress={reverseGeocodeAddress}
                onTriggerReverseGeocode={handleTriggerReverseGeocode}
                isReverseLoading={isReverseLoading}
              />
            )}

            {activeTab === 'tiling' && (
              <TilingPanel
                zoom={mapZoom}
                center={mapCenter}
                bbox={visibleBbox}
              />
            )}

            {activeTab === 'geohash' && (
              <GeohashPanel
                lastClickedPoint={lastClickedPoint}
                geohashResult={geohashResult}
              />
            )}

            {activeTab === 'routing' && (
              <RoutingPanel
                routingStart={routingStart}
                routingEnd={routingEnd}
                routeResult={routeResult}
                onClearRouting={handleClearRouting}
                onTriggerRoute={handleTriggerRoute}
                isLoading={routingLoading}
                errorMsg={routingErrorMsg}
                activeSelectionMode={activeSelectionMode}
                setActiveSelectionMode={setActiveSelectionMode}
                routingProfile={routingProfile}
                setRoutingProfile={setRoutingProfile}
              />
            )}

            {activeTab === 'isochrones' && (
              <IsochronesPanel
                lastClickedPoint={lastClickedPoint}
                isochroneResult={isochroneResult}
                onCalculateIsochrone={handleCalculateIsochrone}
                onClearIsochrone={handleClearIsochrone}
              />
            )}

            {activeTab === 'individual' && (
              <IndividualPanel
                onLoadRun={setUploadedRunResult}
                onClearRun={() => setUploadedRunResult(null)}
                runResult={uploadedRunResult}
              />
            )}

            {activeTab === 'tests' && (
              <TestsPanel
                onLoadRunOnMap={setUploadedRunResult}
                onClearRunOnMap={() => setUploadedRunResult(null)}
              />
            )}
          </div>

          {/* 3. DSTU Footer for clean dashboard spacing */}
          <div className="p-4 border-t border-slate-100 bg-slate-50 text-[10px] text-slate-400 shrink-0 font-medium">
            <p>© 2026 GIS Lab • DSTU University</p>
            <p>Rostov-on-Don, Russia</p>
          </div>
        </section>

        {/* Right Side: Map frame rendering, framed cleanly */}
        <section className="flex-1 h-full min-h-[350px] relative overflow-hidden bg-slate-100 border border-slate-200 rounded-2xl shadow-sm">
          <MainMap
            activeTab={activeTab}
            center={mapCenter}
            zoom={mapZoom}
            onMapClick={handleMapClick}
            onMapMove={handleMapMove}
            geocodingMarker={geocodingMarker}
            geocodingAddress={geocodingAddress}
            geohashBounds={geohashResult ? getGeohashBounds(geohashResult.hash9) : null}
            geohashCenter={geohashResult ? geohashResult.center : null}
            routingStart={routingStart}
            routingEnd={routingEnd}
            routingRoute={routeResult ? routeResult.geometry : null}
            isochroneCenter={isochroneResult ? isochroneResult.center : null}
            isochronePolygon={isochroneResult ? isochroneResult.polygon : null}
            runGeojson={uploadedRunResult ? uploadedRunResult.geojson : null}
            runBboxPolygon={uploadedRunResult ? uploadedRunResult.bboxPolygon : null}
          />
        </section>
      </main>
    </div>
  );
}
