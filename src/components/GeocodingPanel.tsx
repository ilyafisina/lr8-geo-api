import React, { useState } from 'react';
import { Search, MapPin, Loader2, Navigation, Undo } from 'lucide-react';
import { geocodeAddress } from '../services/geoService';
import { GeocodingResult, LatLng } from '../types';

interface GeocodingPanelProps {
  onSelectPoint: (coords: LatLng, address: string) => void;
  lastClickedPoint: LatLng | null;
  reverseGeocodeAddress: string | null;
  onTriggerReverseGeocode: () => void;
  isReverseLoading: boolean;
}

export default function GeocodingPanel({
  onSelectPoint,
  lastClickedPoint,
  reverseGeocodeAddress,
  onTriggerReverseGeocode,
  isReverseLoading
}: GeocodingPanelProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodingResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorString, setErrorString] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsLoading(true);
    setErrorString(null);
    try {
      const resp = await geocodeAddress(query);
      setResults(resp);
      if (resp.length === 0) {
        setErrorString('Адреса не найдены. Попробуйте уточнить запрос (например, "Большая Садовая, 105").');
      }
    } catch (err: any) {
      setErrorString('Не удалось связаться с сервером Nominatim. Проверьте сеть.');
    } finally {
      setIsLoading(false);
    }
  };

  const selectResult = (item: GeocodingResult) => {
    onSelectPoint({ lat: item.lat, lng: item.lon }, item.displayName);
    setQuery(item.displayName);
    setResults([]);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-slate-800 tracking-tight">API Геокодирования (Nominatim)</h3>
        <p className="text-xs text-slate-500 mt-1">
          Прямое геокодирование (поиск координат по адресу) и обратное геокодирование (поиск адреса по клику на карте).
        </p>
      </div>

      {/* Part 1: Forward Geocoding */}
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-4">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Прямое геокодирование</h4>
        <form onSubmit={handleSearch} className="relative flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              className="w-full text-xs pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 transition-shadow"
              placeholder="Введите адрес в Ростове-на-Дону..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={isLoading || !query.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-xs px-4 py-2.5 rounded-lg transition-colors font-medium flex items-center gap-1.5 cursor-pointer shadow-sm shadow-blue-100"
          >
            {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Navigation className="h-3 w-3" />}
            Поиск
          </button>
        </form>

        {errorString && (
          <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-100 font-medium">
            {errorString}
          </div>
        )}

        {results.length > 0 && (
          <div className="bg-white border border-slate-100 rounded-lg max-h-48 overflow-y-auto divide-y divide-slate-50 shadow-sm">
            {results.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => selectResult(item)}
                className="w-full text-left p-2.5 text-[11px] text-slate-600 hover:bg-blue-50/50 transition-colors flex items-start gap-2 cursor-pointer"
              >
                <MapPin className="h-3.5 w-3.5 text-blue-500 mt-0.5 shrink-0" />
                <div className="truncate">
                  <div className="font-semibold text-slate-700">{item.displayName}</div>
                  <div className="text-slate-400 truncate text-[10px]">{item.address}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Part 2: Reverse Geocoding */}
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-4">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Обратное геокодирование</h4>
        
        {lastClickedPoint ? (
          <div className="space-y-3">
            <div className="space-y-1.5 p-3 bg-white rounded-lg border border-slate-200">
              <div className="text-[10px] text-slate-400 font-mono uppercase">Координаты в клике:</div>
              <div className="font-mono text-xs font-semibold text-slate-700">
                Широта (Lat): <span className="text-blue-500">{lastClickedPoint.lat.toFixed(6)}</span>
              </div>
              <div className="font-mono text-xs font-semibold text-slate-700">
                Долгота (Lng): <span className="text-blue-500">{lastClickedPoint.lng.toFixed(6)}</span>
              </div>
            </div>

            <button
              onClick={onTriggerReverseGeocode}
              disabled={isReverseLoading}
              className="w-full py-2.5 px-4 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white font-medium rounded-lg text-xs transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-sm shadow-emerald-50"
            >
              {isReverseLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Undo className="h-3.5 w-3.5" />
              )}
              Определить адрес по координатам
            </button>

            {reverseGeocodeAddress && (
              <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-1">
                <div className="text-[10px] text-emerald-600 font-bold uppercase">Полученный адрес:</div>
                <p className="text-[11px] text-slate-600 leading-relaxed font-sans">{reverseGeocodeAddress}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 bg-amber-50/50 text-amber-800 text-xs rounded-lg border border-amber-100 flex items-start gap-2.5">
            <MapPin className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <div className="space-y-1 leading-snug">
              <div className="font-bold">Инструкция:</div>
              <div>Кликните в любой точке карты Ростов-на-Дону, чтобы получить точные географические координаты и запросить обратное геокодирование.</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
