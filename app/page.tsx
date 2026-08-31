'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Tool,
  Tab,
  LayoutNode,
  DICOMInstance,
  Point,
  LengthMeasurement,
  DICOMStudy,
  ViewportState,
} from '../utils/types';
import {
  Vector3,
  dot,
  cross,
  sub,
  add,
  mul,
  getOrientationMarkers,
  calculateIntersection,
  getNormal,
  sortInstancesAnatomically,
} from '../utils/dicomGeometry';
import { formatDicomDate, formatDicomTime, formatNumber } from '../utils/formatters';
import { generateReportText, generateReportFilename, downloadReportFile } from '../utils/reportGenerator';
import { getDicomWorkerPool } from '../utils/workerPool';
import { initCornerstone } from '../utils/cornerstoneInit';
import { isSystemOrMetadataFile, traverseFileTree } from '../utils/dicomFiles';
import { getVisibleViewportIndices, splitViewportNode, closeViewportNode, determineHangingProtocol } from '../utils/layoutHelpers';
import {
  findClosestParallelSliceIndex,
  pixelToPatient3D,
  patient3DToPixel,
  findClosestSliceTo3DPoint,
} from '../utils/syncScroll';

// Modular UI Components
import { ViewerToolbar } from '../components/toolbar';
import { Sidebar } from '../components/sidebar';
import {
  LayoutRenderer,
  ViewportOverlay,
  OrientationMarkers,
  ViewportActionBar,
  ViewportInfoButton,
} from '../components/viewport';
import {
  DisclaimerModal,
  HelpModal,
  PatientMismatchDialog,
  RemoveAllDialog,
  RawMetadataModal,
  GlobalDropOverlay,
} from '../components/dialogs';

import packageJson from '../package.json';

const currentVersion = packageJson.version || '0.7.0';

