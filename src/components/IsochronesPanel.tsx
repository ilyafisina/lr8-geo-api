import { MapPin, Zap, Info, Download, Clipboard, Check } from 'lucide-react';
import { useState, useEffect } from 'react';
import * as turf from '@turf/turf';
import { LatLng, IsochroneResult } from '../types';

interface IsochronesPanelProps {
  lastClickedPoint: LatLng | null;
  isochroneResult: IsochroneResult | null;
  onCalculateIsochrone: (timeMin: number, speedKmh: number) => void;
  onClearIsochrone: () => void;
}

export default function IsochronesPanel({
  lastClickedPoint,
  isochroneResult,
  onCalculateIsochrone,
  onClearIsochrone
}: IsochronesPanelProps) {
  const [timeMin, setTimeMin] = useState<number>(15);
  const [speedType, setSpeedType] = useState<'walk' | 'bike' | 'car' | 'custom'>('walk');
  const [customSpeed, setCustomSpeed] = useState<number>(5);
  const [copied, setCopied] = useState(false);

  // Speed presets in km/h
  const speeds = {
    walk: 5,
    bike: 15,
    car: 40,
  };

  const getActiveSpeed = () => {
    return speedType === 'custom' ? customSpeed : speeds[speedType];
  };

  // Re-run calculations if inputs change and we already have a selected point
  useEffect(() => {
    if (lastClickedPoint) {
      onCalculateIsochrone(timeMin, getActiveSpeed());
    }
  }, [timeMin, speedType, customSpeed, lastClickedPoint]);

  const downloadGeoJSON = () => {
    if (!isochroneResult || !isochroneResult.polygon) return;
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(isochroneResult.polygon, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `isochrone_${timeMin}min_${getActiveSpeed()}kmh.geojson`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const copyGeoJSON = () => {
    if (!isochroneResult) return;
    navigator.clipboard.writeText(JSON.stringify(isochroneResult.polygon, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-slate-800 tracking-tight">API Изохрон (Turf.js)</h3>
        <p className="text-xs text-slate-500 mt-1">
          Построение приближенных пространственных изохрон (зон транспортной доступности) на основе скорости движения и затраченного времени.
        </p>
      </div>

      {/* Part 1: Input controls */}
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-4">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Настройки изохроны</h4>
        
        {/* Speed Option Toggles */}
        <div className="space-y-1.5">
          <label className="text-[10px] uppercase font-bold text-slate-400">Режим и скорость движения:</label>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              onClick={() => setSpeedType('walk')}
              className={`p-2 rounded-lg border cursor-pointer transition-colors text-left flex items-center justify-between ${
                speedType === 'walk' ? 'border-purple-500 bg-purple-50/50 text-purple-900 font-medium' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span>🚶 Пешком</span>
              <span className="text-[10px] text-slate-400">5 км/ч</span>
            </button>
            <button
              onClick={() => setSpeedType('bike')}
              className={`p-2 rounded-lg border cursor-pointer transition-colors text-left flex items-center justify-between ${
                speedType === 'bike' ? 'border-purple-500 bg-purple-50/50 text-purple-900 font-medium' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span>🚴 Велосипед</span>
              <span className="text-[10px] text-slate-400">15 км/ч</span>
            </button>
            <button
              onClick={() => setSpeedType('car')}
              className={`p-2 rounded-lg border cursor-pointer transition-colors text-left flex items-center justify-between ${
                speedType === 'car' ? 'border-purple-500 bg-purple-50/50 text-purple-900 font-medium' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span>🚗 Машина</span>
              <span className="text-[10px] text-slate-400">40 км/ч</span>
            </button>
            <button
              onClick={() => setSpeedType('custom')}
              className={`p-2 rounded-lg border cursor-pointer transition-colors text-left flex items-center justify-between ${
                speedType === 'custom' ? 'border-purple-500 bg-purple-50/50 text-purple-900 font-medium' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span>⚙️ Другое</span>
              <span className="text-[10px] text-slate-400">Задать</span>
            </button>
          </div>
        </div>

        {speedType === 'custom' && (
          <div className="space-y-1 bg-white p-3 rounded-lg border border-slate-200">
            <span className="text-[10px] text-slate-400 uppercase font-bold">Пользовательская скорость ({customSpeed} км/ч):</span>
            <input
              type="range"
              min="1"
              max="120"
              value={customSpeed}
              onChange={(e) => setCustomSpeed(parseInt(e.target.value))}
              className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
            />
          </div>
        )}

        {/* Time Sliders */}
        <div className="space-y-1.5 p-3 bg-white border border-slate-200 rounded-lg space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-slate-400 uppercase font-bold">Время движения:</span>
            <span className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">{timeMin} минут</span>
          </div>
          <input
            type="range"
            min="5"
            max="120"
            step="5"
            value={timeMin}
            onChange={(e) => setTimeMin(parseInt(e.target.value))}
            className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
          />
        </div>
      </div>

      {/* Part 2: Selected Centroid Information */}
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-4">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Центр изохроны</h4>
        {lastClickedPoint ? (
          <div className="space-y-3 font-mono text-xs">
            <div className="flex justify-between p-2.5 bg-white rounded-lg border border-slate-200">
              <span className="text-slate-400">Координаты:</span>
              <span className="font-bold text-slate-700">{lastClickedPoint.lat.toFixed(6)}°N, {lastClickedPoint.lng.toFixed(6)}°E</span>
            </div>
            
            {isochroneResult && (
              <div className="grid grid-cols-2 gap-3 shrink-0">
                <div className="bg-white p-3 rounded-lg border border-slate-200">
                  <div className="text-[9px] text-slate-400 font-bold uppercase font-sans">Итоговый радиус zone:</div>
                  <div className="text-sm font-extrabold text-slate-700 mt-1">{isochroneResult.radiusKm.toFixed(3)} км</div>
                </div>
                <div className="bg-white p-3 rounded-lg border border-slate-200">
                  <div className="text-[9px] text-slate-400 font-bold uppercase font-sans font-mono">Скорость (V):</div>
                  <div className="text-sm font-extrabold text-slate-700 mt-1">{isochroneResult.speedKmh} км/ч</div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 bg-amber-50/50 text-amber-800 text-xs rounded-lg border border-amber-100 flex items-start gap-2">
            <MapPin className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <div className="space-y-1 leading-snug">
              <div className="font-bold">Инструкция:</div>
              <div>Кликните по карте Ростов-на-Дону в любой точке, чтобы задать центр изохроны. Программа автоматически сгенерирует полигон доступности на основе выбранных параметров.</div>
            </div>
          </div>
        )}
      </div>

      {/* Part 3: Isochrone GeoJSON Out */}
      {isochroneResult && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
            <div className="flex justify-between items-center bg-slate-800 px-3 py-1.5 border-b border-slate-700">
              <span className="text-[10px] text-slate-400 font-mono">isochrone_circle.geojson</span>
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
            <pre className="p-3 text-[9px] text-purple-400 font-mono overflow-x-auto max-h-40 overflow-y-auto leading-relaxed">
              {JSON.stringify(isochroneResult.polygon, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* Academic Explainer for GIS Laboratory */}
      <div className="p-3 bg-blue-50 text-blue-800 text-xs rounded-xl border border-blue-100 flex gap-2.5">
        <Zap className="h-4 w-4 shrink-0 text-blue-400 mt-0.5" />
        <div className="space-y-1 leading-snug">
          <div className="font-bold font-sans">Сборка изохроны полигона:</div>
          <div>Используется алгоритм Turf.js, который представляет круговые границы как правильные многоугольники с высокой дискретизацией (по умолчанию 64 вершины). Это делает полигон математически валидным согласно стандарту ISO 19107 и спецификации Simple Features OGC.</div>
        </div>
      </div>
    </div>
  );
}
