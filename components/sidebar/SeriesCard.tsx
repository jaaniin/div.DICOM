import React from 'react';
import { FolderOpen, X } from 'lucide-react';
import { DICOMSeries, ViewportState } from '../../utils/types';
import { SeriesThumbnail } from './SeriesThumbnail';

interface SeriesCardProps {
  studyInstanceUID: string;
  series: DICOMSeries;
  viewports: ViewportState[];
  onSelect: (studyUID: string, seriesUID: string) => void;
  onRemove: (e: React.MouseEvent, studyUID: string, seriesUID: string) => void;
}

export const SeriesCard: React.FC<SeriesCardProps> = ({
  studyInstanceUID,
  series,
  viewports,
  onSelect,
  onRemove,
}) => {
  const activeVps = viewports
    .map((vp, idx) => (vp.seriesInstanceUID === series.seriesInstanceUID ? idx + 1 : null))
    .filter((idx): idx is number => idx !== null);

  const isActive = activeVps.length > 0;
  const middleInstance = series.instances[Math.floor(series.instances.length / 2)];

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(
          'application/x-dicom-series',
          JSON.stringify({
            studyInstanceUID,
            seriesInstanceUID: series.seriesInstanceUID,
          })
        );
      }}
      className={`text-xs text-neutral-300 p-2 bg-neutral-950 rounded-md border flex gap-3 cursor-grab active:cursor-grabbing transition-all hover:bg-neutral-900/60 ${
        isActive ? 'border-blue-500/50 ring-1 ring-blue-500/20' : 'border-neutral-800 hover:border-neutral-700'
      }`}
      onClick={() => onSelect(studyInstanceUID, series.seriesInstanceUID)}
    >
      <div className="relative shrink-0">
        <SeriesThumbnail instance={middleInstance} />
        {isActive && (
          <div className="absolute -top-2 -left-2 flex flex-col gap-0.5 z-10">
            {activeVps.map((vpNum) => (
              <span
                key={vpNum}
                className="px-1 bg-[#3584F5] text-white rounded-[3px] text-[9px] font-bold tracking-wider py-[1px] shadow-sm border border-blue-400"
              >
                V{vpNum}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col flex-1 min-w-0 justify-between py-0.5">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center truncate">
            <FolderOpen className="w-3 h-3 mr-1 text-[#3584F5] shrink-0" />
            <span className="truncate font-medium text-neutral-200">
              {series.seriesDescription || 'Unnamed Series'}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0 ml-2">
            <span className="text-[10px] bg-neutral-800/80 px-1.5 py-0.5 rounded text-neutral-400 font-mono font-medium">
              {series.modality}
            </span>
            <button
              onClick={(e) => onRemove(e, studyInstanceUID, series.seriesInstanceUID)}
              className="p-[3px] text-neutral-500 hover:text-red-400 hover:bg-neutral-800 rounded transition-colors"
              title="Remove series"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <div className="text-[10px] text-neutral-500 flex items-center justify-between font-mono">
          <span>{series.instances.length} Images</span>
          <span className="text-neutral-600 text-[9px] truncate max-w-[100px]">
            {series.seriesInstanceUID.slice(-8)}
          </span>
        </div>
      </div>
    </div>
  );
};