export default function App() {
  // App & Ingestion State
  const [isParsing, setIsParsing] = useState(false);
  const [parseProgress, setParseProgress] = useState<{ processed: number; total: number } | null>(null);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [isDisclaimerChecked, setIsDisclaimerChecked] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [showRemoveAllDialog, setShowRemoveAllDialog] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState<{ version: string; url: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [patientMismatchDialog, setPatientMismatchDialog] = useState<{
    show: boolean;
    pendingInstances: DICOMInstance[];
  }>({ show: false, pendingInstances: [] });

  // Tool & Layout State
  const [activeTool, setActiveTool] = useState<Tool>('wwc');
  const [layoutTree, setLayoutTree] = useState<LayoutNode>({ type: 'viewport', id: 'root', viewportIndex: 0 });
  const [initialHangingProtocol, setInitialHangingProtocol] = useState<{
    layout: LayoutNode;
    viewports: ViewportState[];
  } | null>(null);
  const [isLayoutMenuOpen, setIsLayoutMenuOpen] = useState(false);
  const [activeViewportIndex, setActiveViewportIndex] = useState<number | null>(0);
  const [maximizedIndex, setMaximizedIndex] = useState<number | null>(null);
  const [activeInfoViewport, setActiveInfoViewport] = useState<number | null>(null);

  // Sidebar & Reporting State
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('files');
  const [reportText, setReportText] = useState('');
  const [reportSavedStatus, setReportSavedStatus] = useState(false);
  const [isReportCopied, setIsReportCopied] = useState(false);

  // Data & Viewport State
  const [studies, setStudies] = useState<DICOMStudy[]>([]);
  const [viewports, setViewports] = useState<ViewportState[]>(
    Array(4).fill({ studyInstanceUID: null, seriesInstanceUID: null, imageIndex: 0 })
  );
  const [dragOverViewport, setDragOverViewport] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showGlobalOverlay, setShowGlobalOverlay] = useState(false);
  const [overlayHoverZone, setOverlayHoverZone] = useState<'none' | 'left' | 'right' | 'single'>('none');

  // Measurements State
  const [measurements, setMeasurements] = useState<LengthMeasurement[]>([]);
  const [isTrashOpen, setIsTrashOpen] = useState(false);
  const [isDraggingOverTrash, setIsDraggingOverTrash] = useState(false);
  const [selectedForDeletion, setSelectedForDeletion] = useState<Set<string>>(new Set());
  const [draggingPoint, setDraggingPoint] = useState<{
    id: string;
    point: string;
    isNew: boolean;
    lastPt?: any;
  } | null>(null);

  // 3D Spatial Cursor & Probe Ref
  const renderRequestSeqRef = useRef<number[]>([0, 0, 0, 0]);
  const lastRenderedKeyRef = useRef<string[]>(['', '', '', '']);
  const wheelTimeRef = useRef<number>(0);
  const wheelStreakRef = useRef<number>(0);
  const panningViewportIndexRef = useRef<number | null>(null);
  const cursor3DRef = useRef<{
    point: Vector3;
    sourceViewportIndex: number;
    pixelVal?: number;
    canvasPos: { x: number; y: number };
  } | null>(null);

  // DOM Refs
  const viewportRefs = useRef<(HTMLDivElement | null)[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isPointerDraggingRef = useRef<boolean>(false);
  const lastActivePointerDownRef = useRef<{ x: number; y: number; buttons: number } | null>(null);

  // Canvas Measurements & Cross-Referencing Overlay Drawing
  const drawMeasurements = useCallback(
    (element: HTMLElement, viewportIdx: number) => {
      import('cornerstone-core').then((cs) => {
        const cornerstone = cs.default || cs;
        let enabledElement: any;
        try {
          enabledElement = cornerstone.getEnabledElement(element);
        } catch (e) {
          return;
        }
        if (!enabledElement || !enabledElement.image) return;

        let canvas = element.querySelector('canvas.measurement-canvas') as HTMLCanvasElement;
        if (!canvas) {
          canvas = document.createElement('canvas');
          canvas.className = 'measurement-canvas absolute inset-0 pointer-events-none z-10';
          element.appendChild(canvas);
        }

        const rect = element.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        let vp: any;
        try {
          vp = cornerstone.getViewport(element);
        } catch (err) {
          return;
        }
        if (!vp) return;

        const vpState = viewports[viewportIdx];
        const activeStudy = studies.find((s) => s.studyInstanceUID === vpState?.studyInstanceUID);
        const activeSeries = activeStudy?.series.find((s) => s.seriesInstanceUID === vpState?.seriesInstanceUID);
        const activeInstance = activeSeries?.instances[vpState?.imageIndex ?? 0];

        // 1. Draw Scout / Reference Lines:
        // The active/focused viewport is kept clean without distracting reference lines.
        // Other orthogonal viewports display the reference line of the currently active slice.
        if (activeViewportIndex !== null && viewportIdx !== activeViewportIndex) {
          const activeVp = viewports[activeViewportIndex];
          if (activeVp?.seriesInstanceUID) {
            const activeVpStudy = studies.find((s) => s.studyInstanceUID === activeVp.studyInstanceUID);
            const activeVpSeries = activeVpStudy?.series.find((s) => s.seriesInstanceUID === activeVp.seriesInstanceUID);
            const activeVpInstance = activeVpSeries?.instances[activeVp.imageIndex];

            if (activeInstance?.metadata && activeVpInstance?.metadata) {
              const inter = calculateIntersection(activeVpInstance.metadata, activeInstance.metadata);
              if (inter && inter.length === 2) {
                const p1Canvas = cornerstone.pixelToCanvas(element, inter[0] as any);
                const p2Canvas = cornerstone.pixelToCanvas(element, inter[1] as any);

                ctx.save();
                ctx.strokeStyle = '#3584F5';
                ctx.lineWidth = 1.5;
                ctx.setLineDash([4, 4]);
                ctx.beginPath();
                ctx.moveTo(p1Canvas.x, p1Canvas.y);
                ctx.lineTo(p2Canvas.x, p2Canvas.y);
                ctx.stroke();

                // Badge indicating the active source viewport
                ctx.fillStyle = '#3584F5';
                ctx.font = '10px monospace';
                ctx.fillText(`V${activeViewportIndex + 1}`, p1Canvas.x + 4, p1Canvas.y - 4);
                ctx.restore();
              }
            }
          }
        }

        // 2. Draw Distance, Angle, and ROI Measurements
        measurements.forEach((m) => {
          if (m.imageId !== activeInstance?.imageId) return;

          ctx.save();
          ctx.strokeStyle = '#fbbf24';
          ctx.fillStyle = '#fbbf24';
          ctx.lineWidth = 1.5;

          if (m.type === 'roi' && m.points && m.points.length > 0) {
            const canvasPts = m.points.map((p) => cornerstone.pixelToCanvas(element, p as any));
            ctx.beginPath();
            ctx.moveTo(canvasPts[0].x, canvasPts[0].y);
            for (let i = 1; i < canvasPts.length; i++) {
              ctx.lineTo(canvasPts[i].x, canvasPts[i].y);
            }
            if (m.isClosed) ctx.closePath();
            ctx.stroke();

            // ROI handles
            canvasPts.forEach((cp) => {
              ctx.beginPath();
              ctx.arc(cp.x, cp.y, 3, 0, 2 * Math.PI);
              ctx.fill();
            });
          } else if (m.start && m.end) {
            const p1 = cornerstone.pixelToCanvas(element, m.start as any);
            const p2 = cornerstone.pixelToCanvas(element, m.end as any);

            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(p1.x, p1.y, 3, 0, 2 * Math.PI);
            ctx.arc(p2.x, p2.y, 3, 0, 2 * Math.PI);
            ctx.fill();
          }
          ctx.restore();
        });

        // 4. Draw Center Crosshair (+) during Active Pan Tool (Signature #3584F5 Overlay)
        if (panningViewportIndexRef.current === viewportIdx) {
          const cx = Math.round(canvas.width / 2);
          const cy = Math.round(canvas.height / 2);
          const crossSize = 16;

          ctx.save();

          // High-contrast shadow outline for visibility against white/bright anatomy
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
          ctx.lineWidth = 3.5;
          ctx.beginPath();
          ctx.moveTo(cx - crossSize, cy);
          ctx.lineTo(cx + crossSize, cy);
          ctx.moveTo(cx, cy - crossSize);
          ctx.lineTo(cx, cy + crossSize);
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(cx, cy, 4, 0, 2 * Math.PI);
          ctx.stroke();

          // Foreground signature overlay blue (#3584F5)
          ctx.strokeStyle = '#3584F5';
          ctx.lineWidth = 1.75;
          ctx.beginPath();
          ctx.moveTo(cx - crossSize, cy);
          ctx.lineTo(cx + crossSize, cy);
          ctx.moveTo(cx, cy - crossSize);
          ctx.lineTo(cx, cy + crossSize);
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(cx, cy, 4, 0, 2 * Math.PI);
          ctx.stroke();

          ctx.restore();
        }

        // 3. Draw Pixel Probe / 3D Spatial Crosshair Cursor (TASK-MRI-01)
        const cursor3D = cursor3DRef.current;
        if (cursor3D && activeTool === 'pixel') {
          if (cursor3D.sourceViewportIndex === viewportIdx) {
            // Draw primary crosshair & HU badge on source viewport
            const { x, y } = cursor3D.canvasPos;
            ctx.save();
            ctx.strokeStyle = '#38bdf8'; // Cyan
            ctx.lineWidth = 1.5;

            // Crosshair lines
            ctx.beginPath();
            ctx.moveTo(x - 14, y);
            ctx.lineTo(x + 14, y);
            ctx.moveTo(x, y - 14);
            ctx.lineTo(x, y + 14);
            ctx.stroke();

            // Center circle
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, 2 * Math.PI);
            ctx.stroke();

            // Value badge pill
            if (cursor3D.pixelVal !== undefined) {
              const isCT = activeSeries?.modality === 'CT';
              const text = `${cursor3D.pixelVal}${isCT ? ' HU' : ''}`;
              ctx.font = 'bold 11px monospace';
              const textWidth = ctx.measureText(text).width;

              ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
              ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.roundRect(x + 10, y - 22, textWidth + 10, 18, 4);
              ctx.fill();
              ctx.stroke();

              ctx.fillStyle = '#38bdf8';
              ctx.fillText(text, x + 15, y - 9);
            }
            ctx.restore();
          } else if (activeInstance) {
            // Project 3D point onto target viewport
            const projected = patient3DToPixel(cursor3D.point, activeInstance);
            if (projected) {
              const canvasPt = cornerstone.pixelToCanvas(element, projected.pixel as any);
              const sliceThickness = parseFloat(activeInstance.metadata.sliceThickness || '3.0');

              if (projected.distanceToPlane <= sliceThickness * 2.0) {
                ctx.save();
                ctx.strokeStyle = '#38bdf8';
                ctx.lineWidth = 1.5;
                ctx.setLineDash([2, 2]);

                // Target crosshair
                ctx.beginPath();
                ctx.moveTo(canvasPt.x - 12, canvasPt.y);
                ctx.lineTo(canvasPt.x + 12, canvasPt.y);
                ctx.moveTo(canvasPt.x, canvasPt.y - 12);
                ctx.lineTo(canvasPt.x, canvasPt.y + 12);
                ctx.stroke();

                ctx.setLineDash([]);
                ctx.beginPath();
                ctx.arc(canvasPt.x, canvasPt.y, 6, 0, 2 * Math.PI);
                ctx.stroke();

                // Badge indicator
                ctx.fillStyle = '#38bdf8';
                ctx.font = 'bold 10px monospace';
                ctx.fillText(`V${cursor3D.sourceViewportIndex + 1}`, canvasPt.x + 8, canvasPt.y - 8);
                ctx.restore();
              }
            }
          }
        }
      });
    },
    [viewports, studies, measurements, activeTool, activeViewportIndex]
  );

  // Rendering Helper: Viewport Canvas Image & Overlays (Preserves Pan, Zoom, and WW/WC)
  const renderViewportImage = (index: number, instance: DICOMInstance, keepTransforms: boolean = true) => {
    const element = viewportRefs.current[index];
    if (!element || !instance?.imageId) return;

    const currentSeq = ++renderRequestSeqRef.current[index];

    initCornerstone().then(({ cornerstone }) => {
      if (!cornerstone) return;

      try {
        cornerstone.getEnabledElement(element);
      } catch (e) {
        try {
          cornerstone.enable(element);
        } catch (err) {
          return;
        }
      }

      let oldViewport: any = null;
      if (keepTransforms) {
        try {
          oldViewport = cornerstone.getViewport(element);
        } catch (e) {}
      }

      cornerstone
        .loadImage(instance.imageId)
        .then((image: any) => {
          // Drop stale responses from earlier rapid wheel events
          if (currentSeq !== renderRequestSeqRef.current[index]) {
            return;
          }

          cornerstone.displayImage(element, image);
          if (oldViewport && keepTransforms) {
            const currentVp = cornerstone.getViewport(element);
            if (currentVp) {
              currentVp.translation.x = oldViewport.translation.x;
              currentVp.translation.y = oldViewport.translation.y;
              currentVp.scale = oldViewport.scale;
              currentVp.voi.windowCenter = oldViewport.voi.windowCenter;
              currentVp.voi.windowWidth = oldViewport.voi.windowWidth;
              currentVp.rotation = oldViewport.rotation;
              currentVp.hflip = oldViewport.hflip;
              currentVp.vflip = oldViewport.vflip;
              cornerstone.setViewport(element, currentVp);
            }
          } else {
            cornerstone.fitToWindow(element);
          }

          // Trigger measurement & cross-reference redraw
          drawMeasurements(element, index);

          // Update WL/WW HUD Overlay text
          try {
            const vp = cornerstone.getViewport(element);
            const hudEl = document.getElementById(`overlay-wl-zoom-${index}`);
            if (hudEl && vp) {
              hudEl.innerText = `WL: ${Math.round(vp.voi.windowCenter)} WW: ${Math.round(vp.voi.windowWidth)} • Zoom: ${(vp.scale * 100).toFixed(0)}%`;
            }
          } catch (e) {}
        })
        .catch((err: any) => {
          console.warn('Failed to load viewport image:', err);
        });
    });
  };

  // Synchronized Scrolling across Parallel / Comparative Series (TASK-MRI-02)
  const syncScrollToImage = (sourceViewportIndex: number, newImageIndex: number) => {
    const vp = viewports[sourceViewportIndex];
    const study = studies.find((s) => s.studyInstanceUID === vp.studyInstanceUID);
    const series = study?.series.find((s) => s.seriesInstanceUID === vp.seriesInstanceUID);
    if (!series || !series.instances[newImageIndex]) return;

    const sourceInstance = series.instances[newImageIndex];
    const updates: { vpIdx: number; newIdx: number; instance: DICOMInstance }[] = [
      { vpIdx: sourceViewportIndex, newIdx: newImageIndex, instance: sourceInstance },
    ];

    viewports.forEach((otherVp, i) => {
      if (i === sourceViewportIndex || !otherVp.seriesInstanceUID) return;
      const otherStudy = studies.find((s) => s.studyInstanceUID === otherVp.studyInstanceUID);
      const otherSeries = otherStudy?.series.find((s) => s.seriesInstanceUID === otherVp.seriesInstanceUID);
      if (!otherSeries || otherSeries.instances.length === 0) return;

      const matchIdx = findClosestParallelSliceIndex(sourceInstance, otherSeries.instances);
      if (matchIdx !== -1 && matchIdx !== otherVp.imageIndex) {
        updates.push({ vpIdx: i, newIdx: matchIdx, instance: otherSeries.instances[matchIdx] });
      }
    });

    setViewports((prev) => {
      const next = [...prev];
      updates.forEach((u) => {
        next[u.vpIdx] = { ...next[u.vpIdx], imageIndex: u.newIdx };
      });
      return next;
    });

    updates.forEach((u) => {
      lastRenderedKeyRef.current[u.vpIdx] = `${u.instance.metadata.studyInstanceUID}_${u.instance.metadata.seriesInstanceUID}_${u.newIdx}`;
      renderViewportImage(u.vpIdx, u.instance, true);
    });
  };


  // Initialize Cornerstone & WADO Image Loader
  useEffect(() => {
    initCornerstone();
  }, []);

  // Keyboard Hotkeys Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      const key = e.key.toLowerCase();
      if (key === 'w') {
        setActiveTool((prev) => (prev === 'wwc' ? 'none' : 'wwc'));
      } else if (key === 'p') {
        setActiveTool((prev) => (prev === 'pan' ? 'none' : 'pan'));
      } else if (key === 'z') {
        setActiveTool((prev) => (prev === 'zoom' ? 'none' : 'zoom'));
      } else if (key === 'l') {
        setActiveTool((prev) => (prev === 'length' ? 'none' : 'length'));
      } else if (key === 'a') {
        setActiveTool((prev) => (prev === 'angle' ? 'none' : 'angle'));
      } else if (key === 'r') {
        setActiveTool((prev) => (prev === 'roi' ? 'none' : 'roi'));
      } else if (key === 'd') {
        setActiveTool((prev) => (prev === 'pixel' ? 'none' : 'pixel'));
      } else if (key === 'escape') {
        setActiveTool('none');
        setIsTrashOpen(false);
        setIsLayoutMenuOpen(false);
        cursor3DRef.current = null;
        viewportRefs.current.forEach((el, idx) => {
          if (el) drawMeasurements(el, idx);
        });
      } else if (key === 'arrowup' || key === 'pageup' || key === 'arrowleft') {
        e.preventDefault();
        if (activeViewportIndex !== null) {
          const vpState = viewports[activeViewportIndex];
          if (vpState?.seriesInstanceUID) {
            const study = studies.find((s) => s.studyInstanceUID === vpState.studyInstanceUID);
            const series = study?.series.find((s) => s.seriesInstanceUID === vpState.seriesInstanceUID);
            if (series && series.instances.length > 1) {
              const newIdx = Math.max(0, vpState.imageIndex - 1);
              if (newIdx !== vpState.imageIndex) {
                syncScrollToImage(activeViewportIndex, newIdx);
              }
            }
          }
        }
      } else if (key === 'arrowdown' || key === 'pagedown' || key === 'arrowright') {
        e.preventDefault();
        if (activeViewportIndex !== null) {
          const vpState = viewports[activeViewportIndex];
          if (vpState?.seriesInstanceUID) {
            const study = studies.find((s) => s.studyInstanceUID === vpState.studyInstanceUID);
            const series = study?.series.find((s) => s.seriesInstanceUID === vpState.seriesInstanceUID);
            if (series && series.instances.length > 1) {
              const newIdx = Math.min(series.instances.length - 1, vpState.imageIndex + 1);
              if (newIdx !== vpState.imageIndex) {
                syncScrollToImage(activeViewportIndex, newIdx);
              }
            }
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeViewportIndex, viewports, studies, drawMeasurements]);

  // Redraw reference lines on all viewports when active viewport changes
  useEffect(() => {
    viewportRefs.current.forEach((el, idx) => {
      if (el) drawMeasurements(el, idx);
    });
  }, [activeViewportIndex, drawMeasurements]);

  // Clear 3D cursor when active tool changes away from pixel probe
  useEffect(() => {
    if (activeTool !== 'pixel') {
      cursor3DRef.current = null;
      viewportRefs.current.forEach((el, idx) => {
        if (el) drawMeasurements(el, idx);
      });
    }
  }, [activeTool, drawMeasurements]);

  // Disclaimer Storage Check
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const accepted = localStorage.getItem('dicom_viewer_disclaimer_accepted');
        if (!accepted) {
          setShowDisclaimer(true);
        }
      } catch {}
      setIsDisclaimerChecked(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const handleAcceptDisclaimer = () => {
    localStorage.setItem('dicom_viewer_disclaimer_accepted', 'true');
    setShowDisclaimer(false);
  };

  // Check Github for Updates
  useEffect(() => {
    const checkUpdate = async () => {
      try {
        const res = await fetch('https://api.github.com/repos/jaaniin/div.DICOM/releases/latest');
        if (res.ok) {
          const data = await res.json();
          const latestVersion = data.tag_name.replace(/^v/, '');

          const currentParts = currentVersion.split('.').map(Number);
          const latestParts = latestVersion.split('.').map(Number);

          let isNewer = false;
          for (let i = 0; i < 3; i++) {
            if ((latestParts[i] || 0) > (currentParts[i] || 0)) {
              isNewer = true;
              break;
            } else if ((latestParts[i] || 0) < (currentParts[i] || 0)) {
              break;
            }
          }

          if (isNewer) {
            setUpdateAvailable({ version: data.tag_name, url: data.html_url });
          }
        }
      } catch (e) {
        console.warn('Failed to check for updates');
      }
    };
    checkUpdate();
  }, []);

  // Cornerstone Canvas Resizing Effects
  useEffect(() => {
    import('cornerstone-core').then((cs) => {
      const cornerstone = cs.default || cs;
      setTimeout(() => {
        viewportRefs.current.forEach((el) => {
          if (el) {
            try {
              cornerstone.resize(el, true);
            } catch (e) {}
          }
        });
      }, 50);
    });
  }, [layoutTree, maximizedIndex]);

  useEffect(() => {
    let resizeTimer: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        import('cornerstone-core').then((cs) => {
          const cornerstone = cs.default || cs;
          viewportRefs.current.forEach((el) => {
            if (el) {
              try {
                cornerstone.resize(el, true);
              } catch (e) {}
            }
          });
        });
      }, 50);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimer);
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      import('cornerstone-core').then((cs) => {
        const cornerstone = cs.default || cs;
        viewportRefs.current.forEach((el) => {
          if (el) {
            try {
              cornerstone.resize(el);
            } catch (e) {}
          }
        });
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [isSidebarOpen]);

  // Auto-render images on initial study load or layout/series change
  useEffect(() => {
    viewports.forEach((vp, index) => {
      if (!vp.seriesInstanceUID || !vp.studyInstanceUID) {
        lastRenderedKeyRef.current[index] = '';
        return;
      }
      const currentKey = `${vp.studyInstanceUID}_${vp.seriesInstanceUID}_${vp.imageIndex}`;
      if (lastRenderedKeyRef.current[index] === currentKey) {
        return;
      }
      lastRenderedKeyRef.current[index] = currentKey;

      const study = studies.find((s) => s.studyInstanceUID === vp.studyInstanceUID);
      const series = study?.series.find((s) => s.seriesInstanceUID === vp.seriesInstanceUID);
      const instance = series?.instances[vp.imageIndex];
      if (instance) {
        renderViewportImage(index, instance, true);
      }
    });
  }, [viewports, studies, layoutTree]);

  // Layout Actions
  const handleSplitViewport = (nodeId: string, direction: 'horizontal' | 'vertical') => {
    setLayoutTree((prev) => splitViewportNode(prev, nodeId, direction));
  };

  const handleCloseViewport = (nodeId: string) => {
    const newTree = closeViewportNode(layoutTree, nodeId);
    if (newTree) setLayoutTree(newTree);
  };

  const handleApplyLayoutPreset = (preset: LayoutNode) => {
    setLayoutTree(preset);
    setIsLayoutMenuOpen(false);
  };

  const handleRevertHangingProtocol = () => {
    if (initialHangingProtocol) {
      setLayoutTree(initialHangingProtocol.layout);
      setViewports(initialHangingProtocol.viewports);
    }
  };

  // Helper: Update 3D Pixel Probe coordinates and sync intersecting viewports
  const updatePixelProbe = (element: HTMLElement, index: number, clientX: number, clientY: number) => {
    const rect = element.getBoundingClientRect();
    const canvasX = clientX - rect.left;
    const canvasY = clientY - rect.top;

    import('cornerstone-core').then((cs) => {
      const cornerstone = cs.default || cs;
      let enabledElement: any;
      try {
        enabledElement = cornerstone.getEnabledElement(element);
      } catch (err) {
        return;
      }
      if (!enabledElement || !enabledElement.image) return;

      const imagePt = cornerstone.canvasToPixel(element, { x: canvasX, y: canvasY } as any);
      const img = enabledElement.image;
      const u = Math.floor(imagePt.x);
      const v = Math.floor(imagePt.y);

      let pixelVal: number | undefined;
      if (u >= 0 && u < img.width && v >= 0 && v < img.height) {
        const pixelData = img.getPixelData?.();
        if (pixelData) {
          const rawVal = pixelData[v * img.width + u];
          const slope = img.slope || 1;
          const intercept = img.intercept || 0;
          pixelVal = Math.round(rawVal * slope + intercept);
        }
      }

      const vpState = viewports[index];
      const study = studies.find((s) => s.studyInstanceUID === vpState?.studyInstanceUID);
      const series = study?.series.find((s) => s.seriesInstanceUID === vpState?.seriesInstanceUID);
      const instance = series?.instances[vpState?.imageIndex ?? 0];

      if (instance) {
        const p3D = pixelToPatient3D(imagePt.x, imagePt.y, instance);
        if (p3D) {
          cursor3DRef.current = {
            point: p3D,
            sourceViewportIndex: index,
            pixelVal,
            canvasPos: { x: canvasX, y: canvasY },
          };

          // 3D Crosshair Interactive Localization (Auto-scroll other viewports)
          viewports.forEach((otherVp, otherIdx) => {
            if (otherIdx === index || !otherVp.seriesInstanceUID) return;
            const otherStudy = studies.find((s) => s.studyInstanceUID === otherVp.studyInstanceUID);
            const otherSeries = otherStudy?.series.find((s) => s.seriesInstanceUID === otherVp.seriesInstanceUID);
            if (!otherSeries || otherSeries.instances.length === 0) return;

            const closestSlice = findClosestSliceTo3DPoint(p3D, otherSeries.instances);
            if (closestSlice !== otherVp.imageIndex) {
              setViewports((prev) =>
                prev.map((v, idx) => (idx === otherIdx ? { ...v, imageIndex: closestSlice } : v))
              );
              renderViewportImage(otherIdx, otherSeries.instances[closestSlice], true);
            }
          });
        }
      }

      // Redraw canvases on all viewports
      viewportRefs.current.forEach((el, idx) => {
        if (el) drawMeasurements(el, idx);
      });
    });
  };

  // Pointer Interaction Handlers (Multi-Button Mouse Chords)
  const handlePointerDown = (e: React.PointerEvent, index: number) => {
    setActiveViewportIndex(index);
    const element = viewportRefs.current[index];
    if (!element) return;

    isPointerDraggingRef.current = true;
    lastActivePointerDownRef.current = { x: e.clientX, y: e.clientY, buttons: e.buttons };
    (element as any).setPointerCapture?.(e.pointerId);

    let initialAction: string | null = null;
    if (e.buttons === 3) {
      initialAction = 'zoom';
    } else if (e.buttons === 4) {
      initialAction = 'pan';
    } else if (e.buttons === 2) {
      initialAction = 'wwc';
    } else if (e.buttons === 1) {
      initialAction = activeTool;
    }

    if (initialAction === 'pan') {
      panningViewportIndexRef.current = index;
      drawMeasurements(element, index);
    } else if (initialAction === 'pixel') {
      updatePixelProbe(element, index, e.clientX, e.clientY);
    }

    const startX = e.clientX;
    const startY = e.clientY;

    import('cornerstone-core').then((cs) => {
      const cornerstone = cs.default || cs;
      let vp: any;
      try {
        vp = cornerstone.getViewport(element);
      } catch (err) {
        return;
      }
      if (!vp) return;

      const initialCenter = vp.voi.windowCenter;
      const initialWidth = vp.voi.windowWidth;
      const initialTranslation = { ...vp.translation };
      const initialScale = vp.scale;

      const handleMove = (moveEvt: PointerEvent) => {
        if (!isPointerDraggingRef.current) return;
        const deltaX = moveEvt.clientX - startX;
        const deltaY = moveEvt.clientY - startY;

        // Multi-button action determination:
        // Left + Right Click -> Zoom
        // Middle Click -> Pan
        // Right Click -> WW/WC
        // Left Click -> Active Tool
        let action: string | null = null;
        if (moveEvt.buttons === 3) {
          action = 'zoom';
        } else if (moveEvt.buttons === 4) {
          action = 'pan';
        } else if (moveEvt.buttons === 2) {
          action = 'wwc';
        } else if (moveEvt.buttons === 1) {
          action = activeTool;
        }

        if (action === 'zoom') {
          // Zoom centered strictly on viewport center
          vp.scale = Math.max(0.05, Math.min(20.0, initialScale * Math.pow(1.015, -deltaY)));
          cornerstone.setViewport(element, vp);
        } else if (action === 'pan') {
          vp.translation.x = initialTranslation.x + deltaX / vp.scale;
          vp.translation.y = initialTranslation.y + deltaY / vp.scale;
          cornerstone.setViewport(element, vp);
          panningViewportIndexRef.current = index;
        } else if (action === 'wwc') {
          panningViewportIndexRef.current = null;
          const multiplier = Math.max(initialWidth / 256, 1);
          vp.voi.windowWidth = Math.max(1, initialWidth - deltaX * multiplier);
          vp.voi.windowCenter = initialCenter + deltaY * multiplier;
          cornerstone.setViewport(element, vp);
        } else if (action === 'pixel') {
          panningViewportIndexRef.current = null;
          updatePixelProbe(element, index, moveEvt.clientX, moveEvt.clientY);
        }

        drawMeasurements(element, index);

        // Update HUD
        const hudEl = document.getElementById(`overlay-wl-zoom-${index}`);
        if (hudEl) {
          hudEl.innerText = `WL: ${Math.round(vp.voi.windowCenter)} WW: ${Math.round(vp.voi.windowWidth)} • Zoom: ${(vp.scale * 100).toFixed(0)}%`;
        }
      };

      const handleUp = () => {
        isPointerDraggingRef.current = false;
        panningViewportIndexRef.current = null;
        if (cursor3DRef.current !== null) {
          cursor3DRef.current = null;
        }
        viewportRefs.current.forEach((el, idx) => {
          if (el) drawMeasurements(el, idx);
        });
        window.removeEventListener('pointermove', handleMove);
        window.removeEventListener('pointerup', handleUp);
      };

      window.addEventListener('pointermove', handleMove);
      window.addEventListener('pointerup', handleUp);
    });
  };

  // Pointer Move (Hover Tracking, Pixel Probe, Multi-Button Chords)
  const handlePointerMove = (e: React.PointerEvent, index: number) => {
    const element = viewportRefs.current[index];
    if (!element) return;

    // When no buttons are pressed, clear any active probe and return immediately
    if (e.buttons === 0) {
      if (cursor3DRef.current !== null) {
        cursor3DRef.current = null;
        viewportRefs.current.forEach((el, idx) => {
          if (el) drawMeasurements(el, idx);
        });
      }
      return;
    }

    // Direct multi-button movement handler (supports Left+Right Zoom, Middle Pan, Right WW/WC)
    import('cornerstone-core').then((cs) => {
      const cornerstone = cs.default || cs;
      let vp: any;
      try {
        vp = cornerstone.getViewport(element);
      } catch (err) {
        return;
      }
      if (!vp) return;

      let action: string | null = null;
      if (e.buttons === 3) {
        action = 'zoom';
      } else if (e.buttons === 4) {
        action = 'pan';
      } else if (e.buttons === 2) {
        action = 'wwc';
      } else if (e.buttons === 1) {
        action = activeTool;
      }

      if (action === 'zoom') {
        const oldScale = vp.scale;
        const zoomFactor = Math.pow(1.02, -e.movementY);
        const newScale = Math.max(0.05, Math.min(20.0, oldScale * zoomFactor));
        if (newScale !== oldScale) {
          // Zoom centered strictly on viewport center
          vp.scale = newScale;
          cornerstone.setViewport(element, vp);
          drawMeasurements(element, index);

          const hudEl = document.getElementById(`overlay-wl-zoom-${index}`);
          if (hudEl) {
            hudEl.innerText = `WL: ${Math.round(vp.voi.windowCenter)} WW: ${Math.round(vp.voi.windowWidth)} • Zoom: ${(vp.scale * 100).toFixed(0)}%`;
          }
        }
      } else if (action === 'pan') {
        vp.translation.x += e.movementX / vp.scale;
        vp.translation.y += e.movementY / vp.scale;
        cornerstone.setViewport(element, vp);
        panningViewportIndexRef.current = index;
        drawMeasurements(element, index);
      } else if (action === 'wwc') {
        if (panningViewportIndexRef.current !== null) {
          panningViewportIndexRef.current = null;
        }
        const multiplier = Math.max(vp.voi.windowWidth / 256, 1);
        vp.voi.windowCenter += e.movementY * multiplier;
        vp.voi.windowWidth = Math.max(1, vp.voi.windowWidth - e.movementX * multiplier);
        cornerstone.setViewport(element, vp);
        drawMeasurements(element, index);

        const hudEl = document.getElementById(`overlay-wl-zoom-${index}`);
        if (hudEl) {
          hudEl.innerText = `WL: ${Math.round(vp.voi.windowCenter)} WW: ${Math.round(vp.voi.windowWidth)} • Zoom: ${(vp.scale * 100).toFixed(0)}%`;
        }
      } else if (action === 'pixel') {
        updatePixelProbe(element, index, e.clientX, e.clientY);
      }
    });
  };

  // Scroll Wheel Slice Navigation (Proportional Acceleration & Bounce-Free)
  const handleWheel = (e: React.WheelEvent, index: number) => {
    e.preventDefault();
    const vpState = viewports[index];
    if (!vpState?.seriesInstanceUID) return;

    const study = studies.find((s) => s.studyInstanceUID === vpState.studyInstanceUID);
    const series = study?.series.find((s) => s.seriesInstanceUID === vpState.seriesInstanceUID);
    if (!series || series.instances.length <= 1) return;

    const now = e.timeStamp;
    const timeSinceLastWheel = now - wheelTimeRef.current;
    wheelTimeRef.current = now;

    if (timeSinceLastWheel < 60) {
      wheelStreakRef.current += 1;
    } else {
      wheelStreakRef.current = 0;
    }

    const totalSlices = series.instances.length;
    // For small MRI stacks (<= 60 slices), keep step strictly at 1 slice to prevent overshoot
    // For large 500+ slice CT stacks, scale smoothly up to max 2% of volume (capped at 6)
    let maxAllowedStep = 1;
    if (totalSlices > 60) {
      maxAllowedStep = Math.min(6, Math.max(1, Math.floor(totalSlices / 50)));
    }

    let step = 1;
    if (wheelStreakRef.current > 12) {
      step = maxAllowedStep;
    } else if (wheelStreakRef.current > 6) {
      step = Math.min(maxAllowedStep, Math.max(1, Math.floor(maxAllowedStep / 2)));
    }

    const direction = e.deltaY > 0 ? 1 : -1;
    const newIdx = Math.max(0, Math.min(totalSlices - 1, vpState.imageIndex + direction * step));

    if (newIdx !== vpState.imageIndex) {
      syncScrollToImage(index, newIdx);
    }
  };

  // Drag-and-Drop Series Loading into Viewport
  const loadSeriesIntoViewport = (viewportIndex: number, studyUID: string, seriesUID: string) => {
    const study = studies.find((s) => s.studyInstanceUID === studyUID);
    const series = study?.series.find((s) => s.seriesInstanceUID === seriesUID);
    if (!study || !series) return;

    setViewports((prev) =>
      prev.map((vp, idx) =>
        idx === viewportIndex
          ? { studyInstanceUID: studyUID, seriesInstanceUID: seriesUID, imageIndex: 0 }
          : vp
      )
    );

    if (series.instances[0]) {
      renderViewportImage(viewportIndex, series.instances[0], false);
    }
  };

  // Series and Study Ingestion via Worker Pool
  const applyValidInstances = (validInstances: DICOMInstance[], isReplace: boolean = false) => {
    const studyMap = new Map<string, DICOMStudy>();

    if (!isReplace) {
      studies.forEach((st) => {
        studyMap.set(st.studyInstanceUID, {
          ...st,
          series: st.series.map((ser) => ({ ...ser, instances: [...ser.instances] })),
        });
      });
    }

    validInstances.forEach((inst) => {
      const studyUID = inst.metadata.studyInstanceUID || 'UNKNOWN_STUDY';
      const seriesUID = inst.metadata.seriesInstanceUID || 'UNKNOWN_SERIES';

      if (!studyMap.has(studyUID)) {
        studyMap.set(studyUID, {
          studyInstanceUID: studyUID,
          patientName: inst.metadata.patientName || 'Unknown Patient',
          patientId: inst.metadata.patientId || 'Unknown ID',
          patientBirthDate: inst.metadata.patientBirthDate || '',
          patientSex: inst.metadata.patientSex || '',
          patientAge: inst.metadata.patientAge || '',
          studyDate: inst.metadata.studyDate || '',
          studyTime: inst.metadata.studyTime || '',
          studyDescription: inst.metadata.studyDescription || '',
          accessionNumber: inst.metadata.accessionNumber || '',
          referringPhysician: inst.metadata.referringPhysician || '',
          institutionName: inst.metadata.institutionName || '',
          series: [],
        });
      }

      const study = studyMap.get(studyUID)!;
      let series = study.series.find((s) => s.seriesInstanceUID === seriesUID);
      if (!series) {
        const newSeries: any = {
          seriesInstanceUID: seriesUID,
          seriesDescription: inst.metadata.seriesDescription || 'Unnamed Series',
          modality: inst.metadata.modality || 'OT',
          instances: [],
        };
        study.series.push(newSeries);
        series = newSeries;
      }
      if (series) {
        series.instances.push(inst);
      }
    });

    // Anatomical Spatial Sorting along slice plane normal (Essential for interleaved MRI)
    studyMap.forEach((study) => {
      study.series.forEach((series) => {
        series.instances = sortInstancesAnatomically(series.instances);
      });
    });

    const newStudies = Array.from(studyMap.values());
    setStudies(newStudies);

    // Apply Intelligent Hanging Protocol (Spine MRI 1+2, 2-Series 1x2 Columns, or 1x1)
    const protocol = determineHangingProtocol(newStudies);
    if (protocol) {
      setLayoutTree(protocol.layout);
      setViewports(protocol.viewports);
      setInitialHangingProtocol(protocol);
    }
  };

  const handleFiles = async (rawFiles: File[], isReplace: boolean = false) => {
    const files = rawFiles.filter((f) => !isSystemOrMetadataFile(f));
    if (files.length === 0) return;

    setIsParsing(true);
    setParseProgress({ processed: 0, total: files.length });

    setTimeout(async () => {
      try {
        const { cornerstoneWADOImageLoader } = await initCornerstone();
        if (!cornerstoneWADOImageLoader) throw new Error('Cornerstone loader not available');
        const pool = getDicomWorkerPool();

        const rawResults = await pool.processFiles(files, (processed, total) => {
          setParseProgress({ processed, total });
        });

        const results = rawResults.map((res) => {
          if (res.success && res.buffer) {
            if (res.isImage === false) {
              return { _skip: true };
            }
            const newFile = new File([res.buffer], res.fileName, {
              type: res.file?.type || 'application/dicom',
            });
            const imageId = cornerstoneWADOImageLoader.wadouri.fileManager.add(newFile);
            return { file: newFile, imageId, metadata: res.metadata };
          } else {
            if (res.isNonDicom || res.isImage === false) {
              return { _skip: true };
            }
            let userFriendlyError = res.error || 'Unknown error';
            if (typeof userFriendlyError === 'string' && userFriendlyError.includes('DICM prefix not found')) {
              userFriendlyError = 'Not a valid DICOM file (missing DICM prefix).';
            }
            return { _isError: true, fileName: res.fileName, error: userFriendlyError };
          }
        });

        const validInstances = results.filter((r) => r && !r._isError && !r._skip) as DICOMInstance[];
        const errors = results.filter((r) => r && r._isError);
        if (validInstances.length === 0 && errors.length > 0) {
          const msgs = errors.map((e: any) => `- ${e.fileName}: ${e.error}`).join('\n');
          setErrorMessage(`Failed to parse some files:\n\n${msgs}`);
        }
        if (validInstances.length === 0) return;

        let mismatch = false;
        const existingPatientIds = new Set(studies.map((s) => s.patientId));
        const newPatientIds = new Set(validInstances.map((inst) => inst.metadata.patientId));
        if (existingPatientIds.size > 0) {
          for (const newId of newPatientIds) {
            if (!existingPatientIds.has(newId)) {
              mismatch = true;
              break;
            }
          }
        }

        if (isReplace) {
          applyValidInstances(validInstances, true);
        } else {
          if (mismatch) {
            setIsParsing(false);
            setPatientMismatchDialog({ show: true, pendingInstances: validInstances });
            return;
          }
          applyValidInstances(validInstances, false);
        }
      } catch (err) {
        console.error('Error processing batch via worker pool:', err);
      } finally {
        setIsParsing(false);
        setParseProgress(null);
      }
    }, 50);
  };

  // Series and Study Deletion with Explicit Cache Purging
  const handleRemoveSeries = (e: React.MouseEvent, studyUID: string, seriesUID: string) => {
    e.stopPropagation();

    const studyToRemoveFrom = studies.find((s) => s.studyInstanceUID === studyUID);
    const seriesToRemove = studyToRemoveFrom?.series.find((s) => s.seriesInstanceUID === seriesUID);
    if (seriesToRemove) {
      const removedImageIds = new Set(seriesToRemove.instances.map((inst) => inst.imageId));
      setMeasurements((prev) => prev.filter((m) => !removedImageIds.has(m.imageId)));

      // Explicitly purge from Cornerstone imageCache & WADO fileManager
      import('cornerstone-core').then((cs) => {
        const cornerstone = cs.default || cs;
        removedImageIds.forEach((id) => {
          try {
            cornerstone.imageCache.removeImageLoadObject(id);
          } catch (err) {}
        });
      });
      import('cornerstone-wado-image-loader').then((csLoader) => {
        const loader = csLoader.default || csLoader;
        removedImageIds.forEach((id) => {
          try {
            loader.wadouri.fileManager.remove(id);
          } catch (err) {}
        });
      });
    }

    setStudies((prevStudies) =>
      prevStudies
        .map((study) => {
          if (study.studyInstanceUID === studyUID) {
            return {
              ...study,
              series: study.series.filter((s) => s.seriesInstanceUID !== seriesUID),
            };
          }
          return study;
        })
        .filter((study) => study.series.length > 0)
    );

    setViewports((prev) =>
      prev.map((vp, index) => {
        if (vp.studyInstanceUID === studyUID && vp.seriesInstanceUID === seriesUID) {
          import('cornerstone-core').then((cs) => {
            const cornerstone = cs.default || cs;
            const el = viewportRefs.current[index];
            if (el) {
              try {
                cornerstone.disable(el);
                cornerstone.enable(el);
              } catch (err) {}
            }
          });
          return { ...vp, studyInstanceUID: null, seriesInstanceUID: null, imageIndex: 0 };
        }
        return vp;
      })
    );
  };

  const handleRemoveAll = () => {
    import('cornerstone-core').then((cs) => {
      const cornerstone = cs.default || cs;
      try {
        cornerstone.imageCache.purgeCache();
      } catch (err) {}

      viewportRefs.current.forEach((el, idx) => {
        if (el) {
          try {
            cornerstone.disable(el);
            cornerstone.enable(el);
          } catch (err) {}

          // Clear any measurement overlay canvas
          const canvas = el.querySelector('canvas.measurement-canvas') as HTMLCanvasElement;
          if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx?.clearRect(0, 0, canvas.width, canvas.height);
          }

          // Clear HUD overlay text
          const hudEl = document.getElementById(`overlay-wl-zoom-${idx}`);
          if (hudEl) {
            hudEl.innerText = '';
          }
        }
      });
    });

    import('cornerstone-wado-image-loader').then((csLoader) => {
      const loader = csLoader.default || csLoader;
      try {
        loader.wadouri.fileManager.purge();
      } catch (err) {}
    });

    setStudies([]);
    setViewports(Array(4).fill({ studyInstanceUID: null, seriesInstanceUID: null, imageIndex: 0 }));
    setLayoutTree({ type: 'viewport', id: 'root', viewportIndex: 0 });
    setInitialHangingProtocol(null);
    setMeasurements([]);
    setActiveTool('none');
    setShowRemoveAllDialog(false);
    cursor3DRef.current = null;
  };

  // Full-Screen Drag and Drop Handlers
  const handleRootDragEnter = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      setShowGlobalOverlay(true);
    }
  };

  const processDataTransfer = async (dataTransfer: DataTransfer, isReplace: boolean = false) => {
    const items = dataTransfer.items;
    if (items && items.length > 0) {
      const filePromises: Promise<File[]>[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i].webkitGetAsEntry?.() || (items[i] as any).getAsEntry?.();
        if (item) {
          filePromises.push(traverseFileTree(item));
        } else {
          const file = items[i].getAsFile();
          if (file) filePromises.push(Promise.resolve([file]));
        }
      }
      const fileArrays = await Promise.all(filePromises);
      handleFiles(fileArrays.flat(), isReplace);
    } else if (dataTransfer.files && dataTransfer.files.length > 0) {
      handleFiles(Array.from(dataTransfer.files), isReplace);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(Array.from(e.target.files));
    }
  };

  // Report Export and Copy
  const handleSaveReport = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (studies.length === 0) return;

    const fullText = generateReportText({
      studies,
      findings: reportText,
      timestamp: new Date(),
    });
    const filename = generateReportFilename(studies, new Date());
    downloadReportFile(fullText, filename);

    setReportSavedStatus(true);
    setTimeout(() => setReportSavedStatus(false), 2500);
  };

  const handleCopyReport = () => {
    if (studies.length === 0) return;
    const fullText = generateReportText({
      studies,
      findings: reportText,
      timestamp: new Date(),
    });
    navigator.clipboard.writeText(fullText).then(() => {
      setIsReportCopied(true);
      setTimeout(() => setIsReportCopied(false), 2500);
    });
  };

  // Render Single Viewport Content
  const renderViewportContent = (index: number, nodeId: string) => {
    const vpState = viewports[index];
    const vpStudy = studies.find((s) => s.studyInstanceUID === vpState?.studyInstanceUID);
    const vpSeries = vpStudy?.series.find((s) => s.seriesInstanceUID === vpState?.seriesInstanceUID);
    const activeInstance = vpSeries?.instances[vpState?.imageIndex ?? 0];

    const markers = getOrientationMarkers(activeInstance?.metadata.imageOrientationPatient);
    const visibleIndices = getVisibleViewportIndices(layoutTree);
    const totalVisible = visibleIndices.length;
    const isActive = activeViewportIndex === index;

    return (
      <div
        className={`w-full h-full relative group/vp bg-black overflow-hidden select-none ${
          isActive ? 'ring-1 ring-[#3584F5]/50' : ''
        }`}
        onWheel={(e) => handleWheel(e, index)}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes('application/x-dicom-series')) {
            e.preventDefault();
            setDragOverViewport(index);
          }
        }}
        onDragLeave={() => setDragOverViewport(null)}
        onDrop={(e) => {
          setDragOverViewport(null);
          const data = e.dataTransfer.getData('application/x-dicom-series');
          if (data) {
            e.preventDefault();
            const { studyInstanceUID, seriesInstanceUID } = JSON.parse(data);
            loadSeriesIntoViewport(index, studyInstanceUID, seriesInstanceUID);
          }
        }}
      >
        {/* Cornerstone Canvas Mount */}
        <div
          ref={(el) => {
            viewportRefs.current[index] = el;
            if (el) {
              import('cornerstone-core').then((cs) => {
                const cornerstone = cs.default || cs;
                try {
                  cornerstone.getEnabledElement(el);
                } catch (e) {
                  try {
                    cornerstone.enable(el);
                  } catch (err) {}
                }
              });
            }
          }}
          className="absolute inset-0 z-0 bg-black touch-none cursor-default"
          onContextMenu={(e) => e.preventDefault()}
          onPointerDown={(e) => handlePointerDown(e, index)}
          onPointerMove={(e) => handlePointerMove(e, index)}
          onPointerUp={() => {
            panningViewportIndexRef.current = null;
            if (cursor3DRef.current !== null) {
              cursor3DRef.current = null;
            }
            viewportRefs.current.forEach((el, idx) => {
              if (el) drawMeasurements(el, idx);
            });
          }}
          onPointerLeave={() => {
            panningViewportIndexRef.current = null;
            if (activeTool === 'pixel') {
              cursor3DRef.current = null;
            }
            viewportRefs.current.forEach((el, idx) => {
              if (el) drawMeasurements(el, idx);
            });
          }}
          onPointerEnter={() => setActiveViewportIndex(index)}
        />

        {/* Viewport Overlay Info (HUD) */}
        <ViewportOverlay index={index} vpState={vpState} study={vpStudy} />

        {/* Anatomical Orientation Markers */}
        {vpState?.seriesInstanceUID && <OrientationMarkers markers={markers} />}

        {/* Floating Bottom-Right Viewport Controls (Collapsible Split/Maximize Toolbar + Info Hover/Modal Button) */}
        <div className="absolute bottom-2 right-2 z-30 flex items-center gap-1.5 pointer-events-auto">
          <ViewportActionBar
            nodeId={nodeId}
            isMaximized={maximizedIndex === index}
            totalVisible={totalVisible}
            onToggleMaximize={() => setMaximizedIndex(maximizedIndex === index ? null : index)}
            onSplitHorizontal={() => {
              handleSplitViewport(nodeId, 'horizontal');
              setMaximizedIndex(null);
            }}
            onSplitVertical={() => {
              handleSplitViewport(nodeId, 'vertical');
              setMaximizedIndex(null);
            }}
            onClose={() => {
              handleCloseViewport(nodeId);
              setMaximizedIndex(null);
            }}
          />

          {vpState?.seriesInstanceUID && activeInstance?.metadata && (
            <ViewportInfoButton
              instance={activeInstance}
              onClick={() => setActiveInfoViewport(activeInfoViewport === index ? null : index)}
            />
          )}
        </div>

        {/* Raw Metadata Modal */}
        <RawMetadataModal
          isOpen={activeInfoViewport === index}
          onClose={() => setActiveInfoViewport(null)}
          rawTags={activeInstance?.metadata.rawTags}
        />

        {/* Empty Viewport Placeholder */}
        {!vpState?.seriesInstanceUID && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-neutral-500 pointer-events-none z-10 p-6 text-center select-none bg-black/50 backdrop-blur-[2px]">
            <div className="w-12 h-12 mb-3 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-600">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1">No Image Loaded</h3>
            <p className="text-[11px] text-neutral-500 max-w-[200px]">Drag a series from the sidebar or drop DICOM files here</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className="flex flex-col h-screen w-screen overflow-hidden bg-neutral-950 text-neutral-100 font-sans select-none"
      onDragEnter={handleRootDragEnter}
    >
      {/* Top Header Navigation Toolbar */}
      <ViewerToolbar
        activeTool={activeTool}
        onSelectTool={setActiveTool}
        isTrashOpen={isTrashOpen}
        onToggleTrash={() => setIsTrashOpen(!isTrashOpen)}
        isDraggingOverTrash={isDraggingOverTrash}
        draggingPoint={draggingPoint}
        measurements={measurements}
        setMeasurements={setMeasurements}
        selectedForDeletion={selectedForDeletion}
        setSelectedForDeletion={setSelectedForDeletion}
        studies={studies}
        onDeleteSelected={() => {
          setMeasurements((prev) => prev.filter((m) => !selectedForDeletion.has(m.id)));
          setSelectedForDeletion(new Set());
        }}
        isLayoutMenuOpen={isLayoutMenuOpen}
        onToggleLayoutMenu={() => setIsLayoutMenuOpen(!isLayoutMenuOpen)}
        onApplyLayoutPreset={handleApplyLayoutPreset}
        initialHangingProtocol={initialHangingProtocol}
        onRevertHangingProtocol={handleRevertHangingProtocol}
        updateAvailable={updateAvailable}
        onOpenHelp={() => setIsHelpModalOpen(true)}
        onOpenDisclaimer={() => setShowDisclaimer(true)}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
      />

      {/* Main Center Area: Viewport Canvas Grid & Collapsible Sidebar */}
      <div className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 w-full h-full relative overflow-hidden bg-black">
          {maximizedIndex !== null ? (
            <div className="w-full h-full relative">{renderViewportContent(maximizedIndex, 'maximized')}</div>
          ) : (
            <LayoutRenderer node={layoutTree} renderViewport={renderViewportContent} />
          )}
        </div>

        {/* Collapsible Sidebar */}
        <Sidebar
          isOpen={isSidebarOpen}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          studies={studies}
          viewports={viewports}
          isDragging={isDragging}
          fileInputRef={fileInputRef}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            processDataTransfer(e.dataTransfer, false);
          }}
          onFileInput={handleFileInput}
          onSelectSeries={(stUID, serUID) => loadSeriesIntoViewport(0, stUID, serUID)}
          onRemoveSeries={handleRemoveSeries}
          onClearAll={() => setShowRemoveAllDialog(true)}
          reportText={reportText}
          onReportTextChange={setReportText}
          onSaveReport={handleSaveReport}
          onCopyReport={handleCopyReport}
          reportSavedStatus={reportSavedStatus}
          isReportCopied={isReportCopied}
        />
      </div>

      {/* Full-Screen Drag & Drop Overlay (Add vs Replace) */}
      <GlobalDropOverlay
        isOpen={showGlobalOverlay}
        hasLoadedStudies={studies.length > 0}
        hoverZone={overlayHoverZone}
        onDragLeave={(e) => {
          if (!e.relatedTarget || (e.relatedTarget as Element).nodeName === 'HTML') {
            setShowGlobalOverlay(false);
            setOverlayHoverZone('none');
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (studies.length === 0) {
            setOverlayHoverZone('single');
          } else {
            const rect = e.currentTarget.getBoundingClientRect();
            if (e.clientX < rect.width / 2) {
              setOverlayHoverZone('left');
            } else {
              setOverlayHoverZone('right');
            }
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          setShowGlobalOverlay(false);
          const isReplace = studies.length > 0 && overlayHoverZone === 'right';
          setOverlayHoverZone('none');
          processDataTransfer(e.dataTransfer, isReplace);
        }}
      />

      {/* Modal Dialogs */}
      <DisclaimerModal
        isOpen={showDisclaimer && isDisclaimerChecked}
        isChecked={isDisclaimerChecked}
        onCheckedChange={setIsDisclaimerChecked}
        onAccept={handleAcceptDisclaimer}
      />

      <HelpModal
        isOpen={isHelpModalOpen}
        onClose={() => setIsHelpModalOpen(false)}
        version={currentVersion}
      />

      <PatientMismatchDialog
        isOpen={patientMismatchDialog.show}
        onReplace={() => {
          const instances = patientMismatchDialog.pendingInstances;
          setPatientMismatchDialog({ show: false, pendingInstances: [] });
          applyValidInstances(instances, true);
        }}
        onAppend={() => {
          const instances = patientMismatchDialog.pendingInstances;
          setPatientMismatchDialog({ show: false, pendingInstances: [] });
          applyValidInstances(instances, false);
        }}
        onCancel={() => setPatientMismatchDialog({ show: false, pendingInstances: [] })}
      />

      <RemoveAllDialog
        isOpen={showRemoveAllDialog}
        onConfirm={handleRemoveAll}
        onCancel={() => setShowRemoveAllDialog(false)}
      />

      {/* Live Loading & Worker Pool Parsing Progress Modal */}
      {isParsing && (
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
                        width: `${Math.max(
                          4,
                          Math.round((parseProgress.processed / parseProgress.total) * 100)
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
