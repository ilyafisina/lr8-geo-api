import { MapPin, Info, Clipboard, Check } from 'lucide-react';
import { useState } from 'react';
import { LatLng, GeohashResult } from '../types';

interface GeohashPanelProps {
  lastClickedPoint: LatLng | null;
  geohashResult: GeohashResult | null;
}

export default function GeohashPanel({ lastClickedPoint, geohashResult }: GeohashPanelProps) {
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(label);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-slate-800 tracking-tight">API Геохеширования (Geohash)</h3>
        <p className="text-xs text-slate-500 mt-1">
          Геохеш преобразует пары широта/долгота в строку символов, определяющую прямоугольную ячейку на поверхности Земли.
        </p>
      </div>

      {/* Part 1: Selected coordinates */}
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-4">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Исходная точка</h4>
        {lastClickedPoint ? (
          <div className="space-y-1.5 font-mono text-xs">
            <div className="flex justify-between p-2 bg-white rounded border border-slate-200">
              <span className="text-slate-400">Широта (Lat):</span>
              <span className="font-bold text-slate-700">{lastClickedPoint.lat.toFixed(7)}</span>
            </div>
            <div className="flex justify-between p-2 bg-white rounded border border-slate-200">
              <span className="text-slate-400">Долгота (Lng):</span>
              <span className="font-bold text-slate-700">{lastClickedPoint.lng.toFixed(7)}</span>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-amber-50/50 text-amber-800 text-xs rounded-lg border border-amber-100 flex items-start gap-2">
            <MapPin className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
            <div className="space-y-1 leading-snug">
              <div className="font-bold">Действие:</div>
              <div>Кликните где-нибудь на карте Ростов-на-Дону, чтобы рассчитать геохеш для этой точки.</div>
            </div>
          </div>
        )}
      </div>

      {/* Part 2: Calculated Length Options */}
      {geohashResult && (
        <div className="space-y-4">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3.5">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Результаты расчета геохеша</h4>
            
            {/* Geohash 5 */}
            <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1.5 relative group">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Прецизионность 5 (Ячейка ~4.9 x 4.9 км)</span>
                <button
                  onClick={() => copyToClipboard(geohashResult.hash5, 'h5')}
                  className="text-slate-400 hover:text-blue-500 cursor-pointer p-0.5 rounded transition-all"
                >
                  {copiedHash === 'h5' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Clipboard className="h-3.5 w-3.5" />}
                </button>
              </div>
              <div className="font-mono text-lg font-extrabold text-blue-600 block tracking-widest bg-blue-50/30 py-1 px-2 rounded w-fit">
                {geohashResult.hash5}
              </div>
            </div>

            {/* Geohash 7 */}
            <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1.5 relative group">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Прецизионность 7 (Ячейка ~152 x 152 м)</span>
                <button
                  onClick={() => copyToClipboard(geohashResult.hash7, 'h7')}
                  className="text-slate-400 hover:text-blue-500 cursor-pointer p-0.5 rounded transition-all"
                >
                  {copiedHash === 'h7' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Clipboard className="h-3.5 w-3.5" />}
                </button>
              </div>
              <div className="font-mono text-lg font-extrabold text-blue-600 block tracking-widest bg-blue-50/30 py-1 px-2 rounded w-fit">
                {geohashResult.hash7}
              </div>
            </div>

            {/* Geohash 9 */}
            <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1.5 relative group">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Прецизионность 9 (Ячейка ~4.8 x 4.8 м)</span>
                <button
                  onClick={() => copyToClipboard(geohashResult.hash9, 'h9')}
                  className="text-slate-400 hover:text-blue-500 cursor-pointer p-0.5 rounded transition-all"
                >
                  {copiedHash === 'h9' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Clipboard className="h-3.5 w-3.5" />}
                </button>
              </div>
              <div className="font-mono text-lg font-extrabold text-blue-600 block tracking-widest bg-blue-50/30 py-1 px-2 rounded w-fit">
                {geohashResult.hash9}
              </div>
            </div>
          </div>

          {/* Center Coordinates of Geohash */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Центр ячейки геохеша (Precision 9)</h4>
            <div className="font-mono text-xs p-3 bg-white border border-slate-200 rounded-lg space-y-1">
              <div>Широта (Lat): <span className="font-bold text-slate-700">{geohashResult.center.lat.toFixed(7)}</span></div>
              <div>Долгота (Lng): <span className="font-bold text-slate-700">{geohashResult.center.lng.toFixed(7)}</span></div>
            </div>
            <p className="text-[10px] text-slate-400 italic">
              * На карте синей рамкой отображен геометрический контур ячейки Geohash, а красной точкой — её расчётный центр.
            </p>
          </div>
        </div>
      )}

      
    </div>
  );
}
