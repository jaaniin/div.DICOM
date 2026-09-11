import { isSystemOrMetadataFile } from './dicomFiles';

export interface UploadProgressCallback {
  (processed: number, total: number): void;
}

export interface UploadResult {
  success: boolean;
  indexedCount: number;
  totalReceived: number;
  error?: string;
}

/**
 * Uploads DICOM files in batches to the backend so they are saved to data/inbox/
 * and indexed into SQLite (dicom_inbox.db).
 */
export async function uploadDicomFilesToBrowser(
  files: File[],
  onProgress?: UploadProgressCallback
): Promise<UploadResult> {
  const validFiles = files.filter((f) => f && !isSystemOrMetadataFile(f) && (f.size === undefined || f.size >= 132));
  if (validFiles.length === 0) {
    return { success: true, indexedCount: 0, totalReceived: 0 };
  }

  const BATCH_SIZE = 20; // 20 files per multipart request
  let totalIndexed = 0;

  for (let i = 0; i < validFiles.length; i += BATCH_SIZE) {
    const batch = validFiles.slice(i, i + BATCH_SIZE);
    const formData = new FormData();
    for (const file of batch) {
      formData.append('files', file, file.name);
    }

    try {
      const res = await fetch('/api/browser/upload', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        totalIndexed += data.indexedCount || 0;
      }
    } catch (err) {
      console.warn('Batch upload error:', err);
    }

    if (onProgress) {
      onProgress(Math.min(i + BATCH_SIZE, validFiles.length), validFiles.length);
    }
  }

  return {
    success: true,
    indexedCount: totalIndexed,
    totalReceived: validFiles.length,
  };
}
