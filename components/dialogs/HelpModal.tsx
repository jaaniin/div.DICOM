import React from 'react';
import { HelpCircle, X } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  version: string;
}

export const HelpModal: React.FC<HelpModalProps> = ({
  isOpen,
  onClose,
  version,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-neutral-900 border border-neutral-700/80 rounded-xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#3584F5]/20 flex items-center justify-center shrink-0">
              <HelpCircle className="w-5 h-5 text-[#3584F5]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Help & Shortcuts</h2>
              <p className="text-sm text-neutral-400">Quick reference guide</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[60vh] text-sm text-neutral-300 space-y-6">
          <div>
            <h3 className="font-semibold text-[#3584F5] uppercase tracking-wider text-xs mb-3 border-b border-neutral-800 pb-2">
              About
            </h3>
            <div className="flex items-center justify-between bg-neutral-950/50 p-4 rounded-lg border border-neutral-800/50">
              <div className="flex items-center gap-3">
                <span className="font-bold tracking-wide flex items-baseline select-none">
                  <span className="text-neutral-500 font-mono tracking-tighter text-lg">&lt;&nbsp;</span>
                  <span className="text-[#3584F5] font-mono text-lg">div.</span>
                  <span className="text-white text-xl ml-0.5">DICOM</span>
                  <span className="text-neutral-500 font-mono tracking-tighter ml-0.5 text-lg">&nbsp;/&gt;</span>
                </span>
                <span className="text-neutral-400 font-medium">v{version}</span>
              </div>
              <a
                href="https://github.com/jaaniin/div.DICOM/releases"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-[#3584F5] hover:underline transition-colors"
              >
                Release Notes
              </a>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-[#3584F5] uppercase tracking-wider text-xs mb-3 border-b border-neutral-800 pb-2">
              Mouse Controls
            </h3>
            <div className="grid grid-cols-2 gap-y-2 text-sm">
              <div className="text-neutral-400">Left Click & Drag</div>
              <div className="font-medium text-white">Use Active Tool</div>
              <div className="text-neutral-400">Middle Click & Drag</div>
              <div className="font-medium text-white">Pan Image</div>
              <div className="text-neutral-400">Right Click & Drag</div>
              <div className="font-medium text-white">Adjust Window / Level</div>
              <div className="text-neutral-400">Left + Right Click & Drag</div>
              <div className="font-medium text-white">Zoom In / Out</div>
              <div className="text-neutral-400">Scroll Wheel</div>
              <div className="font-medium text-white">Change Slice</div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-[#3584F5] uppercase tracking-wider text-xs mb-3 border-b border-neutral-800 pb-2">
              Tool Hotkeys
            </h3>
            <div className="grid grid-cols-2 gap-y-2.5 text-sm">
              <div className="text-neutral-400 flex items-center gap-2">
                <kbd className="px-1.5 py-0.5 bg-neutral-800 rounded font-mono text-white text-xs border border-neutral-700">W</kbd>
                Window/Level (WW/WC)
              </div>
              <div className="font-medium text-white">Brightness & Contrast</div>

              <div className="text-neutral-400 flex items-center gap-2">
                <kbd className="px-1.5 py-0.5 bg-neutral-800 rounded font-mono text-white text-xs border border-neutral-700">P</kbd>
                Pan
              </div>
              <div className="font-medium text-white">Translate Image</div>

              <div className="text-neutral-400 flex items-center gap-2">
                <kbd className="px-1.5 py-0.5 bg-neutral-800 rounded font-mono text-white text-xs border border-neutral-700">Z</kbd>
                Zoom
              </div>
              <div className="font-medium text-white">Zoom In / Out</div>

              <div className="text-neutral-400 flex items-center gap-2">
                <kbd className="px-1.5 py-0.5 bg-neutral-800 rounded font-mono text-white text-xs border border-neutral-700">L</kbd>
                Distance
              </div>
              <div className="font-medium text-white">Measure Length (mm)</div>

              <div className="text-neutral-400 flex items-center gap-2">
                <kbd className="px-1.5 py-0.5 bg-neutral-800 rounded font-mono text-white text-xs border border-neutral-700">A</kbd>
                Angle
              </div>
              <div className="font-medium text-white">3-Point Angle (°)</div>

              <div className="text-neutral-400 flex items-center gap-2">
                <kbd className="px-1.5 py-0.5 bg-neutral-800 rounded font-mono text-white text-xs border border-neutral-700">R</kbd>
                ROI (Polygon)
              </div>
              <div className="font-medium text-white">Area & Mean HU/Density</div>

              <div className="text-neutral-400 flex items-center gap-2">
                <kbd className="px-1.5 py-0.5 bg-neutral-800 rounded font-mono text-white text-xs border border-neutral-700">D</kbd>
                Pixel Probe
              </div>
              <div className="font-medium text-white">Crosshair 3D Cursor</div>

              <div className="text-neutral-400 flex items-center gap-2">
                <kbd className="px-1.5 py-0.5 bg-neutral-800 rounded font-mono text-white text-xs border border-neutral-700">Esc</kbd>
                Deselect Tool
              </div>
              <div className="font-medium text-white">Reset to Pointer</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
