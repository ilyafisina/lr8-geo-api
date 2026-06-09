import { useState } from 'react';
import { Play, CheckCircle, XCircle, FileCode, AlertCircle, RefreshCw, Layers } from 'lucide-react';
import { testPresets, TestPreset } from '../geojson/testPresets';
import { processRunGeoJSON } from '../utils/geoUtils';
import { IndividualResult } from '../types';
import TileViewer from './TileViewer';

interface TestsPanelProps {
  onLoadRunOnMap: (result: IndividualResult) => void;
  onClearRunOnMap: () => void;
}

export default function TestsPanel({ onLoadRunOnMap, onClearRunOnMap }: TestsPanelProps) {
  const [selectedPresetId, setSelectedPresetId] = useState<string>('normal-run');
  const [testResult, setTestResult] = useState<{
    status: 'success' | 'error';
    message: string;
    elapsedMs: number;
    parsedData?: IndividualResult;
  } | null>(null);
  const [showRawJson, setShowRawJson] = useState<boolean>(false);

  // Find active preset
  const activePreset = testPresets.find(p => p.id === selectedPresetId) || testPresets[0];

  const runTest = (preset: TestPreset) => {
    onClearRunOnMap();
    setTestResult(null);
    const startTime = performance.now();

    try {
      // Execute standard processing engine
      const processed = processRunGeoJSON(preset.content, `${preset.id}.geojson`);
      const endTime = performance.now();
      const elapsed = parseFloat((endTime - startTime).toFixed(3));

      // Update state and load on map
      setTestResult({
        status: 'success',
        message: 'Файл GeoJSON успешно прошел валидацию и обработан алгоритмами ГИС.',
        elapsedMs: elapsed,
        parsedData: {
          ...processed,
          originalFileName: `${preset.id}.geojson`
        }
      });
      
      // Load this geometry on the map to trigger visual centering!
      onLoadRunOnMap({
        ...processed,
        originalFileName: `${preset.id}.geojson`
      });

    } catch (err: any) {
      const endTime = performance.now();
      const elapsed = parseFloat((endTime - startTime).toFixed(3));
      
      setTestResult({
        status: 'error',
        message: err.message || 'Неизвестная ошибка во время лексического анализа.',
        elapsedMs: elapsed
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-slate-800 tracking-tight">Панель тестирования ГИС-валидатора</h3>
        <p className="text-xs text-slate-500 mt-1">
          Интерактивная верификация устойчивости парсера GeoJSON к пограничным, пустым и зашумленным структурам данных согласно ГОСТ Р 59194-2020.
        </p>
      </div>

      {/* Preset Selector Grid */}
      <div className="space-y-2">
        <label className="text-[10px] uppercase font-bold text-slate-400">Выберите тест-кейс для запуска:</label>
        <div className="grid grid-cols-1 gap-2">
          {testPresets.map((preset) => (
            <button
              key={preset.id}
              onClick={() => {
                setSelectedPresetId(preset.id);
                setTestResult(null);
                onClearRunOnMap();
              }}
              className={`text-left p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-start gap-3 ${
                selectedPresetId === preset.id
                  ? 'border-blue-600 bg-blue-50/50 shadow-sm'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
              }`}
            >
              <div className={`p-1.5 rounded-lg text-white mt-0.5 ${
                preset.type === 'valid' ? 'bg-emerald-500' :
                preset.type === 'tiny' ? 'bg-amber-500' :
                preset.type === 'large' ? 'bg-cyan-500' :
                preset.type === 'malformed' ? 'bg-red-500' : 'bg-slate-400'
              }`}>
                <Layers className="h-3.5 w-3.5" />
              </div>
              <div className="space-y-0.5">
                <div className="font-semibold text-slate-800">{preset.name}</div>
                <div className="text-[10px] text-slate-400 font-sans leading-tight">{preset.description}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Run Action Button */}
      <div className="flex gap-2">
        <button
          onClick={() => runTest(activePreset)}
          className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white border-none font-medium rounded-lg text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm shadow-blue-100"
        >
          <Play className="h-4 w-4" />
          Запустить верификацию примера
        </button>
        <button
          onClick={() => setShowRawJson(!showRawJson)}
          className="px-3.5 py-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs transition-colors"
          title="Показать исходный JSON"
        >
          <FileCode className="h-4 w-4" />
        </button>
      </div>

      {/* Collapsible raw JSON editor preview */}
      {showRawJson && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg animate-fade-in">
          <div className="bg-slate-800 px-3 py-1.5 border-b border-slate-700 text-slate-400 text-[10px] font-mono select-none">
            {activePreset.id}.geojson
          </div>
          <pre className="p-3 text-[9px] text-teal-400 font-mono overflow-x-auto max-h-40 overflow-y-auto leading-relaxed">
            {activePreset.content}
          </pre>
        </div>
      )}

      {/* Execution logs / Analysis Results display */}
      {testResult && (
        <div className="space-y-4 animate-fade-in">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
            <div className="flex justify-between items-center">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Статус обработки</h4>
              <span className="font-mono text-[10px] text-slate-400 bg-white px-2 py-0.5 border border-slate-200 rounded">
                Заняло: {testResult.elapsedMs} мс
              </span>
            </div>

            {testResult.status === 'success' ? (
              <div className="p-3.5 bg-emerald-50 text-emerald-800 text-xs rounded-lg border border-emerald-100 flex items-start gap-2.5">
                <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="font-bold">Верификация пройдена успешно!</div>
                  <div className="leading-snug text-emerald-700 text-[11px]">{testResult.message}</div>
                </div>
              </div>
            ) : (
              <div className="p-3.5 bg-red-50 text-red-800 text-xs rounded-lg border border-red-100 flex items-start gap-2.5">
                <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="font-bold">Сбой при обработке данных!</div>
                  <div className="leading-relaxed text-red-700 text-[11px] font-mono">{testResult.message}</div>
                </div>
              </div>
            )}
          </div>

          {/* Success variables breakdown for GISS analysis */}
          {testResult.status === 'success' && testResult.parsedData && (
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Сгенерированные метаданные</h4>
              
              <div className="space-y-2 text-xs font-mono">
                <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1">
                  <div className="text-[9px] uppercase text-slate-400">Размеры Bounding Box:</div>
                  <div className="font-bold text-slate-700">
                    {testResult.parsedData.bboxWidthKm.toFixed(3)} км (Ширина) × {testResult.parsedData.bboxHeightKm.toFixed(3)} км (Высота)
                  </div>
                </div>

                <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1">
                  <div className="text-[9px] uppercase text-slate-400">Координаты Bounding Box [ЮЗ, СВ]:</div>
                  <div className="font-bold text-slate-700 text-[10px] select-all leading-normal">
                    [{testResult.parsedData.bbox[0].toFixed(6)}, {testResult.parsedData.bbox[1].toFixed(6)}] — [{testResult.parsedData.bbox[2].toFixed(6)}, {testResult.parsedData.bbox[3].toFixed(6)}]
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <div className="text-[8px] uppercase text-slate-400">Тип данных:</div>
                    <div className="font-bold text-blue-600 uppercase mt-0.5">{testResult.parsedData.geometryType}</div>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <div className="text-[8px] uppercase text-slate-400">Тайлы на Zoom 14:</div>
                    <div className="font-bold text-blue-600 mt-0.5">{testResult.parsedData.tileCount} шт.</div>
                  </div>
                </div>

                {testResult.parsedData.polygonAreaSqM !== undefined && (
                  <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1 col-span-2">
                    <div className="text-[9px] uppercase text-slate-400">Расчетная площадь Turf.js:</div>
                    <div className="font-bold text-emerald-600">
                      {(testResult.parsedData.polygonAreaSqM).toFixed(2)} м²
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {testResult.status === 'success' && testResult.parsedData && (
            <TileViewer 
              tileStats={testResult.parsedData.tileCoordinates as any} 
              title="Сетка тайлов верификации (Зум 14)" 
            />
          )}
        </div>
      )}
    </div>
  );
}
