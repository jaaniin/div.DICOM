import React from 'react';
import { Columns, Rows, X, Maximize2, Minimize2 } from 'lucide-react';

interface ViewportActionBarProps {
  nodeId: string;
  isMaximized: boolean;
  totalVisible: number;
  onToggleMaximize: () => void;
  onSplitHorizontal: () => void;
  onSplitVertical: () => void;
  onClose: () => void;
}

export const ViewportActionBar: React.FC<ViewportActionBarProps> = ({
  isMaximized,
  totalVisible,
  onToggleMaximize,
  onSplitHorizontal,
  onSplitVertical,
  onClose,
}) => {
  return (
    <div
      className="group/actionbar relative flex items-center bg-neutral-900/75 hover:bg-neutral-900/95 border border-neutral-700/50 hover:border-neutral-600 rounded-lg p-1 shadow-lg backdrop-blur-md transition-all duration-300 ease-out max-w-[34px] hover:max-w-[160px] overflow-hidden"
      onClick={(e) => e.stopPropagation()}
    >
      {/* 1. Main Anchor Icon (Always visible in collapsed mode: Columns icon or Maximize) */}
      <button
        onClick={onSplitHorizontal}
        className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-md transition-colors shrink-0 flex items-center justify-center"
        title="Split Horizontally (Hover for more layout tools)"
      >
        <Columns className="w-3.5 h-3.5" />
      </button>

      {/* 2. Expanded Tools (Slide out when hovering over the action bar) */}
      <div className="flex items-center gap-1 pl-1 opacity-0 group-hover/actionbar:opacity-100 transition-opacity duration-200 shrink-0">
        <button
          onClick={onSplitVertical}
          className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-md transition-colors flex items-center justify-center"
          title="Split Vertically (Top / Bottom)"
        >
          <Rows className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={onToggleMaximize}
          className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-md transition-colors flex items-center justify-center"
          title={isMaximized ? 'Restore Viewport Layout' : 'Maximize Viewport'}
        >
          {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>

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
    </div>
  );
};
