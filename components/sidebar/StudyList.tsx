import React from 'react';
import { UploadCloud, Trash2 } from 'lucide-react';
import { DICOMStudy, ViewportState } from '../../utils/types';
import { formatDicomDate } from '../../utils/formatters';
import { SeriesCard } from './SeriesCard';

interface StudyListProps {
  studies: DICOMStudy[];
  viewports: ViewportState[];
  isDragging: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onFileInput: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSelectSeries: (studyUID: string, seriesUID: string) => void;
  onRemoveSeries: (e: React.MouseEvent, studyUID: string, seriesUID: string) => void;
  onClearAll: () => void;
}

export const StudyList: React.FC<StudyListProps> = ({
  studies,
  viewports,
  isDragging,
  fileInputRef,
  onDragOver,
  onDragLeave,
  onDrop,
  onFileInput,
  onSelectSeries,
  onRemoveSeries,
  onClearAll,
}) => {
  return (
    <div className="p-4 flex flex-col h-full">
      {/* Upload Dropzone */}
      <div
        className={`${
          studies.length === 0 ? 'flex-1 flex-col p-6' : 'shrink-0 flex-row p-3'
        } border-2 border-dashed rounded-lg flex items-center justify-center text-center transition-all cursor-pointer ${
          isDragging
            ? 'border-blue-500 bg-blue-500/10 text-blue-400'
            : 'border-neutral-700/80 bg-neutral-950/50 text-neutral-400 hover:border-neutral-500 hover:bg-neutral-900'
        }`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <UploadCloud
          className={`${studies.length === 0 ? 'w-10 h-10 mb-3' : 'w-6 h-6 mr-3'} ${
            isDragging ? 'text-blue-400' : 'text-neutral-500'
          }`}
        />
        <div className={studies.length === 0 ? '' : 'text-left'}>
          <h3 className={`${studies.length === 0 ? 'text-sm mb-1' : 'text-sm'} font-medium text-neutral-200`}>
            Drag & Drop DICOM Files
          </h3>
          <p className={`${studies.length === 0 ? 'text-xs' : 'text-[10px]'} text-neutral-500`}>
            or click to select files{studies.length === 0 ? ' from your computer' : ''}
          </p>
        </div>

        <input
          type="file"
          ref={fileInputRef as any}
          onChange={onFileInput}
          className="hidden"
          multiple
          {...({ webkitdirectory: '' } as any)}
        />
      </div>

      {/* Loaded Studies Section */}
      <div className="mt-4 flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-2 shrink-0">
          <h4 className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
            Loaded Studies
          </h4>
          {studies.length > 0 && (
            <button
              onClick={onClearAll}
              className="text-xs text-neutral-500 hover:text-red-400 transition-colors px-2 py-0.5 rounded flex items-center gap-1 hover:bg-neutral-800"
              title="Remove all loaded studies"
            >
              <Trash2 className="w-3 h-3" />
              Clear
            </button>
          )}
        </div>

        {studies.length === 0 ? (
          <div className="text-xs text-neutral-600 italic text-center p-4 bg-neutral-950 rounded-md border border-neutral-800/50">
            No studies loaded yet.
          </div>
        ) : (
          <div className="flex flex-col gap-3 overflow-y-auto pr-1 flex-1">
            {studies.map((study) => (
              <div key={study.studyInstanceUID} className="flex flex-col gap-1.5">
                {/* Study Header */}
                <div className="text-[11px] text-emerald-400 font-medium px-1 flex items-center justify-between">
                  <span className="truncate">{study.patientName || 'Unknown Patient'}</span>
                  <span className="text-neutral-500 font-mono text-[10px]">{formatDicomDate(study.studyDate)}</span>
                </div>

                {/* Series List */}
                <div className="flex flex-col gap-1">
                  {study.series.map((series) => (
                    <SeriesCard
                      key={series.seriesInstanceUID}
                      studyInstanceUID={study.studyInstanceUID}
                      series={series}
                      viewports={viewports}
                      onSelect={onSelectSeries}
                      onRemove={onRemoveSeries}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
