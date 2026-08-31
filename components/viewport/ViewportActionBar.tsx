import React from 'react';
import { Columns, Rows, X, Maximize2, Minimize2 } from 'lucide-react';

interface ViewportActionBarProps {
  nodeId: string;
  isMaximized: boolean;
  totalVisible: number;
  canSplitHorizontal?: boolean;
  canSplitVertical?: boolean;
  onToggleMaximize: () => void;
  onSplitHorizontal: () => void;
  onSplitVertical: () => void;
  onClose: () => void;
}

export const ViewportActionBar: React.FC<ViewportActionBarProps> = ({
  isMaximized,
  totalVisible,
  canSplitHorizontal = true,
  canSplitVertical = true,
  onToggleMaximize,
  onSplitHorizontal,
  onSplitVertical,
  onClose,
}) => {
  // In Focus / Maximized mode, show only the Restore Viewport icon
  if (isMaximized) {
    return (
      <div
        className="flex items-center bg-neutral-900/80 hover:bg-neutral-900 border border-neutral-700/60 hover:border-neutral-500 rounded-lg p-1 shadow-lg backdrop-blur-md transition-all duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onToggleMaximize}
          className="p-1.5 text-[#3584F5] hover:text-white hover:bg-[#3584F5]/20 rounded-md transition-colors flex items-center justify-center"
          title="Restore Viewport Layout"
        >
          <Minimize2 className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-0.5 bg-neutral-900/75 hover:bg-neutral-900/95 border border-neutral-700/50 hover:border-neutral-600 rounded-lg p-1 shadow-lg backdrop-blur-md transition-all duration-200"
      onClick={(e) => e.stopPropagation()}
    >
      {/* 1. Split Horizontal (Columns) */}
      <button
        onClick={onSplitHorizontal}
        disabled={!canSplitHorizontal}
        className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed rounded-md transition-colors flex items-center justify-center"
        title={
          canSplitHorizontal
            ? 'Split Horizontally (Columns - max 6 cols)'
            : 'Max 6 columns reached'
        }
      >
        <Columns className="w-3.5 h-3.5" />
      </button>

      {/* 2. Split Vertical (Rows) */}
      <button
        onClick={onSplitVertical}
        disabled={!canSplitVertical}
        className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed rounded-md transition-colors flex items-center justify-center"
        title={
          canSplitVertical
            ? 'Split Vertically (Rows - max 4 rows)'
            : 'Max 4 rows reached'
        }
      >
        <Rows className="w-3.5 h-3.5" />
      </button>

      {/* 3. Maximize Viewport (Focus Mode) */}
      <button
        onClick={onToggleMaximize}
        className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-md transition-colors flex items-center justify-center"
        title="Maximize Viewport (Focus Mode)"
      >
        <Maximize2 className="w-3.5 h-3.5" />
      </button>

      {/* 4. Close Viewport */}
      {totalVisible > 1 && (
        <button
          onClick={onClose}
          className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded-md transition-colors flex items-center justify-center"
          title="Close Viewport"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
