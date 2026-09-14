import React from 'react';
import {
  SunMedium,
  Move,
  Search,
  RotateCw,
  Ruler,
  Crosshair,
} from 'lucide-react';
import { Tool } from '../../utils/types';
import { FastPagingIcon, AngleIcon, RoiIcon } from '../Icons';

export interface ToolDef {
  id: Tool;
  icon: any;
  label: string;
  shortcut: string;
  hotkey: string;
}

export const TOOLS: ToolDef[] = [
  { id: 'paging', icon: FastPagingIcon, label: 'Fast Paging', shortcut: 'B • Left Drag', hotkey: 'B' },
  { id: 'wwc', icon: SunMedium, label: 'Window/Level (WW/WL)', shortcut: 'W • Right Drag', hotkey: 'W' },
  { id: 'pan', icon: Move, label: 'Pan', shortcut: 'P • Middle Drag', hotkey: 'P' },
  { id: 'zoom', icon: Search, label: 'Zoom', shortcut: 'Z • Left+Right Drag', hotkey: 'Z' },
  { id: 'rotate', icon: RotateCw, label: 'Rotate 2D', shortcut: 'R • Drag (Shift snap)', hotkey: 'R' },
  { id: 'length', icon: Ruler, label: 'Distance', shortcut: 'L', hotkey: 'L' },
  { id: 'angle', icon: AngleIcon, label: 'Angle', shortcut: 'A', hotkey: 'A' },
  { id: 'roi', icon: RoiIcon, label: 'ROI (Polygon)', shortcut: 'O', hotkey: 'O' },
  { id: 'pixel', icon: Crosshair, label: 'Pixel Probe', shortcut: 'D', hotkey: 'D' },
];

interface ToolButtonGroupProps {
  activeTool: Tool;
  onSelectTool: (tool: Tool) => void;
}

export const ToolButtonGroup: React.FC<ToolButtonGroupProps> = ({
  activeTool,
  onSelectTool,
}) => {
  return (
    <div className="flex items-center gap-1">
      {TOOLS.map((tool) => {
        const Icon = tool.icon;
        const isActive = activeTool === tool.id;

        return (
          <button
            key={tool.id}
            onClick={() => onSelectTool(isActive ? 'none' : tool.id)}
            className={`group relative p-2 rounded-md transition-all duration-150 ${
              isActive
                ? 'bg-[#3584F5] text-white shadow-md shadow-[#3584F5]/30 ring-1 ring-blue-400'
                : 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'
            }`}
          >
            <Icon className="w-5 h-5" />
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2.5 py-1.5 bg-neutral-800 text-neutral-200 text-xs rounded-md shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 delay-0 group-hover:delay-300 whitespace-nowrap z-50 pointer-events-none border border-neutral-700/50 flex flex-col items-center leading-tight">
              <span className="font-medium flex items-center gap-1.5">
                {tool.label}
                <kbd className="px-1.5 py-0.5 text-[10px] bg-neutral-900 border border-neutral-700 text-[#3584F5] rounded font-mono font-semibold">
                  {tool.hotkey}
                </kbd>
              </span>
              {tool.shortcut && (
                <span className="text-[10px] text-neutral-400 italic mt-0.5">{tool.shortcut}</span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
};
