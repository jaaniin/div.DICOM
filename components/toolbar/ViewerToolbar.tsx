import React from 'react';
import {
  AlertCircle,
  HelpCircle,
  PanelRightClose,
  PanelRightOpen,
  Download,
} from 'lucide-react';
import { Tool, LayoutNode, ViewportState, LengthMeasurement, DICOMStudy } from '../../utils/types';
import { ToolButtonGroup } from './ToolButtonGroup';
import { MeasurementTrashMenu } from './MeasurementTrashMenu';
import { LayoutPresetPicker } from './LayoutPresetPicker';

interface ViewerToolbarProps {
  activeTool: Tool;
  onSelectTool: (tool: Tool) => void;
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
  isLayoutMenuOpen: boolean;
  onToggleLayoutMenu: () => void;
  onApplyLayoutPreset: (preset: LayoutNode) => void;
  initialHangingProtocol: { layout: LayoutNode; viewports: ViewportState[] } | null;
  onRevertHangingProtocol: () => void;
  updateAvailable: { version: string; url: string } | null;
  onOpenHelp: () => void;
  onOpenDisclaimer: () => void;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export const ViewerToolbar: React.FC<ViewerToolbarProps> = ({
  activeTool,
  onSelectTool,
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
  isLayoutMenuOpen,
  onToggleLayoutMenu,
  onApplyLayoutPreset,
  initialHangingProtocol,
  onRevertHangingProtocol,
  updateAvailable,
  onOpenHelp,
  onOpenDisclaimer,
  isSidebarOpen,
  onToggleSidebar,
}) => {
  return (
    <div className="h-14 border-b border-neutral-800 bg-neutral-900/90 backdrop-blur-md px-4 flex items-center justify-between shrink-0 select-none z-30">
      {/* Brand & Update Notification */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="font-bold tracking-wide flex items-baseline select-none">
            <span className="text-neutral-500 font-mono tracking-tighter text-base">&lt;&nbsp;</span>
            <span className="text-[#3584F5] font-mono text-base">div.</span>
            <span className="text-white text-lg ml-0.5">DICOM</span>
            <span className="text-neutral-500 font-mono tracking-tighter ml-0.5 text-base">&nbsp;/&gt;</span>
          </span>
        </div>

        {updateAvailable && (
          <a
            href={updateAvailable.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#3584F5]/10 border border-[#3584F5]/30 text-[11px] text-[#3584F5] hover:bg-[#3584F5]/20 transition-colors shadow-sm"
          >
            <Download className="w-3 h-3 animate-bounce" />
            <span>Update v{updateAvailable.version}</span>
          </a>
        )}
      </div>

      {/* Main Center Tools */}
      <div className="flex items-center gap-1 bg-neutral-950/60 p-1 rounded-lg border border-neutral-800/80">
        <ToolButtonGroup activeTool={activeTool} onSelectTool={onSelectTool} />

        <div className="w-px h-6 bg-neutral-800 mx-1" />

        <MeasurementTrashMenu
          isTrashOpen={isTrashOpen}
          onToggleTrash={onToggleTrash}
          isDraggingOverTrash={isDraggingOverTrash}
          draggingPoint={draggingPoint}
          measurements={measurements}
          setMeasurements={setMeasurements}
          selectedForDeletion={selectedForDeletion}
          setSelectedForDeletion={setSelectedForDeletion}
          studies={studies}
          onDeleteSelected={onDeleteSelected}
        />

        <div className="w-px h-6 bg-neutral-800 mx-1" />

        <LayoutPresetPicker
          isMenuOpen={isLayoutMenuOpen}
          onToggleMenu={onToggleLayoutMenu}
          onApplyPreset={onApplyLayoutPreset}
          initialHangingProtocol={initialHangingProtocol}
          onRevertHangingProtocol={onRevertHangingProtocol}
        />
      </div>

      {/* Right Controls: Disclaimer, Help & Sidebar Toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenDisclaimer}
          className="text-xs text-amber-500/80 hover:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 px-2.5 py-1.5 rounded-md transition-colors flex items-center gap-1.5"
          title="Medical Disclaimer"
        >
          <AlertCircle className="w-3.5 h-3.5" />
          <span className="hidden sm:inline font-medium">Disclaimer</span>
        </button>

        <button
          onClick={onOpenHelp}
          className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-md transition-colors"
          title="Help & Shortcuts"
        >
          <HelpCircle className="w-5 h-5" />
        </button>

        <div className="w-px h-6 bg-neutral-800 mx-1" />

        <button
          onClick={onToggleSidebar}
          className={`p-1.5 rounded-md transition-colors ${
            isSidebarOpen
              ? 'text-[#3584F5] bg-[#3584F5]/10 hover:bg-[#3584F5]/20'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
          }`}
          title={isSidebarOpen ? 'Close Sidebar (Zen Mode)' : 'Open Sidebar'}
        >
          {isSidebarOpen ? <PanelRightClose className="w-5 h-5" /> : <PanelRightOpen className="w-5 h-5" />}
        </button>
      </div>
    </div>
  );
};
