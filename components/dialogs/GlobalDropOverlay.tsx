import React from 'react';
import { UploadCloud, Plus, RefreshCw } from 'lucide-react';

interface GlobalDropOverlayProps {
  isOpen: boolean;
  hasLoadedStudies: boolean;
  hoverZone: 'none' | 'left' | 'right' | 'single';
  onDragLeave: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}

export const GlobalDropOverlay: React.FC<GlobalDropOverlayProps> = ({
  isOpen,
  hasLoadedStudies,
  hoverZone,
  onDragLeave,
  onDragOver,
  onDrop,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex animate-in fade-in duration-150 select-none"
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {!hasLoadedStudies ? (
        <div
          className={`flex-1 flex flex-col items-center justify-center bg-blue-950/60 backdrop-blur-md border-4 border-dashed transition-all ${
            hoverZone === 'single' ? 'border-[#3584F5] bg-blue-900/40' : 'border-blue-500/40'
          }`}
        >
          <div className="pointer-events-none text-center flex flex-col items-center">
            <UploadCloud className="w-20 h-20 text-[#3584F5] mb-4 animate-pulse" />
            <h2 className="text-2xl font-bold text-white mb-2">Drop DICOM Files or Folders Here</h2>
            <p className="text-sm text-blue-200">Release to open and parse study instances</p>
          </div>
        </div>
      ) : (
        <>
          {/* Left: Add / Append */}
          <div
            className={`flex-1 flex flex-col items-center justify-center backdrop-blur-md border-4 border-dashed transition-all border-r-0 ${
              hoverZone === 'left'
                ? 'bg-blue-900/60 border-[#3584F5] scale-[1.01] z-10 shadow-2xl'
                : 'bg-blue-950/40 border-blue-500/30'
            }`}
          >
            <div className="pointer-events-none text-center flex flex-col items-center">
              <Plus
                className={`w-20 h-20 mb-4 transition-transform ${
                  hoverZone === 'left' ? 'text-blue-300 scale-110' : 'text-blue-400'
                }`}
              />
              <h2 className="text-2xl font-bold text-white mb-2 tracking-wide">ADD IMAGES</h2>
              <p className="text-sm text-blue-200">Append new studies alongside current ones</p>
            </div>
          </div>

          {/* Right: Replace */}
          <div
            className={`flex-1 flex flex-col items-center justify-center backdrop-blur-md border-4 border-dashed transition-all border-l-0 ${
              hoverZone === 'right'
                ? 'bg-amber-900/60 border-amber-400 scale-[1.01] z-10 shadow-2xl'
                : 'bg-amber-950/40 border-amber-500/30'
            }`}
          >
            <div className="pointer-events-none text-center flex flex-col items-center">
              <RefreshCw
                className={`w-20 h-20 mb-4 transition-transform ${
                  hoverZone === 'right' ? 'text-amber-300 scale-110 rotate-180 duration-500' : 'text-amber-400'
                }`}
              />
              <h2 className="text-2xl font-bold text-white mb-2 tracking-wide">REPLACE IMAGES</h2>
              <p className="text-sm text-amber-200">Clear current workspace and load only new files</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
