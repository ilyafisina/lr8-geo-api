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

  // Capture Map Snapshot - tiles + SVG paths drawn directly
  const generateMapSnapshot = async () => {
    setIsCapturing(true);
    setErrorMsg(null);
    try {
      const mapElement = document.getElementById('map-element');
      if (!mapElement) {
        throw new Error('Элемент карты не найден.');
      }

      // Wait for all tiles to load
      await new Promise((resolve) => setTimeout(resolve, 4000));

      const width = mapElement.offsetWidth;
      const height = mapElement.offsetHeight;

      // Create result canvas
      const resultCanvas = document.createElement('canvas');
      resultCanvas.width = width;
      resultCanvas.height = height;
      const ctx = resultCanvas.getContext('2d');

      if (!ctx) {
        throw new Error('Не удалось получить контекст canvas.');
      }

      // Draw white background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);

      // Step 1: Draw tile images
      const tileImages = Array.from(mapElement.querySelectorAll('img')) as HTMLImageElement[];
      
      tileImages.forEach((img) => {
        try {
          if (img.naturalWidth > 0 && img.naturalHeight > 0) {
            const rect = img.getBoundingClientRect();
            const mapRect = mapElement.getBoundingClientRect();
            const x = rect.left - mapRect.left;
            const y = rect.top - mapRect.top;
            ctx.drawImage(img, x, y, rect.width, rect.height);
          }
        } catch (e) {
          // Skip CORS errors
        }
      });

      // Step 2: Draw SVG paths/lines directly (routes, bbox)
      const svgs = Array.from(mapElement.querySelectorAll('svg'));
      console.log('Found SVG elements:', svgs.length);
      
      svgs.forEach((svg, svgIndex) => {
        try {
          // Get SVG position
          const svgRect = svg.getBoundingClientRect();
          const mapRect = mapElement.getBoundingClientRect();
          const offsetX = svgRect.left - mapRect.left;
          const offsetY = svgRect.top - mapRect.top;
          
          console.log(`SVG ${svgIndex}: position (${offsetX}, ${offsetY}), size (${svgRect.width}, ${svgRect.height})`);

          // Draw all paths from SVG
          const paths = svg.querySelectorAll('path');
          console.log(`SVG ${svgIndex} has ${paths.length} paths`);
          
          paths.forEach((path, pathIndex) => {
            try {
              const d = path.getAttribute('d');
              const stroke = path.getAttribute('stroke') || path.style.stroke || '#000';
              const strokeWidth = parseFloat(path.getAttribute('stroke-width') || path.style.strokeWidth || '1');
              const fill = path.getAttribute('fill') || path.style.fill;
              const fillOpacity = parseFloat(path.getAttribute('fill-opacity') || path.style.fillOpacity || '0');

              console.log(`Path ${pathIndex}: d="${d?.substring(0, 50)}...", stroke=${stroke}, width=${strokeWidth}`);

              if (!d) return;

              // Set stroke style
              ctx.strokeStyle = stroke;
              ctx.lineWidth = strokeWidth;
              
              // Set fill style if needed
              if (fill && fill !== 'none' && fillOpacity > 0) {
                ctx.fillStyle = fill;
                ctx.globalAlpha = fillOpacity;
              }

              // Parse and draw the path
              const pathCommands = d.match(/[a-zA-Z][^a-zA-Z]*/g) || [];
              let x = 0, y = 0;
              let firstPoint = true;

              ctx.beginPath();

              pathCommands.forEach((command) => {
                const cmd = command.charAt(0);
                const args = command
                  .slice(1)
                  .trim()
                  .split(/[\s,]+/)
                  .map(Number)
                  .filter(n => !isNaN(n));

                switch (cmd) {
                  case 'M': // moveto
                    x = offsetX + args[0];
                    y = offsetY + args[1];
                    ctx.moveTo(x, y);
                    firstPoint = true;
                    break;
                  case 'L': // lineto
                    x = offsetX + args[0];
                    y = offsetY + args[1];
                    ctx.lineTo(x, y);
                    break;
                  case 'H': // horizontal line
                    x = offsetX + args[0];
                    ctx.lineTo(x, y);
                    break;
                  case 'V': // vertical line
                    y = offsetY + args[0];
                    ctx.lineTo(x, y);
                    break;
                  case 'Z': // close path
                    ctx.closePath();
                    break;
                  case 'C': // cubic bezier
                    for (let i = 0; i < args.length; i += 6) {
                      ctx.bezierCurveTo(
                        offsetX + args[i],
                        offsetY + args[i + 1],
                        offsetX + args[i + 2],
                        offsetY + args[i + 3],
                        offsetX + args[i + 4],
                        offsetY + args[i + 5]
                      );
                    }
                    break;
                }
              });

              ctx.stroke();
              if (fill && fill !== 'none' && fillOpacity > 0) {
                ctx.fill();
              }
              ctx.globalAlpha = 1;
            } catch (err) {
              // Skip problematic paths
            }
          });

          // Draw all circles/markers
          const circles = svg.querySelectorAll('circle');
          circles.forEach((circle) => {
            try {
              const cx = parseFloat(circle.getAttribute('cx') || '0');
              const cy = parseFloat(circle.getAttribute('cy') || '0');
              const r = parseFloat(circle.getAttribute('r') || '0');
              const fill = circle.getAttribute('fill') || circle.style.fill || '#000';
              const stroke = circle.getAttribute('stroke') || circle.style.stroke;

              ctx.fillStyle = fill;
              ctx.beginPath();
              ctx.arc(offsetX + cx, offsetY + cy, r, 0, Math.PI * 2);
              ctx.fill();

              if (stroke) {
                ctx.strokeStyle = stroke;
                ctx.lineWidth = parseFloat(circle.getAttribute('stroke-width') || '1');
                ctx.stroke();
              }
            } catch (err) {
              // Skip problematic circles
            }
          });
        } catch (err) {
          console.error('Error drawing SVG:', err);
        }
      });

      const imgUrl = resultCanvas.toDataURL('image/png');
      if (!imgUrl || imgUrl.length < 1000) {
        throw new Error('Некорректное изображение.');
      }
      setScreenshotUrl(imgUrl);
    } catch (err: any) {
      console.error('Screenshot error:', err);
      setErrorMsg(`Ошибка: ${err.message}`);
    } finally {
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
