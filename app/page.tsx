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
import { uploadDicomFilesToBrowser } from '../utils/dicomUploader';
import { getVisibleViewportIndices, splitViewportNode, closeViewportNode, determineHangingProtocol, canSplitNode, MAX_VIEWPORTS, createDefaultViewports, createQuickLayout } from '../utils/layoutHelpers';
import {
  findClosestParallelSliceIndex,
  pixelToPatient3D,
  patient3DToPixel,
  findClosestSliceTo3DPoint,
} from '../utils/syncScroll';
import { calculateMeasurementLengthText, calculateRoiStatistics } from '../utils/measurements';

// Modular UI Components
import { ViewerToolbar } from '../components/toolbar';
import { Sidebar } from '../components/sidebar';
import {
  LayoutRenderer, PanelSizes,
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
  ParsingModal,
} from '../components/dialogs';

import packageJson from '../package.json';

const currentVersion = packageJson.version || '0.7.0';

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  return Math.hypot(p.x - projX, p.y - projY);
}

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
  const [activeTool, setActiveTool] = useState<Tool>('none');
  const [layoutTree, setLayoutTree] = useState<LayoutNode>({ type: 'viewport', id: 'root', viewportIndex: 0 });
  const [initialHangingProtocol, setInitialHangingProtocol] = useState<{
    layout: LayoutNode;
    viewports: ViewportState[];
  } | null>(null);
  const [isLayoutMenuOpen, setIsLayoutMenuOpen] = useState(false);
  const [activeViewportIndex, setActiveViewportIndex] = useState<number | null>(0);
  const [maximizedIndex, setMaximizedIndex] = useState<number | null>(null);
  const [activeInfoViewport, setActiveInfoViewport] = useState<number | null>(null);
  const [selectedViewports, setSelectedViewports] = useState<number[]>([]);
  const panelSizesRef = useRef<Map<string, PanelSizes>>(new Map());
  const [panelSizesMap, setPanelSizesMap] = useState<Map<string, PanelSizes>>(new Map());
  const handleSavePanelSizes = useCallback((nodeId: string, sizes: PanelSizes) => {
    panelSizesRef.current.set(nodeId, sizes);
    setPanelSizesMap(new Map(panelSizesRef.current));
  }, []);
  const selectedViewportsRef = useRef<number[]>([]);
  const ctrlPressedRef = useRef<boolean>(false);
  const didInteractWithCtrlRef = useRef<boolean>(false);
  useEffect(() => {
    selectedViewportsRef.current = selectedViewports;
  }, [selectedViewports]);

  // Sidebar & Reporting State
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('files');
  const [reportText, setReportText] = useState('');
  const [reportSavedStatus, setReportSavedStatus] = useState(false);
  const [isReportCopied, setIsReportCopied] = useState(false);

  // Data & Viewport State
  const [studies, setStudies] = useState<DICOMStudy[]>([]);
  const [viewports, setViewports] = useState<ViewportState[]>(createDefaultViewports(MAX_VIEWPORTS));
  const [dragOverViewport, setDragOverViewport] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showGlobalOverlay, setShowGlobalOverlay] = useState(false);
  const [overlayHoverZone, setOverlayHoverZone] = useState<'none' | 'left' | 'right' | 'single'>('none');

  // Measurements State & Ref
  const [measurements, setMeasurements] = useState<LengthMeasurement[]>([]);
  const measurementsRef = useRef<LengthMeasurement[]>([]);
  useEffect(() => {
    measurementsRef.current = measurements;
  }, [measurements]);

  const [isTrashOpen, setIsTrashOpen] = useState(false);
  const [isDraggingOverTrash, setIsDraggingOverTrash] = useState(false);
  const isDraggingOverTrashRef = useRef<boolean>(false);
  const [selectedForDeletion, setSelectedForDeletion] = useState<Set<string>>(new Set());
  const [draggingPoint, setDraggingPoint] = useState<{
    id: string;
    point: string;
    isNew: boolean;
    lastPt?: any;
  } | null>(null);

  // 3D Spatial Cursor, Probe & Mouse Pos Ref
  const mousePosRef = useRef<{ x: number; y: number } | null>(null);
  const renderRequestSeqRef = useRef<number[]>(Array(MAX_VIEWPORTS).fill(0));
  const savedViewportTransformsRef = useRef<Map<number, { zoomRatio: number; translation: { x: number; y: number }; voi: { windowCenter: number; windowWidth: number }; rotation?: number; hflip?: boolean; vflip?: boolean }>>(new Map());
  const lastRenderedKeyRef = useRef<string[]>(Array(MAX_VIEWPORTS).fill(''));
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

  // Close menus when clicking outside toolbar dropdowns
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        !target.closest('#trash-icon, #layout-picker-btn, .animate-in')
      ) {
        setIsTrashOpen(false);
        setIsLayoutMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', handleGlobalClick);
    return () => window.removeEventListener('mousedown', handleGlobalClick);
  }, []);

  // Tool Selection with Auto Menu Closure
  const handleSelectTool = (tool: Tool) => {
    setActiveTool(tool);
    setIsTrashOpen(false);
    setIsLayoutMenuOpen(false);
  };

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
        if (!enabledElement || !enabledElement.image || !enabledElement.viewport) return;

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

                ctx.fillStyle = '#3584F5';
                ctx.font = '10px monospace';
                ctx.fillText(`V${activeViewportIndex + 1}`, p1Canvas.x + 4, p1Canvas.y - 4);
                ctx.restore();
              }
            }
          }
        }

        // 2. Draw Distance, Angle, and ROI Measurements
        const scale = vp.scale || 1;
        const threshold = 10 / scale;

        let mouseImagePt: Point | null = null;
        if (mousePosRef.current) {
          try {
            mouseImagePt = cornerstone.pageToPixel(element, mousePosRef.current.x, mousePosRef.current.y);
          } catch (e) {}
        }

        const currentMeasList = measurementsRef.current;

        currentMeasList.forEach((m, mIndex) => {
          if (m.imageId !== activeInstance?.imageId) return;

          ctx.save();

          const drawLineAndPoints = (
            start: Point,
            end: Point,
            isHoverStart: boolean,
            isHoverEnd: boolean,
            isAngle: boolean,
            lineLabel: string
          ) => {
            const pt1 = cornerstone.pixelToCanvas(element, start as any);
            const pt2 = cornerstone.pixelToCanvas(element, end as any);

            ctx.beginPath();
            ctx.moveTo(pt1.x, pt1.y);
            ctx.lineTo(pt2.x, pt2.y);
            ctx.strokeStyle = 'rgba(52, 211, 153, 0.8)';
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.fillStyle = 'rgba(52, 211, 153, 0.8)';
            if (isAngle) {
              ctx.beginPath();
              ctx.arc(pt1.x, pt1.y, 4, 0, 2 * Math.PI);
              ctx.fill();
              ctx.beginPath();
              ctx.arc(pt2.x, pt2.y, 4, 0, 2 * Math.PI);
              ctx.fill();
            } else {
              const lengthPx = Math.hypot(pt2.x - pt1.x, pt2.y - pt1.y);
              const ux = lengthPx > 0 ? (pt2.x - pt1.x) / lengthPx : 0;
              const uy = lengthPx > 0 ? (pt2.y - pt1.y) / lengthPx : 0;
              const px = -uy;
              const py = ux;
              const tBarW = 6;

              if (isHoverStart) {
                ctx.beginPath();
                ctx.arc(pt1.x, pt1.y, 4, 0, 2 * Math.PI);
                ctx.fill();
              } else {
                ctx.beginPath();
                ctx.moveTo(pt1.x + px * tBarW, pt1.y + py * tBarW);
                ctx.lineTo(pt1.x - px * tBarW, pt1.y - py * tBarW);
                ctx.stroke();
              }
              if (isHoverEnd) {
                ctx.beginPath();
                ctx.arc(pt2.x, pt2.y, 4, 0, 2 * Math.PI);
                ctx.fill();
              } else {
                ctx.beginPath();
                ctx.moveTo(pt2.x + px * tBarW, pt2.y + py * tBarW);
                ctx.lineTo(pt2.x - px * tBarW, pt2.y - py * tBarW);
                ctx.stroke();
              }
            }

            // Circular letter badge in the middle of line
            const midX = (pt1.x + pt2.x) / 2;
            const midY = (pt1.y + pt2.y) / 2;

            ctx.beginPath();
            ctx.arc(midX, midY, 9, 0, 2 * Math.PI);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(52, 211, 153, 0.8)';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            ctx.fillStyle = '#34d399';
            ctx.font = 'bold 11px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(lineLabel, midX, midY + 1);

            ctx.textAlign = 'left';
            ctx.textBaseline = 'alphabetic';

            return { pt1, pt2 };
          };

          let hoverStart = false,
            hoverEnd = false;
          let hoverStart2 = false,
            hoverEnd2 = false;

          if (mouseImagePt) {
            if (m.start && Math.hypot(m.start.x - mouseImagePt.x, m.start.y - mouseImagePt.y) < threshold)
              hoverStart = true;
            if (m.end && Math.hypot(m.end.x - mouseImagePt.x, m.end.y - mouseImagePt.y) < threshold)
              hoverEnd = true;
            if (m.start2 && Math.hypot(m.start2.x - mouseImagePt.x, m.start2.y - mouseImagePt.y) < threshold)
              hoverStart2 = true;
            if (m.end2 && Math.hypot(m.end2.x - mouseImagePt.x, m.end2.y - mouseImagePt.y) < threshold)
              hoverEnd2 = true;
          }

          if (m.type === 'roi' && m.points && m.points.length > 0) {
            const canvasPts = m.points.map((p) => cornerstone.pixelToCanvas(element, p as any));

            ctx.beginPath();
            ctx.moveTo(canvasPts[0].x, canvasPts[0].y);
            for (let i = 1; i < canvasPts.length; i++) {
              ctx.lineTo(canvasPts[i].x, canvasPts[i].y);
            }

            let closedLineEnd = null;
            let isHoveringStartPoint = false;
            if (!m.isClosed && mouseImagePt && activeTool === 'roi') {
              const mPt = cornerstone.pixelToCanvas(element, mouseImagePt as any);
              const distToFirst = Math.hypot(canvasPts[0].x - mPt.x, canvasPts[0].y - mPt.y);
              if (distToFirst < 16 && m.points.length >= 3) {
                isHoveringStartPoint = true;
              }
              ctx.lineTo(mPt.x, mPt.y);
              closedLineEnd = mPt;
            }

            if (m.isClosed) {
              ctx.lineTo(canvasPts[0].x, canvasPts[0].y);
            }

            ctx.strokeStyle = 'rgba(52, 211, 153, 0.8)';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Preview dashed closing line back to start while actively drawing open ROI
            if (!m.isClosed && closedLineEnd) {
              ctx.beginPath();
              ctx.moveTo(closedLineEnd.x, closedLineEnd.y);
              ctx.lineTo(canvasPts[0].x, canvasPts[0].y);
              ctx.strokeStyle = 'rgba(52, 211, 153, 0.8)';
              ctx.lineWidth = 2;
              ctx.setLineDash([5, 5]);
              ctx.stroke();
              ctx.setLineDash([]);
            }

            // Draw vertex handles
            canvasPts.forEach((pt, pIdx) => {
              ctx.beginPath();
              if (pIdx === 0 && isHoveringStartPoint) {
                ctx.arc(pt.x, pt.y, 7, 0, 2 * Math.PI);
                ctx.fillStyle = 'rgba(52, 211, 153, 1.0)';
                ctx.fill();
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2;
                ctx.stroke();
              } else {
                ctx.arc(pt.x, pt.y, 4, 0, 2 * Math.PI);
                ctx.fillStyle = 'rgba(52, 211, 153, 0.8)';
                ctx.fill();
              }
            });

            const label = String.fromCharCode(65 + (mIndex % 26));
            ctx.font = '13px Arial';

            const textX = canvasPts[0].x + 10;
            const textY = canvasPts[0].y - 10;

            const lengthText = calculateMeasurementLengthText(m, mIndex, studies);

            ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
            const textWidth = ctx.measureText(lengthText).width;
            ctx.fillRect(textX - 3, textY - 13, textWidth + 6, 17);
            ctx.strokeStyle = 'rgba(52, 211, 153, 0.5)';
            ctx.lineWidth = 1;
            ctx.strokeRect(textX - 3, textY - 13, textWidth + 6, 17);

            ctx.fillStyle = '#34d399';
            ctx.fillText(lengthText, textX, textY);
            ctx.restore();
            return;
          }

          const isAngle = m.type === 'angle';

          let line1Label = String.fromCharCode(65 + (mIndex % 26));
          let line2Label = '';
          if (isAngle) {
            line1Label = String.fromCharCode(97 + ((mIndex * 2) % 26));
            line2Label = String.fromCharCode(97 + ((mIndex * 2 + 1) % 26));
          }

          const { pt1, pt2 } = drawLineAndPoints(m.start, m.end, hoverStart, hoverEnd, isAngle, line1Label);

          let pt1_2 = { x: 0, y: 0 };
          let pt2_2 = { x: 0, y: 0 };
          if (isAngle && m.start2 && m.end2) {
            const res = drawLineAndPoints(m.start2, m.end2, hoverStart2, hoverEnd2, true, line2Label);
            pt1_2 = res.pt1;
            pt2_2 = res.pt2;
          }

          const lengthText = calculateMeasurementLengthText(m, mIndex, studies);
          ctx.font = '13px Arial';

          let textX = 0;
          let textY = 0;

          if (m.type === 'angle') {
            if (!m.start2 || !m.end2) {
              textX = pt2.x + 10;
              textY = pt2.y - 10;
            } else {
              const denom = (pt1.x - pt2.x) * (pt1_2.y - pt2_2.y) - (pt1.y - pt2.y) * (pt1_2.x - pt2_2.x);
              if (Math.abs(denom) > 1e-5) {
                const intersectX =
                  ((pt1.x * pt2.y - pt1.y * pt2.x) * (pt1_2.x - pt2_2.x) -
                    (pt1.x - pt2.x) * (pt1_2.x * pt2_2.y - pt1_2.y * pt2_2.x)) /
                  denom;
                const intersectY =
                  ((pt1.x * pt2.y - pt1.y * pt2.x) * (pt1_2.y - pt2_2.y) -
                    (pt1.y - pt2.y) * (pt1_2.x * pt2_2.y - pt1_2.y * pt2_2.x)) /
                  denom;

                const mid1 = { x: (pt1.x + pt2.x) / 2, y: (pt1.y + pt2.y) / 2 };
                const mid2 = { x: (pt1_2.x + pt2_2.x) / 2, y: (pt1_2.y + pt2_2.y) / 2 };
                const a1 = Math.atan2(mid1.y - intersectY, mid1.x - intersectX);
                const a2 = Math.atan2(mid2.y - intersectY, mid2.x - intersectX);

                const r1 = Math.hypot(mid1.x - intersectX, mid1.y - intersectY);
                const r2 = Math.hypot(mid2.x - intersectX, mid2.y - intersectY);
                const radius = Math.min(r1, r2);

                ctx.setLineDash([4, 4]);
                ctx.beginPath();
                ctx.arc(intersectX, intersectY, radius, Math.min(a1, a2), Math.max(a1, a2), Math.abs(a1 - a2) > Math.PI);
                ctx.strokeStyle = 'rgba(52, 211, 153, 0.8)';
                ctx.lineWidth = 1.5;
                ctx.stroke();

                const dot1 = (pt1.x - intersectX) * (pt2.x - intersectX) + (pt1.y - intersectY) * (pt2.y - intersectY);
                if (dot1 > 0) {
                  const closest1 =
                    Math.hypot(pt1.x - intersectX, pt1.y - intersectY) <
                    Math.hypot(pt2.x - intersectX, pt2.y - intersectY)
                      ? pt1
                      : pt2;
                  ctx.beginPath();
                  ctx.moveTo(closest1.x, closest1.y);
                  ctx.lineTo(intersectX, intersectY);
                  ctx.stroke();
                }

                const dot2 =
                  (pt1_2.x - intersectX) * (pt2_2.x - intersectX) + (pt1_2.y - intersectY) * (pt2_2.y - intersectY);
                if (dot2 > 0) {
                  const closest2 =
                    Math.hypot(pt1_2.x - intersectX, pt1_2.y - intersectY) <
                    Math.hypot(pt2_2.x - intersectX, pt2.y - intersectY)
                      ? pt1_2
                      : pt2_2;
                  ctx.beginPath();
                  ctx.moveTo(closest2.x, closest2.y);
                  ctx.lineTo(intersectX, intersectY);
                  ctx.stroke();
                }

                ctx.setLineDash([]);

                const midAngle = (a1 + a2) / 2 + (Math.abs(a1 - a2) > Math.PI ? Math.PI : 0);
                textX = intersectX + radius * Math.cos(midAngle);
                textY = intersectY + radius * Math.sin(midAngle);
              } else {
                textX = ((pt1.x + pt2.x) / 2 + (pt1_2.x + pt2_2.x) / 2) / 2;
                textY = ((pt1.y + pt2.y) / 2 + (pt1_2.y + pt2_2.y) / 2) / 2;
              }
            }
          } else {
            textX = pt2.x + 10;
            textY = pt2.y - 10;
          }

          ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
          const textWidth = ctx.measureText(lengthText).width;
          ctx.fillRect(textX - 3, textY - 13, textWidth + 6, 17);
          ctx.strokeStyle = 'rgba(52, 211, 153, 0.5)';
          ctx.lineWidth = 1;
          ctx.strokeRect(textX - 3, textY - 13, textWidth + 6, 17);

          ctx.fillStyle = '#34d399';
          ctx.fillText(lengthText, textX, textY);

          ctx.restore();
        });

        // 4. Draw Center Crosshair (+) during Active Pan Tool
        if (panningViewportIndexRef.current === viewportIdx) {
          const cx = Math.round(canvas.width / 2);
          const cy = Math.round(canvas.height / 2);
          const crossSize = 16;

          ctx.save();
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

        // 3. Draw Pixel Probe / 3D Spatial Crosshair Cursor
        const cursor3D = cursor3DRef.current;
        if (cursor3D && activeTool === 'pixel') {
          if (cursor3D.sourceViewportIndex === viewportIdx) {
            const { x, y } = cursor3D.canvasPos;
            ctx.save();
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 1.5;

            ctx.beginPath();
            ctx.moveTo(x - 14, y);
            ctx.lineTo(x + 14, y);
            ctx.moveTo(x, y - 14);
            ctx.lineTo(x + 14, y);
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(x, y, 4, 0, 2 * Math.PI);
            ctx.stroke();

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
            const projected = patient3DToPixel(cursor3D.point, activeInstance);
            if (projected) {
              const canvasPt = cornerstone.pixelToCanvas(element, projected.pixel as any);
              const sliceThickness = parseFloat(activeInstance.metadata.sliceThickness || '3.0');

              if (projected.distanceToPlane <= sliceThickness * 2.0) {
                ctx.save();
                ctx.strokeStyle = '#38bdf8';
                ctx.lineWidth = 1.5;
                ctx.setLineDash([2, 2]);

                ctx.beginPath();
                ctx.moveTo(canvasPt.x - 12, canvasPt.y);
                ctx.lineTo(canvasPt.x + 12, canvasPt.y);
                ctx.moveTo(canvasPt.x, canvasPt.y - 12);
                ctx.lineTo(canvasPt.x + 12, canvasPt.y);
                ctx.stroke();

                ctx.setLineDash([]);
                ctx.beginPath();
                ctx.arc(canvasPt.x, canvasPt.y, 6, 0, 2 * Math.PI);
                ctx.stroke();

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
    [viewports, studies, activeTool, activeViewportIndex]
  );

  // Close Open ROI Helper (And Deactivate ROI Tool)
  const closeOpenRoi = useCallback((openRoi: LengthMeasurement, viewportIndex: number) => {
    const element = viewportRefs.current[viewportIndex];
    if (!element || !openRoi.points || openRoi.points.length < 3) return;

    import('cornerstone-core').then((cs) => {
      const cornerstone = cs.default || cs;
      let enabledElement: any;
      try {
        enabledElement = cornerstone.getEnabledElement(element);
      } catch (err) {
        return;
      }
      if (!enabledElement || !enabledElement.image) return;

      const vpState = viewports[viewportIndex];
      const study = studies.find((s) => s.studyInstanceUID === vpState?.studyInstanceUID);
      const series = study?.series.find((s) => s.seriesInstanceUID === vpState?.seriesInstanceUID);
      const activeInstance = series?.instances[vpState?.imageIndex ?? 0];

      let pts = [...(openRoi.points || [])];
      if (pts.length > 3) {
        const last = pts[pts.length - 1];
        const secondLast = pts[pts.length - 2];
        if (Math.hypot(last.x - secondLast.x, last.y - secondLast.y) < 5) {
          pts = pts.slice(0, -1);
        }
      }

      const stats = calculateRoiStatistics(
        pts,
        enabledElement.image,
        activeInstance?.metadata.pixelSpacing
      );

      setMeasurements((prev) => {
        const next = prev.map((m) =>
          m.id === openRoi.id
            ? {
                ...m,
                points: pts,
                isClosed: true,
                area: stats.area,
                mean: stats.mean,
                stdDev: stats.stdDev,
                min: stats.min,
                max: stats.max,
              }
            : m
        );
        measurementsRef.current = next;
        return next;
      });

      // Deactivate ROI tool after closing polygon
      setActiveTool('none');
      drawMeasurements(element, viewportIndex);
    });
  }, [viewports, studies, drawMeasurements]);

  // Helper to compute base fit-to-window scale for an element and image
  const computeFitScale = (element: HTMLElement, image: any): number => {
    if (!element || !image || !image.width || !image.height) return 1.0;
    const w = element.clientWidth || element.offsetWidth || 1;
    const h = element.clientHeight || element.offsetHeight || 1;
    return Math.min(w / image.width, h / image.height);
  };

  // Snapshot current transforms (relative zoom ratio, translation, VOI) for all active viewports
  const snapshotViewportTransforms = useCallback(() => {
    import('cornerstone-core').then((cs) => {
      const cornerstone = cs.default || cs;
      viewportRefs.current.forEach((el, idx) => {
        if (el) {
          try {
            const enabled = cornerstone.getEnabledElement(el);
            if (enabled && enabled.viewport && enabled.image) {
              const fitScale = computeFitScale(el, enabled.image);
              const zoomRatio = fitScale > 0 ? (enabled.viewport.scale ?? 1.0) / fitScale : 1.0;
              savedViewportTransformsRef.current.set(idx, {
                zoomRatio,
                translation: { ...(enabled.viewport.translation ?? {x: 0, y: 0}) },
                voi: { windowCenter: (enabled.viewport.voi?.windowCenter ?? 0), windowWidth: (enabled.viewport.voi?.windowWidth ?? 0) },
                rotation: (enabled.viewport.rotation ?? 0),
                hflip: (enabled.viewport.hflip ?? false),
                vflip: (enabled.viewport.vflip ?? false),
              });
            }
          } catch (e) {}
        }
      });
    });
  }, []);

  const toggleMaximize = useCallback((index: number) => {
    snapshotViewportTransforms();
    setMaximizedIndex((prev) => (prev === index ? null : index));
  }, [snapshotViewportTransforms]);

  // Focus Mode / Double Click Toggle Handler (With ROI Close Handling)
  const handleDoubleClick = (e: React.MouseEvent, index: number) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target && target.closest('button, input, textarea, a, select, [role="button"]')) {
      return;
    }

    const vpState = viewports[index];
    const study = studies.find((s) => s.studyInstanceUID === vpState?.studyInstanceUID);
    const series = study?.series.find((s) => s.seriesInstanceUID === vpState?.seriesInstanceUID);
    const activeInstance = series?.instances[vpState?.imageIndex ?? 0];

    const openRoi = measurementsRef.current.find(
      (m) => m.imageId === activeInstance?.imageId && m.type === 'roi' && !m.isClosed
    );

    if (openRoi && openRoi.points && openRoi.points.length >= 3) {
      e.stopPropagation();
      e.preventDefault();
      closeOpenRoi(openRoi, index);
      return;
    }

    if (activeTool === 'roi') {
      return;
    }

    toggleMaximize(index);
  };

  // Rendering Helper: Viewport Canvas Image & Overlays
  const renderViewportImage = useCallback((index: number, instance: DICOMInstance, keepTransforms: boolean = true) => {
    const element = viewportRefs.current[index];
    if (!element || !instance?.imageId) return;

    const currentSeq = ++renderRequestSeqRef.current[index];

    import('cornerstone-core').then((cs) => {
      const cornerstone = cs.default || cs;

      try {
        cornerstone.getEnabledElement(element);
      } catch (e) {
        try {
          cornerstone.enable(element);
        } catch (err) {
          return;
        }
      }

      const savedTransform = savedViewportTransformsRef.current.get(index);

      cornerstone
        .loadImage(instance.imageId)
        .then((image: any) => {
          if (currentSeq !== renderRequestSeqRef.current[index]) {
            return;
          }

          const fitScale = computeFitScale(element, image);

          if (savedTransform && keepTransforms) {
            cornerstone.displayImage(element, image);
            const currentVp = cornerstone.getViewport(element);
            if (currentVp) {
              currentVp.translation.x = savedTransform.translation.x;
              currentVp.translation.y = savedTransform.translation.y;
              currentVp.scale = fitScale * (savedTransform.zoomRatio || 1.0);
              currentVp.voi.windowCenter = savedTransform.voi.windowCenter;
              currentVp.voi.windowWidth = savedTransform.voi.windowWidth;
              if (savedTransform.rotation !== undefined) currentVp.rotation = savedTransform.rotation;
              if (savedTransform.hflip !== undefined) currentVp.hflip = savedTransform.hflip;
              if (savedTransform.vflip !== undefined) currentVp.vflip = savedTransform.vflip;
              cornerstone.setViewport(element, currentVp);
            }
          } else {
            // Fresh series load / drop: Apply the new series' own native default LUT & VOI
            const defaultVp = cornerstone.getDefaultViewportForImage(element, image);
            cornerstone.displayImage(element, image, defaultVp);
            cornerstone.fitToWindow(element);
            try {
              const fitVp = cornerstone.getViewport(element);
              if (fitVp) {
                savedViewportTransformsRef.current.set(index, {
                  zoomRatio: 1.0,
                  translation: { ...fitVp.translation },
                  voi: { windowCenter: fitVp.voi.windowCenter, windowWidth: fitVp.voi.windowWidth },
                  rotation: fitVp.rotation || 0,
                  hflip: fitVp.hflip || false,
                  vflip: fitVp.vflip || false,
                });
              }
            } catch (e) {}
          }

          drawMeasurements(element, index);

          try {
            const vp = cornerstone.getViewport(element);
            const hudEl = document.getElementById(`overlay-wl-zoom-${index}`);
            if (hudEl && vp) {
              const activeRatio = fitScale > 0 ? vp.scale / fitScale : 1.0;
              hudEl.innerText = `WL: ${Math.round(vp.voi.windowCenter)} WW: ${Math.round(vp.voi.windowWidth)} • Zoom: ${(activeRatio * 100).toFixed(0)}%`;
            }
          } catch (e) {}
        })
        .catch((err: any) => {
          console.warn('Failed to load viewport image:', err);
        });
    });
  }, [drawMeasurements]);

  // Synchronized Scrolling across Parallel / Comparative Series
  const syncScrollToImage = useCallback((sourceViewportIndex: number, newImageIndex: number) => {
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
  }, [viewports, studies, renderViewportImage]);

  // Initialize Cornerstone & WADO Image Loader
  useEffect(() => {
    initCornerstone();
  }, []);

  // Quick Layout Handler for Multi-Selected Viewports (Ctrl+Click 1..4 viewports -> 1x1, 1x2, 1x3, 2x2)
  const handleQuickLayout = useCallback(() => {
    if (selectedViewports.length === 0 || selectedViewports.length > 4) return;
    const count = selectedViewports.length;
    const newLayout = createQuickLayout(count);

    // Map existing live & saved transforms from srcIdx to targetIdx
    const newTransforms = new Map<number, {
      zoomRatio: number;
      translation: { x: number; y: number };
      voi: { windowCenter: number; windowWidth: number };
      rotation?: number;
      hflip?: boolean;
      vflip?: boolean;
    }>();

    import('cornerstone-core').then((cs) => {
      const cornerstone = cs.default || cs;

      selectedViewports.forEach((srcIdx, targetIdx) => {
        const srcEl = viewportRefs.current[srcIdx];
        let srcTransform: any = null;

        if (srcEl) {
          try {
            const enabled = cornerstone.getEnabledElement(srcEl);
            if (enabled && enabled.viewport && enabled.image) {
              const fitScale = computeFitScale(srcEl, enabled.image);
              const zoomRatio = fitScale > 0 ? (enabled.viewport.scale ?? 1.0) / fitScale : 1.0;
              srcTransform = {
                zoomRatio,
                translation: { ...(enabled.viewport.translation ?? {x: 0, y: 0}) },
                voi: { windowCenter: (enabled.viewport.voi?.windowCenter ?? 0), windowWidth: (enabled.viewport.voi?.windowWidth ?? 0) },
                rotation: (enabled.viewport.rotation ?? 0),
                hflip: (enabled.viewport.hflip ?? false),
                vflip: (enabled.viewport.vflip ?? false),
              };
            }
          } catch (e) {}
        }

        if (!srcTransform) {
          srcTransform = savedViewportTransformsRef.current.get(srcIdx) || null;
        }

        if (srcTransform) {
          newTransforms.set(targetIdx, srcTransform);
        }
      });

      panelSizesRef.current.clear();
      setPanelSizesMap(new Map());
      savedViewportTransformsRef.current = newTransforms;

      const newViewports = createDefaultViewports(MAX_VIEWPORTS);
      selectedViewports.forEach((srcIdx, targetIdx) => {
        newViewports[targetIdx] = { ...viewports[srcIdx] };
      });

      lastRenderedKeyRef.current = Array(MAX_VIEWPORTS).fill('');
      setLayoutTree(newLayout);
      setViewports(newViewports);
      setSelectedViewports([]);
      setMaximizedIndex(null);
      setActiveViewportIndex(0);
    });
  }, [selectedViewports, viewports]);

  // Keyboard Hotkeys Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      if (e.key === 'Control' || e.key === 'Meta') {
        if (!ctrlPressedRef.current) {
          ctrlPressedRef.current = true;
          didInteractWithCtrlRef.current = false;
        }
      } else if (ctrlPressedRef.current) {
        didInteractWithCtrlRef.current = true;
      }

      const key = e.key.toLowerCase();
      if (key === 'w') {
        handleSelectTool(activeTool === 'wwc' ? 'none' : 'wwc');
      } else if (key === 'p') {
        handleSelectTool(activeTool === 'pan' ? 'none' : 'pan');
      } else if (key === 'z') {
        handleSelectTool(activeTool === 'zoom' ? 'none' : 'zoom');
      } else if (key === 'l') {
        handleSelectTool(activeTool === 'length' ? 'none' : 'length');
      } else if (key === 'a') {
        handleSelectTool(activeTool === 'angle' ? 'none' : 'angle');
      } else if (key === 'r') {
        handleSelectTool(activeTool === 'roi' ? 'none' : 'roi');
      } else if (key === 'd') {
        handleSelectTool(activeTool === 'pixel' ? 'none' : 'pixel');
      } else if (key === 'enter') {
        if (selectedViewports.length >= 1 && selectedViewports.length <= 4) {
          e.preventDefault();
          handleQuickLayout();
        }
      } else if (key === 'escape') {
        setSelectedViewports([]);
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

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Control' || e.key === 'Meta') {
        ctrlPressedRef.current = false;
        if (!didInteractWithCtrlRef.current) {
          // Simple Ctrl tap down & up resets the multi-selection
          setSelectedViewports([]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [activeViewportIndex, viewports, studies, drawMeasurements, activeTool, selectedViewports, handleQuickLayout, syncScrollToImage]);

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
          const latestVersion = data.tag_name ? data.tag_name.replace(/^v/, '') : null;
          if (latestVersion && latestVersion !== currentVersion) {
            setUpdateAvailable({ version: latestVersion, url: data.html_url });
          }
        }
      } catch (err) {}
    };
    checkUpdate();
  }, []);

  // Sync cornerstone canvas size with window resizing and container transitions
  useEffect(() => {
    const handleResize = () => {
      import('cornerstone-core').then((cs) => {
        const cornerstone = cs.default || cs;
        viewportRefs.current.forEach((el, idx) => {
          if (el) {
            try {
              cornerstone.resize(el);
              drawMeasurements(el, idx);
            } catch (e) {}
          }
        });
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [drawMeasurements]);

  // Essential Refresh Fix: Re-render images when layoutTree or maximizedIndex changes
  useEffect(() => {
    lastRenderedKeyRef.current = Array(MAX_VIEWPORTS).fill('');
    const timer = setTimeout(() => {
      import('cornerstone-core').then((cs) => {
        const cornerstone = cs.default || cs;
        viewports.forEach((vp, index) => {
          const el = viewportRefs.current[index];
          if (el) {
            try {
              cornerstone.resize(el);
            } catch (e) {}
            if (vp.studyInstanceUID && vp.seriesInstanceUID) {
              const study = studies.find((s) => s.studyInstanceUID === vp.studyInstanceUID);
              const series = study?.series.find((s) => s.seriesInstanceUID === vp.seriesInstanceUID);
              const instance = series?.instances[vp.imageIndex];
              if (instance) {
                renderViewportImage(index, instance, true);
              }
            }
          }
        });
      });
    }, 60);
    return () => clearTimeout(timer);
  }, [layoutTree, maximizedIndex, studies, viewports, drawMeasurements, renderViewportImage]);

  useEffect(() => {
    const timer = setTimeout(() => {
      import('cornerstone-core').then((cs) => {
        const cornerstone = cs.default || cs;
        viewportRefs.current.forEach((el, idx) => {
          if (el) {
            try {
              cornerstone.resize(el);
              drawMeasurements(el, idx);
            } catch (e) {}
          }
        });
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [isSidebarOpen, drawMeasurements]);

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
  }, [viewports, studies, layoutTree, renderViewportImage]);

  // Layout Actions
  const handleSplitViewport = (nodeId: string, direction: 'horizontal' | 'vertical') => {
    if (!canSplitNode(layoutTree, nodeId, direction)) return;
    setLayoutTree((prev) => splitViewportNode(prev, nodeId, direction));
  };

  const handleCloseViewport = (nodeId: string) => {
    const newTree = closeViewportNode(layoutTree, nodeId);
    if (newTree) setLayoutTree(newTree);
  };

  const handleApplyLayoutPreset = (preset: LayoutNode) => {
    panelSizesRef.current.clear();
    setPanelSizesMap(new Map());
    setMaximizedIndex(null);
    setLayoutTree(preset);
    setIsLayoutMenuOpen(false);
  };

  const handleRevertHangingProtocol = () => {
    panelSizesRef.current.clear();
    setPanelSizesMap(new Map());
    savedViewportTransformsRef.current.clear();
    setMaximizedIndex(null);
    setSelectedViewports([]);
    lastRenderedKeyRef.current = Array(MAX_VIEWPORTS).fill('');

    if (initialHangingProtocol) {
      setLayoutTree(initialHangingProtocol.layout);
      setViewports(initialHangingProtocol.viewports);

      setTimeout(() => {
        import('cornerstone-core').then((cs) => {
          const cornerstone = cs.default || cs;
          viewportRefs.current.forEach((el, index) => {
            if (el) {
              try {
                cornerstone.fitToWindow(el);
                drawMeasurements(el, index);
              } catch (e) {}
            }
          });
        });
      }, 50);
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
      if (!enabledElement || !enabledElement.image || !enabledElement.viewport) return;

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

          // 3D Crosshair Interactive Localization
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

      viewportRefs.current.forEach((el, idx) => {
        if (el) drawMeasurements(el, idx);
      });
    });
  };

  // Pointer Interaction Handlers (Multi-Button Mouse Chords & Measurement Editing)
  const handlePointerDown = (e: React.PointerEvent, index: number) => {
    const target = e.target as HTMLElement;
    if (
      target &&
      (target.closest('[data-panel-resize-handle-id], [data-panel-group] > [role="separator"], [role="separator"], .resize-handle') ||
        (target as any).hasAttribute?.('data-panel-resize-handle-id'))
    ) {
      return;
    }

    // Multi-Viewport Selection with Ctrl (or Meta/Cmd) Click
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      e.stopPropagation();
      didInteractWithCtrlRef.current = true;
      setSelectedViewports((prev) => {
        if (prev.includes(index)) {
          return prev.filter((i) => i !== index);
        }
        if (prev.length >= 4) {
          return prev;
        }
        return [...prev, index];
      });
      return;
    }

    setActiveViewportIndex(index);
    // Close toolbar menus when interacting with a viewport
    setIsTrashOpen(false);
    setIsLayoutMenuOpen(false);

    const element = viewportRefs.current[index];
    if (!element) return;

    isPointerDraggingRef.current = true;
    (element as any).setPointerCapture?.(e.pointerId);

    const vpState = viewports[index];
    const study = studies.find((s) => s.studyInstanceUID === vpState?.studyInstanceUID);
    const series = study?.series.find((s) => s.seriesInstanceUID === vpState?.seriesInstanceUID);
    const activeInstance = series?.instances[vpState?.imageIndex ?? 0];

    const startX = e.clientX;
    const startY = e.clientY;

    import('cornerstone-core').then((cs) => {
      const cornerstone = cs.default || cs;
      let enabledElement: any;
      try {
        enabledElement = cornerstone.getEnabledElement(element);
      } catch (err) {
        return;
      }
      if (!enabledElement || !enabledElement.image || !enabledElement.viewport) return;

      const rect = element.getBoundingClientRect();
      const canvasX = e.clientX - rect.left;
      const canvasY = e.clientY - rect.top;
      const imagePt = cornerstone.canvasToPixel(element, { x: canvasX, y: canvasY } as any);

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

      // Fast Linking / Syncing: Capture initial states of all other selected viewports
      const currentSelected = selectedViewportsRef.current;
      const isCurrentLinked = currentSelected.includes(index) && currentSelected.length >= 2;
      const initialLinkedStates: {
        [idx: number]: {
          element: HTMLElement;
          scale: number;
          translation: { x: number; y: number };
          voi: { windowCenter: number; windowWidth: number };
        };
      } = {};

      if (isCurrentLinked) {
        currentSelected.forEach((otherIdx) => {
          if (otherIdx !== index) {
            const otherEl = viewportRefs.current[otherIdx];
            if (otherEl) {
              try {
                const oVp = cornerstone.getViewport(otherEl);
                if (oVp) {
                  initialLinkedStates[otherIdx] = {
                    element: otherEl,
                    scale: oVp.scale,
                    translation: { ...oVp.translation },
                    voi: { windowCenter: oVp.voi.windowCenter, windowWidth: oVp.voi.windowWidth },
                  };
                }
              } catch (e) {}
            }
          }
        });
      }

      let initialAction: string | null = null;
      let currentDraggingPoint: { id: string; point: string; isNew: boolean; lastPt?: any } | null = null;

      let isChordZooming = false;
      let chordZoomStartY = startY;
      let chordZoomInitialScale = initialScale;

      if (e.buttons === 3) {
        initialAction = 'zoom';
        isChordZooming = true;
      } else if (e.buttons === 4) {
        initialAction = 'pan';
      } else if (e.buttons === 2) {
        initialAction = 'wwc';
      } else if (e.buttons === 1) {
        const threshold = 12 / (vp.scale || 1);
        const closeThreshold = Math.max(16, 16 / (vp.scale || 1));

        // 1. Check if clicking on an existing measurement handle, badge or line
        let hitItem: { id: string; point: string; lastPt: Point } | null = null;
        const currentMeasList = measurementsRef.current;

        for (const m of currentMeasList) {
          if (m.imageId !== activeInstance?.imageId) continue;

          if (m.type === 'roi' && m.points) {
            // Check if user is clicking near start point of an unclosed ROI to close it
            if (!m.isClosed) {
              const firstPt = m.points[0];
              const distToFirst = Math.hypot(firstPt.x - imagePt.x, firstPt.y - imagePt.y);
              if (distToFirst < closeThreshold && m.points.length >= 3) {
                closeOpenRoi(m, index);
                return;
              }
              continue;
            }

            for (let pi = 0; pi < m.points.length; pi++) {
              const p = m.points[pi];
              if (Math.hypot(p.x - imagePt.x, p.y - imagePt.y) < threshold) {
                hitItem = { id: m.id, point: `point_${pi}`, lastPt: imagePt };
                break;
              }
            }
            if (hitItem) break;

            if (m.isClosed) {
              let inside = false;
              for (let i = 0, j = m.points.length - 1; i < m.points.length; j = i++) {
                const xi = m.points[i].x,
                  yi = m.points[i].y;
                const xj = m.points[j].x,
                  yj = m.points[j].y;
                const intersect =
                  yi > imagePt.y !== yj > imagePt.y &&
                  imagePt.x < ((xj - xi) * (imagePt.y - yi)) / (yj - yi) + xi;
                if (intersect) inside = !inside;
              }
              if (inside) {
                hitItem = { id: m.id, point: 'line', lastPt: imagePt };
                break;
              }
            }
          } else if (m.type === 'angle') {
            // Check line 2 start / end handles
            if (m.start2 && m.end2) {
              if (Math.hypot(m.start2.x - imagePt.x, m.start2.y - imagePt.y) < threshold) {
                hitItem = { id: m.id, point: 'start2', lastPt: imagePt };
                break;
              } else if (Math.hypot(m.end2.x - imagePt.x, m.end2.y - imagePt.y) < threshold) {
                hitItem = { id: m.id, point: 'end2', lastPt: imagePt };
                break;
              }
            }
            // Check line 1 start / end handles
            if (m.start && m.end) {
              if (Math.hypot(m.start.x - imagePt.x, m.start.y - imagePt.y) < threshold) {
                hitItem = { id: m.id, point: 'start', lastPt: imagePt };
                break;
              } else if (Math.hypot(m.end.x - imagePt.x, m.end.y - imagePt.y) < threshold) {
                hitItem = { id: m.id, point: 'end', lastPt: imagePt };
                break;
              }
            }
            // Check line 2 body or center circular badge
            if (m.start2 && m.end2 && distanceToSegment(imagePt, m.start2, m.end2) < threshold) {
              hitItem = { id: m.id, point: 'line2', lastPt: imagePt };
              break;
            }
            // Check line 1 body or center circular badge
            if (m.start && m.end && distanceToSegment(imagePt, m.start, m.end) < threshold) {
              hitItem = { id: m.id, point: 'line', lastPt: imagePt };
              break;
            }
          } else if (m.start && m.end) {
            // Length start / end handles
            if (Math.hypot(m.start.x - imagePt.x, m.start.y - imagePt.y) < threshold) {
              hitItem = { id: m.id, point: 'start', lastPt: imagePt };
              break;
            } else if (Math.hypot(m.end.x - imagePt.x, m.end.y - imagePt.y) < threshold) {
              hitItem = { id: m.id, point: 'end', lastPt: imagePt };
              break;
            } else if (distanceToSegment(imagePt, m.start, m.end) < threshold) {
              // Clicking line body or center badge translates length
              hitItem = { id: m.id, point: 'line', lastPt: imagePt };
              break;
            }
          }
        }

        if (hitItem) {
          currentDraggingPoint = { id: hitItem.id, point: hitItem.point, isNew: false, lastPt: hitItem.lastPt };
          setDraggingPoint(currentDraggingPoint);
          initialAction = 'drag_measurement';
        } else if (activeTool === 'roi') {
          initialAction = 'roi';
          const openRoi = currentMeasList.find(
            (m) => m.imageId === activeInstance?.imageId && m.type === 'roi' && !m.isClosed
          );
          if (openRoi && openRoi.points && openRoi.points.length > 0) {
            const firstPt = openRoi.points[0];
            const distToFirst = Math.hypot(firstPt.x - imagePt.x, firstPt.y - imagePt.y);
            if (distToFirst < closeThreshold && openRoi.points.length >= 3) {
              closeOpenRoi(openRoi, index);
              return;
            } else {
              setMeasurements((prev) => {
                const next = prev.map((m) =>
                  m.id === openRoi.id ? { ...m, points: [...m.points!, { ...imagePt }] } : m
                );
                measurementsRef.current = next;
                return next;
              });
            }
            drawMeasurements(element, index);
            return;
          } else if (activeInstance?.imageId) {
            const newId = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
            const newMeas: LengthMeasurement = {
              id: newId,
              imageId: activeInstance.imageId,
              type: 'roi',
              start: { ...imagePt },
              end: { ...imagePt },
              points: [{ ...imagePt }],
              isClosed: false,
            };
            setMeasurements((prev) => {
              const next = [...prev, newMeas];
              measurementsRef.current = next;
              return next;
            });
            drawMeasurements(element, index);
            return;
          }
        } else if (activeTool === 'angle' && activeInstance?.imageId) {
          initialAction = 'angle';
          const incompleteAngle = currentMeasList.find(
            (m) => m.imageId === activeInstance.imageId && m.type === 'angle' && (!m.start2 || !m.end2)
          );
          if (incompleteAngle) {
            setMeasurements((prev) => {
              const next = prev.map((m) =>
                m.id === incompleteAngle.id
                  ? { ...m, start2: { ...imagePt }, end2: { ...imagePt } }
                  : m
              );
              measurementsRef.current = next;
              return next;
            });
            currentDraggingPoint = { id: incompleteAngle.id, point: 'end2', isNew: true };
            setDraggingPoint(currentDraggingPoint);
          } else {
            const newId = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
            const newMeas: LengthMeasurement = {
              id: newId,
              imageId: activeInstance.imageId,
              type: 'angle',
              start: { ...imagePt },
              end: { ...imagePt },
            };
            setMeasurements((prev) => {
              const next = [...prev, newMeas];
              measurementsRef.current = next;
              return next;
            });
            currentDraggingPoint = { id: newId, point: 'end', isNew: true };
            setDraggingPoint(currentDraggingPoint);
          }
        } else if (activeTool === 'length' && activeInstance?.imageId) {
          initialAction = 'length';
          const newId = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          const newMeas: LengthMeasurement = {
            id: newId,
            imageId: activeInstance.imageId,
            type: 'length',
            start: { ...imagePt },
            end: { ...imagePt },
          };
          setMeasurements((prev) => {
            const next = [...prev, newMeas];
            measurementsRef.current = next;
            return next;
          });
          currentDraggingPoint = { id: newId, point: 'end', isNew: true };
          setDraggingPoint(currentDraggingPoint);
        } else {
          initialAction = activeTool;
        }
      }

      if (initialAction === 'pan') {
        panningViewportIndexRef.current = index;
        drawMeasurements(element, index);
      } else if (initialAction === 'pixel') {
        updatePixelProbe(element, index, e.clientX, e.clientY);
      }

      const handleMove = (moveEvt: PointerEvent) => {
        if (!isPointerDraggingRef.current) return;

        let action: string | null = null;
        if (moveEvt.buttons === 3 || isChordZooming) {
          action = 'zoom';
          if (!isChordZooming) {
            isChordZooming = true;
            chordZoomStartY = moveEvt.clientY;
            chordZoomInitialScale = vp.scale;
            Object.entries(initialLinkedStates).forEach(([linkedIdxStr, init]) => {
              try {
                const lVp = cornerstone.getViewport(init.element);
                if (lVp) init.scale = lVp.scale;
              } catch (e) {}
            });
          }
        } else if (moveEvt.buttons === 4) {
          action = 'pan';
        } else if (moveEvt.buttons === 2) {
          action = 'wwc';
        } else if (moveEvt.buttons === 1) {
          if (currentDraggingPoint) {
            action = 'drag_measurement';
          } else {
            action = activeTool;
          }
        }

        const deltaX = moveEvt.clientX - startX;
        const deltaY = moveEvt.clientY - startY;

        const fitScale = computeFitScale(element, enabledElement.image);
        const currentZoomRatio = fitScale > 0 ? vp.scale / fitScale : 1.0;

        if (action === 'zoom') {
          const effectiveDeltaY = isChordZooming ? moveEvt.clientY - chordZoomStartY : deltaY;
          const effectiveBaseScale = isChordZooming ? chordZoomInitialScale : initialScale;
          const zoomFactor = Math.pow(1.015, -effectiveDeltaY);
          vp.scale = Math.max(0.05, Math.min(20.0, effectiveBaseScale * zoomFactor));
          cornerstone.setViewport(element, vp);

          const updatedRatio = fitScale > 0 ? vp.scale / fitScale : 1.0;
          savedViewportTransformsRef.current.set(index, {
            zoomRatio: updatedRatio,
            translation: { ...vp.translation },
            voi: { windowCenter: vp.voi.windowCenter, windowWidth: vp.voi.windowWidth },
            rotation: vp.rotation,
            hflip: vp.hflip,
            vflip: vp.vflip,
          });

          // Fast Linking: Sync Zoom to all other selected viewports
          Object.entries(initialLinkedStates).forEach(([linkedIdxStr, init]) => {
            try {
              const lIdx = parseInt(linkedIdxStr, 10);
              const lVp = cornerstone.getViewport(init.element);
              if (lVp) {
                lVp.scale = Math.max(0.05, Math.min(20.0, init.scale * zoomFactor));
                cornerstone.setViewport(init.element, lVp);
                const lEnabled = cornerstone.getEnabledElement(init.element);
                const lFit = lEnabled ? computeFitScale(init.element, lEnabled.image) : 1.0;
                const lRatio = lFit > 0 ? lVp.scale / lFit : 1.0;
                savedViewportTransformsRef.current.set(lIdx, {
                  zoomRatio: lRatio,
                  translation: { ...lVp.translation },
                  voi: { windowCenter: lVp.voi.windowCenter, windowWidth: lVp.voi.windowWidth },
                  rotation: lVp.rotation,
                  hflip: lVp.hflip,
                  vflip: lVp.vflip,
                });
                drawMeasurements(init.element, lIdx);
                const lHud = document.getElementById(`overlay-wl-zoom-${linkedIdxStr}`);
                if (lHud) {
                  lHud.innerText = `WL: ${Math.round(lVp.voi.windowCenter)} WW: ${Math.round(lVp.voi.windowWidth)} • Zoom: ${(lRatio * 100).toFixed(0)}%`;
                }
              }
            } catch (e) {}
          });
        } else if (action === 'pan') {
          vp.translation.x = initialTranslation.x + deltaX / vp.scale;
          vp.translation.y = initialTranslation.y + deltaY / vp.scale;
          cornerstone.setViewport(element, vp);
          panningViewportIndexRef.current = index;
          savedViewportTransformsRef.current.set(index, {
            zoomRatio: currentZoomRatio,
            translation: { ...vp.translation },
            voi: { windowCenter: vp.voi.windowCenter, windowWidth: vp.voi.windowWidth },
            rotation: vp.rotation,
            hflip: vp.hflip,
            vflip: vp.vflip,
          });

          // Fast Linking: Sync Pan to all other selected viewports
          Object.entries(initialLinkedStates).forEach(([linkedIdxStr, init]) => {
            try {
              const lIdx = parseInt(linkedIdxStr, 10);
              const lVp = cornerstone.getViewport(init.element);
              if (lVp) {
                lVp.translation.x = init.translation.x + deltaX / lVp.scale;
                lVp.translation.y = init.translation.y + deltaY / lVp.scale;
                cornerstone.setViewport(init.element, lVp);
                const lEnabled = cornerstone.getEnabledElement(init.element);
                const lFit = lEnabled ? computeFitScale(init.element, lEnabled.image) : 1.0;
                const lRatio = lFit > 0 ? lVp.scale / lFit : 1.0;
                savedViewportTransformsRef.current.set(lIdx, {
                  zoomRatio: lRatio,
                  translation: { ...lVp.translation },
                  voi: { windowCenter: lVp.voi.windowCenter, windowWidth: lVp.voi.windowWidth },
                  rotation: lVp.rotation,
                  hflip: lVp.hflip,
                  vflip: lVp.vflip,
                });
                drawMeasurements(init.element, lIdx);
              }
            } catch (e) {}
          });
        } else if (action === 'wwc') {
          panningViewportIndexRef.current = null;
          const multiplier = Math.max(initialWidth / 256, 1);
          vp.voi.windowWidth = Math.max(1, initialWidth - deltaX * multiplier);
          vp.voi.windowCenter = initialCenter + deltaY * multiplier;
          cornerstone.setViewport(element, vp);
          savedViewportTransformsRef.current.set(index, {
            zoomRatio: currentZoomRatio,
            translation: { ...vp.translation },
            voi: { windowCenter: vp.voi.windowCenter, windowWidth: vp.voi.windowWidth },
            rotation: vp.rotation,
            hflip: vp.hflip,
            vflip: vp.vflip,
          });

          // Fast Linking: Sync WW/WL to all other selected viewports
          Object.entries(initialLinkedStates).forEach(([linkedIdxStr, init]) => {
            try {
              const lIdx = parseInt(linkedIdxStr, 10);
              const lVp = cornerstone.getViewport(init.element);
              if (lVp) {
                const lMultiplier = Math.max(init.voi.windowWidth / 256, 1);
                lVp.voi.windowWidth = Math.max(1, init.voi.windowWidth - deltaX * lMultiplier);
                lVp.voi.windowCenter = init.voi.windowCenter + deltaY * lMultiplier;
                cornerstone.setViewport(init.element, lVp);
                const lEnabled = cornerstone.getEnabledElement(init.element);
                const lFit = lEnabled ? computeFitScale(init.element, lEnabled.image) : 1.0;
                const lRatio = lFit > 0 ? lVp.scale / lFit : 1.0;
                savedViewportTransformsRef.current.set(lIdx, {
                  zoomRatio: lRatio,
                  translation: { ...lVp.translation },
                  voi: { windowCenter: lVp.voi.windowCenter, windowWidth: lVp.voi.windowWidth },
                  rotation: lVp.rotation,
                  hflip: lVp.hflip,
                  vflip: lVp.vflip,
                });
                const lHud = document.getElementById(`overlay-wl-zoom-${linkedIdxStr}`);
                if (lHud) {
                  lHud.innerText = `WL: ${Math.round(lVp.voi.windowCenter)} WW: ${Math.round(lVp.voi.windowWidth)} • Zoom: ${(lRatio * 100).toFixed(0)}%`;
                }
              }
            } catch (e) {}
          });
        } else if (action === 'pixel') {
          panningViewportIndexRef.current = null;
          updatePixelProbe(element, index, moveEvt.clientX, moveEvt.clientY);
        } else if (action === 'drag_measurement' && currentDraggingPoint) {
          const moveRect = element.getBoundingClientRect();
          let currImagePt = cornerstone.canvasToPixel(element, {
            x: moveEvt.clientX - moveRect.left,
            y: moveEvt.clientY - moveRect.top,
          } as any);

          if (moveEvt.shiftKey) {
            const targetM = measurementsRef.current.find((m) => m.id === currentDraggingPoint?.id);
            if (targetM) {
              let refPt: Point | null = null;
              if (currentDraggingPoint.point === 'end') refPt = targetM.start;
              else if (currentDraggingPoint.point === 'start') refPt = targetM.end;
              else if (currentDraggingPoint.point === 'end2') refPt = targetM.start2 || null;
              else if (currentDraggingPoint.point === 'start2') refPt = targetM.end2 || null;

              if (refPt) {
                const dx = Math.abs(currImagePt.x - refPt.x);
                const dy = Math.abs(currImagePt.y - refPt.y);
                if (dx > dy) {
                  currImagePt.y = refPt.y;
                } else {
                  currImagePt.x = refPt.x;
                }
              }
            }
          }

          let hoverTrash = false;
          try {
            const elementsUnder = document.elementsFromPoint(moveEvt.clientX, moveEvt.clientY);
            hoverTrash = elementsUnder.some((el) => el.id === 'trash-icon' || el.closest('#trash-icon'));
          } catch (err) {}
          isDraggingOverTrashRef.current = hoverTrash;
          setIsDraggingOverTrash(hoverTrash);

          if (currentDraggingPoint.point === 'line') {
            const dx = currImagePt.x - currentDraggingPoint.lastPt.x;
            const dy = currImagePt.y - currentDraggingPoint.lastPt.y;
            currentDraggingPoint.lastPt = currImagePt;

            setMeasurements((prev) => {
              const next = prev.map((m) => {
                if (m.id === currentDraggingPoint?.id) {
                  if (m.type === 'roi' && m.points) {
                    return {
                      ...m,
                      points: m.points.map((pt) => ({ x: pt.x + dx, y: pt.y + dy })),
                    };
                  }
                  return {
                    ...m,
                    start: { x: m.start.x + dx, y: m.start.y + dy },
                    end: { x: m.end.x + dx, y: m.end.y + dy },
                  };
                }
                return m;
              });
              measurementsRef.current = next;
              return next;
            });
          } else if (currentDraggingPoint.point === 'line2') {
            const dx = currImagePt.x - currentDraggingPoint.lastPt.x;
            const dy = currImagePt.y - currentDraggingPoint.lastPt.y;
            currentDraggingPoint.lastPt = currImagePt;

            setMeasurements((prev) => {
              const next = prev.map((m) => {
                if (m.id === currentDraggingPoint?.id && m.start2 && m.end2) {
                  return {
                    ...m,
                    start2: { x: m.start2.x + dx, y: m.start2.y + dy },
                    end2: { x: m.end2.x + dx, y: m.end2.y + dy },
                  };
                }
                return m;
              });
              measurementsRef.current = next;
              return next;
            });
          } else if (currentDraggingPoint.point.startsWith('point_')) {
            const ptIdx = parseInt(currentDraggingPoint.point.replace('point_', ''), 10);
            setMeasurements((prev) => {
              const next = prev.map((m) => {
                if (m.id === currentDraggingPoint?.id && m.points) {
                  return {
                    ...m,
                    points: m.points.map((pt, idx) => (idx === ptIdx ? { ...currImagePt } : pt)),
                  };
                }
                return m;
              });
              measurementsRef.current = next;
              return next;
            });
          } else {
            const targetProp = currentDraggingPoint.point;
            setMeasurements((prev) => {
              const next = prev.map((m) =>
                m.id === currentDraggingPoint?.id
                  ? { ...m, [targetProp]: { ...currImagePt } }
                  : m
              );
              measurementsRef.current = next;
              return next;
            });
          }
        }

        drawMeasurements(element, index);

        const hudEl = document.getElementById(`overlay-wl-zoom-${index}`);
        if (hudEl) {
          const activeRatio = fitScale > 0 ? vp.scale / fitScale : 1.0;
          hudEl.innerText = `WL: ${Math.round(vp.voi.windowCenter)} WW: ${Math.round(vp.voi.windowWidth)} • Zoom: ${(activeRatio * 100).toFixed(0)}%`;
        }
      };

      const handleUp = (upEvt: PointerEvent) => {
        isPointerDraggingRef.current = false;
        panningViewportIndexRef.current = null;
        if (cursor3DRef.current !== null) {
          cursor3DRef.current = null;
        }

        if (currentDraggingPoint) {
          let droppedOnTrash = isDraggingOverTrashRef.current;
          if (!droppedOnTrash) {
            try {
              const elementsUnder = document.elementsFromPoint(upEvt.clientX, upEvt.clientY);
              droppedOnTrash = elementsUnder.some((el) => el.id === 'trash-icon' || el.closest('#trash-icon'));
            } catch (err) {}
          }

          const targetId = currentDraggingPoint.id;

          if (droppedOnTrash) {
            setMeasurements((prev) => {
              const next = prev.filter((m) => m.id !== targetId);
              measurementsRef.current = next;
              return next;
            });
          } else {
            if (currentDraggingPoint.isNew) {
              if (currentDraggingPoint.point === 'end') {
                setMeasurements((prev) => {
                  const next = prev.filter((m) => {
                    if (m.id === targetId) {
                      return Math.hypot(m.start.x - m.end.x, m.start.y - m.end.y) > 2;
                    }
                    return true;
                  });
                  measurementsRef.current = next;
                  return next;
                });

                // Finish Length measurement -> de-activate tool
                if (activeTool === 'length') {
                  setActiveTool('none');
                }
              } else if (currentDraggingPoint.point === 'end2') {
                setMeasurements((prev) => {
                  const next = prev.map((m) => {
                    if (m.id === targetId && m.start2 && m.end2) {
                      if (Math.hypot(m.start2.x - m.end2.x, m.start2.y - m.end2.y) <= 2) {
                        return { ...m, start2: undefined, end2: undefined };
                      }
                    }
                    return m;
                  });
                  measurementsRef.current = next;
                  return next;
                });

                // Finish Angle measurement (second line placed) -> de-activate tool
                if (activeTool === 'angle') {
                  setActiveTool('none');
                }
              }
            }

            if (currentDraggingPoint.point.startsWith('point_') || currentDraggingPoint.point === 'line') {
              setMeasurements((prev) => {
                const next = prev.map((m) => {
                  if (m.id === targetId && m.type === 'roi' && m.isClosed && m.points) {
                    const stats = calculateRoiStatistics(
                      m.points,
                      enabledElement.image,
                      activeInstance?.metadata.pixelSpacing
                    );
                    return {
                      ...m,
                      area: stats.area,
                      mean: stats.mean,
                      stdDev: stats.stdDev,
                      min: stats.min,
                      max: stats.max,
                    };
                  }
                  return m;
                });
                measurementsRef.current = next;
                return next;
              });
            }
          }

          setDraggingPoint(null);
          isDraggingOverTrashRef.current = false;
          setIsDraggingOverTrash(false);
          currentDraggingPoint = null;
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

  // Pointer Move (Hover Tracking when not dragging)
  const handlePointerMove = (e: React.PointerEvent, index: number) => {
    const element = viewportRefs.current[index];
    if (!element) return;

    mousePosRef.current = { x: e.pageX, y: e.pageY };

    // When no buttons pressed, update hover state & preview lines
    if (e.buttons === 0) {
      if (activeTool === 'roi' || measurementsRef.current.length > 0) {
        drawMeasurements(element, index);
      }
      if (cursor3DRef.current !== null) {
        cursor3DRef.current = null;
        viewportRefs.current.forEach((el, idx) => {
          if (el) drawMeasurements(el, idx);
        });
      }
      return;
    }
  };

  // Scroll Wheel Slice Navigation
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

    setViewports((prev) => {
      const next = [...prev];
      while (next.length <= viewportIndex) {
        next.push({ studyInstanceUID: null, seriesInstanceUID: null, imageIndex: 0 });
      }
      next[viewportIndex] = { studyInstanceUID: studyUID, seriesInstanceUID: seriesUID, imageIndex: 0 };
      return next;
    });

    savedViewportTransformsRef.current.delete(viewportIndex);
    if (series.instances[0]) {
      lastRenderedKeyRef.current[viewportIndex] = `${studyUID}_${seriesUID}_0`;
      renderViewportImage(viewportIndex, series.instances[0], false);
    }
  };

  // Series and Study Ingestion via Worker Pool
  const applyValidInstances = useCallback((validInstances: DICOMInstance[], isReplace: boolean = false) => {
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

    studyMap.forEach((study) => {
      study.series.forEach((series) => {
        series.instances = sortInstancesAnatomically(series.instances);
      });
    });

    const newStudies = Array.from(studyMap.values());
    setStudies(newStudies);

    const protocol = determineHangingProtocol(newStudies);
    if (protocol) {
      setLayoutTree(protocol.layout);
      setViewports(protocol.viewports);
      setInitialHangingProtocol(protocol);
    }
  }, [studies]);

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

  // Full-Screen Drag and Drop Handlers
  const handleRootDragEnter = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('Files') && !e.dataTransfer.types.includes('application/x-dicom-series')) {
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
      const allFiles = fileArrays.flat();
      handleFiles(allFiles, isReplace);
      // Index into Study Browser SQLite DB asynchronously in background
      uploadDicomFilesToBrowser(allFiles).catch((err) => {
        console.warn('Background study browser sync error:', err);
      });
    } else if (dataTransfer.files && dataTransfer.files.length > 0) {
      const allFiles = Array.from(dataTransfer.files);
      handleFiles(allFiles, isReplace);
      // Index into Study Browser SQLite DB asynchronously in background
      uploadDicomFilesToBrowser(allFiles).catch((err) => {
        console.warn('Background study browser sync error:', err);
      });
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const allFiles = Array.from(e.target.files);
      handleFiles(allFiles);
      uploadDicomFilesToBrowser(allFiles).catch((err) => {
        console.warn('Background study browser sync error:', err);
      });
      e.target.value = '';
    }
  };

  // Auto-load study or series from Study Browser via URL query params
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const urlParams = new URLSearchParams(window.location.search);
    const seriesUids = urlParams.get('seriesUids') || urlParams.get('series');
    const studyUids = urlParams.get('studyUids') || urlParams.get('studies');
    const studyUid = urlParams.get('studyUid');
    const seriesUid = urlParams.get('seriesUid');

    if (!seriesUids && !studyUids && !studyUid && !seriesUid) return;

    const loadFromBrowser = async () => {
      try {
        setIsParsing(true);
        let endpoint = '';
        if (seriesUids || studyUids) {
          const params = new URLSearchParams();
          if (seriesUids) params.set('seriesUids', seriesUids);
          if (studyUids) params.set('studyUids', studyUids);
          endpoint = `/api/browser/instances?${params.toString()}`;
        } else if (studyUid) {
          endpoint = `/api/browser/study/${encodeURIComponent(studyUid)}`;
        } else if (seriesUid) {
          endpoint = `/api/browser/series/${encodeURIComponent(seriesUid)}`;
        }

        const res = await fetch(endpoint);
        if (!res.ok) throw new Error('Failed to fetch instances from browser API');
        const data = await res.json();
        const instances: Array<{ filePath: string; sopInstanceUid: string }> = data.instances || [];

        if (instances.length === 0) return;

        setParseProgress({ processed: 0, total: instances.length });

        const filePromises = instances.map(async (inst, idx) => {
          try {
            const fileRes = await fetch(`/api/browser/file?path=${encodeURIComponent(inst.filePath)}`);
            if (!fileRes.ok) {
              console.warn(`Could not load DICOM file at ${inst.filePath} (status ${fileRes.status})`);
              return null;
            }
            const blob = await fileRes.blob();
            const fileName = inst.filePath.split('/').pop() || `${inst.sopInstanceUid}.dcm`;
            setParseProgress((prev) => ({ processed: idx + 1, total: instances.length }));
            return new File([blob], fileName, { type: 'application/dicom' });
          } catch (fileErr) {
            console.warn(`Failed to load file ${inst.filePath}:`, fileErr);
            return null;
          }
        });

        const filesRaw = await Promise.all(filePromises);
        const files = filesRaw.filter((f): f is File => f !== null);

        if (files.length === 0) {
          console.warn('No readable DICOM files found.');
          return;
        }

        await handleFiles(files, true);

        // If a specific series was requested in single-study mode, ensure viewport 0 is focused on that series
        if (studyUid && seriesUid) {
          setViewports((prev) => {
            const next = [...prev];
            next[0] = {
              studyInstanceUID: studyUid,
              seriesInstanceUID: seriesUid,
              imageIndex: 0,
            };
            return next;
          });
        }
      } catch (err) {
        console.error('Failed to load study/series from browser:', err);
      } finally {
        setIsParsing(false);
      }
    };

    loadFromBrowser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Series and Study Deletion with Explicit Cache Purging
  const handleRemoveSeries = (e: React.MouseEvent, studyUID: string, seriesUID: string) => {
    e.stopPropagation();

    const studyToRemoveFrom = studies.find((s) => s.studyInstanceUID === studyUID);
    const seriesToRemove = studyToRemoveFrom?.series.find((s) => s.seriesInstanceUID === seriesUID);
    if (seriesToRemove) {
      const removedImageIds = new Set(seriesToRemove.instances.map((inst) => inst.imageId));
      setMeasurements((prev) => {
        const next = prev.filter((m) => !removedImageIds.has(m.imageId));
        measurementsRef.current = next;
        return next;
      });

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
            const nextSeries = study.series.filter((s) => s.seriesInstanceUID !== seriesUID);
            return { ...study, series: nextSeries };
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

          const canvas = el.querySelector('canvas.measurement-canvas') as HTMLCanvasElement;
          if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx?.clearRect(0, 0, canvas.width, canvas.height);
          }

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

    savedViewportTransformsRef.current.clear();
    setStudies([]);
    setViewports(createDefaultViewports(MAX_VIEWPORTS));
    lastRenderedKeyRef.current = Array(MAX_VIEWPORTS).fill('');
    renderRequestSeqRef.current = Array(MAX_VIEWPORTS).fill(0);
    setLayoutTree({ type: 'viewport', id: 'root', viewportIndex: 0 });
    setMaximizedIndex(null);
    setInitialHangingProtocol(null);
    setMeasurements([]);
    measurementsRef.current = [];
    setActiveTool('none');
    setShowRemoveAllDialog(false);
    cursor3DRef.current = null;
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
    const isDragOver = dragOverViewport === index;
    const selectedIndexInOrder = selectedViewports.indexOf(index);
    const isMultiSelected = selectedIndexInOrder !== -1;
    const selectionBadgeNumber = selectedIndexInOrder + 1;

    return (
      <div
        className={`w-full h-full relative group/vp bg-black overflow-hidden select-none transition-all duration-150 ${
          isMultiSelected
            ? 'ring-2 ring-[#3584F5] bg-[#3584F5]/5 shadow-[0_0_16px_rgba(53,132,245,0.35)]'
            : isDragOver
            ? 'ring-2 ring-[#3584F5] bg-[#3584F5]/10 shadow-[inset_0_0_24px_rgba(53,132,245,0.25)]'
            : isActive
            ? 'ring-1 ring-[#3584F5]/50'
            : ''
        }`}
        onDoubleClick={(e) => handleDoubleClick(e, index)}
        onWheel={(e) => handleWheel(e, index)}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes('application/x-dicom-series')) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            if (dragOverViewport !== index) {
              setDragOverViewport(index);
            }
          }
        }}
        onDragEnter={(e) => {
          if (e.dataTransfer.types.includes('application/x-dicom-series')) {
            e.preventDefault();
            setDragOverViewport(index);
          }
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setDragOverViewport((prev) => (prev === index ? null : prev));
          }
        }}
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
        {/* Highlight overlay when dragging a series over this viewport */}
        {isDragOver && (
          <div className="absolute inset-0 z-40 bg-[#3584F5]/15 border-2 border-dashed border-[#3584F5] rounded pointer-events-none flex items-center justify-center backdrop-blur-[1px] animate-in fade-in duration-100">
            <div className="px-3.5 py-2 rounded-lg bg-neutral-900/90 border border-[#3584F5]/60 text-xs text-[#3584F5] font-medium shadow-2xl flex items-center gap-2">
              <svg className="w-4 h-4 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
              <span>Drop Series into Viewport {index + 1}</span>
            </div>
          </div>
        )}
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

        {/* Multi-Selection Badge (#1, #2, #3, #4) & Fast Sync Indicator */}
        {isMultiSelected && (
          <div className="absolute top-2 left-2 z-40 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#3584F5] text-white font-bold text-xs shadow-xl border border-white/30 animate-in fade-in zoom-in-95 duration-100 select-none pointer-events-none">
            <span className="font-mono">#{selectionBadgeNumber}</span>
            {selectedViewports.length >= 2 && (
              <span className="text-[10px] text-blue-100 font-normal flex items-center gap-0.5 border-l border-white/30 pl-1.5 ml-0.5">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                Linked
              </span>
            )}
          </div>
        )}

        {/* Viewport Overlay Info (HUD) */}
        <ViewportOverlay index={index} vpState={vpState} study={vpStudy} />

        {/* Anatomical Orientation Markers */}
        {vpState?.seriesInstanceUID && <OrientationMarkers markers={markers} />}

        {/* Floating Bottom-Right Viewport Controls */}
        <div className="absolute bottom-2 right-2 z-30 flex items-center gap-1.5 pointer-events-auto">
          <ViewportActionBar
            nodeId={nodeId}
            isMaximized={maximizedIndex === index}
            totalVisible={totalVisible}
            canSplitHorizontal={canSplitNode(layoutTree, nodeId, 'horizontal')}
            canSplitVertical={canSplitNode(layoutTree, nodeId, 'vertical')}
            onToggleMaximize={() => toggleMaximize(index)}
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
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
        onSelectTool={handleSelectTool}
        isTrashOpen={isTrashOpen}
        onToggleTrash={() => {
          setIsTrashOpen((prev) => {
            const next = !prev;
            if (next) setIsLayoutMenuOpen(false);
            return next;
          });
        }}
        isDraggingOverTrash={isDraggingOverTrash}
        draggingPoint={draggingPoint}
        measurements={measurements}
        setMeasurements={setMeasurements}
        selectedForDeletion={selectedForDeletion}
        setSelectedForDeletion={setSelectedForDeletion}
        studies={studies}
        onDeleteSelected={() => {
          setMeasurements((prev) => {
            const next = prev.filter((m) => !selectedForDeletion.has(m.id));
            measurementsRef.current = next;
            return next;
          });
          setSelectedForDeletion(new Set());
        }}
        isLayoutMenuOpen={isLayoutMenuOpen}
        onToggleLayoutMenu={() => {
          setIsLayoutMenuOpen((prev) => {
            const next = !prev;
            if (next) setIsTrashOpen(false);
            return next;
          });
        }}
        onApplyLayoutPreset={handleApplyLayoutPreset}
        initialHangingProtocol={initialHangingProtocol}
        onRevertHangingProtocol={handleRevertHangingProtocol}
        selectedViewportsCount={selectedViewports.length}
        onQuickLayout={handleQuickLayout}
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
            <LayoutRenderer node={layoutTree} renderViewport={renderViewportContent} panelSizesMap={panelSizesMap} onSavePanelSizes={handleSavePanelSizes} />
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

      <ParsingModal isParsing={isParsing} parseProgress={parseProgress} />
    </div>
  );
}





