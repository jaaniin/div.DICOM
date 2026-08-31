import React from 'react';
import { AlertCircle } from 'lucide-react';

interface DisclaimerModalProps {
  isOpen: boolean;
  isChecked: boolean;
  onCheckedChange: (checked: boolean) => void;
  onAccept: () => void;
}

export const DisclaimerModal: React.FC<DisclaimerModalProps> = ({
  isOpen,
  isChecked,
  onCheckedChange,
  onAccept,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="max-w-md w-full bg-neutral-900 border border-neutral-700/80 rounded-xl shadow-2xl p-6 flex flex-col gap-5">
        <div className="flex items-center gap-3 text-amber-500">
          <AlertCircle className="w-8 h-8 shrink-0" />
          <h2 className="text-lg font-bold text-neutral-100">Medical Disclaimer</h2>
        </div>

        <div className="text-sm text-neutral-300 space-y-3 leading-relaxed">
          <p className="font-semibold text-amber-400">
            NOT FOR DIAGNOSTIC USE
          </p>
          <p>
            div.DICOM is an experimental web-based DICOM viewer provided exclusively for review, educational, and research purposes.
          </p>
          <p>
            It is not a certified medical device and has not received FDA 510(k), CE mark, or any regulatory clearance for primary diagnostic evaluation.
          </p>
        </div>

        <div className="pt-2 border-t border-neutral-800 flex flex-col gap-4">
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isChecked}
              onChange={(e) => onCheckedChange(e.target.checked)}
              className="mt-1 rounded border-neutral-700 bg-neutral-800 text-blue-600 focus:ring-blue-500 focus:ring-offset-neutral-900 cursor-pointer w-4 h-4"
            />
            <span className="text-xs text-neutral-300 leading-snug">
              I acknowledge that this software is not intended for primary clinical diagnosis.
            </span>
          </label>

          <button
            onClick={onAccept}
            disabled={!isChecked}
            className="w-full py-2.5 px-4 bg-amber-600 hover:bg-amber-500 disabled:bg-neutral-800 disabled:text-neutral-600 disabled:cursor-not-allowed text-white font-medium rounded-lg shadow-lg transition-colors flex items-center justify-center"
          >
            I Understand and Accept
          </button>
        </div>
      </div>
    </div>
  );
};
