/**
 * Web Worker Pool for High-Throughput DICOM Parsing
 * 
 * Throttles worker creation to hardware concurrency limits (e.g. 2-8 threads),
 * avoiding memory exhaustion and main thread stutter on large series (500+ files).
 */

export interface DicomParseResult {
  success: boolean;
  isImage?: boolean;
  isNonDicom?: boolean;
  fileId?: string;
  fileName: string;
  metadata?: any;
  buffer?: ArrayBuffer;
  error?: string;
  file?: File;
  imageId?: string;
}

interface WorkerTask {
  file: File;
  resolve: (result: DicomParseResult) => void;
  reject: (err: any) => void;
}

export class DicomWorkerPool {
  private workers: Worker[] = [];
  private idleWorkers: Worker[] = [];
  private workerBusyMap: Map<Worker, boolean> = new Map();
  private poolSize: number;
  private isInitialized = false;

  constructor(poolSize?: number) {
    if (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) {
      // Use concurrency minus 1 for UI responsiveness, bounded between 2 and 8
      this.poolSize = poolSize || Math.max(2, Math.min(navigator.hardwareConcurrency - 1, 8));
    } else {
      this.poolSize = poolSize || 4;
    }
  }

  private initWorkers() {
    if (this.isInitialized || typeof window === 'undefined') return;

    for (let i = 0; i < this.poolSize; i++) {
      try {
        const worker = new Worker(new URL('../app/workers/dicom.worker.ts', import.meta.url));
        this.workers.push(worker);
        this.idleWorkers.push(worker);
        this.workerBusyMap.set(worker, false);
      } catch (err) {
        console.error(`Failed to spawn DICOM worker #${i}:`, err);
      }
    }
    this.isInitialized = true;
  }

  /**
   * Processes an array of files through the worker pool with concurrency throttling and progress reporting.
   */
  public async processFiles(
    files: File[],
    onProgress?: (processed: number, total: number) => void
  ): Promise<DicomParseResult[]> {
    this.initWorkers();

    if (files.length === 0) return [];
    if (this.workers.length === 0) {
      throw new Error('No DICOM workers available');
    }

    const total = files.length;
    let completed = 0;

    const queue: WorkerTask[] = [];
    const results: DicomParseResult[] = new Array(total);

    return new Promise<DicomParseResult[]>((resolveAll) => {
      let isCompleted = false;

      const checkCompletion = () => {
        if (completed === total && !isCompleted) {
          isCompleted = true;
          resolveAll(results);
        }
      };

      const pumpQueue = () => {
        while (this.idleWorkers.length > 0 && queue.length > 0) {
          const worker = this.idleWorkers.pop()!;
          const task = queue.shift()!;
          const fileIndex = files.indexOf(task.file);

          this.workerBusyMap.set(worker, true);

          task.file.arrayBuffer().then((buffer) => {
            const handleMessage = (e: MessageEvent) => {
              worker.removeEventListener('message', handleMessage);
              worker.removeEventListener('error', handleError);

              this.workerBusyMap.set(worker, false);
              this.idleWorkers.push(worker);

              completed++;
              if (onProgress) {
                onProgress(completed, total);
              }

              task.resolve({ ...e.data, file: task.file });
              pumpQueue();
              checkCompletion();
            };

            const handleError = (err: ErrorEvent) => {
              worker.removeEventListener('message', handleMessage);
              worker.removeEventListener('error', handleError);

              this.workerBusyMap.set(worker, false);
              this.idleWorkers.push(worker);

              completed++;
              if (onProgress) {
                onProgress(completed, total);
              }

              task.resolve({
                success: false,
                fileName: task.file.name,
                error: err.message || 'Worker thread error',
                file: task.file
              });
              pumpQueue();
              checkCompletion();
            };

            worker.addEventListener('message', handleMessage);
            worker.addEventListener('error', handleError);

            // Zero-copy transfer of array buffer
            worker.postMessage({ buffer, fileName: task.file.name }, [buffer]);
          }).catch((err) => {
            this.workerBusyMap.set(worker, false);
            this.idleWorkers.push(worker);

            completed++;
            if (onProgress) {
              onProgress(completed, total);
            }

            task.resolve({
              success: false,
              fileName: task.file.name,
              error: err?.message || 'Failed to read file buffer',
              file: task.file
            });
            pumpQueue();
            checkCompletion();
          });
        }
      };

      // Populate tasks
      files.forEach((file, idx) => {
        queue.push({
          file,
          resolve: (result) => {
            results[idx] = result;
          },
          reject: () => {
            // Handled via resolve with success: false
          }
        });
      });

      pumpQueue();
    });
  }

  /**
   * Terminates all pool workers
   */
  public terminate() {
    this.workers.forEach((w) => {
      try {
        w.terminate();
      } catch (err) {}
    });
    this.workers = [];
    this.idleWorkers = [];
    this.workerBusyMap.clear();
    this.isInitialized = false;
  }
}

// Global singleton worker pool instance
let globalPool: DicomWorkerPool | null = null;

export const getDicomWorkerPool = (): DicomWorkerPool => {
  if (!globalPool) {
    globalPool = new DicomWorkerPool();
  }
  return globalPool;
};
