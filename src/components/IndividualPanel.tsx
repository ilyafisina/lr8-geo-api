import React, { useState, useRef, DragEvent } from 'react';
import { Upload, Map, FileJson, Image, Download, RefreshCw, AlertCircle, Trash2, Sliders, ChevronDown } from 'lucide-react';
import html2canvas from 'html2canvas';
import { IndividualResult, LatLng } from '../types';
import { processRunGeoJSON, getTilesForBbox } from '../utils/geoUtils';
import { testPresets } from '../geojson/testPresets';
import TileViewer from './TileViewer';

interface IndividualPanelProps {
  onLoadRun: (result: IndividualResult) => void;
  onClearRun: () => void;
  runResult: IndividualResult | null;
}

export default function IndividualPanel({ onLoadRun, onClearRun, runResult }: IndividualPanelProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [tileZoom, setTileZoom] = useState<number>(14);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parse and handle file content
  const handleFileContent = (content: string, fileName: string) => {
    setErrorMsg(null);
    setScreenshotUrl(null);
    try {
      const processed = processRunGeoJSON(content, fileName);
      onLoadRun({
        ...processed,
        originalFileName: fileName
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'Ошибка обработки GeoJSON файла.');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      handleFileContent(text, file.name);
    };
    reader.onerror = () => {
      setErrorMsg('Ошибка чтения файла с диска.');
    };
    reader.readAsText(file);
  };

  const handleDrag = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        handleFileContent(text, file.name);
      };
      reader.readAsText(file);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  // Capture Map Snapshot via html2canvas
  const generateMapSnapshot = async () => {
    setIsCapturing(true);
    setErrorMsg(null);
    
    // Track clean-up actions to restore pristine DOM styles after snapshotting completes
    const cleanups: (() => void)[] = [];

    try {
      // Find Leaflet map container element
      const mapElement = document.getElementById('map-element');
      if (!mapElement) {
        throw new Error('Элемент карты #map-element не найден в DOM.');
      }

      // We wait 300ms for animations and rendering to completely settle down
      await new Promise((resolve) => setTimeout(resolve, 300));

      // 1. Process and clean style and link elements to filter out 'oklch' color functions.
      // This allows html2canvas to interpret Leaflet layouts perfectly (preventing tile displacement / mosaic defects)
      // while avoiding modern CSS syntax parsing crashes entirely.
      const styleElements = Array.from(document.querySelectorAll('style'));
      const linkElements = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));

      // Clean inline `<style>` blocks (commonly populated during dev hot reloading)
      for (const style of styleElements) {
        const text = style.textContent || '';
        if (text.includes('oklch')) {
          const cleanedText = text.replace(/oklch\([^)]+\)/gi, 'rgb(100, 116, 139)');
          style.textContent = cleanedText;
          cleanups.push(() => {
            style.textContent = text;
          });
        }
      }

      // Clean compiled `<link rel="stylesheet">` sheets (commonly populated in built/deployed runs)
      for (const link of linkElements) {
        const href = (link as HTMLLinkElement).href || '';
        if (href) {
          let isSameOrigin = false;
          try {
            const url = new URL(href, window.location.href);
            isSameOrigin = url.origin === window.location.origin;
          } catch (e) {
            // ignore parsing failures
          }

          if (isSameOrigin) {
            try {
              const response = await fetch(href);
              const originalCSS = await response.text();
              if (originalCSS.includes('oklch')) {
                // Replace all oklch tags with an rgb alternative standard fallback
                const cleanedCSS = originalCSS.replace(/oklch\([^)]+\)/gi, 'rgb(100, 116, 139)');
                
                // Mount a temporary style tag with cleaned rules so leaflet layout and positions stay active
                const tempStyle = document.createElement('style');
                tempStyle.textContent = cleanedCSS;
                document.head.appendChild(tempStyle);

                // Disable the original link that contains oklch rules to prevent html2canvas parsing crashes
                const originalDisabled = (link as any).disabled;
                (link as any).disabled = true;

                cleanups.push(() => {
                  if (tempStyle.parentNode) {
                    tempStyle.parentNode.removeChild(tempStyle);
                  }
                  (link as any).disabled = originalDisabled;
                });
              }
            } catch (err) {
              console.warn('Failed to sanitize link stylesheet in-place:', href, err);
            }
          }
        }
      }

      let canvas: HTMLCanvasElement;
      let imgUrl = '';
      
      try {
        // Step 1: Attempt standard high-quality snapshot with CORS allowed and ignoring markers/shadows that might taint
        canvas = await html2canvas(mapElement, {
          useCORS: true,
          allowTaint: false,
          logging: false,
          scale: 1.5, // Enhances quality of snapshot
          ignoreElements: (element) => {
            return (
              element.classList.contains('leaflet-control-zoom') ||
              element.classList.contains('leaflet-control-attribution') ||
              element.classList.contains('leaflet-bar') ||
              element.classList.contains('leaflet-marker-icon') ||
              element.classList.contains('leaflet-marker-shadow')
            );
          }
        });
        imgUrl = canvas.toDataURL('image/png');
      } catch (firstErr) {
        console.warn('First snapshot attempt or toDataURL conversion failed, initiating robust vector fallback mode...', firstErr);
        // Step 2: Fallback mode. If Tiles are blocked by browser sandbox/cache conflicts, we isolate them completely.
        canvas = await html2canvas(mapElement, {
          useCORS: false,
          allowTaint: true,
          logging: false,
          scale: 1.5,
          ignoreElements: (element) => {
            return (
              element.classList.contains('leaflet-control-zoom') ||
              element.classList.contains('leaflet-control-attribution') ||
              element.classList.contains('leaflet-bar') ||
              element.tagName.toLowerCase() === 'img' // removes tiles & taints completely to safeguard export
            );
          }
        });
        imgUrl = canvas.toDataURL('image/png');
      }

      setScreenshotUrl(imgUrl);
    } catch (err: any) {
      console.error('Snapshot failed on all fallback stages:', err);
      setErrorMsg('Не удалось сформировать изображение карты. Ошибка CORS или отрисовки Canvas.');
    } finally {
      // Flawlessly restore style and link rules to their original versions instantly
      for (const cleanupAction of cleanups) {
        try {
          cleanupAction();
        } catch (restoreErr) {
          console.warn('Error during style cleanups restoration:', restoreErr);
        }
      }
      setIsCapturing(false);
    }
  };

  const downloadScreenshot = () => {
    if (!screenshotUrl) return;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.href = screenshotUrl;
    downloadAnchor.download = `run_map_snapshot_${runResult?.originalFileName?.replace(/\.[^/.]+$/, "") || 'track'}.png`;
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Download files
  const downloadGeoJSON = () => {
    if (!runResult || !runResult.geojson) return;
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(runResult.geojson, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.href = dataStr;
    dlAnchor.download = `processed_${runResult.originalFileName || 'route.geojson'}`;
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
  };

  const downloadRouteInfoJSON = () => {
    if (!runResult) return;
    
    // Structure metadata object for export
    const exportMetadata = {
      fileName: runResult.originalFileName,
      geometryType: runResult.geometryType,
      boundingBox: {
        minLon: runResult.bbox[0],
        minLat: runResult.bbox[1],
        maxLon: runResult.bbox[2],
        maxLat: runResult.bbox[3],
        widthKm: runResult.bboxWidthKm,
        heightKm: runResult.bboxHeightKm,
      },
      computedTiles: {
        zoomLevel: tileZoom,
        totalTilesCount: getTilesForBbox(runResult.bbox, tileZoom).count,
        minTileX: getTilesForBbox(runResult.bbox, tileZoom).minX,
        maxTileX: getTilesForBbox(runResult.bbox, tileZoom).maxX,
        minTileY: getTilesForBbox(runResult.bbox, tileZoom).minY,
        maxTileY: getTilesForBbox(runResult.bbox, tileZoom).maxY,
      },
      polygonAreaSqM: runResult.polygonAreaSqM,
      extractedAt: new Date().toISOString()
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportMetadata, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.href = dataStr;
    dlAnchor.download = `run_analysis_info.json`;
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
  };

  // Re-compute active tiles overlap when user slides zoom selector for individual run
  const dynamicTilesMeta = runResult ? getTilesForBbox(runResult.bbox, tileZoom) : null;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-slate-800 tracking-tight">Вариант 3 — Индивидуальное задание</h3>
        <p className="text-xs text-slate-500 mt-1">
          Расширенный процессор пробежек. Загрузите GeoJSONфайл пробежки (Polygon или LineString) для расчета характеристик, плотности покрытия тайлов и генерации высококачественных PNG-снимков карты.
        </p>
      </div>

      {/* Part 1: Drag & Drop File Upload Area */}
      {!runResult ? (
        <div className="space-y-4">
          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={triggerFileInput}
            className={`cursor-pointer border-2 border-dashed rounded-xl p-8 text-center transition-all ${
              isDragActive
                ? 'border-cyan-500 bg-cyan-50/50'
                : 'border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50/50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".geojson,.json"
              className="hidden"
              onChange={handleFileUpload}
            />
            <div className="flex flex-col items-center justify-center gap-2.5">
              <Upload className={`h-8 w-8 ${isDragActive ? 'text-cyan-500 animate-bounce' : 'text-slate-400'}`} />
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-700">Перетащите сюда GeoJSON или кликните</p>
                <p className="text-[10px] text-slate-400">Поддерживаются файлы *.geojson или *.json с треками пробежек</p>
              </div>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-100/70 text-red-800 text-xs rounded-xl flex items-start gap-2 border border-red-200">
              <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Ошибка парсинга:</span> {errorMsg}
              </div>
            </div>
          )}

          {/* Quick Preset Selector */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 space-y-3">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <Map className="h-3.5 w-3.5 text-blue-500" />
              <span>Быстрый выбор готовых треков пробежек</span>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {testPresets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleFileContent(preset.content, `${preset.id}.geojson`)}
                  className={`text-left px-3.5 py-2.5 bg-white border rounded-xl text-xs cursor-pointer transition-all flex items-center justify-between ${
                    preset.type === 'malformed'
                      ? 'hover:bg-red-50/40 border-red-100 hover:border-red-200'
                      : preset.type === 'empty'
                      ? 'hover:bg-amber-50/40 border-amber-100 hover:border-amber-200'
                      : 'hover:bg-blue-50/50 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <div className="font-semibold text-slate-700 truncate">{preset.name}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5 truncate leading-snug">{preset.description}</div>
                  </div>
                  {preset.type === 'malformed' ? (
                    <span className="text-[10px] text-red-600 font-bold whitespace-nowrap bg-red-50 py-1 px-2 rounded-md">Тест ошибки →</span>
                  ) : preset.type === 'empty' ? (
                    <span className="text-[10px] text-amber-600 font-bold whitespace-nowrap bg-amber-50 py-1 px-2 rounded-md">Пустой →</span>
                  ) : (
                    <span className="text-[10px] text-blue-600 font-bold whitespace-nowrap bg-blue-50 py-1 px-2 rounded-md">Выбрать →</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Track Loading Status Header */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex items-center justify-between">
            <div className="min-w-0">
              <div className="text-[10px] text-cyan-600 font-bold uppercase tracking-wider">Загруженный трек</div>
              <div className="font-mono text-xs font-bold text-slate-700 truncate">{runResult.originalFileName}</div>
            </div>
            <button
              onClick={() => {
                onClearRun();
                setScreenshotUrl(null);
                setErrorMsg(null);
              }}
              className="p-1 text-slate-400 hover:text-red-500 transition-colors bg-white hover:bg-red-50 rounded-lg border border-slate-200"
              title="Удалить трек"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-100/70 text-red-800 text-xs rounded-xl flex items-start gap-2 border border-red-200">
              <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
              <div>{errorMsg}</div>
            </div>
          )}

          {/* Part 2: Math and GIS Stats */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Параметры маршрута & Bounding Box</h4>
            
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-white p-3 rounded-lg border border-slate-200 col-span-2">
                <div className="text-[9px] text-slate-400 font-bold uppercase">Bounding Box (ЮЗ-СВ доп. узел):</div>
                <div className="font-mono text-[10px] text-slate-700 mt-1 select-all font-semibold leading-relaxed">
                  [{runResult.bbox[0].toFixed(5)}, {runResult.bbox[1].toFixed(5)}] — [{runResult.bbox[2].toFixed(5)}, {runResult.bbox[3].toFixed(5)}]
                </div>
              </div>

              <div className="bg-white p-3 rounded-lg border border-slate-200">
                <div className="text-[9px] text-slate-400 font-bold uppercase">Габариты BBox:</div>
                <div className="font-mono font-bold text-slate-700 mt-1">
                  {runResult.bboxWidthKm.toFixed(2)} × {runResult.bboxHeightKm.toFixed(2)} км
                </div>
              </div>

              <div className="bg-white p-3 rounded-lg border border-slate-200">
                <div className="text-[9px] text-slate-400 font-bold uppercase">Тип геометрии:</div>
                <div className="font-mono font-bold text-pink-600 mt-1 uppercase flex items-center gap-1">
                  <span className="w-2 h-2 rounded bg-pink-500 shrink-0"></span>
                  {runResult.geometryType}
                </div>
              </div>

              {runResult.polygonAreaSqM !== undefined && (
                <div className="bg-white p-3 rounded-lg border border-slate-200 col-span-2">
                  <div className="text-[9px] text-slate-400 font-bold uppercase">Площадь полигона (Turf.js):</div>
                  <div className="font-mono font-bold text-slate-700 mt-1">
                    {(runResult.polygonAreaSqM).toLocaleString('ru-RU', { maximumFractionDigits: 2 })} м² 
                    <span className="text-[10px] text-slate-400 font-normal"> ({(runResult.polygonAreaSqM / 10000).toFixed(3)} Га)</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Part 3: Map Tiles calculations at adjustable Zoom */}
          {dynamicTilesMeta && (
            <div className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3.5">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Накладные тайлы OSM в BBox</h4>
                  <div className="flex items-center gap-1 text-[11px] font-mono text-slate-500 font-semibold bg-white border border-slate-200 px-2 py-0.5 rounded shadow-sm">
                    <span>Zoom:</span>
                    <select
                      value={tileZoom}
                      onChange={(e) => setTileZoom(parseInt(e.target.value))}
                      className="bg-transparent border-none outline-none focus:ring-0 cursor-pointer text-cyan-600 font-extrabold"
                    >
                      {[10, 11, 12, 13, 14, 15, 16, 17, 18, 19].map((z) => (
                        <option key={z} value={z}>{z}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200 font-mono text-xs">
                    <div className="text-[9px] text-slate-400 font-bold uppercase mb-0.5">Лимиты X тайлов:</div>
                    <span className="font-bold text-slate-700">{dynamicTilesMeta.minX} — {dynamicTilesMeta.maxX}</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200 font-mono text-xs">
                    <div className="text-[9px] text-slate-400 font-bold uppercase mb-0.5">Лимиты Y тайлов:</div>
                    <span className="font-bold text-slate-700">{dynamicTilesMeta.minY} — {dynamicTilesMeta.maxY}</span>
                  </div>
                </div>

                <div className="p-3 bg-cyan-50 text-cyan-900 border border-cyan-100 rounded-lg flex justify-between items-center text-xs">
                  <span className="font-medium font-sans">Количество тайлов для загрузки:</span>
                  <span className="font-mono font-bold text-base text-cyan-700">{dynamicTilesMeta.count.toLocaleString()} шт.</span>
                </div>
              </div>

              <TileViewer tileStats={dynamicTilesMeta} title={`Сетка тайлов BBox (Зум ${tileZoom})`} />
            </div>
          )}

          {/* Part 4: Downloads & Metadata exports */}
          <div className="flex gap-2.5">
            <button
              onClick={downloadGeoJSON}
              className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
            >
              <FileJson className="h-4 w-4 text-cyan-600" />
              Скачать GeoJSON
            </button>
            <button
              onClick={downloadRouteInfoJSON}
              className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Sliders className="h-4 w-4 text-cyan-600" />
              Экспорт JSON
            </button>
          </div>

          {/* Part 5: Screenshot Snapshots formation engine */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Генератор скриншотов карты</h4>

            {!screenshotUrl ? (
              <button
                onClick={generateMapSnapshot}
                disabled={isCapturing}
                className="w-full py-3 bg-cyan-600 hover:bg-cyan-700 disabled:bg-cyan-300 text-white font-medium rounded-lg text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm shadow-cyan-100"
              >
                {isCapturing ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Компоновка изображения...
                  </>
                ) : (
                  <>
                    <Image className="h-4 w-4" />
                    Сформировать снимок карты PNG
                  </>
                )}
              </button>
            ) : (
              <div className="space-y-3">
                <div className="text-[10px] text-emerald-600 font-bold uppercase flex items-center gap-1">
                  <span>Предпросмотр снимка:</span>
                </div>
                
                <div className="relative aspect-video rounded-lg border border-slate-300 overflow-hidden bg-slate-100 shadow-inner group">
                  <img
                    src={screenshotUrl}
                    alt="Map snapshot"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity duration-200">
                    <button
                      onClick={downloadScreenshot}
                      className="bg-white hover:bg-slate-100 text-slate-800 p-2 rounded-lg shadow text-xs font-medium flex items-center gap-1 cursor-pointer"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Скачать PNG
                    </button>
                    <button
                      onClick={() => setScreenshotUrl(null)}
                      className="bg-black/40 hover:bg-black/60 text-white p-2 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                    >
                      Сбросить
                    </button>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={downloadScreenshot}
                    className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer shadow-sm shadow-emerald-50"
                  >
                    <Download className="h-4 w-4" />
                    Скачать файл карты (PNG)
                  </button>
                  <button
                    onClick={generateMapSnapshot}
                    disabled={isCapturing}
                    className="px-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs transition-colors"
                    title="Обновить снимок"
                  >
                    <RefreshCw className={`h-4 w-4 ${isCapturing ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
