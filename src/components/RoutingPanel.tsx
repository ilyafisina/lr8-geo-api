import { MapPin, Navigation, Compass, Loader2, Download, HelpCircle, Clipboard, Check, Car, Footprints, Bike } from 'lucide-react';
import { useState } from 'react';
import { LatLng, RouteResult } from '../types';

interface RoutingPanelProps {
  routingStart: LatLng | null;
  routingEnd: LatLng | null;
  routeResult: RouteResult | null;
  onClearRouting: () => void;
  onTriggerRoute: () => void;
  isLoading: boolean;
  errorMsg: string | null;
  activeSelectionMode: 'start' | 'end' | 'none';
  setActiveSelectionMode: (mode: 'start' | 'end' | 'none') => void;
  routingProfile: 'driving' | 'walking' | 'cycling';
  setRoutingProfile: (profile: 'driving' | 'walking' | 'cycling') => void;
}

export default function RoutingPanel({
  routingStart,
  routingEnd,
  routeResult,
  onClearRouting,
  onTriggerRoute,
  isLoading,
  errorMsg,
  activeSelectionMode,
  setActiveSelectionMode,
  routingProfile,
  setRoutingProfile
}: RoutingPanelProps) {
  const [copied, setCopied] = useState(false);

  const downloadGeoJSON = () => {
    if (!routeResult || !routeResult.geometry) return;
    
    // Create standard Feature containing our OSRM route LineString polyline
    const routeFeature = {
      type: 'Feature',
      properties: {
        name: 'OSRM Маршрут по Ростову-на-Дону',
        distance_meters: routeResult.distance,
        duration_seconds: routeResult.duration,
        timestamp: new Date().toISOString()
      },
      geometry: routeResult.geometry
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(routeFeature, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', 'osrm_route.geojson');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const copyGeoJSON = () => {
    if (!routeResult) return;
    const routeFeature = {
      type: 'Feature',
      properties: {
        name: 'OSRM Route',
        distance_m: routeResult.distance,
        duration_s: routeResult.duration
      },
      geometry: routeResult.geometry
    };
    navigator.clipboard.writeText(JSON.stringify(routeFeature, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formattedDistance = routeResult
    ? (routeResult.distance >= 1000 
        ? `${(routeResult.distance / 1000).toFixed(2)} км` 
        : `${routeResult.distance} м`)
    : '';

  const formattedDuration = routeResult
    ? (routeResult.duration >= 60 
        ? `${Math.floor(routeResult.duration / 60)} мин ${Math.round(routeResult.duration % 60)} сек` 
        : `${Math.round(routeResult.duration)} сек`)
    : '';

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-slate-800 tracking-tight">API Маршрутизации (OSRM)</h3>
        <p className="text-xs text-slate-500 mt-1">
          Построение оптимальных пешеходных, велосипедных и автомобильных маршрутов между двумя точками с помощью движка OSRM.
        </p>
      </div>

      {/* Выбор режима транспорта */}
      <div className="space-y-2.5">
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Выбор режима транспорта</label>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setRoutingProfile('driving')}
            className={`flex flex-col items-center justify-center py-2.5 px-3 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
              routingProfile === 'driving'
                ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-xs scale-[0.98]'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-800'
            }`}
          >
            <Car className="h-4 w-4 mb-1 text-blue-600" />
            <span>На машине</span>
          </button>
          
          <button
            type="button"
            onClick={() => setRoutingProfile('walking')}
            className={`flex flex-col items-center justify-center py-2.5 px-3 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
              routingProfile === 'walking'
                ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-xs scale-[0.98]'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-800'
            }`}
          >
            <Footprints className="h-4 w-4 mb-1 text-emerald-600" />
            <span>Пешком</span>
          </button>
          
          <button
            type="button"
            onClick={() => setRoutingProfile('cycling')}
            className={`flex flex-col items-center justify-center py-2.5 px-3 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
              routingProfile === 'cycling'
                ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-xs scale-[0.98]'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-800'
            }`}
          >
            <Bike className="h-4 w-4 mb-1 text-amber-600" />
            <span>Велосипед</span>
          </button>
        </div>
      </div>

      {/* Part 1: Interactive point selectors */}
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-4">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Настройка точек</h4>

        <div className="space-y-3">
          {/* Point A */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveSelectionMode('start')}
              className={`flex-1 text-left p-3 rounded-lg border text-xs transition-all flex items-center justify-between cursor-pointer ${
                activeSelectionMode === 'start'
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-500 font-semibold'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-[10px]">A</span>
                <span>Старт (Точка A)</span>
              </div>
              <span className="text-[10px] uppercase font-bold text-slate-400">
                {routingStart ? 'Установлена' : 'Выбрать на карте'}
              </span>
            </button>
          </div>
          {routingStart && (
            <div className="font-mono text-[10px] text-slate-500 pl-8 -mt-2">
              Lat: {routingStart.lat.toFixed(5)}, Lng: {routingStart.lng.toFixed(5)}
            </div>
          )}

          {/* Point B */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveSelectionMode('end')}
              className={`flex-1 text-left p-3 rounded-lg border text-xs transition-all flex items-center justify-between cursor-pointer ${
                activeSelectionMode === 'end'
                  ? 'border-red-500 bg-red-50 text-red-800 ring-1 ring-red-500 font-semibold'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center font-bold text-[10px]">B</span>
                <span>Финиш (Точка B)</span>
              </div>
              <span className="text-[10px] uppercase font-bold text-slate-400">
                {routingEnd ? 'Установлена' : 'Выбрать на карте'}
              </span>
            </button>
          </div>
          {routingEnd && (
            <div className="font-mono text-[10px] text-slate-500 pl-8 -mt-2">
              Lat: {routingEnd.lat.toFixed(5)}, Lng: {routingEnd.lng.toFixed(5)}
            </div>
          )}
        </div>

        {activeSelectionMode !== 'none' && (
          <div className="p-2.5 bg-amber-50 text-amber-800 text-[11px] rounded-lg border border-amber-100 flex items-center gap-2">
            <Compass className="h-3.5 w-3.5 text-amber-500 shrink-0 animate-spin" />
            <div>Кликните по любой точке на карте, чтобы привязать её к выбранному маркеру.</div>
          </div>
        )}
      </div>

      {/* Part 2: Calculate trigger */}
      <div className="flex gap-2.5">
        <button
          onClick={onTriggerRoute}
          disabled={isLoading || !routingStart || !routingEnd}
          className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium rounded-lg text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm shadow-blue-100"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Рассчитываем маршрут...
            </>
          ) : (
            <>
              <Navigation className="h-3.5 w-3.5" />
              Рассчитать маршрут OSRM
            </>
          )}
        </button>

        {(routingStart || routingEnd || routeResult) && (
          <button
            onClick={onClearRouting}
            className="px-4 py-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs transition-colors cursor-pointer"
          >
            Сброс
          </button>
        )}
      </div>

      {errorMsg && (
        <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-100">
          <strong>Ошибка OSRM:</strong> {errorMsg}
        </div>
      )}

      {/* Part 3: Routing Output */}
      {routeResult && (
        <div className="space-y-4">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3.5">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Характеристики маршрута</h4>

            <div className="grid grid-cols-2 gap-3 font-semibold">
              <div className="bg-white p-3 rounded-lg border border-slate-200">
                <div className="text-[10px] text-slate-400 uppercase font-mono">Общая дистанция:</div>
                <div className="text-sm font-bold text-slate-700 mt-1">{formattedDistance}</div>
              </div>
              <div className="bg-white p-3 rounded-lg border border-slate-200">
                <div className="text-[10px] text-slate-400 uppercase font-mono">Расчётное время:</div>
                <div className="text-sm font-bold text-slate-700 mt-1">{formattedDuration}</div>
              </div>
            </div>

            <p className="text-[10px] text-slate-400 leading-snug">
              * Маршрут успешно прорисован на карте синей линией. Для использования в ГИС вы можете скопировать или скачать полученный GeoJSON.
            </p>
          </div>

          {/* Codeblock display */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
            <div className="flex justify-between items-center bg-slate-800 px-3 py-1.5 border-b border-slate-700">
              <span className="text-[10px] text-slate-400 font-mono">osrm_route.geojson</span>
              <div className="flex gap-2">
                <button
                  onClick={copyGeoJSON}
                  className="text-slate-400 hover:text-white cursor-pointer p-0.5 rounded transition-all"
                  title="Копировать в буфер"
                >
                  {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Clipboard className="h-3 w-3" />}
                </button>
                <button
                  onClick={downloadGeoJSON}
                  className="text-slate-400 hover:text-white cursor-pointer p-0.5 rounded transition-all"
                  title="Скачать файл"
                >
                  <Download className="h-3 w-3" />
                </button>
              </div>
            </div>
            <pre className="p-3 text-[9px] text-teal-400 font-mono overflow-x-auto max-h-40 overflow-y-auto leading-relaxed">
              {JSON.stringify(
                {
                  type: 'Feature',
                  properties: {
                    distance_m: routeResult.distance,
                    duration_s: routeResult.duration
                  },
                  geometry: routeResult.geometry
                },
                null,
                2
              )}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
