import React from 'react';
import { OrientationMarkers as OrientationMarkersType } from '../../utils/dicomGeometry';

interface OrientationMarkersProps {
  markers: OrientationMarkersType;
}

export const OrientationMarkers: React.FC<OrientationMarkersProps> = ({ markers }) => {
  if (!markers.top && !markers.bottom && !markers.left && !markers.right) {
    return null;
  }

  return (
    <>
      {markers.top && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 text-xs font-bold text-neutral-300 hud-shadow pointer-events-none select-none tracking-widest bg-neutral-900/40 px-1.5 py-0.5 rounded border border-neutral-700/30">
          {markers.top}
        </div>
      )}
      {markers.bottom && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 text-xs font-bold text-neutral-300 hud-shadow pointer-events-none select-none tracking-widest bg-neutral-900/40 px-1.5 py-0.5 rounded border border-neutral-700/30">
          {markers.bottom}
        </div>
      )}
      {markers.left && (
        <div className="absolute left-2 top-1/2 -translate-y-1/2 z-20 text-xs font-bold text-neutral-300 hud-shadow pointer-events-none select-none tracking-widest bg-neutral-900/40 px-1.5 py-0.5 rounded border border-neutral-700/30">
          {markers.left}
        </div>
      )}
      {markers.right && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 z-20 text-xs font-bold text-neutral-300 hud-shadow pointer-events-none select-none tracking-widest bg-neutral-900/40 px-1.5 py-0.5 rounded border border-neutral-700/30">
          {markers.right}
        </div>
      )}
    </>
  );
};
