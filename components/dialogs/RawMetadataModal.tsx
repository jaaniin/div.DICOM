import React, { useState } from 'react';
import { Info, Copy, Check, X } from 'lucide-react';

interface RawMetadataModalProps {
  isOpen: boolean;
  onClose: () => void;
  rawTags?: Array<{ tag: string; name: string; value: string }>;
}

export const RawMetadataModal: React.FC<RawMetadataModalProps> = ({
  isOpen,
  onClose,
  rawTags,
}) => {
  const [isCopied, setIsCopied] = useState(false);

  if (!isOpen || !rawTags) return null;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const text = rawTags.map((rt) => `${rt.name} ${rt.tag}: ${rt.value}`).join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  return (
    <div
      className="absolute inset-2 z-50 bg-neutral-900/95 border border-neutral-700/80 rounded-lg shadow-2xl flex flex-col backdrop-blur-md overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      onWheel={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between p-3 border-b border-neutral-800 bg-neutral-900 shrink-0">
        <h3 className="text-sm font-semibold text-neutral-200 flex items-center gap-2">
          <Info className="w-4 h-4 text-emerald-400" />
          Raw DICOM Metadata
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="p-1 hover:bg-neutral-800 rounded-md text-neutral-400 hover:text-white transition-colors flex items-center justify-center w-7 h-7"
            title="Copy to clipboard"
          >
            {isCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="p-1 hover:bg-neutral-800 rounded-md text-neutral-400 hover:text-white transition-colors flex items-center justify-center w-7 h-7"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-0">
        <table className="w-full text-xs text-left border-collapse">
          <thead className="bg-neutral-800 text-neutral-400 sticky top-0 border-b border-neutral-700">
            <tr>
              <th className="p-2 font-medium border-r border-neutral-700/50">Tag Name (Position)</th>
              <th className="p-2 font-medium">Value</th>
            </tr>
          </thead>
          <tbody>
            {rawTags.map((rt, i) => (
              <tr key={i} className="border-b border-neutral-800/50 hover:bg-neutral-800/30">
                <td className="p-2 font-mono text-neutral-400 border-r border-neutral-700/50 align-top">
                  <span className="text-neutral-300 font-sans mr-2">{rt.name}</span>
                  <span className="text-neutral-500 text-[10px]">{rt.tag}</span>
                </td>
                <td className="p-2 font-mono text-neutral-300 break-words">{rt.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
