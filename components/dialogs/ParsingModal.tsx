import React from 'react';
import { Loader2 } from 'lucide-react';

export const ParsingModal = ({
  isParsing,
  parseProgress,
}: {
  isParsing: boolean;
  parseProgress: { processed: number; total: number } | null;
}) => {
  if (!isParsing) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-neutral-950/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4 bg-neutral-900 border border-neutral-800 p-6 rounded-2xl shadow-2xl min-w-[280px]">
        <Loader2 className="w-10 h-10 text-[#3584F5] animate-spin" />
        <div className="text-center">
          <div className="text-base font-semibold text-neutral-200">Parsing DICOM files...</div>
          {parseProgress && parseProgress.total > 0 && (
            <div className="mt-2.5 flex flex-col items-center gap-1.5">
              <div className="text-xs text-neutral-400 font-mono">
                {parseProgress.processed} / {parseProgress.total} (
                {Math.round((parseProgress.processed / parseProgress.total) * 100)}%)
              </div>
              <div className="w-48 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#3584F5] transition-all duration-150 rounded-full"
                  style={{
                    width: `${Math.max(4, Math.round((parseProgress.processed / parseProgress.total) * 100))}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
