import React, { useRef, useEffect, useState } from 'react';
import { initCornerstone } from '@/utils/cornerstoneInit';
import { ImageIcon } from 'lucide-react';

interface BrowserSeriesThumbnailProps {
  filePath?: string;
  sopUid?: string;
  size?: number;
  className?: string;
}

const imageIdCache = new Map<string, string>();
const pendingFetchMap = new Map<string, Promise<string | null>>();

async function getOrFetchImageId(
  filePath?: string,
  sopUid?: string
): Promise<string | null> {
  const cacheKey = filePath || sopUid || '';
  if (!cacheKey) return null;

  if (imageIdCache.has(cacheKey)) {
    return imageIdCache.get(cacheKey)!;
  }

  if (pendingFetchMap.has(cacheKey)) {
    return pendingFetchMap.get(cacheKey)!;
  }

  const fetchPromise = (async () => {
    try {
      const { cornerstoneWADOImageLoader } = await initCornerstone();
      if (!cornerstoneWADOImageLoader) return null;

      const queryParam = filePath
        ? `path=${encodeURIComponent(filePath)}`
        : `sopUid=${encodeURIComponent(sopUid!)}`;

      const res = await fetch(`/api/browser/file?${queryParam}`);
      if (!res.ok) return null;

      const blob = await res.blob();
      const fileName = filePath ? filePath.split('/').pop() || 'slice.dcm' : `${sopUid}.dcm`;
      const file = new File([blob], fileName, { type: 'application/dicom' });

      const imageId = cornerstoneWADOImageLoader.wadouri.fileManager.add(file);
      imageIdCache.set(cacheKey, imageId);
      return imageId;
    } catch (err) {
      console.warn('Failed to load DICOM thumbnail file:', err);
      return null;
    } finally {
      pendingFetchMap.delete(cacheKey);
    }
  })();

  pendingFetchMap.set(cacheKey, fetchPromise);
  return fetchPromise;
}

export const BrowserSeriesThumbnail: React.FC<BrowserSeriesThumbnailProps> = ({
  filePath,
  sopUid,
  size,
  className = 'w-full h-full',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let isActive = true;
    let csInstance: any = null;
    const element = containerRef.current;
    if (!element || (!filePath && !sopUid)) return;

    setLoading(true);
    setError(false);

    async function loadThumbnail() {
      try {
        const { cornerstone } = await initCornerstone();
        csInstance = cornerstone;
        if (!cornerstone || !isActive || !element) return;

        const imageId = await getOrFetchImageId(filePath, sopUid);
        if (!isActive || !element) return;

        if (!imageId) {
          setError(true);
          setLoading(false);
          return;
        }

        try {
          cornerstone.getEnabledElement(element);
        } catch {
          try {
            cornerstone.enable(element);
          } catch {
            if (isActive) {
              setError(true);
              setLoading(false);
            }
            return;
          }
        }

        try {
          const image = await cornerstone.loadImage(imageId);
          if (!isActive || !element) return;

          const defaultVp = cornerstone.getDefaultViewportForImage(element, image);
          cornerstone.displayImage(element, image, defaultVp);
          cornerstone.fitToWindow(element);
          cornerstone.resize(element, true);

          setLoading(false);
        } catch (loadErr) {
          if (isActive) {
            console.warn('Cornerstone display thumbnail error:', loadErr);
            setError(true);
            setLoading(false);
          }
        }
      } catch (err) {
        if (isActive) {
          console.warn('Browser thumbnail error:', err);
          setError(true);
          setLoading(false);
        }
      }
    }

    const timer = setTimeout(loadThumbnail, 20);

    return () => {
      isActive = false;
      clearTimeout(timer);
      if (element && csInstance) {
        try {
          csInstance.disable(element);
        } catch {}
      }
    };
  }, [filePath, sopUid]);

  return (
    <div
      style={size ? { width: size, height: size } : undefined}
      className={`relative bg-black overflow-hidden select-none ${className}`}
    >
      {/* Cornerstone target element - always block and full size so dimensions exist */}
      <div
        ref={containerRef}
        className="w-full h-full block pointer-events-none"
      />

      {/* Loading Spinner Overlay */}
      {loading && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-neutral-950/70 z-10">
          <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Error Fallback Overlay */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-neutral-900 text-neutral-600 z-10">
          <ImageIcon className="w-5 h-5" />
        </div>
      )}
    </div>
  );
};
