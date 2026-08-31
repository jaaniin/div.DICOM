import React, { useRef, useEffect } from 'react';
import { DICOMInstance } from '../../utils/types';
import { initCornerstone } from '../../utils/cornerstoneInit';

interface SeriesThumbnailProps {
  instance?: DICOMInstance;
}

export const SeriesThumbnail: React.FC<SeriesThumbnailProps> = ({ instance }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isActive = true;
    const element = containerRef.current;
    if (!element || !instance?.imageId) return;

    initCornerstone().then(({ cornerstone }) => {
      if (!cornerstone || !isActive) return;

      try {
        cornerstone.getEnabledElement(element);
      } catch (e) {
        try {
          cornerstone.enable(element);
        } catch (err) {
          return;
        }
      }

      cornerstone
        .loadImage(instance.imageId)
        .then((image: any) => {
          if (!isActive) return;
          cornerstone.displayImage(element, image);
          cornerstone.resize(element);
        })
        .catch((err: any) => {
          console.warn('Thumbnail load error:', err);
        });
    });

    return () => {
      isActive = false;
      if (element) {
        import('cornerstone-core').then((cs) => {
          const cornerstone = cs.default || cs;
          try {
            cornerstone.disable(element);
          } catch (e) {}
        });
      }
    };
  }, [instance?.imageId]);

  return (
    <div
      ref={containerRef}
      className="w-12 h-12 bg-black rounded overflow-hidden shrink-0 pointer-events-none border border-neutral-800"
    />
  );
};
