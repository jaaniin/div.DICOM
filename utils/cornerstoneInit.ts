/**
 * Centralized Cornerstone & WADO Image Loader Initializer
 * Ensures cornerstoneWADOImageLoader is wired to cornerstone and dicomParser
 * and registers image loaders (dicomfile: & wadouri:) before any loadImage calls.
 */

let isInitialized = false;

export const initCornerstone = async () => {
  if (typeof window === 'undefined') {
    return { cornerstone: null, cornerstoneWADOImageLoader: null };
  }

  const [csCore, csLoader, dicomParser] = await Promise.all([
    import('cornerstone-core'),
    import('cornerstone-wado-image-loader'),
    import('dicom-parser'),
  ]);

  const cornerstone = csCore.default || csCore;
  const cornerstoneWADOImageLoader = csLoader.default || csLoader;
  const parser = dicomParser.default || dicomParser;

  if (!isInitialized) {
    try {
      cornerstoneWADOImageLoader.external.cornerstone = cornerstone;
      cornerstoneWADOImageLoader.external.dicomParser = parser;
    } catch (e) {
      console.warn('Cornerstone external wiring notice:', e);
    }

    try {
      if (cornerstoneWADOImageLoader.wadouri?.loadImage) {
        cornerstone.registerImageLoader('dicomfile', cornerstoneWADOImageLoader.wadouri.loadImage);
        cornerstone.registerImageLoader('wadouri', cornerstoneWADOImageLoader.wadouri.loadImage);
      }
    } catch (e) {
      // Ignored if already registered
    }

    isInitialized = true;
  }

  return { cornerstone, cornerstoneWADOImageLoader };
};
