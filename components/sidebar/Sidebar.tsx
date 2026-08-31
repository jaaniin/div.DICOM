import React from 'react';
import { FolderOpen, FileText } from 'lucide-react';
import { Tab, DICOMStudy, ViewportState } from '../../utils/types';
import { StudyList } from './StudyList';
import { ReportingPanel } from './ReportingPanel';

interface SidebarProps {
  isOpen: boolean;
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
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
  reportText: string;
  onReportTextChange: (text: string) => void;
  onSaveReport: (e?: React.FormEvent) => void;
  onCopyReport: () => void;
  reportSavedStatus: boolean;
  isReportCopied: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  activeTab,
  onTabChange,
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
  reportText,
  onReportTextChange,
  onSaveReport,
  onCopyReport,
  reportSavedStatus,
  isReportCopied,
}) => {
  return (
    <div
      className={`flex flex-col bg-neutral-900 flex-shrink-0 z-20 shadow-2xl border-neutral-800 transition-all duration-300 ease-in-out relative ${
        isOpen ? 'w-80 border-l' : 'w-0 border-l-0 overflow-hidden opacity-0 pointer-events-none'
      }`}
    >
      <div className="w-80 flex flex-col h-full absolute top-0 right-0">
        {/* Navigation Tabs */}
        <div className="flex h-14 border-b border-neutral-800 shrink-0">
          <button
            onClick={() => onTabChange('files')}
            className={`flex-1 flex items-center justify-center gap-2 text-sm font-medium transition-colors ${
              activeTab === 'files'
                ? 'bg-neutral-800/80 text-white border-b-2 border-[#3584F5]'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40'
            }`}
          >
            <FolderOpen className="w-4 h-4" />
            Files
          </button>
          <button
            onClick={() => onTabChange('reporting')}
            className={`flex-1 flex items-center justify-center gap-2 text-sm font-medium transition-colors ${
              activeTab === 'reporting'
                ? 'bg-neutral-800/80 text-white border-b-2 border-[#3584F5]'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40'
            }`}
          >
            <FileText className="w-4 h-4" />
            Reporting
          </button>
        </div>

        {/* Tab Content Panel */}
        <div className="flex-1 flex flex-col overflow-y-auto">
          {activeTab === 'reporting' ? (
            <ReportingPanel
              studies={studies}
              reportText={reportText}
              onReportTextChange={onReportTextChange}
              onSaveReport={onSaveReport}
              onCopyReport={onCopyReport}
              reportSavedStatus={reportSavedStatus}
              isReportCopied={isReportCopied}
            />
          ) : (
            <StudyList
              studies={studies}
              viewports={viewports}
              isDragging={isDragging}
              fileInputRef={fileInputRef}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onFileInput={onFileInput}
              onSelectSeries={onSelectSeries}
              onRemoveSeries={onRemoveSeries}
              onClearAll={onClearAll}
            />
          )}
        </div>
      </div>
    </div>
  );
};
