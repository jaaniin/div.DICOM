import React from 'react';
import type { BrowserSeriesItem, BrowserStudyItem } from '@/utils/types';
import { BrowserSeriesThumbnail } from './BrowserSeriesThumbnail';
import { ExternalLink, Info, X } from 'lucide-react';

interface BrowserSeriesInspectorProps {
  series: BrowserSeriesItem | null;
  study: BrowserStudyItem | null;
  onClose: () => void;
  onOpenInViewer: (studyUid: string, seriesUid?: string) => void;
}

export const BrowserSeriesInspector: React.FC<BrowserSeriesInspectorProps> = ({
  series,
  study,
  onClose,
  onOpenInViewer,
}) => {
  if (!series || !study) {
    return (
      <aside className="w-80 bg-neutral-950 border-l border-neutral-800 flex flex-col items-center justify-center p-6 text-neutral-500 text-xs text-center shrink-0 select-none">
        <Info className="w-8 h-8 text-neutral-700 mb-2" />
        <span className="font-medium text-neutral-400">Ei valittua sarjaa</span>
        <span className="text-[11px] text-neutral-600 mt-1">
          Valitse kuvasarja listalta nähdäksesi tekniset tiedot ja suuremman esikatselukuvan.
        </span>
      </aside>
    );
  }

  return (
    <aside className="w-80 bg-neutral-950 border-l border-neutral-800 flex flex-col h-full overflow-hidden text-neutral-300 text-xs shrink-0 select-none">
      {/* Header */}
      <div className="h-10 px-3.5 border-b border-neutral-800 flex items-center justify-between shrink-0">
        <span className="font-semibold text-neutral-200 text-xs flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-blue-400" />
          Sarjan tiedot
        </span>
        <button
          onClick={onClose}
          className="text-neutral-500 hover:text-neutral-300 transition-colors"
          title="Sulje paneeli"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Large Thumbnail Preview */}
        <div className="flex flex-col items-center justify-center bg-black/50 p-3 rounded-lg border border-neutral-800/80">
          <BrowserSeriesThumbnail
            filePath={series.previewFilePath}
            sopUid={series.previewSopUid}
            size={180}
          />
          <div className="mt-2 text-center">
            <span className="font-semibold text-neutral-200 block text-xs truncate max-w-[220px]">
              {series.seriesDescription || 'Nimetön sarja'}
            </span>
            <span className="text-[11px] text-neutral-500 font-mono">
              {series.instanceCount} leikettä • {series.modality}
            </span>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={() => onOpenInViewer(study.studyInstanceUid, series.seriesInstanceUid)}
          className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded text-xs flex items-center justify-center gap-1.5 transition-colors shadow-sm"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Avaa tämä sarja katselimeen
        </button>

        {/* Technical Properties Table */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-1">
            Tekniset parametrit
          </div>
          <div className="bg-neutral-900/70 border border-neutral-800/80 rounded-md p-2.5 space-y-1.5 text-[11px]">
            <div className="flex justify-between py-0.5 border-b border-neutral-800/50">
              <span className="text-neutral-500">Leikesuunta:</span>
              <span className="font-semibold text-purple-300 font-mono">{series.calculatedOrientation}</span>
            </div>
            <div className="flex justify-between py-0.5 border-b border-neutral-800/50">
              <span className="text-neutral-500">Modaliteetti:</span>
              <span className="font-mono text-neutral-200">{series.modality}</span>
            </div>
            <div className="flex justify-between py-0.5 border-b border-neutral-800/50">
              <span className="text-neutral-500">Koko (Matriisi):</span>
              <span className="font-mono text-neutral-200">
                {series.rows && series.columns ? `${series.rows} × ${series.columns}` : '–'}
              </span>
            </div>
            <div className="flex justify-between py-0.5 border-b border-neutral-800/50">
              <span className="text-neutral-500">Leikepaksuus:</span>
              <span className="font-mono text-neutral-200">
                {series.sliceThickness ? `${series.sliceThickness.toFixed(2)} mm` : '–'}
              </span>
            </div>
            <div className="flex justify-between py-0.5 border-b border-neutral-800/50">
              <span className="text-neutral-500">Sarjanumero:</span>
              <span className="font-mono text-neutral-200">{series.seriesNumber ?? '–'}</span>
            </div>
            <div className="flex justify-between py-0.5">
              <span className="text-neutral-500">Leikkeet:</span>
              <span className="font-mono text-neutral-200">{series.instanceCount} kpl</span>
            </div>
          </div>
        </div>

        {/* Study Info */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-1">
            Tutkimus & Potilas
          </div>
          <div className="bg-neutral-900/70 border border-neutral-800/80 rounded-md p-2.5 space-y-1.5 text-[11px]">
            <div className="flex justify-between py-0.5 border-b border-neutral-800/50">
              <span className="text-neutral-500">Potilas:</span>
              <span className="font-medium text-neutral-200 truncate max-w-[150px]">{study.patientName}</span>
            </div>
            <div className="flex justify-between py-0.5 border-b border-neutral-800/50">
              <span className="text-neutral-500">Potilas-ID:</span>
              <span className="font-mono text-neutral-200">{study.patientId}</span>
            </div>
            <div className="flex justify-between py-0.5 border-b border-neutral-800/50">
              <span className="text-neutral-500">Päivämäärä:</span>
              <span className="font-mono text-neutral-200">{study.studyDate || '–'}</span>
            </div>
            <div className="py-0.5">
              <span className="text-neutral-500 block mb-0.5">Series UID:</span>
              <span className="font-mono text-[9.5px] text-neutral-400 break-all">{series.seriesInstanceUid}</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};
