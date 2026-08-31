import React from 'react';
import { Save, Copy, Check } from 'lucide-react';
import { DICOMStudy } from '../../utils/types';
import { formatDicomDate } from '../../utils/formatters';

interface ReportingPanelProps {
  studies: DICOMStudy[];
  reportText: string;
  onReportTextChange: (text: string) => void;
  onSaveReport: (e?: React.FormEvent) => void;
  onCopyReport: () => void;
  reportSavedStatus: boolean;
  isReportCopied: boolean;
}

export const ReportingPanel: React.FC<ReportingPanelProps> = ({
  studies,
  reportText,
  onReportTextChange,
  onSaveReport,
  onCopyReport,
  reportSavedStatus,
  isReportCopied,
}) => {
  return (
    <form onSubmit={onSaveReport} className="flex-1 flex flex-col p-4 h-full">
      {/* Study Summary Header */}
      {studies.length > 0 && (
        <div className="mb-3 p-2.5 bg-neutral-950/80 rounded-md border border-neutral-800 text-xs flex flex-col gap-1 shrink-0">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="font-medium text-neutral-300">Study Metadata</span>
            <span className="text-[10px] text-emerald-400 bg-emerald-950/50 px-1.5 py-0.5 rounded border border-emerald-800/40">
              Auto-included
            </span>
          </div>
          <div className="text-neutral-300 font-medium truncate">
            {studies[0].patientName} • {studies[0].patientId}
          </div>
          <div className="text-[11px] text-neutral-500">
            {formatDicomDate(studies[0].studyDate)}{' '}
            {studies[0].studyDescription ? `• ${studies[0].studyDescription}` : ''}
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col mb-4 min-h-[160px]">
        <div className="flex items-center justify-between mb-2 shrink-0">
          <label htmlFor="findings" className="text-sm font-medium text-neutral-300">
            Findings
          </label>
        </div>
        <textarea
          id="findings"
          value={reportText}
          onChange={(e) => onReportTextChange(e.target.value)}
          placeholder="Enter structured clinical findings, measurements, and conclusions..."
          className="w-full flex-1 p-3 bg-neutral-950/80 border border-neutral-800 rounded-md text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-[#3584F5] focus:ring-1 focus:ring-[#3584F5] resize-none leading-relaxed font-sans"
        />
      </div>

      <div className="flex flex-col gap-2 shrink-0">
        <button
          type="submit"
          disabled={studies.length === 0}
          className="w-full py-2.5 px-4 bg-[#3584F5] hover:bg-[#2870db] disabled:bg-neutral-800 disabled:text-neutral-600 text-white font-medium rounded-lg shadow-lg transition-all flex items-center justify-center gap-2 text-sm"
        >
          {reportSavedStatus ? (
            <>
              <Check className="w-4 h-4 text-emerald-400" />
              Report Downloaded!
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Export & Download (.txt)
            </>
          )}
        </button>

        <button
          type="button"
          onClick={onCopyReport}
          disabled={studies.length === 0}
          className="w-full py-2 px-4 bg-neutral-800/80 hover:bg-neutral-700 disabled:bg-neutral-900 disabled:text-neutral-700 text-neutral-300 font-medium rounded-lg border border-neutral-700/60 transition-colors flex items-center justify-center gap-2 text-xs"
        >
          {isReportCopied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              Full Report Copied to Clipboard
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 text-neutral-400" />
              Copy Full Report Text
            </>
          )}
        </button>
      </div>
    </form>
  );
};
