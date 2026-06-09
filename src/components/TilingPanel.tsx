import { useState } from 'react';
import { Layers, HelpCircle, Compass, Maximize2, Hash } from 'lucide-react';
import { LatLng } from '../types';
import { getTilesForBbox, getBboxDimensions } from '../utils/geoUtils';
import TileViewer from './TileViewer';

interface TilingPanelProps {
  zoom: number;
  center: LatLng;
  bbox: [number, number, number, number] | null; // [minLon, minLat, maxLon, maxLat]
}

export default function TilingPanel({ zoom, center, bbox }: TilingPanelProps) {
  const [targetZoom, setTargetZoom] = useState<number>(14);

  // Calculates bounding box parameters
  const dims = bbox ? getBboxDimensions(bbox) : null;
  const tileStats = bbox ? getTilesForBbox(bbox, targetZoom) : null;

  // Let's generate stats for multiple zoom levels (for educational purposes in GIS lab)
  const zoomOptions = [10, 12, 14, 16, 18];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-slate-800 tracking-tight">API Тайлинга (OpenStreetMap)</h3>
        <p className="text-xs text-slate-500 mt-1">
          Демонстрирует разложение двумерного пространства на пирамиду тайлов EPSG:3857 (Web Mercator).
        </p>
      </div>

      {/* Part 1: Current State */}
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-4">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5" />
          Текущее состояние камеры
        </h4>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white p-3 rounded-lg border border-slate-200">
            <div className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1">
              <Layers className="h-3 w-3 text-blue-500" /> Масштаб (Zoom)
            </div>
            <div className="font-mono text-base font-bold text-slate-700 mt-1">{zoom}</div>
          </div>
          <div className="bg-white p-3 rounded-lg border border-slate-200">
            <div className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1">
              <Compass className="h-3 w-3 text-blue-500" /> Центр карты
            </div>
            <div className="font-mono text-[11px] font-semibold text-slate-600 mt-1 space-y-0.5">
              <div>Lat: {center.lat.toFixed(5)}</div>
              <div>Lng: {center.lng.toFixed(5)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Part 2: Visible Bounding Box (BBox) */}
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-4">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <Maximize2 className="h-3.5 w-3.5" />
          Bounding Box видимой области
        </h4>

        {bbox ? (
          <div className="space-y-4">
            <div className="font-mono text-[11px] p-3 bg-white border border-slate-200 rounded-lg divide-y divide-slate-100 space-y-1.5">
              <div className="pb-1.5 flex justify-between">
                <span className="text-slate-400 uppercase text-[9px] font-bold">СВ (North-East):</span>
                <span className="text-slate-700 font-semibold">{bbox[3].toFixed(5)}°N, {bbox[2].toFixed(5)}°E</span>
              </div>
              <div className="py-1.5 flex justify-between">
                <span className="text-slate-400 uppercase text-[9px] font-bold">ЮЗ (South-West):</span>
                <span className="text-slate-700 font-semibold">{bbox[1].toFixed(5)}°N, {bbox[0].toFixed(5)}°E</span>
              </div>
              {dims && (
                <div className="pt-1.5 flex justify-between font-mono bg-blue-50/20 px-1 py-0.5 rounded text-blue-800">
                  <span className="text-blue-500 uppercase text-[9px] font-bold">Размеры области:</span>
                  <span className="font-bold">{dims.widthKm} км × {dims.heightKm} км</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-xs text-slate-400 p-2 text-center">Вычисление границ bounding box...</div>
        )}
      </div>

      {/* Part 3: Tile Grid Math API */}
      {bbox && tileStats && (
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Hash className="h-3.5 w-3.5" />
              Расчет тайлов на зуме
            </h4>
            
            <select
              value={targetZoom}
              onChange={(e) => setTargetZoom(parseInt(e.target.value))}
              className="text-[11px] px-2 py-1 bg-white border border-slate-200 rounded focus:outline-none cursor-pointer"
            >
              {[10, 11, 12, 13, 14, 15, 16, 17, 18].map(z => (
                <option key={z} value={z}>Зум {z}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="bg-white p-3 rounded-lg border border-slate-200">
              <div className="text-[9px] text-slate-400 font-mono font-bold uppercase">Диапазон X тайлов:</div>
              <div className="font-mono text-xs font-bold text-slate-700 mt-1">
                {tileStats.minX} — {tileStats.maxX}
              </div>
            </div>
            <div className="bg-white p-3 rounded-lg border border-slate-200">
              <div className="text-[9px] text-slate-400 font-mono font-bold uppercase">Диапазон Y тайлов:</div>
              <div className="font-mono text-xs font-bold text-slate-700 mt-1">
                {tileStats.minY} — {tileStats.maxY}
              </div>
            </div>
          </div>

          <div className="p-3 bg-blue-50 rounded-lg text-xs border border-blue-100 flex items-center justify-between font-mono">
            <span className="font-medium text-blue-800">Всего тайлов в BBox:</span>
            <span className="font-bold text-base text-blue-600">{tileStats.count.toLocaleString()} шт.</span>
          </div>

          {/* Table display comparison for laboratory report */}
          <div className="space-y-1.5">
            <div className="text-[10px] text-slate-400 font-semibold uppercase">Сравнение масштабов для отчёта:</div>
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
              <table className="w-full text-[10px] text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-500 font-mono border-b border-slate-200">
                    <th className="px-3 py-1.5 font-bold">Зум</th>
                    <th className="px-3 py-1.5 font-bold">Размер сетки (2^z)</th>
                    <th className="px-3 py-1.5 font-bold text-right">Кол-во тайлов</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-slate-600">
                  {zoomOptions.map((z) => {
                    const stats = getTilesForBbox(bbox, z);
                    return (
                      <tr key={z} className={z === zoom ? 'bg-blue-50 font-bold text-blue-700' : ''}>
                        <td className="px-3 py-1.5">
                          {z} {z === zoom ? ' (тек.)' : ''}
                        </td>
                        <td className="px-3 py-1.5">{Math.pow(2, z).toLocaleString()}×{Math.pow(2, z).toLocaleString()}</td>
                        <td className="px-3 py-1.5 text-right font-bold">{stats.count.toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <TileViewer tileStats={tileStats} title={`Сетка тайлов (Зум ${targetZoom})`} />
        </div>
      )}
    </div>
  );
}
