export interface ClickModifiers {
  isCtrlOrCmd: boolean;
  isShift: boolean;
}

export interface TreeItem {
  id: string; // e.g. "study:std.1" or "series:ser.1"
  type: 'study' | 'series';
  studyUid: string;
  seriesUid?: string;
  seriesUids: string[]; // for study: all its series UIDs; for series: [seriesUid]
}

export interface HierarchicalSelectionState {
  selectedSeriesUids: Set<string>;
  anchorItemId: string | null;
  activeItemId: string | null;
}

export type StudyCheckState = 'checked' | 'indeterminate' | 'unchecked';

/**
 * Calculates whether a study is checked (all series selected),
 * indeterminate (some series selected), or unchecked (no series selected).
 */
export function getStudyCheckState(
  studySeriesUids: string[],
  selectedSeriesUids: Set<string>
): StudyCheckState {
  if (studySeriesUids.length === 0) return 'unchecked';
  let matchCount = 0;
  for (const sUid of studySeriesUids) {
    if (selectedSeriesUids.has(sUid)) {
      matchCount++;
    }
  }
  if (matchCount === 0) return 'unchecked';
  if (matchCount === studySeriesUids.length) return 'checked';
  return 'indeterminate';
}

/**
 * Handles clicking a visible tree item (study or series) with Finder/Explorer semantics.
 */
export function handleTreeItemClick(
  visibleItems: TreeItem[],
  targetItem: TreeItem,
  currentState: HierarchicalSelectionState,
  modifiers: ClickModifiers
): HierarchicalSelectionState {
  const targetIdx = visibleItems.findIndex((it) => it.id === targetItem.id);
  if (targetIdx === -1) return currentState;

  const { isCtrlOrCmd, isShift } = modifiers;

  // 1. Shift + Click: Range selection in the visible tree
  if (isShift) {
    const effectiveAnchor =
      currentState.anchorItemId && visibleItems.some((it) => it.id === currentState.anchorItemId)
        ? currentState.anchorItemId
        : currentState.activeItemId && visibleItems.some((it) => it.id === currentState.activeItemId)
        ? currentState.activeItemId
        : visibleItems[0]?.id || targetItem.id;

    const anchorIdx = visibleItems.findIndex((it) => it.id === effectiveAnchor);
    const validAnchorIdx = anchorIdx !== -1 ? anchorIdx : 0;
    const start = Math.min(validAnchorIdx, targetIdx);
    const end = Math.max(validAnchorIdx, targetIdx);
    const rangeItems = visibleItems.slice(start, end + 1);

    const nextSelected = isCtrlOrCmd
      ? new Set(currentState.selectedSeriesUids)
      : new Set<string>();

    for (const it of rangeItems) {
      for (const sUid of it.seriesUids) {
        nextSelected.add(sUid);
      }
    }

    return {
      selectedSeriesUids: nextSelected,
      anchorItemId: effectiveAnchor,
      activeItemId: targetItem.id,
    };
  }

  // 2. Cmd / Ctrl + Click: Toggle selection
  if (isCtrlOrCmd) {
    const nextSelected = new Set(currentState.selectedSeriesUids);

    if (targetItem.type === 'study') {
      const checkState = getStudyCheckState(targetItem.seriesUids, currentState.selectedSeriesUids);
      if (checkState === 'checked') {
        // Unselect all series of this study
        for (const sUid of targetItem.seriesUids) {
          nextSelected.delete(sUid);
        }
      } else {
        // Select all series of this study
        for (const sUid of targetItem.seriesUids) {
          nextSelected.add(sUid);
        }
      }
    } else {
      // Series item toggle
      const sUid = targetItem.seriesUid || targetItem.seriesUids[0];
      if (sUid) {
        if (nextSelected.has(sUid)) {
          nextSelected.delete(sUid);
        } else {
          nextSelected.add(sUid);
        }
      }
    }

    return {
      selectedSeriesUids: nextSelected,
      anchorItemId: targetItem.id,
      activeItemId: targetItem.id,
    };
  }

  // 3. Normal Single Click: Select only this item's series, clear others
  return {
    selectedSeriesUids: new Set(targetItem.seriesUids),
    anchorItemId: targetItem.id,
    activeItemId: targetItem.id,
  };
}

/**
 * Handles arrow key navigation (Up/Down) through the visible tree with optional Shift range extension.
 */
export function handleTreeArrowNavigation(
  visibleItems: TreeItem[],
  direction: 'up' | 'down',
  currentState: HierarchicalSelectionState,
  isShift: boolean
): HierarchicalSelectionState {
  if (visibleItems.length === 0) return currentState;

  const currentIdx = currentState.activeItemId
    ? visibleItems.findIndex((it) => it.id === currentState.activeItemId)
    : -1;

  let nextIdx: number;
  if (direction === 'down') {
    nextIdx = currentIdx === -1 ? 0 : Math.min(visibleItems.length - 1, currentIdx + 1);
  } else {
    nextIdx = currentIdx === -1 ? 0 : Math.max(0, currentIdx - 1);
  }

  const nextItem = visibleItems[nextIdx];

  // Shift + Arrow: extend/shrink range from anchor
  if (isShift) {
    const effectiveAnchor =
      currentState.anchorItemId && visibleItems.some((it) => it.id === currentState.anchorItemId)
        ? currentState.anchorItemId
        : currentIdx !== -1
        ? visibleItems[currentIdx].id
        : nextItem.id;

    const anchorIdx = visibleItems.findIndex((it) => it.id === effectiveAnchor);
    const validAnchorIdx = anchorIdx !== -1 ? anchorIdx : 0;
    const start = Math.min(validAnchorIdx, nextIdx);
    const end = Math.max(validAnchorIdx, nextIdx);
    const rangeItems = visibleItems.slice(start, end + 1);

    const nextSelected = new Set<string>();
    for (const it of rangeItems) {
      for (const sUid of it.seriesUids) {
        nextSelected.add(sUid);
      }
    }

    return {
      selectedSeriesUids: nextSelected,
      anchorItemId: effectiveAnchor,
      activeItemId: nextItem.id,
    };
  }

  // Normal arrow navigation
  return {
    selectedSeriesUids: new Set(nextItem.seriesUids),
    anchorItemId: nextItem.id,
    activeItemId: nextItem.id,
  };
}

/**
 * Handles Select All (Cmd+A / Ctrl+A) across all studies & series.
 */
export function handleTreeSelectAll(
  visibleItems: TreeItem[],
  allSeriesUids: string[],
  currentState: HierarchicalSelectionState
): HierarchicalSelectionState {
  return {
    selectedSeriesUids: new Set(allSeriesUids),
    anchorItemId: currentState.anchorItemId || (visibleItems.length > 0 ? visibleItems[0].id : null),
    activeItemId: currentState.activeItemId || (visibleItems.length > 0 ? visibleItems[0].id : null),
  };
}
