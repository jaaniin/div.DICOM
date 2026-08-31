import React from 'react';
import { Info } from 'lucide-react';
import { DICOMInstance } from '../../utils/types';
import { formatDicomDate, formatDicomTime, formatNumber } from '../../utils/formatters';

interface ViewportInfoButtonProps {
  instance?: DICOMInstance;
  onClick: () => void;
}

export const ViewportInfoButton: React.FC<ViewportInfoButtonProps> = ({ instance, onClick }) => {
  if (!instance?.metadata) return null;

  const meta = instance.metadata;

  return (
    <div className="relative group/info flex flex-col items-end">
      {/* Floating Hover Card (Appears after 0.5s hover exclusively on the (i) button) */}
      <div
        className="absolute bottom-full right-0 mb-2 w-[340px] max-w-[90vw] z-50 bg-neutral-900/95 border border-neutral-700/80 rounded-xl shadow-2xl flex flex-col backdrop-blur-md overflow-hidden opacity-0 invisible group-hover/info:opacity-100 group-hover/info:visible transition-all duration-200 delay-0 group-hover/info:delay-500 origin-bottom-right pointer-events-none group-hover/info:pointer-events-auto"
        onWheel={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-2.5 border-b border-neutral-800 bg-neutral-950/80">
          <h3 className="text-[11px] uppercase tracking-wider font-semibold text-neutral-300 flex items-center gap-2">
            <Info className="w-3.5 h-3.5 text-emerald-400" />
            DICOM Metadata Summary
          </h3>
          <span className="text-[10px] text-neutral-500">Click icon for raw tags</span>
        </div>

        <div className="p-3 text-[11px] font-mono text-neutral-300 select-text whitespace-pre-wrap leading-relaxed max-h-[60vh] overflow-y-auto cursor-text">
{`Institution: ${meta.institutionName || 'Unknown'}
Series: ${meta.seriesDescription || 'Unknown'}
Acquisition Date: ${formatDicomDate(meta.acquisitionDate || meta.studyDate)} ${formatDicomTime(meta.acquisitionTime)}
Manufacturer: ${meta.manufacturer || 'Unknown'}
Model: ${meta.model || 'Unknown'}
Field Strength: ${meta.fieldStrength ? formatNumber(meta.fieldStrength, 2) + ' T' : 'Unknown'}

Slice Thickness: ${meta.sliceThickness ? formatNumber(meta.sliceThickness) + ' mm' : 'Unknown'}
Spacing Between Slices: ${meta.spacingBetweenSlices ? formatNumber(meta.spacingBetweenSlices) + ' mm' : 'Unknown'}
Pixel Spacing: ${meta.pixelSpacing ? meta.pixelSpacing.map((p) => formatNumber(p)).join(' x ') + ' mm' : 'Unknown'}
Acquisition Matrix: ${meta.rows && meta.columns ? meta.rows + ' x ' + meta.columns : 'Unknown'}

Scanning Sequence: ${meta.scanningSequence || 'Unknown'}
TR: ${meta.tr ? formatNumber(meta.tr, 0) + ' ms' : 'Unknown'} / TE: ${meta.te ? formatNumber(meta.te, 0) + ' ms' : 'Unknown'}${meta.ti ? '\nTI: ' + formatNumber(meta.ti, 0) + ' ms' : ''}
Flip Angle: ${meta.flipAngle ? meta.flipAngle + '°' : 'Unknown'}
Echo Train Length (ETL): ${meta.echoTrainLength || 'Unknown'}
Number of Echos: ${meta.echoNumbers || 'Unknown'}`}
        </div>
      </div>

      {/* Trigger Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        className="p-1.5 bg-neutral-900/75 hover:bg-neutral-900/95 text-emerald-400 hover:text-emerald-300 rounded-lg backdrop-blur-md transition-colors border border-neutral-700/50 hover:border-neutral-600 shadow-lg flex items-center justify-center"
        title="Hover for summary, click for full raw metadata tags"
      >
        <Info className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
