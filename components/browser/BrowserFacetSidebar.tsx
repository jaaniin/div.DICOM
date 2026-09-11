import React, { useState } from 'react';
import { Search, FolderSync, Filter, X, RefreshCw, Layers, Compass, Calendar, HardDrive } from 'lucide-react';
import type { BrowserFacets } from '@/utils/types';

interface BrowserFacetSidebarProps {
  facets: BrowserFacets | null;
  selectedModality: string;
  onSelectModality: (mod: string) => void;
  selectedOrientation: string;
  onSelectOrientation: (ori: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  minSlices: number;
  onMinSlicesChange: (num: number) => void;
  startDate: string;
  endDate: string;
  onDateChange: (start: string, end: string) => void;
  onResetFilters: () => void;
  onScanDirectory: (dir: string) => Promise<void>;
  isScanning: boolean;
  defaultRoot: string;
  scanMessage: string | null;
}

export const BrowserFacetSidebar: React.FC<BrowserFacetSidebarProps> = ({
  facets,
  selectedModality,
  onSelectModality,
  selectedOrientation,
  onSelectOrientation,
  searchQuery,
  onSearchChange,
  minSlices,
  onMinSlicesChange,
  startDate,
  endDate,
  onDateChange,
  onResetFilters,
  onScanDirectory,
  isScanning,
  defaultRoot,
  scanMessage,
}) => {
  const [scanInputPath, setScanInputPath] = useState(defaultRoot || '');

  const handleScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (scanInputPath.trim()) {
      onScanDirectory(scanInputPath.trim());
    }
  };

  const hasActiveFilters =
    selectedModality !== 'ALL' ||
    selectedOrientation !== 'ALL' ||
    searchQuery.trim() !== '' ||
    minSlices > 0 ||
    startDate !== '' ||
    endDate !== '';

  return (
    <aside className="w-80 bg-neutral-950 border-r border-neutral-800 flex flex-col h-full overflow-hidden text-neutral-300 text-xs shrink-0 select-none">
      {/* Search Header */}
      <div className="p-3 border-b border-neutral-800 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-neutral-200 text-sm flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-blue-400" />
            Suodattimet
          </span>
          {hasActiveFilters && (
            <button
              onClick={onResetFilters}
              className="text-[11px] text-neutral-400 hover:text-red-400 flex items-center gap-1 transition-colors"
            >
              <X className="w-3 h-3" />
              Tyhjennä
            </button>
          )}
        </div>

        {/* Free-text search input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Hae potilasta, ID:tä tai tutkimusta..."
            className="w-full pl-8 pr-3 py-1.5 bg-neutral-900 border border-neutral-800 rounded text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
      </div>

      {/* Directory Scanner Box */}
      <div className="p-3 border-b border-neutral-800/80 bg-neutral-900/30">
        <div className="flex items-center justify-between mb-1.5 text-[11px] text-neutral-400 font-medium">
          <span className="flex items-center gap-1">
            <HardDrive className="w-3 h-3 text-cyan-400" />
            DICOM-kansio (Zero-Copy)
          </span>
        </div>
        <form onSubmit={handleScanSubmit} className="space-y-1.5">
          <input
            type="text"
            value={scanInputPath}
            onChange={(e) => setScanInputPath(e.target.value)}
            placeholder="/polku/dicom-kansioon"
            className="w-full px-2.5 py-1 bg-neutral-950 border border-neutral-800 rounded font-mono text-[11px] text-neutral-300 focus:outline-none focus:border-cyan-500"
          />
          <button
            type="submit"
            disabled={isScanning || !scanInputPath.trim()}
            className="w-full py-1.5 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 text-neutral-200 font-medium rounded flex items-center justify-center gap-1.5 transition-colors text-[11px]"
          >
            {isScanning ? (
              <>
                <RefreshCw className="w-3 h-3 animate-spin text-cyan-400" />
                Skannataan...
              </>
            ) : (
              <>
                <FolderSync className="w-3 h-3 text-cyan-400" />
                Skannaa / Päivitä indeksi
              </>
            )}
          </button>
        </form>
        {scanMessage && (
          <p className="mt-1.5 text-[10px] text-emerald-400/90 leading-tight">
            {scanMessage}
          </p>
        )}
      </div>

      {/* Filter Options Scrollable Body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Modality Filter */}
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">
            <Layers className="w-3 h-3 text-blue-400" />
            Modaliteetti
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => onSelectModality('ALL')}
              className={`px-2 py-1 rounded text-[11px] font-medium border transition-colors ${
                selectedModality === 'ALL'
                  ? 'bg-blue-600/20 border-blue-500/60 text-blue-300'
                  : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:border-neutral-700'
              }`}
            >
              Kaikki
            </button>
            {facets?.modalities.map((m) => (
              <button
                key={m.name}
                onClick={() => onSelectModality(m.name)}
                className={`px-2 py-1 rounded text-[11px] font-medium border flex items-center gap-1 transition-colors ${
                  selectedModality === m.name
                    ? 'bg-blue-600/20 border-blue-500/60 text-blue-300'
                    : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                }`}
              >
                <span>{m.name}</span>
                <span className="text-[10px] text-neutral-500 font-mono">({m.count})</span>
              </button>
            ))}
          </div>
        </div>

