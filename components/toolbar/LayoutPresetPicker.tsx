import React from 'react';
import { LayoutGrid, RotateCcw } from 'lucide-react';
import { LayoutNode, ViewportState } from '../../utils/types';

export const LAYOUT_PRESETS: { name: string; node: LayoutNode }[] = [
  {
    name: '1x1 Single',
    node: { type: 'viewport', id: 'vp_0', viewportIndex: 0 },
  },
  {
    name: '1x2 Columns',
    node: {
      type: 'split',
      direction: 'horizontal',
      id: 'split_1x2',
      children: [
        { type: 'viewport', id: 'vp_0', viewportIndex: 0 },
        { type: 'viewport', id: 'vp_1', viewportIndex: 1 },
      ],
    },
  },
  {
    name: '1x3 Columns',
    node: {
      type: 'split',
      direction: 'horizontal',
      id: 'split_1x3_root',
      children: [
        { type: 'viewport', id: 'vp_0', viewportIndex: 0 },
        {
          type: 'split',
          direction: 'horizontal',
          id: 'split_1x3_sub',
          children: [
            { type: 'viewport', id: 'vp_1', viewportIndex: 1 },
            { type: 'viewport', id: 'vp_2', viewportIndex: 2 },
          ],
        },
      ],
    },
  },
  {
    name: '2x1 Rows',
    node: {
      type: 'split',
      direction: 'vertical',
      id: 'split_2x1',
      children: [
        { type: 'viewport', id: 'vp_0', viewportIndex: 0 },
        { type: 'viewport', id: 'vp_1', viewportIndex: 1 },
      ],
    },
  },
  {
    name: '1+2 Hanging',
    node: {
      type: 'split',
      direction: 'horizontal',
      id: 'split_1p2_root',
      children: [
        { type: 'viewport', id: 'vp_0', viewportIndex: 0 },
        {
          type: 'split',
          direction: 'vertical',
          id: 'split_1p2_sub',
          children: [
            { type: 'viewport', id: 'vp_1', viewportIndex: 1 },
            { type: 'viewport', id: 'vp_2', viewportIndex: 2 },
          ],
        },
      ],
    },
  },
  {
    name: '2x2 Grid',
    node: {
      type: 'split',
      direction: 'vertical',
      id: 'split_2x2_root',
      children: [
        {
          type: 'split',
          direction: 'horizontal',
          id: 'split_2x2_top',
          children: [
            { type: 'viewport', id: 'vp_0', viewportIndex: 0 },
            { type: 'viewport', id: 'vp_1', viewportIndex: 1 },
          ],
        },
        {
          type: 'split',
          direction: 'horizontal',
          id: 'split_2x2_bottom',
          children: [
            { type: 'viewport', id: 'vp_2', viewportIndex: 2 },
            { type: 'viewport', id: 'vp_3', viewportIndex: 3 },
          ],
        },
      ],
    },
  },
];

interface LayoutPresetPickerProps {
  isMenuOpen: boolean;
  onToggleMenu: () => void;
  onApplyPreset: (preset: LayoutNode) => void;
  initialHangingProtocol: { layout: LayoutNode; viewports: ViewportState[] } | null;
  onRevertHangingProtocol: () => void;
}

export const LayoutPresetPicker: React.FC<LayoutPresetPickerProps> = ({
  isMenuOpen,
  onToggleMenu,
  onApplyPreset,
  initialHangingProtocol,
  onRevertHangingProtocol,
}) => {
  return (
    <div className="flex items-center gap-1">
      {/* Preset Dropdown */}
      <div className="relative">
        <button
          onClick={onToggleMenu}
          className={`p-2 rounded-md transition-colors flex items-center gap-1.5 text-xs font-medium ${
            isMenuOpen
              ? 'bg-[#3584F5] text-white shadow-md shadow-[#3584F5]/30'
              : 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'
          }`}
          title="Grid Layout Presets"
        >
          <LayoutGrid className="w-5 h-5" />
        </button>

        {isMenuOpen && (
          <div className="absolute top-full left-0 mt-2 bg-neutral-800 border border-neutral-700/80 p-2 rounded-lg shadow-2xl w-44 z-50 animate-in fade-in zoom-in-95 duration-150 flex flex-col gap-1">
            <div className="px-2 py-1 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider border-b border-neutral-700/60 mb-1">
              Grid Layouts
            </div>
            {LAYOUT_PRESETS.map((preset) => (
              <button
                key={preset.name}
                onClick={() => {
                  onApplyPreset(preset.node);
                }}
                className="w-full text-left px-2.5 py-1.5 text-xs text-neutral-200 hover:bg-neutral-700 hover:text-white rounded transition-colors flex items-center justify-between"
              >
                <span>{preset.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Revert Hanging Protocol Button */}
      {initialHangingProtocol && (
        <button
          onClick={onRevertHangingProtocol}
          className="px-2 py-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-md transition-colors text-xs flex items-center gap-1.5 border border-neutral-700/50"
          title="Reset to initial Hanging Protocol layout"
        >
          <RotateCcw className="w-3.5 h-3.5 text-[#3584F5]" />
          <span>Reset Layout</span>
        </button>
      )}
    </div>
  );
};
