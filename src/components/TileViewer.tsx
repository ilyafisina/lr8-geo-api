import { useState } from 'react';
import { Search, ExternalLink, Minimize2, Eye, Grid, ChevronLeft, ChevronRight, Compass } from 'lucide-react';
import { tile2lon, tile2lat } from '../utils/geoUtils';

interface TileItem {
  x: number;
  y: number;
  z: number;
  url: string;
}

interface TileViewerProps {
  tileStats: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    count: number;
    list: TileItem[];
  } | null;
  title?: string;
}

export default function TileViewer({ tileStats, title = "Проводник сгенерированных тайлов" }: TileViewerProps) {
  const [filterStr, setFilterStr] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTile, setSelectedTile] = useState<TileItem | null>(null);
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});

  if (!tileStats || !tileStats.list || tileStats.list.length === 0) {
    return (
      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-center text-xs text-slate-400">
        Нет доступных тайлов для отображения.
      </div>
    );
  }

  // Filter list by coordinates
  const filteredList = tileStats.list.filter(tile => {
    if (!filterStr) return true;
    const term = filterStr.toLowerCase();
    return (
      tile.x.toString().includes(term) ||
      tile.y.toString().includes(term) ||
      `z${tile.z}`.includes(term) ||
      `${tile.x},${tile.y}`.includes(term)
    );
  });

  const itemsPerPage = 12;
  const totalPages = Math.ceil(filteredList.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedList = filteredList.slice(startIndex, startIndex + itemsPerPage);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handleTileClick = (tile: TileItem) => {
    setSelectedTile(selectedTile?.x === tile.x && selectedTile?.y === tile.y ? null : tile);
  };

  const getTileBounds = (tile: TileItem) => {
    const leftLon = tile2lon(tile.x, tile.z);
    const rightLon = tile2lon(tile.x + 1, tile.z);
    const topLat = tile2lat(tile.y, tile.z);
    const bottomLat = tile2lat(tile.y + 1, tile.z);

    return {
      west: leftLon.toFixed(6),
      east: rightLon.toFixed(6),
      north: topLat.toFixed(6),
      south: bottomLat.toFixed(6)
    };
  };

  const handleImageError = (key: string) => {
    setImgErrors(prev => ({ ...prev, [key]: true }));
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden space-y-4 p-4 font-sans text-xs">
      {/* Title block */}
      <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1 px-2 rounded bg-blue-100 text-blue-700 font-bold text-[10px] flex items-center gap-1">
            <Grid className="h-3 w-3" />
            <span>Tile Grid</span>
          </div>
          <h4 className="font-bold text-slate-800 text-[11px] uppercase tracking-wide">{title}</h4>
        </div>
        <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
          Всего тайлов в BBox: {tileStats.count}
        </span>
      </div>

      {/* Filter and limits message */}
      <div className="space-y-2">
        <div className="relative">
          <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 text-slate-400">
            <Search className="h-3 w-3" />
          </span>
          <input
            type="text"
            placeholder="Поиск по X, Y или паре X,Y..."
            value={filterStr}
            onChange={(e) => {
              setFilterStr(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-slate-50/50"
          />
        </div>

        {tileStats.count > tileStats.list.length && (
          <p className="text-[10px] text-slate-400 italic leading-snug">
            * Карта охватывает слишком большую площадь. Отображается репрезентативный набор из первые {tileStats.list.length} тайлов для исключения зависания браузера.
          </p>
        )}
      </div>

      {/* Tile Preview cards layout */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {paginatedList.map((tile) => {
          const key = `${tile.z}_${tile.x}_${tile.y}`;
          const isSelected = selectedTile?.x === tile.x && selectedTile?.y === tile.y;
          const hasError = imgErrors[key];

          return (
            <div
              key={key}
              onClick={() => handleTileClick(tile)}
              className={`group relative rounded-lg border p-2 text-left cursor-pointer transition-all flex flex-col justify-between ${
                isSelected
                  ? 'border-blue-600 bg-blue-50/40 ring-1 ring-blue-500'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
              }`}
            >
              {/* Card Title */}
              <div className="flex items-center justify-between text-[10px] font-mono font-semibold text-slate-700">
                <span className="text-blue-600 bg-blue-50 group-hover:bg-blue-100 px-1 py-0.5 rounded text-[9px]">
                  z:{tile.z}
                </span>
                <span className="opacity-70">
                  x:{tile.x} y:{tile.y}
                </span>
              </div>

              {/* Centered Thumbnail */}
              <div className="my-2 h-16 w-full flex items-center justify-center bg-slate-100 rounded border border-slate-200/50 overflow-hidden relative">
                {!hasError ? (
                  <img
                    src={tile.url}
                    alt={`Tile x=${tile.x} y=${tile.y}`}
                    className="h-full w-full object-cover transition-transform group-hover:scale-110"
                    onError={() => handleImageError(key)}
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="text-[9px] text-slate-400 flex flex-col items-center justify-center p-1 text-center">
                    <Grid className="h-4 w-4 text-slate-300 mb-0.5" />
                    <span>OSM Tile Placeholder</span>
                  </div>
                )}
                {/* Visual hover assist badge */}
                <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <Eye className="h-4 w-4 text-white" />
                </div>
              </div>

              {/* Bottom bar with action links */}
              <div className="flex items-center justify-between text-[9px] text-slate-400 font-mono mt-1">
                <span className="text-slate-500 hover:text-slate-800 underline truncate select-none flex items-center gap-0.5">
                  Детали {isSelected ? '▲' : '▼'}
                </span>
                <a
                  href={tile.url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="p-0.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
                  title="Открыть исходное изображение в новой вкладке"
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          );
        })}
      </div>

      {paginatedList.length === 0 && (
        <div className="p-6 text-center text-slate-400 italic">
          Тайлы, соответствующие запросу, не найдены.
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-[11px] text-slate-500">
          <span>
            Страница <b>{currentPage}</b> из <b>{totalPages}</b> (найдено {filteredList.length})
          </span>
          <div className="flex gap-1.5">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-2 py-1 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 disabled:opacity-40 disabled:hover:bg-white cursor-pointer transition-colors"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-2 py-1 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 disabled:opacity-40 disabled:hover:bg-white cursor-pointer transition-colors"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Expandable Selected Tile Detailed Section (bounds representation in EPSG:4326) */}
      {selectedTile && (
        <div className="bg-slate-50 border border-blue-100 rounded-xl p-3.5 text-xs text-slate-600 space-y-2.5 animate-fade-in">
          <div className="font-bold text-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-blue-800">
              <Compass className="h-3.5 w-3.5 text-blue-500" />
              <span>Детали тайла X={selectedTile.x}, Y={selectedTile.y}</span>
            </div>
            <button
              onClick={() => setSelectedTile(null)}
              className="text-[10px] text-slate-400 hover:text-slate-600 font-normal underline border-none bg-transparent cursor-pointer"
            >
              Свернуть
            </button>
          </div>

          {/* Boundaries rendering */}
          <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
            <div className="bg-white p-2 rounded border border-slate-200">
              <span className="text-slate-400 block font-sans text-[8px] uppercase font-bold">Северная граница (North):</span>
              <span className="font-semibold text-slate-700">{getTileBounds(selectedTile).north}° N</span>
            </div>
            <div className="bg-white p-2 rounded border border-slate-200">
              <span className="text-slate-400 block font-sans text-[8px] uppercase font-bold">Самая южная (South):</span>
              <span className="font-semibold text-slate-700">{getTileBounds(selectedTile).south}° N</span>
            </div>
            <div className="bg-white p-2 rounded border border-slate-200">
              <span className="text-slate-400 block font-sans text-[8px] uppercase font-bold">Западная граница (West):</span>
              <span className="font-semibold text-slate-700">{getTileBounds(selectedTile).west}° E</span>
            </div>
            <div className="bg-white p-2 rounded border border-slate-200">
              <span className="text-slate-400 block font-sans text-[8px] uppercase font-bold">Восточная граница (East):</span>
              <span className="font-semibold text-slate-700">{getTileBounds(selectedTile).east}° E</span>
            </div>
          </div>

          <div className="flex gap-2">
            <a
              href={selectedTile.url}
              target="_blank"
              rel="noreferrer"
              className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-center shadow-xs transition-colors flex items-center justify-center gap-1.5"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>Открыть полное изображение в новой вкладке</span>
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
