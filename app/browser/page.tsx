'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  FolderSync,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Plus,
  X,
  HardDrive,
  UploadCloud,
  FolderUp,
} from 'lucide-react';
import type { BrowserStudyItem, BrowserSeriesItem, BrowserFacets } from '@/utils/types';
import { BrowserSeriesThumbnail } from '@/components/browser/BrowserSeriesThumbnail';
import { traverseFileTree } from '@/utils/dicomFiles';
import { uploadDicomFilesToBrowser } from '@/utils/dicomUploader';
import {
  handleTreeItemClick,
  handleTreeArrowNavigation,
  handleTreeSelectAll,
  getStudyCheckState,
  type TreeItem,
  type HierarchicalSelectionState,
  type StudyCheckState,
} from '@/utils/selectionHelper';

interface ExcludeChip {
  text: string;
  enabled: boolean;
}

export default function StudyBrowserPage() {
  const router = useRouter();

  // Data State
  const [studies, setStudies] = useState<BrowserStudyItem[]>([]);
  const [facets, setFacets] = useState<BrowserFacets | null>(null);
  const [selectedSeriesUids, setSelectedSeriesUids] = useState<Set<string>>(new Set());
  const [anchorItemId, setAnchorItemId] = useState<string | null>(null);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [expandedStudies, setExpandedStudies] = useState<Set<string>>(new Set());

  // Upload and Drag & Drop State
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ processed: number; total: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Visible items in tree (Study rows + expanded Series rows)
  const visibleTreeItems = React.useMemo<TreeItem[]>(() => {
    const items: TreeItem[] = [];
    for (const study of studies) {
      const allStudySeriesUids = study.series.map((s) => s.seriesInstanceUid);
      items.push({
        id: `study:${study.studyInstanceUid}`,
        type: 'study',
        studyUid: study.studyInstanceUid,
        seriesUids: allStudySeriesUids,
      });

      if (expandedStudies.has(study.studyInstanceUid)) {
        for (const ser of study.series) {
          items.push({
            id: `series:${ser.seriesInstanceUid}`,
            type: 'series',
            studyUid: study.studyInstanceUid,
            seriesUid: ser.seriesInstanceUid,
            seriesUids: [ser.seriesInstanceUid],
          });
        }
      }
    }
    return items;
  }, [studies, expandedStudies]);

  // Refs for rock-solid global keyboard listeners without stale closures
  const studiesRef = useRef(studies);
  studiesRef.current = studies;
  const visibleTreeItemsRef = useRef(visibleTreeItems);
  visibleTreeItemsRef.current = visibleTreeItems;
  const selectedSeriesUidsRef = useRef(selectedSeriesUids);
  selectedSeriesUidsRef.current = selectedSeriesUids;
  const anchorItemIdRef = useRef(anchorItemId);
  anchorItemIdRef.current = anchorItemId;
  const activeItemIdRef = useRef(activeItemId);
  activeItemIdRef.current = activeItemId;
  const tableContainerRef = useRef<HTMLElement>(null);

  // Apply new selection state & sync side-effects (active series, DOM focus/scrolling)
  const applySelection = useCallback((next: HierarchicalSelectionState) => {
    selectedSeriesUidsRef.current = next.selectedSeriesUids;
    anchorItemIdRef.current = next.anchorItemId;
    activeItemIdRef.current = next.activeItemId;

    setSelectedSeriesUids(next.selectedSeriesUids);
    setAnchorItemId(next.anchorItemId);
    setActiveItemId(next.activeItemId);

    if (next.activeItemId) {
      const el = document.getElementById(`row-${next.activeItemId}`);
      if (el) {
        el.scrollIntoView({ block: 'nearest' });
      }
    }
  }, []);

  // Determine active study and series for right sidebar
  const activeTreeItem = visibleTreeItems.find((it) => it.id === activeItemId);
  let activeStudyUid = activeTreeItem?.studyUid;
  if (!activeStudyUid && selectedSeriesUids.size > 0) {
    const firstSelectedSerUid = Array.from(selectedSeriesUids)[0];
    const foundStudy = studies.find((st) => st.series.some((s) => s.seriesInstanceUid === firstSelectedSerUid));
    if (foundStudy) activeStudyUid = foundStudy.studyInstanceUid;
  }
  if (!activeStudyUid && studies.length > 0) {
    activeStudyUid = studies[0].studyInstanceUid;
  }

  const activeStudy = studies.find((s) => s.studyInstanceUid === activeStudyUid) || (studies.length > 0 ? studies[0] : null);
  const activeSeries =
    activeTreeItem?.seriesUid
      ? activeStudy?.series.find((s) => s.seriesInstanceUid === activeTreeItem.seriesUid)
      : activeStudy?.series.find((s) => selectedSeriesUids.has(s.seriesInstanceUid)) ||
        (activeStudy?.series.length ? activeStudy.series[0] : null);

  // Filter States
  const [filterPatient, setFilterPatient] = useState<string>('');
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');
  const [filterDesc, setFilterDesc] = useState<string>('');
  const [filterMod, setFilterMod] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [excludeChips, setExcludeChips] = useState<ExcludeChip[]>([
    { text: 'scout', enabled: true },
    { text: 'loc', enabled: true },
  ]);

  // Sorting
  const [sortColumn, setSortColumn] = useState<'patient' | 'date' | 'desc' | 'mod' | 'images'>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Sidebar Resizing
  const [sidebarWidth, setSidebarWidth] = useState<number>(360);
  const isDraggingResizer = useRef<boolean>(false);

  // Scanning State
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanPath, setScanPath] = useState<string>('');
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Fetch Facets & Default Root Config
  const fetchConfig = useCallback(async () => {
    try {
      const [facetsRes, scanRes] = await Promise.all([
        fetch('/api/browser/facets'),
        fetch('/api/browser/scan'),
      ]);

      if (facetsRes.ok) {
        const fData = await facetsRes.json();
        setFacets(fData);
      }
      if (scanRes.ok) {
        const sData = await scanRes.json();
        if (sData.defaultRoot && !scanPath) {
          setScanPath(sData.defaultRoot);
        }
      }
    } catch (err) {
      console.error('Failed to load initial browser config:', err);
    }
  }, [scanPath]);

  // Fetch Studies from backend
  const fetchStudies = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterMod) params.set('modality', filterMod);
      if (filterPatient.trim()) params.set('search', filterPatient.trim());
      if (filterStartDate) params.set('startDate', filterStartDate);
      if (filterEndDate) params.set('endDate', filterEndDate);

      if (sortColumn === 'date') params.set('sortBy', 'studyDate');
      else if (sortColumn === 'patient') params.set('sortBy', 'patientName');
      else if (sortColumn === 'images') params.set('sortBy', 'seriesCount');
      params.set('sortOrder', sortDirection);

      const res = await fetch(`/api/browser/studies?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        let loadedStudies: BrowserStudyItem[] = data.studies || [];

        // Apply client-side description and exclude chips filter
        if (filterDesc.trim() || excludeChips.some((c) => c.enabled)) {
          const lowerDesc = filterDesc.toLowerCase().trim();
          const activeExcludes = excludeChips.filter((c) => c.enabled).map((c) => c.text.toLowerCase());

          loadedStudies = loadedStudies
            .map((st) => {
              const matchedSeries = st.series.filter((ser) => {
                const sDesc = (ser.seriesDescription || '').toLowerCase();
                const stDesc = (st.studyDescription || '').toLowerCase();
                const combined = `${sDesc} ${stDesc}`;

                // Check text search
                if (lowerDesc && !combined.includes(lowerDesc)) {
                  return false;
                }

                // Check exclude chips
                for (const ex of activeExcludes) {
                  if (combined.includes(ex)) return false;
                }

                return true;
              });

              return {
                ...st,
                series: matchedSeries,
                seriesCount: matchedSeries.length,
              };
            })
            .filter((st) => st.series.length > 0 || !lowerDesc);
        }

        setStudies(loadedStudies);

        // Selection maintenance using current refs
        if (loadedStudies.length > 0) {
          const allLoadedSeriesUids = new Set<string>();
          loadedStudies.forEach((st) => st.series.forEach((s) => allLoadedSeriesUids.add(s.seriesInstanceUid)));

          const validSeriesUids = new Set<string>();
          selectedSeriesUidsRef.current.forEach((uid) => {
            if (allLoadedSeriesUids.has(uid)) {
              validSeriesUids.add(uid);
            }
          });

          const firstStudy = loadedStudies[0];
          const defaultInitialStudyItem = `study:${firstStudy.studyInstanceUid}`;

          if (validSeriesUids.size === 0 && firstStudy.series.length > 0) {
            firstStudy.series.forEach((s) => validSeriesUids.add(s.seriesInstanceUid));
          }

          const nextActive = activeItemIdRef.current || defaultInitialStudyItem;
          const nextAnchor = anchorItemIdRef.current || defaultInitialStudyItem;

          applySelection({
            selectedSeriesUids: validSeriesUids,
            anchorItemId: nextAnchor,
            activeItemId: nextActive,
          });
        } else {
          applySelection({
            selectedSeriesUids: new Set(),
            anchorItemId: null,
            activeItemId: null,
          });
        }
      }
    } catch (err) {
      console.error('Failed to fetch studies:', err);
    } finally {
      setIsLoading(false);
    }
  }, [filterMod, filterPatient, filterStartDate, filterEndDate, filterDesc, excludeChips, sortColumn, sortDirection, applySelection]);

  useEffect(() => {
    let ignore = false;
    async function loadInitial() {
      try {
        const [facetsRes, scanRes] = await Promise.all([
          fetch('/api/browser/facets'),
          fetch('/api/browser/scan'),
        ]);

        if (facetsRes.ok) {
          const fData = await facetsRes.json();
          if (!ignore) setFacets(fData);
        }
        if (scanRes.ok) {
          const sData = await scanRes.json();
          if (!ignore && sData.defaultRoot) {
            setScanPath(sData.defaultRoot);
          }
        }
      } catch (err) {
        console.error('Failed to load initial browser config:', err);
      }
    }
    loadInitial();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchStudies();
    }, 150);
    return () => clearTimeout(timer);
  }, [fetchStudies]);

  const toggleStudyExpand = useCallback((studyUid: string) => {
    setExpandedStudies((prev) => {
      const next = new Set(prev);
      if (next.has(studyUid)) next.delete(studyUid);
      else next.add(studyUid);
      return next;
    });
  }, []);

  // Open viewer with selected series (across studies!) or specified study/series
  const handleOpenViewer = useCallback((targetStudyUid?: string, targetSeriesUid?: string) => {
    const params = new URLSearchParams();
    let uidsToOpen: string[] = [];

    if (targetSeriesUid) {
      uidsToOpen = [targetSeriesUid];
    } else if (targetStudyUid) {
      const found = studiesRef.current.find((s) => s.studyInstanceUid === targetStudyUid);
      if (found) {
        uidsToOpen = found.series.map((ser) => ser.seriesInstanceUid);
      }
    } else if (selectedSeriesUidsRef.current.size > 0) {
      uidsToOpen = Array.from(selectedSeriesUidsRef.current);
    } else if (activeItemIdRef.current) {
      const activeIt = visibleTreeItemsRef.current.find((it) => it.id === activeItemIdRef.current);
      if (activeIt) {
        uidsToOpen = activeIt.seriesUids;
      }
    }

    if (uidsToOpen.length === 0 && studiesRef.current.length > 0) {
      uidsToOpen = studiesRef.current[0].series.map((ser) => ser.seriesInstanceUid);
    }

    if (uidsToOpen.length === 0) return;

    params.set('seriesUids', uidsToOpen.join(','));
    router.push(`/?${params.toString()}`);
  }, [router]);

  // Keyboard shortcut handler for filter inputs: Drop down into table on ArrowDown, or open on Enter
  const handleFilterInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      (e.currentTarget as HTMLElement).blur();
      if (activeItemIdRef.current) {
        document.getElementById(`row-${activeItemIdRef.current}`)?.focus();
      } else if (visibleTreeItemsRef.current.length > 0) {
        const firstItem = visibleTreeItemsRef.current[0];
        applySelection({
          selectedSeriesUids: new Set(firstItem.seriesUids),
          anchorItemId: firstItem.id,
          activeItemId: firstItem.id,
        });
        document.getElementById(`row-${firstItem.id}`)?.focus();
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      (e.currentTarget as HTMLElement).blur();
      handleOpenViewer();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      (e.currentTarget as HTMLElement).blur();
      if (activeItemIdRef.current) {
        document.getElementById(`row-${activeItemIdRef.current}`)?.focus();
      }
    }
  };

  // Study Row & Checkbox Selection Handlers
  const handleStudyRowClick = (study: BrowserStudyItem, e: React.MouseEvent) => {
    if (document.activeElement instanceof HTMLElement && document.activeElement !== e.currentTarget) {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        document.activeElement.blur();
      }
    }

    const item: TreeItem = {
      id: `study:${study.studyInstanceUid}`,
      type: 'study',
      studyUid: study.studyInstanceUid,
      seriesUids: study.series.map((s) => s.seriesInstanceUid),
    };

    const next = handleTreeItemClick(
      visibleTreeItemsRef.current,
      item,
      {
        selectedSeriesUids: selectedSeriesUidsRef.current,
        anchorItemId: anchorItemIdRef.current,
        activeItemId: activeItemIdRef.current,
      },
      {
        isCtrlOrCmd: Boolean(e.metaKey || e.ctrlKey),
        isShift: Boolean(e.shiftKey),
      }
    );
    applySelection(next);
    document.getElementById(`row-study:${study.studyInstanceUid}`)?.focus();
  };

  const handleStudyCheckboxClick = (study: BrowserStudyItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (document.activeElement instanceof HTMLElement && document.activeElement !== e.currentTarget) {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        document.activeElement.blur();
      }
    }

    const item: TreeItem = {
      id: `study:${study.studyInstanceUid}`,
      type: 'study',
      studyUid: study.studyInstanceUid,
      seriesUids: study.series.map((s) => s.seriesInstanceUid),
    };

    const next = handleTreeItemClick(
      visibleTreeItemsRef.current,
      item,
      {
        selectedSeriesUids: selectedSeriesUidsRef.current,
        anchorItemId: anchorItemIdRef.current,
        activeItemId: activeItemIdRef.current,
      },
      {
        isCtrlOrCmd: true,
        isShift: Boolean(e.shiftKey),
      }
    );
    applySelection(next);
    document.getElementById(`row-study:${study.studyInstanceUid}`)?.focus();
  };

  // Series Row & Checkbox Selection Handlers
  const handleSeriesRowClick = (studyUid: string, ser: BrowserSeriesItem, e: React.MouseEvent) => {
    if (document.activeElement instanceof HTMLElement && document.activeElement !== e.currentTarget) {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        document.activeElement.blur();
      }
    }

    const item: TreeItem = {
      id: `series:${ser.seriesInstanceUid}`,
      type: 'series',
      studyUid: studyUid,
      seriesUid: ser.seriesInstanceUid,
      seriesUids: [ser.seriesInstanceUid],
    };

    const next = handleTreeItemClick(
      visibleTreeItemsRef.current,
      item,
      {
        selectedSeriesUids: selectedSeriesUidsRef.current,
        anchorItemId: anchorItemIdRef.current,
        activeItemId: activeItemIdRef.current,
      },
      {
        isCtrlOrCmd: Boolean(e.metaKey || e.ctrlKey),
        isShift: Boolean(e.shiftKey),
      }
    );
    applySelection(next);
    document.getElementById(`row-series:${ser.seriesInstanceUid}`)?.focus();
  };

  const handleSeriesCheckboxClick = (studyUid: string, ser: BrowserSeriesItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (document.activeElement instanceof HTMLElement && document.activeElement !== e.currentTarget) {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        document.activeElement.blur();
      }
    }

    const item: TreeItem = {
      id: `series:${ser.seriesInstanceUid}`,
      type: 'series',
      studyUid: studyUid,
      seriesUid: ser.seriesInstanceUid,
      seriesUids: [ser.seriesInstanceUid],
    };

    const next = handleTreeItemClick(
      visibleTreeItemsRef.current,
      item,
      {
        selectedSeriesUids: selectedSeriesUidsRef.current,
        anchorItemId: anchorItemIdRef.current,
        activeItemId: activeItemIdRef.current,
      },
      {
        isCtrlOrCmd: true,
        isShift: Boolean(e.shiftKey),
      }
    );
    applySelection(next);
    document.getElementById(`row-series:${ser.seriesInstanceUid}`)?.focus();
  };

  const handleMasterSelectAll = () => {
    const allSeries = studiesRef.current.flatMap((st) => st.series.map((s) => s.seriesInstanceUid));
    if (selectedSeriesUidsRef.current.size === allSeries.length && allSeries.length > 0) {
      applySelection({
        selectedSeriesUids: new Set(),
        anchorItemId: null,
        activeItemId: null,
      });
    } else {
      const next = handleTreeSelectAll(
        visibleTreeItemsRef.current,
        allSeries,
        {
          selectedSeriesUids: selectedSeriesUidsRef.current,
          anchorItemId: anchorItemIdRef.current,
          activeItemId: activeItemIdRef.current,
        }
      );
      applySelection(next);
    }
  };

  // Keyboard navigation for Finder/Explorer list behavior (capture phase for maximum reliability)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'SELECT' ||
          activeEl.tagName === 'TEXTAREA' ||
          (activeEl as HTMLElement).isContentEditable);

      if (isInput) {
        if (e.key === 'Escape') {
          (activeEl as HTMLElement).blur();
          if (activeItemIdRef.current) {
            document.getElementById(`row-${activeItemIdRef.current}`)?.focus();
          }
        }
        return;
      }

      if (visibleTreeItemsRef.current.length === 0) return;

      // Select All: Cmd+A (Mac) / Ctrl+A (Windows)
      if ((e.metaKey || e.ctrlKey) && (e.key === 'a' || e.key === 'A' || e.code === 'KeyA')) {
        e.preventDefault();
        const allSeries = studiesRef.current.flatMap((st) => st.series.map((s) => s.seriesInstanceUid));
        const next = handleTreeSelectAll(
          visibleTreeItemsRef.current,
          allSeries,
          {
            selectedSeriesUids: selectedSeriesUidsRef.current,
            anchorItemId: anchorItemIdRef.current,
            activeItemId: activeItemIdRef.current,
          }
        );
        applySelection(next);
        return;
      }

      // Open in Viewer: Enter
      if (e.key === 'Enter') {
        e.preventDefault();
        handleOpenViewer();
        return;
      }

      // Toggle Expand: Space
      if (e.key === ' ' || e.code === 'Space') {
        if (activeItemIdRef.current) {
          const activeIt = visibleTreeItemsRef.current.find((it) => it.id === activeItemIdRef.current);
          if (activeIt) {
            e.preventDefault();
            toggleStudyExpand(activeIt.studyUid);
          }
        }
        return;
      }

      // Arrow Navigation: Up / Down
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const direction = e.key === 'ArrowDown' ? 'down' : 'up';
        const next = handleTreeArrowNavigation(
          visibleTreeItemsRef.current,
          direction,
          {
            selectedSeriesUids: selectedSeriesUidsRef.current,
            anchorItemId: anchorItemIdRef.current,
            activeItemId: activeItemIdRef.current,
          },
          Boolean(e.shiftKey)
        );
        applySelection(next);
        if (next.activeItemId) {
          document.getElementById(`row-${next.activeItemId}`)?.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [applySelection, handleOpenViewer, toggleStudyExpand]);

  // Handle Scan Submit
  const handleScanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanPath.trim()) return;

    setIsScanning(true);
    setScanMessage(null);
    try {
      const res = await fetch('/api/browser/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ directoryPath: scanPath.trim() }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setScanMessage(`✓ Skannattu: ${data.dicomFilesIndexed} leikettä (${(data.elapsedMs / 1000).toFixed(1)}s)`);
        fetchConfig();
        fetchStudies();
      } else {
        setScanMessage(`Virhe: ${data.error || 'Skannaus epäonnistui'}`);
      }
    } catch (err: any) {
      setScanMessage(`Virhe: ${err?.message || 'Yhteysvirhe'}`);
    } finally {
      setIsScanning(false);
    }
  };

  // Sorting Handler
  const handleToggleSort = (col: 'patient' | 'date' | 'desc' | 'mod' | 'images') => {
    if (sortColumn === col) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(col);
      setSortDirection(col === 'date' || col === 'images' ? 'desc' : 'asc');
    }
  };

  // Resizer Mouse Handlers
  const handleMouseDownResizer = (e: React.MouseEvent) => {
    isDraggingResizer.current = true;
    document.body.style.cursor = 'col-resize';

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingResizer.current) return;
      const newWidth = Math.max(260, Math.min(1000, window.innerWidth - moveEvent.clientX));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      isDraggingResizer.current = false;
      document.body.style.cursor = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const totalAllSeries = React.useMemo(() => {
    return studies.reduce((acc, st) => acc + st.series.length, 0);
  }, [studies]);

  const numSelectedSeries = selectedSeriesUids.size;
  const numSelectedStudies = React.useMemo(() => {
    const studyUids = new Set<string>();
    for (const study of studies) {
      if (study.series.some((s) => selectedSeriesUids.has(s.seriesInstanceUid))) {
        studyUids.add(study.studyInstanceUid);
      }
    }
    return studyUids.size;
  }, [studies, selectedSeriesUids]);

  const formatStudyDate = (dateStr: string) => {
    if (!dateStr || dateStr.length < 8) return dateStr || '–';
    const y = dateStr.slice(0, 4);
    const m = dateStr.slice(4, 6);
    const d = dateStr.slice(6, 8);
    return `${d}.${m}.${y}`;
  };

  const handleProcessUploadedFiles = async (files: File[]) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    setUploadProgress({ processed: 0, total: files.length });
    setScanMessage(null);

    try {
      const res = await uploadDicomFilesToBrowser(files, (processed, total) => {
        setUploadProgress({ processed, total });
      });

      if (res.success) {
        setScanMessage(`✓ Tuotu ja indeksoitu ${res.indexedCount} kuvaleikettä`);
        await Promise.all([fetchConfig(), fetchStudies()]);
      } else {
        setScanMessage(`Virhe: ${res.error || 'Tuonti epäonnistui'}`);
      }
    } catch (err: any) {
      setScanMessage(`Virhe: ${err?.message || 'Tuonti epäonnistui'}`);
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  const handleRootDragEnter = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      setIsDraggingOver(true);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);

    const items = e.dataTransfer.items;
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
      await handleProcessUploadedFiles(fileArrays.flat());
    } else if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await handleProcessUploadedFiles(Array.from(e.dataTransfer.files));
    }
  };

  const addExcludeChip = () => {
    const text = prompt('Anna poissuljettava sana (esim. scout, loc, sagittal):');
    if (text && text.trim()) {
      setExcludeChips((prev) => [...prev, { text: text.trim().toLowerCase(), enabled: true }]);
    }
  };

  return (
    <div
      onDragEnter={handleRootDragEnter}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault();
        }
      }}
      className="flex flex-col h-screen w-screen overflow-hidden bg-[#090b10] text-[#f1f5f9] font-sans text-xs select-none relative"
    >
      {/* ── Top Header ────────────────────────────────────────────── */}
      <header className="h-11 bg-[#0e1017] border-b border-[#21273b] px-3.5 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 text-[#f1f5f9] hover:opacity-90 transition-opacity" title="Palaa katselimeen">
            <div className="w-5 h-5 bg-cyan-400/15 border border-cyan-400 rounded flex items-center justify-center font-extrabold text-[13px] text-cyan-400">
              +
            </div>
            <span className="font-extrabold text-[13px] text-[#f1f5f9] tracking-tight">
              div<span className="text-cyan-400 font-bold">.DICOM</span>
            </span>
            <span className="text-[10px] text-[#64748b] font-medium ml-1 pl-2 border-l border-[#21273b]">
              Study Browser
            </span>
          </Link>
        </div>

        {/* Scan input directly in top bar for quick access */}
        <form onSubmit={handleScanSubmit} className="flex items-center gap-1.5 max-w-lg flex-1 mx-4">
          <div className="relative flex-1">
            <HardDrive className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#64748b]" />
            <input
              type="text"
              value={scanPath}
              onChange={(e) => setScanPath(e.target.value)}
              onKeyDown={handleFilterInputKeyDown}
              placeholder="DICOM-hakemiston polku (/Volumes/...)"
              className="w-full pl-7 pr-2.5 py-1 bg-[#080a0e] border border-[#21273b] rounded text-[11px] font-mono text-[#f1f5f9] focus:outline-none focus:border-cyan-400"
            />
          </div>
          <button
            type="submit"
            disabled={isScanning || !scanPath.trim()}
            className="px-2.5 py-1 bg-[#131722] hover:bg-[#1a2030] border border-[#21273b] hover:border-cyan-400 text-cyan-400 rounded text-[11px] font-semibold flex items-center gap-1.5 transition-colors shrink-0 disabled:opacity-50"
          >
            {isScanning ? (
              <>
                <RefreshCw className="w-3 h-3 animate-spin" />
                Skannataan...
              </>
            ) : (
              <>
                <FolderSync className="w-3 h-3" />
                Skannaa
              </>
            )}
          </button>
          {scanMessage && (
            <span className="text-[10px] text-emerald-400 truncate max-w-[200px]" title={scanMessage}>
              {scanMessage}
            </span>
          )}
        </form>

        <div className="flex items-center gap-2">
          {/* File and Folder Upload Inputs */}
          <input
            type="file"
            ref={fileInputRef}
            multiple
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleProcessUploadedFiles(Array.from(e.target.files));
                e.target.value = '';
              }
            }}
            className="hidden"
          />
          <input
            type="file"
            ref={folderInputRef}
            // @ts-ignore
            webkitdirectory="true"
            directory="true"
            multiple
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleProcessUploadedFiles(Array.from(e.target.files));
                e.target.value = '';
              }
            }}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => folderInputRef.current?.click()}
            disabled={isUploading}
            className="px-2.5 py-1 bg-[#131722] hover:bg-[#1a2030] border border-[#21273b] hover:border-cyan-400 text-[#cbd5e1] hover:text-white rounded text-[11px] font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
            title="Tuo DICOM-kansio selaimesta"
          >
            <FolderUp className="w-3 h-3 text-cyan-400" />
            Tuo kansio
          </button>
        </div>
      </header>

      {/* ── Title Bar ─────────────────────────────────────────────── */}
      <div className="h-[38px] bg-[#090b10] flex items-center px-3.5 shrink-0 border-b border-[#181d2e] justify-between">
        <h1 className="text-[13px] font-bold text-[#f1f5f9] flex items-center gap-2">
          <span>Tutkimuslista</span>
          <small className="text-[11px] font-normal text-[#64748b]">(Hierarkkinen Study / Series -selaus)</small>
        </h1>
        <div className="flex items-center gap-4 text-xs text-[#94a3b8]">
          <span>Tutkimukset: <strong className="text-[#f1f5f9] font-bold font-mono">{facets?.totalStudies ?? studies.length}</strong></span>
          <span>Kuvattuja sarjoja: <strong className="text-[#f1f5f9] font-bold font-mono">{facets?.totalSeries ?? 0}</strong></span>
          <span>Leikkeitä: <strong className="text-[#f1f5f9] font-bold font-mono">{facets?.totalInstances ?? 0}</strong></span>
        </div>
      </div>

      {/* ── Main Split View Body ───────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Study Area */}
        <div className="flex-1 flex flex-col overflow-hidden border-r border-[#21273b]">
          {/* Column Filter Header Bar */}
          <div className="bg-[#11141e] border-b border-[#21273b] px-3.5 py-1.5 shrink-0">
            <div className="flex items-end gap-2">
              <div className="w-4 shrink-0"></div>

              {/* Master Select-all Checkbox */}
              <div
                onClick={handleMasterSelectAll}
                className={`w-3.5 h-3.5 mb-1 rounded border flex items-center justify-center shrink-0 cursor-pointer transition-colors ${
                  totalAllSeries > 0 && selectedSeriesUids.size === totalAllSeries
                    ? 'bg-blue-600 border-blue-400 text-white'
                    : selectedSeriesUids.size > 0
                    ? 'bg-blue-900/60 border-blue-400 text-cyan-300'
                    : 'border-[#334155] hover:border-slate-400 bg-[#080a0e]'
                }`}
                title="Valitse kaikki / Tyhjennä valinta"
              >
                {totalAllSeries > 0 && selectedSeriesUids.size === totalAllSeries ? (
                  <span className="text-[10px] leading-none font-bold">✓</span>
                ) : selectedSeriesUids.size > 0 ? (
                  <span className="text-[12px] leading-none font-bold">-</span>
                ) : null}
              </div>

              {/* Patient / MRN */}
              <div className="w-56 shrink-0 flex flex-col gap-1">
                <div
                  className="text-[10px] font-semibold text-[#94a3b8] hover:text-[#f1f5f9] uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                  onClick={() => handleToggleSort('patient')}
                >
                  POTILAS / MRN
                  <span className={`text-[9px] ${sortColumn === 'patient' ? 'text-cyan-400 font-bold' : 'text-[#64748b]'}`}>
                    {sortColumn === 'patient' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                  </span>
                </div>
                <input
                  type="text"
                  value={filterPatient}
                  onChange={(e) => setFilterPatient(e.target.value)}
                  onKeyDown={handleFilterInputKeyDown}
                  placeholder="Nimi tai ID..."
                  className="h-6 bg-[#080a0e] border border-[#21273b] rounded text-[11px] text-[#f1f5f9] px-2 outline-none focus:border-cyan-400"
                />
              </div>

              {/* Date Range */}
              <div className="w-36 shrink-0 flex flex-col gap-1">
                <div
                  className="text-[10px] font-semibold text-[#94a3b8] hover:text-[#f1f5f9] uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                  onClick={() => handleToggleSort('date')}
                >
                  PÄIVÄMÄÄRÄ
                  <span className={`text-[9px] ${sortColumn === 'date' ? 'text-cyan-400 font-bold' : 'text-[#64748b]'}`}>
                    {sortColumn === 'date' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                  </span>
                </div>
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={filterStartDate}
                    onChange={(e) => setFilterStartDate(e.target.value)}
                    onKeyDown={handleFilterInputKeyDown}
                    placeholder="Alku"
                    className="h-6 w-1/2 bg-[#080a0e] border border-[#21273b] rounded text-[11px] text-[#f1f5f9] px-1.5 outline-none focus:border-cyan-400"
                  />
                  <input
                    type="text"
                    value={filterEndDate}
                    onChange={(e) => setFilterEndDate(e.target.value)}
                    onKeyDown={handleFilterInputKeyDown}
                    placeholder="Loppu"
                    className="h-6 w-1/2 bg-[#080a0e] border border-[#21273b] rounded text-[11px] text-[#f1f5f9] px-1.5 outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              {/* Description + Inline Exclude Chips */}
              <div className="flex-1 min-w-[200px] flex flex-col gap-1">
                <div className="flex items-center justify-between gap-1">
                  <div
                    className="text-[10px] font-semibold text-[#94a3b8] hover:text-[#f1f5f9] uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                    onClick={() => handleToggleSort('desc')}
                  >
                    KUVAUS (DESCRIPTION)
                    <span className={`text-[9px] ${sortColumn === 'desc' ? 'text-cyan-400 font-bold' : 'text-[#64748b]'}`}>
                      {sortColumn === 'desc' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                    </span>
                  </div>

                  {/* Exclude Chips */}
                  <div className="flex items-center gap-1 overflow-x-auto">
                    {excludeChips.map((chip, idx) => (
                      <span
                        key={idx}
                        onClick={() => {
                          setExcludeChips((prev) =>
                            prev.map((c, i) => (i === idx ? { ...c, enabled: !c.enabled } : c))
                          );
                        }}
                        className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full cursor-pointer transition-colors ${
                          chip.enabled
                            ? 'bg-[#192033] border border-cyan-400 text-cyan-400'
                            : 'bg-transparent border border-[#21273b] text-[#64748b] line-through'
                        }`}
                      >
                        -{chip.text}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setExcludeChips((prev) => prev.filter((_, i) => i !== idx));
                          }}
                          className="hover:text-red-400 text-[8px]"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    <button
                      type="button"
                      onClick={addExcludeChip}
                      className="h-4 px-1.5 border border-dashed border-[#21273b] hover:border-cyan-400 text-[#94a3b8] hover:text-[#f1f5f9] rounded text-[9px] flex items-center gap-0.5"
                    >
                      <Plus className="w-2.5 h-2.5" /> exclude
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  value={filterDesc}
                  onChange={(e) => setFilterDesc(e.target.value)}
                  onKeyDown={handleFilterInputKeyDown}
                  placeholder="Hae kuvauksesta..."
                  className="h-6 bg-[#080a0e] border border-[#21273b] rounded text-[11px] text-[#f1f5f9] px-2 outline-none focus:border-cyan-400"
                />
              </div>

              {/* Modality */}
              <div className="w-20 shrink-0 flex flex-col gap-1">
                <div
                  className="text-[10px] font-semibold text-[#94a3b8] hover:text-[#f1f5f9] uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                  onClick={() => handleToggleSort('mod')}
                >
                  MODALITEETTI
                  <span className={`text-[9px] ${sortColumn === 'mod' ? 'text-cyan-400 font-bold' : 'text-[#64748b]'}`}>
                    {sortColumn === 'mod' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                  </span>
                </div>
                <select
                  value={filterMod}
                  onChange={(e) => setFilterMod(e.target.value)}
                  className="h-6 bg-[#080a0e] border border-[#21273b] rounded text-[11px] text-[#f1f5f9] px-1 outline-none focus:border-cyan-400"
                >
                  <option value="">Kaikki</option>
                  <option value="MR">MR</option>
                  <option value="CT">CT</option>
                  <option value="CR">CR/DX</option>
                  <option value="PT">PT/PET</option>
                  <option value="US">US</option>
                </select>
              </div>

              {/* Status / Tila */}
              <div className="w-24 shrink-0 flex flex-col gap-1">
                <div className="text-[10px] font-semibold text-[#94a3b8] uppercase tracking-wider text-right">
                  TILA
                </div>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="h-6 bg-[#080a0e] border border-[#21273b] rounded text-[11px] text-[#f1f5f9] px-1 outline-none focus:border-cyan-400"
                >
                  <option value="">Kaikki</option>
                  <option value="ready">Valmis</option>
                  <option value="open">Avattu</option>
                </select>
              </div>

              {/* Images count header */}
              <div className="w-20 shrink-0 flex flex-col gap-1 text-right">
                <div
                  className="text-[10px] font-semibold text-[#94a3b8] hover:text-[#f1f5f9] uppercase tracking-wider flex items-center justify-end gap-1 cursor-pointer"
                  onClick={() => handleToggleSort('images')}
                >
                  KUVAT
                  <span className={`text-[9px] ${sortColumn === 'images' ? 'text-cyan-400 font-bold' : 'text-[#64748b]'}`}>
                    {sortColumn === 'images' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                  </span>
                </div>
                <div className="h-6"></div>
              </div>
            </div>
          </div>

          {/* Main Study & Series Table */}
          <main
            ref={tableContainerRef}
            tabIndex={0}
            onClick={(e) => {
              // Clicking empty table space blurs any active inputs
              if (e.target === e.currentTarget && document.activeElement instanceof HTMLElement) {
                document.activeElement.blur();
              }
            }}
            className="flex-1 overflow-y-auto outline-none"
          >
            {isLoading ? (
              <div className="p-8 text-center text-[#64748b] flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                Ladataan tutkimuksia...
              </div>
            ) : studies.length === 0 ? (
              <div className="p-12 text-center text-[#64748b] space-y-2">
                <div className="text-sm font-semibold text-[#94a3b8]">Ei tutkimuksia</div>
                <div className="text-[11px]">Syötä yläpalkkiin DICOM-kansiosi polku ja paina Skannaa.</div>
              </div>
            ) : (
              studies.map((study) => {
                const isExpanded = expandedStudies.has(study.studyInstanceUid);
                const studySeriesUids = study.series.map((s) => s.seriesInstanceUid);
                const checkState = getStudyCheckState(studySeriesUids, selectedSeriesUids);
                const isStudyActive = activeItemId === `study:${study.studyInstanceUid}`;

                return (
                  <div key={study.studyInstanceUid} className="border-b border-[#181d2e]">
                    {/* Study Row (32px) */}
                    <div
                      id={`row-study:${study.studyInstanceUid}`}
                      tabIndex={0}
                      onClick={(e) => handleStudyRowClick(study, e)}
                      onDoubleClick={(e) => {
                        e.preventDefault();
                        handleOpenViewer(study.studyInstanceUid);
                      }}
                      onMouseDown={(e) => {
                        if (e.shiftKey) {
                          e.preventDefault(); // Prevents native text selection during shift-range click
                        }
                        (e.currentTarget as HTMLElement).focus();
                      }}
                      className={`h-8 px-3.5 flex items-center gap-2 cursor-pointer border-l-[3px] outline-none transition-colors ${
                        checkState === 'checked'
                          ? isStudyActive
                            ? 'bg-blue-600/50 border-l-cyan-400 text-white ring-1 ring-inset ring-cyan-400/50 shadow-sm'
                            : 'bg-blue-800/40 border-l-blue-400 text-white ring-1 ring-inset ring-blue-500/20'
                          : checkState === 'indeterminate'
                          ? isStudyActive
                            ? 'bg-blue-900/40 border-l-cyan-400 text-white ring-1 ring-inset ring-cyan-400/40'
                            : 'bg-blue-950/30 border-l-cyan-400/60 text-[#e2e8f0]'
                          : isStudyActive
                          ? 'bg-[#182030] border-l-slate-400 text-white'
                          : 'bg-[#11141e] hover:bg-[#182030] border-l-transparent text-[#cbd5e1]'
                      }`}
                    >
                      {/* Expand Chevron */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleStudyExpand(study.studyInstanceUid);
                        }}
                        className="w-4 h-4 flex items-center justify-center text-[#64748b] hover:text-cyan-400 shrink-0"
                      >
                        <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-90 text-cyan-400' : ''}`} />
                      </button>

                      {/* Selection Checkbox */}
                      <div
                        onClick={(e) => handleStudyCheckboxClick(study, e)}
                        className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                          checkState === 'checked'
                            ? 'bg-blue-600 border-blue-400 text-white shadow-sm'
                            : checkState === 'indeterminate'
                            ? 'bg-blue-900/80 border-cyan-400 text-cyan-300 shadow-sm'
                            : 'border-[#334155] hover:border-slate-400 bg-[#080a0e]'
                        }`}
                      >
                        {checkState === 'checked' ? (
                          <span className="text-[10px] leading-none font-bold">✓</span>
                        ) : checkState === 'indeterminate' ? (
                          <span className="text-[12px] leading-none font-bold">-</span>
                        ) : null}
                      </div>

                      {/* Patient / MRN */}
                      <div className="w-56 shrink-0 flex items-center gap-1.5 truncate">
                        <span className="font-semibold text-[#f1f5f9] truncate">{study.patientName}</span>
                        <span className="text-[#64748b]">•</span>
                        <span className="font-mono text-[11px] text-cyan-400 shrink-0">{study.patientId}</span>
                      </div>

                      {/* Date */}
                      <div className="w-36 shrink-0 text-[#f1f5f9] text-[11px] font-mono">
                        {formatStudyDate(study.studyDate)}
                      </div>

                      {/* Description */}
                      <div className="flex-1 min-w-[200px] truncate font-medium text-[#f1f5f9]">
                        {study.studyDescription || '–'}
                      </div>

                      {/* Modality Badge */}
                      <div className="w-20 shrink-0">
                        <span className="text-[9.5px] font-bold text-[#7ba5ff] bg-[#1b2742] border border-[#7ba5ff]/25 px-1.5 py-0.5 rounded">
                          {study.series[0]?.modality || 'MR'}
                        </span>
                      </div>

                      {/* Status Dot */}
                      <div className="w-24 shrink-0 flex items-center justify-end gap-1.5 text-[10.5px] font-semibold text-emerald-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                        <span>Valmis</span>
                      </div>

                      {/* Image Count */}
                      <div className="w-20 shrink-0 text-right font-semibold text-cyan-400 font-mono">
                        {study.totalInstances}
                      </div>
                    </div>

                    {/* Series Rows (28px each, nested under expanded study) */}
                    {isExpanded && (
                      <div className="bg-[#0d1018]">
                        {study.series.map((ser) => {
                          const isSeriesSelected = selectedSeriesUids.has(ser.seriesInstanceUid);
                          const isSeriesActive = activeItemId === `series:${ser.seriesInstanceUid}`;

                          return (
                            <div
                              key={ser.seriesInstanceUid}
                              id={`row-series:${ser.seriesInstanceUid}`}
                              tabIndex={0}
                              onClick={(e) => handleSeriesRowClick(study.studyInstanceUid, ser, e)}
                              onDoubleClick={(e) => {
                                e.preventDefault();
                                handleOpenViewer(study.studyInstanceUid, ser.seriesInstanceUid);
                              }}
                              onMouseDown={(e) => {
                                if (e.shiftKey) {
                                  e.preventDefault();
                                }
                                (e.currentTarget as HTMLElement).focus();
                              }}
                              className={`h-7 pl-9 pr-3.5 flex items-center gap-2.5 text-[11px] cursor-pointer border-b border-white/[0.03] outline-none transition-colors ${
                                isSeriesSelected
                                  ? isSeriesActive
                                    ? 'bg-[#1f3563] text-white ring-1 ring-inset ring-cyan-400/40'
                                    : 'bg-[#182849] text-[#f1f5f9]'
                                  : isSeriesActive
                                  ? 'bg-[#182030] text-[#f1f5f9]'
                                  : 'text-[#94a3b8] hover:bg-[#151a28] hover:text-[#f1f5f9]'
                              }`}
                            >
                              <span className="text-[#21273b] font-mono">└──</span>

                              {/* Series Checkbox */}
                              <div
                                onClick={(e) => handleSeriesCheckboxClick(study.studyInstanceUid, ser, e)}
                                className={`w-3 h-3 rounded border flex items-center justify-center shrink-0 transition-colors ${
                                  isSeriesSelected
                                    ? 'bg-blue-600 border-blue-400 text-white shadow-sm'
                                    : 'border-[#334155] hover:border-slate-400 bg-[#080a0e]'
                                }`}
                              >
                                {isSeriesSelected && <span className="text-[9px] leading-none font-bold">✓</span>}
                              </div>

                              {/* Series number */}
                              <span className="w-7 font-mono font-semibold text-[#64748b]">
                                #{ser.seriesNumber ?? '–'}
                              </span>

                              {/* Modality */}
                              <span className="w-7 font-mono text-[10px] text-[#64748b]">
                                {ser.modality}
                              </span>

                              {/* Description */}
                              <span className="flex-1 truncate font-medium text-[#f1f5f9]">
                                {ser.seriesDescription || 'Unnamed Series'}
                              </span>

                              {/* Orientation Badge */}
                              <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded border border-purple-500/30 bg-purple-500/10 text-purple-300">
                                {ser.calculatedOrientation}
                              </span>

                              {/* Slices */}
                              <span className="text-[#64748b] font-mono text-[10.5px]">
                                {ser.instanceCount} leikettä
                              </span>

                              {/* Open in Viewer Button */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenViewer(study.studyInstanceUid, ser.seriesInstanceUid);
                                }}
                                className="px-2 py-0.5 text-[9.5px] font-semibold bg-[#1e293b] hover:bg-cyan-400 hover:text-black border border-[#21273b] hover:border-cyan-400 text-[#94a3b8] rounded flex items-center gap-1 transition-all"
                              >
                                🔬 Katselin
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </main>
        </div>

        {/* Draggable Resizer Handle */}
        <div
          onMouseDown={handleMouseDownResizer}
          className="w-1.5 bg-[#21273b] hover:bg-cyan-400 active:bg-cyan-400 cursor-col-resize shrink-0 transition-colors z-10 select-none"
          title="Muuta esikatselupaneelin kokoa vetämällä"
        />

        {/* ── Right Thumbnail Sidebar ───────────────────────────────── */}
        <aside
          style={{ width: `${sidebarWidth}px` }}
          className="bg-[#11141e] flex flex-col shrink-0 overflow-hidden select-none border-l border-[#21273b]"
        >
          {/* Sidebar Header */}
          <div className="h-[34px] bg-[#0e1017] border-b border-[#21273b] px-2.5 flex items-center justify-between text-[10.5px] font-bold text-[#64748b] uppercase tracking-wider shrink-0">
            <div className="truncate max-w-[170px] text-cyan-400 flex items-center gap-1">
              <span>SARJA:</span>
              <span className="truncate text-[#f1f5f9]">{activeSeries?.seriesDescription || '–'}</span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {/* Presets */}
              <div className="flex gap-0.5">
                <button
                  type="button"
                  onClick={() => setSidebarWidth(280)}
                  className="px-1.5 py-0.5 bg-[#080a0e] border border-[#21273b] hover:border-cyan-400 text-[#94a3b8] hover:text-[#f1f5f9] rounded text-[9.5px]"
                  title="1 sarake (280px)"
                >
                  ◫ 1
                </button>
                <button
                  type="button"
                  onClick={() => setSidebarWidth(480)}
                  className="px-1.5 py-0.5 bg-[#080a0e] border border-[#21273b] hover:border-cyan-400 text-[#94a3b8] hover:text-[#f1f5f9] rounded text-[9.5px]"
                  title="2 saraketta (480px)"
                >
                  ⊞ 2
                </button>
                <button
                  type="button"
                  onClick={() => setSidebarWidth(720)}
                  className="px-1.5 py-0.5 bg-[#080a0e] border border-[#21273b] hover:border-cyan-400 text-[#94a3b8] hover:text-[#f1f5f9] rounded text-[9.5px]"
                  title="3 saraketta (720px)"
                >
                  ⊞ 3
                </button>
              </div>

              {/* Open in Viewer button */}
              <button
                type="button"
                onClick={() => handleOpenViewer()}
                className="px-2 py-0.5 text-[9.5px] font-semibold bg-cyan-400/20 hover:bg-cyan-400 text-cyan-400 hover:text-black border border-cyan-400/40 rounded flex items-center gap-1 transition-colors"
                title="Avaa valittu sarja katselimeen"
              >
                <ExternalLink className="w-2.5 h-2.5" />
                Avaa katselin
              </button>
            </div>
          </div>

          {/* Sidebar Thumbnail Grid */}
          <div className="flex-1 overflow-y-auto p-2.5 grid grid-cols-2 gap-2.5 auto-rows-max bg-[#11141e]">
            {!activeStudy ? (
              <div className="col-span-2 p-8 text-center text-[#64748b] text-[11px]">
                Valitse tutkimus listalta nähdäksesi kuvasarjojen esikatselukuvat.
              </div>
            ) : (
              activeStudy.series.map((ser) => {
                const isSelected = selectedSeriesUids.has(ser.seriesInstanceUid);
                const isActive = activeItemId === `series:${ser.seriesInstanceUid}`;

                return (
                  <div
                    key={ser.seriesInstanceUid}
                    onClick={(e) => handleSeriesRowClick(activeStudy.studyInstanceUid, ser, e)}
                    onDoubleClick={() => handleOpenViewer(activeStudy.studyInstanceUid, ser.seriesInstanceUid)}
                    className={`bg-[#090b10] rounded border flex flex-col overflow-hidden cursor-pointer transition-all ${
                      isSelected
                        ? isActive
                          ? 'border-cyan-400 shadow-[0_0_0_2px_rgba(34,211,238,0.45),inset_0_0_0_1px_rgba(34,211,238,0.25)] bg-cyan-400/[0.08]'
                          : 'border-blue-500 shadow-[0_0_0_1px_rgba(59,130,246,0.5)] bg-blue-950/20'
                        : 'border-[#21273b] hover:border-cyan-400'
                    }`}
                  >
                    {/* Square Thumbnail Canvas Wrap */}
                    <div className="w-full aspect-square bg-black relative flex items-center justify-center overflow-hidden">
                      <BrowserSeriesThumbnail
                        filePath={ser.previewFilePath}
                        sopUid={ser.previewSopUid}
                        className="w-full h-full"
                      />
                      {/* Check badge if selected */}
                      {isSelected && (
                        <div className="absolute top-1.5 left-1.5 w-4 h-4 rounded bg-blue-600 border border-blue-400 text-white flex items-center justify-center shadow">
                          <span className="text-[10px] font-bold leading-none">✓</span>
                        </div>
                      )}
                      {/* Top right modality badge */}
                      <span className="absolute top-1.5 right-1.5 text-[8.5px] font-bold bg-black/80 border border-white/25 rounded px-1 text-white">
                        {ser.modality}
                      </span>
                    </div>

                    {/* Bottom Info */}
                    <div className="p-1.5 bg-[#11141e] border-t border-[#181d2e] flex flex-col gap-0.5">
                      <span className="text-[10.5px] font-semibold text-[#f1f5f9] truncate">
                        #{ser.seriesNumber ?? ''} {ser.modality} · {ser.seriesDescription || 'Unnamed'}
                      </span>
                      <div className="text-[9.5px] text-[#64748b] flex justify-between font-mono">
                        <span className="uppercase text-purple-300">{ser.calculatedOrientation}</span>
                        <span>{ser.instanceCount} leikettä</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>
      </div>

      {/* ── Status Bar ────────────────────────────────────────────── */}
      <footer className="h-7 bg-[#0e1017] border-t border-[#21273b] px-3.5 flex items-center justify-between text-[11px] text-[#64748b] shrink-0">
        <div className="flex items-center gap-3">
          <span>
            Näytetään <strong className="text-[#94a3b8] font-bold font-mono">{studies.length}</strong> / <span className="font-mono">{facets?.totalStudies || studies.length}</span> tutkimusta
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[#94a3b8] truncate max-w-sm">
            Valittu:{' '}
            <strong className="text-cyan-400">
              {numSelectedSeries > 0
                ? `${numSelectedSeries} sarjaa valittu (${numSelectedStudies} tutkimuksesta)`
                : activeStudy
                ? `${activeStudy.patientName} (${activeStudy.patientId})`
                : 'Ei valintaa'}
            </strong>
          </span>
          <button
            onClick={() => {
              fetchConfig();
              fetchStudies();
            }}
            className="px-2 py-0.5 bg-[#131722] hover:bg-[#1a2030] border border-[#21273b] hover:border-cyan-400 text-cyan-400 rounded text-[10px] flex items-center gap-1 transition-colors"
          >
            🔄 Päivitä
          </button>
        </div>
      </footer>

      {/* Fullscreen Drag & Drop Overlay */}
      {isDraggingOver && (
        <div
          onDragLeave={(e) => {
            if (!e.relatedTarget || (e.relatedTarget as Element).nodeName === 'HTML') {
              setIsDraggingOver(false);
            }
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="fixed inset-0 z-50 bg-[#090b10]/85 backdrop-blur-sm border-4 border-dashed border-cyan-400 flex flex-col items-center justify-center animate-in fade-in duration-100 select-none"
        >
          <UploadCloud className="w-16 h-16 text-cyan-400 mb-3 animate-bounce" />
          <h2 className="text-xl font-bold text-white mb-1">Pudota DICOM-tiedostot tai kansiot tähän</h2>
          <p className="text-xs text-cyan-200">Tiedostot tallennetaan ja indeksoidaan automaattisesti tutkimuslistaan</p>
        </div>
      )}

      {/* Uploading Progress Modal */}
      {isUploading && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] flex items-center justify-center animate-in fade-in duration-100 select-none">
          <div className="bg-[#11141e] border border-[#21273b] rounded-lg p-5 max-w-sm w-full mx-4 shadow-2xl flex flex-col items-center gap-3">
            <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
            <div className="text-center">
              <h3 className="font-bold text-sm text-[#f1f5f9]">Tallennetaan ja indeksoidaan tiedostoja...</h3>
              {uploadProgress && (
                <p className="text-xs text-[#94a3b8] mt-1 font-mono">
                  {uploadProgress.processed} / {uploadProgress.total} tiedostoa käsitelty
                </p>
              )}
            </div>
            {uploadProgress && (
              <div className="w-full bg-[#080a0e] rounded-full h-1.5 overflow-hidden border border-[#21273b]">
                <div
                  className="bg-cyan-400 h-full transition-all duration-150"
                  style={{ width: `${(uploadProgress.processed / Math.max(1, uploadProgress.total)) * 100}%` }}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
