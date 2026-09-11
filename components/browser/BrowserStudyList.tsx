import React, { useState } from 'react';
import {
  ChevronRight,
  ChevronDown,
  FolderOpen,
  ExternalLink,
  Layers,
  Calendar,
  User,
  Activity,
  ArrowUpDown,
} from 'lucide-react';
import type { BrowserStudyItem, BrowserSeriesItem } from '@/utils/types';
import { BrowserSeriesThumbnail } from './BrowserSeriesThumbnail';

interface BrowserStudyListProps {
  studies: BrowserStudyItem[];
  selectedSeries: BrowserSeriesItem | null;
  onSelectSeries: (series: BrowserSeriesItem, study: BrowserStudyItem) => void;
  onOpenInViewer: (studyUid: string, seriesUid?: string) => void;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  onSortChange: (sortBy: any, sortOrder: 'asc' | 'desc') => void;
  isLoading: boolean;
}

export const BrowserStudyList: React.FC<BrowserStudyListProps> = ({
  studies,
  selectedSeries,
  onSelectSeries,
  onOpenInViewer,
  sortBy,
  sortOrder,
  onSortChange,
  isLoading,
}) => {
  const [expandedStudies, setExpandedStudies] = useState<Record<string, boolean>>({});

  const toggleStudyExpand = (studyUid: string) => {
    setExpandedStudies((prev) => ({
      ...prev,
      [studyUid]: prev[studyUid] === undefined ? false : !prev[studyUid],
    }));
  };

  const isStudyExpanded = (studyUid: string) => {
    // Default to true (expanded)
    return expandedStudies[studyUid] !== false;
  };

  const formatStudyDate = (dateStr: string) => {
    if (!dateStr || dateStr.length < 8) return dateStr || 'Tuntematon pvm';
    const y = dateStr.slice(0, 4);
    const m = dateStr.slice(4, 6);
    const d = dateStr.slice(6, 8);
    return `${d}.${m}.${y}`;
  };

  const getOrientationColor = (ori: string) => {
    switch (ori) {
      case 'SAGITTAL':
        return 'bg-purple-900/40 text-purple-300 border-purple-700/50';
      case 'CORONAL':
        return 'bg-emerald-900/40 text-emerald-300 border-emerald-700/50';
      case 'AXIAL':
        return 'bg-blue-900/40 text-blue-300 border-blue-700/50';
      default:
        return 'bg-neutral-800 text-neutral-400 border-neutral-700';
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-neutral-900 overflow-hidden text-neutral-200">
      {/* Top action bar / sorting */}
      <div className="h-10 px-4 border-b border-neutral-800 bg-neutral-950 flex items-center justify-between shrink-0 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-neutral-300">Tutkimukset</span>
          <span className="bg-neutral-800 text-neutral-400 px-2 py-0.5 rounded-full text-[11px] font-mono">
            {studies.length} kpl
          </span>
        </div>

        {/* Sort Controls */}
        <div className="flex items-center gap-2">
          <ArrowUpDown className="w-3.5 h-3.5 text-neutral-500" />
          <span className="text-neutral-400 text-[11px]">Järjestä:</span>
          <select
            value={`${sortBy}_${sortOrder}`}
            onChange={(e) => {
              const [field, order] = e.target.value.split('_');
              onSortChange(field, order as 'asc' | 'desc');
            }}
            className="bg-neutral-900 border border-neutral-800 text-neutral-300 rounded px-2 py-1 text-[11px] focus:outline-none focus:border-blue-500"
          >
            <option value="studyDate_desc">Päivämäärä (Uusin ensin)</option>
            <option value="studyDate_asc">Päivämäärä (Vanhin ensin)</option>
            <option value="patientName_asc">Potilaan nimi (A-Ö)</option>
            <option value="patientId_asc">Potilas-ID</option>
            <option value="seriesCount_desc">Sarjamäärä (Eniten)</option>
          </select>
        </div>
      </div>

      {/* Main List Body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {isLoading ? (
          <div className="h-48 flex items-center justify-center text-neutral-500 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              Ladataan tutkimuksia...
            </div>
          </div>
        ) : studies.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center text-neutral-500 text-xs space-y-1">
            <Layers className="w-8 h-8 text-neutral-700" />
            <span className="font-medium text-neutral-400">Ei tutkimuksia</span>
            <span className="text-[11px] text-neutral-600">
              Skannaa paikallinen DICOM-hakemisto sivupalkista tai kokeile toisia hakuehtoja.
            </span>
          </div>
        ) : (
          studies.map((study) => {
            const expanded = isStudyExpanded(study.studyInstanceUid);

            return (
              <div
                key={study.studyInstanceUid}
                className="bg-neutral-950 border border-neutral-800 rounded-lg overflow-hidden transition-all shadow-sm"
              >
                {/* Study Header Row */}
                <div
                  onClick={() => toggleStudyExpand(study.studyInstanceUid)}
                  className="px-3.5 py-2.5 bg-neutral-900/80 hover:bg-neutral-900 cursor-pointer flex items-center justify-between border-b border-neutral-800/80 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <button
                      type="button"
                      className="text-neutral-400 hover:text-neutral-200 transition-transform"
                    >
                      {expanded ? (
                        <ChevronDown className="w-4 h-4 text-blue-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>

                    <div className="flex items-center gap-2 font-medium text-xs text-neutral-200 truncate">
                      <User className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                      <span className="font-semibold text-neutral-100">{study.patientName}</span>
                      <span className="text-neutral-500 font-mono text-[11px]">({study.patientId})</span>
                    </div>

                    <span className="text-neutral-600">•</span>

                    <div className="text-neutral-300 text-xs truncate max-w-sm">
                      {study.studyDescription || 'Ei tutkimuskuvausta'}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 text-xs">
                    <div className="flex items-center gap-1 text-neutral-400 text-[11px]">
                      <Calendar className="w-3 h-3 text-neutral-500" />
                      <span>{formatStudyDate(study.studyDate)}</span>
                    </div>

                    <span className="bg-neutral-800 text-neutral-300 font-mono px-2 py-0.5 rounded text-[11px]">
                      {study.seriesCount} {study.seriesCount === 1 ? 'sarja' : 'sarjaa'} ({study.totalInstances} leikettä)
                    </span>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenInViewer(study.studyInstanceUid);
                      }}
                      className="px-2.5 py-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 hover:text-blue-300 border border-blue-500/30 rounded text-[11px] font-medium flex items-center gap-1 transition-colors"
                      title="Avaa tutkimus katselimessa"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Avaa tutkimus
                    </button>
                  </div>
                </div>

                {/* Series List (Cards) */}
                {expanded && (
                  <div className="p-2.5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 bg-neutral-950/60">
                    {study.series.map((ser) => {
                      const isSelected = selectedSeries?.seriesInstanceUid === ser.seriesInstanceUid;

                      return (
                        <div
                          key={ser.seriesInstanceUid}
                          onClick={() => onSelectSeries(ser, study)}
                          className={`p-2 rounded-md border flex gap-2.5 cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-blue-950/30 border-blue-500/60 ring-1 ring-blue-500/30'
                              : 'bg-neutral-900/60 hover:bg-neutral-900 border-neutral-800/80 hover:border-neutral-700'
                          }`}
                        >
                          {/* Thumbnail */}
                          <BrowserSeriesThumbnail
                            filePath={ser.previewFilePath}
                            sopUid={ser.previewSopUid}
                            size={60}
                          />

                          {/* Info Column */}
                          <div className="flex flex-col flex-1 min-w-0 justify-between py-0.5">
                            <div>
                              <div className="flex items-center justify-between gap-1 mb-1">
                                <span className="font-medium text-neutral-200 text-xs truncate" title={ser.seriesDescription}>
                                  {ser.seriesDescription || 'Nimetön sarja'}
                                </span>
                                <span className="text-[10px] font-mono font-bold bg-neutral-800 text-neutral-400 px-1 rounded shrink-0">
                                  {ser.modality}
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span
                                  className={`text-[9.5px] font-semibold px-1.5 py-0.2 rounded border ${getOrientationColor(
                                    ser.calculatedOrientation
                                  )}`}
                                >
                                  {ser.calculatedOrientation}
                                </span>
                                {ser.sliceThickness && (
                                  <span className="text-[10px] text-neutral-400 font-mono">
                                    {ser.sliceThickness.toFixed(1)} mm
                                  </span>
                                )}
                                {ser.rows && ser.columns && (
                                  <span className="text-[10px] text-neutral-500 font-mono">
                                    {ser.rows}×{ser.columns}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center justify-between text-[10px] text-neutral-500 font-mono mt-1 pt-1 border-t border-neutral-800/60">
                              <span>{ser.instanceCount} leikettä</span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onOpenInViewer(study.studyInstanceUid, ser.seriesInstanceUid);
                                }}
                                className="text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-0.5 text-[10.5px]"
                              >
                                <ExternalLink className="w-2.5 h-2.5" />
                                Avaa
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
