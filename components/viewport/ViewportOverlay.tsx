import React from 'react';
import { DICOMStudy, ViewportState } from '../../utils/types';
import { formatDicomDate } from '../../utils/formatters';
import { getFormattedSliceLocation } from '../../utils/dicomGeometry';

interface ViewportOverlayProps {
  index: number;
  vpState?: ViewportState;
  study?: DICOMStudy;
}

export const ViewportOverlay: React.FC<ViewportOverlayProps> = ({
  index,
  vpState,
  study,
}) => {
  const series = study?.series.find((s) => s.seriesInstanceUID === vpState?.seriesInstanceUID);
  const seriesIndex = (study?.series.findIndex((s) => s.seriesInstanceUID === vpState?.seriesInstanceUID) ?? -1) + 1;
  const currentInstance = series?.instances[vpState?.imageIndex ?? 0];
  const sliceLocationText = getFormattedSliceLocation(currentInstance?.metadata);

  return (
    <>
      {/* Top Left: Patient Info */}
      <div className="absolute top-2 left-2 text-xs font-mono text-emerald-400 z-10 pointer-events-none hud-shadow leading-tight">
        {vpState?.studyInstanceUID ? (
          <>
            <div className="font-semibold text-emerald-300">{study?.patientName || 'Unknown Patient'}</div>
            <div className="text-emerald-400/80 text-[11px]">ID: {study?.patientId || '-'}</div>
          </>
        ) : (
          <>
            <div className="text-neutral-500">No Patient Loaded</div>
            <div className="text-neutral-600 text-[11px]">ID: -</div>
          </>
        )}
      </div>

      {/* Top Right: Study & Series Details */}
      <div className="absolute top-2 right-2 text-xs font-mono text-emerald-400 text-right z-10 pointer-events-none hud-shadow leading-tight">
        {vpState?.seriesInstanceUID ? (
          <>
            <div>{study?.studyDate ? formatDicomDate(study.studyDate) : '-'}</div>
            <div className="font-semibold text-emerald-300 truncate max-w-[200px]">
              {series?.seriesDescription || '-'}
            </div>
          </>
        ) : (
          <>
            <div className="text-neutral-500">Study Date: -</div>
            <div className="text-neutral-600">Series: -</div>
          </>
        )}
      </div>

      {/* Bottom Left: Series / Instance counts & Dynamic WL/WW */}
      <div className="absolute bottom-2 left-2 text-xs font-mono text-emerald-400 z-10 pointer-events-none hud-shadow leading-tight">
        {vpState?.seriesInstanceUID ? (
          <>
            <div>
              sr: {seriesIndex}/{study?.series.length || 1}
            </div>
            <div>
              img: {(vpState?.imageIndex ?? 0) + 1}/{series?.instances.length || 1}
            </div>
            {sliceLocationText && (
              <div>{sliceLocationText}</div>
            )}
          </>
        ) : (
          <>
            <div className="text-neutral-500">sr: -/-</div>
            <div className="text-neutral-500">img: -/-</div>
          </>
        )}
        <div id={`overlay-wl-zoom-${index}`} className="text-[11px] text-emerald-400/90 mt-0.5">
          WL: 500 WW: 1000
        </div>
      </div>
    </>
  );
};
