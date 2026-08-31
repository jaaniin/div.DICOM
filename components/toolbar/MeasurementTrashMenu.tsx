import React from 'react';
import { Trash2, ListCollapse, ChevronRight } from 'lucide-react';
import { LengthMeasurement, DICOMStudy } from '../../utils/types';
import { calculateMeasurementLengthText } from '../../utils/measurements';

interface MeasurementTrashMenuProps {
  isTrashOpen: boolean;
  onToggleTrash: () => void;
  isDraggingOverTrash: boolean;
  draggingPoint: { id: string; point: string; isNew: boolean; lastPt?: any } | null;
  measurements: LengthMeasurement[];
  setMeasurements: React.Dispatch<React.SetStateAction<LengthMeasurement[]>>;
  selectedForDeletion: Set<string>;
  setSelectedForDeletion: React.Dispatch<React.SetStateAction<Set<string>>>;
  studies: DICOMStudy[];
  onDeleteSelected: () => void;
}

export const MeasurementTrashMenu: React.FC<MeasurementTrashMenuProps> = ({
  isTrashOpen,
  onToggleTrash,
  isDraggingOverTrash,
  draggingPoint,
  measurements,
  setMeasurements,
  selectedForDeletion,
  setSelectedForDeletion,
  studies,
  onDeleteSelected,
}) => {
  return (
    <div className="relative">
      <button
        id="trash-icon"
        onClick={onToggleTrash}
        className={`group relative p-2 rounded-md transition-all duration-200 flex items-center justify-center ${
          isDraggingOverTrash
            ? 'scale-110 bg-red-600 text-white ring-2 ring-red-400 shadow-lg shadow-red-600/50'
            : draggingPoint
            ? 'scale-105 bg-neutral-800 text-neutral-200 border border-neutral-600 shadow-md animate-pulse'
            : isTrashOpen
            ? 'bg-neutral-700 text-white'
            : 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'
        }`}
      >
        {draggingPoint ? (
          <Trash2
            className={`w-5 h-5 transition-transform ${
              isDraggingOverTrash ? '-translate-y-0.5 scale-110 text-white' : 'text-neutral-300'
            }`}
          />
        ) : (
          <ListCollapse className="w-5 h-5" />
        )}

        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2.5 py-1.5 bg-neutral-800 text-neutral-200 text-xs rounded-md shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 delay-0 group-hover:delay-300 whitespace-nowrap z-50 pointer-events-none border border-neutral-700/50 flex flex-col items-center leading-tight">
          <span className="font-medium">
            {draggingPoint
              ? isDraggingOverTrash
                ? 'Release to delete measurement'
                : 'Drag here to delete measurement'
              : 'Measurements & Deletions'}
          </span>
        </div>
      </button>

      {isTrashOpen && (
        <div className="absolute top-full left-0 mt-2 bg-neutral-800 border border-neutral-700 p-3 rounded-md shadow-2xl w-[340px] z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-medium text-neutral-400 uppercase tracking-wider">Measurements</h4>
            <span className="text-[10px] text-neutral-500 font-mono">({measurements.length})</span>
          </div>

          {measurements.length === 0 ? (
            <div className="text-xs text-neutral-500 italic mb-3">No measurements created</div>
          ) : (
            <div className="flex flex-col gap-2 max-h-56 overflow-y-auto mb-3">
              {measurements.map((m, idx) => {
                const isRoi = m.type === 'roi';
                return (
                  <div
                    key={m.id}
                    className="flex flex-col bg-neutral-900/50 border border-neutral-700/50 rounded overflow-hidden"
                  >
                    <div
                      className="flex items-center gap-2 text-sm text-neutral-200 hover:bg-neutral-700/60 p-1.5 transition-colors cursor-pointer"
                      onClick={(e) => {
                        if ((e.target as HTMLElement).tagName === 'INPUT') return;
                        if (isRoi) {
                          setMeasurements((prev) =>
                            prev.map((old) => (old.id === m.id ? { ...old, isExpanded: !old.isExpanded } : old))
                          );
                        }
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedForDeletion.has(m.id)}
                        onChange={(e) => {
                          const newSet = new Set(selectedForDeletion);
                          if (e.target.checked) newSet.add(m.id);
                          else newSet.delete(m.id);
                          setSelectedForDeletion(newSet);
                        }}
                        className="rounded bg-neutral-900 border-neutral-700 text-red-500 focus:ring-red-500 cursor-pointer"
                      />
                      <span className="truncate text-xs font-mono flex-1">
                        {calculateMeasurementLengthText(m, idx, studies)}
                      </span>
                      {isRoi && (
                        <ChevronRight
                          className={`w-4 h-4 text-neutral-400 transition-transform ${
                            m.isExpanded ? 'rotate-90' : ''
                          }`}
                        />
                      )}
                    </div>
                    {isRoi && m.isExpanded && (
                      <div className="p-2 bg-neutral-950 text-xs font-mono text-neutral-400 grid grid-cols-2 gap-y-1 gap-x-2 border-t border-neutral-800">
                        <div>Area:</div>
                        <div className="text-right text-neutral-200">
                          {m.area !== undefined ? `${m.area.toFixed(1)} mm²` : '--'}
                        </div>
                        <div>Mean:</div>
                        <div className="text-right text-neutral-200">
                          {m.mean !== undefined ? m.mean.toFixed(1) : '--'}
                        </div>
                        <div>StdDev:</div>
                        <div className="text-right text-neutral-200">
                          {m.stdDev !== undefined ? m.stdDev.toFixed(1) : '--'}
                        </div>
                        <div>Min:</div>
                        <div className="text-right text-neutral-200">
                          {m.min !== undefined ? m.min : '--'}
                        </div>
                        <div>Max:</div>
                        <div className="text-right text-neutral-200">
                          {m.max !== undefined ? m.max : '--'}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <button
            onClick={onDeleteSelected}
            disabled={selectedForDeletion.size === 0}
            className="w-full py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-neutral-700 disabled:text-neutral-500 text-white text-xs font-medium rounded transition-colors"
          >
            Delete selected {selectedForDeletion.size > 0 ? `(${selectedForDeletion.size})` : ''}
          </button>
        </div>
      )}
    </div>
  );
};