        {/* Orientation Filter */}
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">
            <Compass className="w-3 h-3 text-purple-400" />
            Leikesuunta (3D)
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => onSelectOrientation('ALL')}
              className={`px-2 py-1 rounded text-[11px] font-medium border transition-colors ${
                selectedOrientation === 'ALL'
                  ? 'bg-purple-600/20 border-purple-500/60 text-purple-300'
                  : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:border-neutral-700'
              }`}
            >
              Kaikki
            </button>
            {['SAGITTAL', 'CORONAL', 'AXIAL', 'OBLIQUE'].map((ori) => {
              const count = facets?.orientations.find((o) => o.name === ori)?.count || 0;
              return (
                <button
                  key={ori}
                  onClick={() => onSelectOrientation(ori)}
                  className={`px-2 py-1 rounded text-[11px] font-medium border flex items-center gap-1 transition-colors ${
                    selectedOrientation === ori
                      ? 'bg-purple-600/20 border-purple-500/60 text-purple-300'
                      : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                  }`}
                >
                  <span>{ori}</span>
                  {count > 0 && <span className="text-[10px] text-neutral-500 font-mono">({count})</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Min Slices Filter */}
        <div>
          <div className="flex items-center justify-between text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">
            <span>Vähimmäisleikemäärä</span>
            <span className="text-blue-400 font-mono">{minSlices > 0 ? `≥ ${minSlices}` : 'Kaikki'}</span>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {[0, 5, 15, 30].map((num) => (
              <button
                key={num}
                onClick={() => onMinSlicesChange(num)}
                className={`py-1 rounded text-[10.5px] font-medium border text-center transition-colors ${
                  minSlices === num
                    ? 'bg-blue-600/20 border-blue-500/60 text-blue-300'
                    : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                }`}
              >
                {num === 0 ? 'Kaikki' : `≥ ${num}`}
              </button>
            ))}
          </div>
        </div>

        {/* Date Range Filter */}
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">
            <Calendar className="w-3 h-3 text-emerald-400" />
            Kuvauspäivämäärä
          </div>
          <div className="space-y-1.5">
            <div>
              <label className="text-[10px] text-neutral-500 block mb-0.5">Alkaen</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => onDateChange(e.target.value, endDate)}
                className="w-full px-2 py-1 bg-neutral-900 border border-neutral-800 rounded text-xs text-neutral-300 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-[10px] text-neutral-500 block mb-0.5">Asti</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => onDateChange(startDate, e.target.value)}
                className="w-full px-2 py-1 bg-neutral-900 border border-neutral-800 rounded text-xs text-neutral-300 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Footer Stats */}
      <div className="p-3 border-t border-neutral-800 bg-neutral-950 text-[11px] text-neutral-500 flex justify-between">
        <span>Tutkimuksia: <strong className="text-neutral-300 font-mono">{facets?.totalStudies || 0}</strong></span>
        <span>Sarjoja: <strong className="text-neutral-300 font-mono">{facets?.totalSeries || 0}</strong></span>
        <span>Leikkeitä: <strong className="text-neutral-300 font-mono">{facets?.totalInstances || 0}</strong></span>
      </div>
    </aside>
  );
};
