import React from 'react';
import { AlertCircle, ChevronRight } from 'lucide-react';

interface PatientMismatchDialogProps {
  isOpen: boolean;
  onReplace: () => void;
  onAppend: () => void;
  onCancel: () => void;
}

export const PatientMismatchDialog: React.FC<PatientMismatchDialogProps> = ({
  isOpen,
  onReplace,
  onAppend,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden">
        <div className="p-5 border-b border-neutral-800 flex items-center gap-3 bg-neutral-900">
          <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
            <AlertCircle className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Patient ID Mismatch</h2>
            <p className="text-sm text-neutral-400">
              The new images have a different Patient ID than the currently loaded images.
            </p>
          </div>
        </div>
        <div className="p-5 flex flex-col gap-3">
          <button
            onClick={onReplace}
            className="w-full px-4 py-3 bg-[#3584F5] hover:bg-[#2870db] text-white font-medium rounded-lg shadow transition-colors flex items-center justify-between"
          >
            <span>Replace Images</span>
            <ChevronRight className="w-4 h-4 text-blue-200" />
          </button>
          <button
            onClick={onAppend}
            className="w-full px-4 py-3 bg-neutral-800 hover:bg-neutral-700 text-white font-medium rounded-lg transition-colors flex items-center justify-between"
          >
            <span>Append Anyway</span>
            <ChevronRight className="w-4 h-4 text-neutral-500" />
          </button>
          <button
            onClick={onCancel}
            className="w-full px-4 py-3 bg-transparent hover:bg-neutral-800 border border-neutral-700 text-neutral-300 font-medium rounded-lg transition-colors flex items-center justify-center mt-2"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
