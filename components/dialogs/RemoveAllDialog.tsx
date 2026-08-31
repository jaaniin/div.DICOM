import React from 'react';
import { Trash2 } from 'lucide-react';

interface RemoveAllDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const RemoveAllDialog: React.FC<RemoveAllDialogProps> = ({
  isOpen,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl w-full max-w-sm flex flex-col overflow-hidden">
        <div className="p-5 border-b border-neutral-800 flex items-center gap-3 bg-neutral-900">
          <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
            <Trash2 className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Remove All Studies</h2>
          </div>
        </div>
        <div className="p-5 flex flex-col gap-3">
          <p className="text-sm text-neutral-300 mb-2 leading-relaxed">
            Are you sure you want to remove all loaded studies? This action will clear the viewer and cannot be undone.
          </p>
          <button
            onClick={onConfirm}
            className="w-full px-4 py-3 bg-red-600 hover:bg-red-500 text-white font-medium rounded-lg shadow transition-colors flex items-center justify-center"
          >
            Clear All
          </button>
          <button
            onClick={onCancel}
            className="w-full px-4 py-3 bg-transparent hover:bg-neutral-800 border border-neutral-700 text-neutral-300 font-medium rounded-lg transition-colors flex items-center justify-center mt-1"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
