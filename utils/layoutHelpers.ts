import { LayoutNode, DICOMStudy, ViewportState } from './types';

export const MAX_LAYOUT_COLS = 6;
export const MAX_LAYOUT_ROWS = 4;
export const MAX_VIEWPORTS = 24;

export const createDefaultViewports = (count: number = MAX_VIEWPORTS): ViewportState[] =>
  Array(count)
    .fill(null)
    .map(() => ({ studyInstanceUID: null, seriesInstanceUID: null, imageIndex: 0 }));

/**
 * Traverses a LayoutNode tree to collect all active viewport indices.
 */
export const getVisibleViewportIndices = (node: LayoutNode): number[] => {
  if (node.type === 'viewport') {
    return [node.viewportIndex];
  }
  return node.children.flatMap(getVisibleViewportIndices);
};

/**
 * Finds the first unused viewport index from [0 ... maxSlots - 1] given an existing tree.
 */
export const getNextAvailableViewportIndex = (root: LayoutNode, maxSlots: number = MAX_VIEWPORTS): number => {
  const used = new Set(getVisibleViewportIndices(root));
  for (let i = 0; i < maxSlots; i++) {
    if (!used.has(i)) return i;
  }
  return used.size;
};

/**
 * Computes the effective column and row dimensions for any layout tree.
 */
export const getLayoutDimensions = (node: LayoutNode): { cols: number; rows: number } => {
  if (node.type === 'viewport') {
    return { cols: 1, rows: 1 };
  }
  const [child0, child1] = node.children;
  const d0 = getLayoutDimensions(child0);
  const d1 = getLayoutDimensions(child1);

  if (node.direction === 'horizontal') {
    return {
      cols: d0.cols + d1.cols,
      rows: Math.max(d0.rows, d1.rows),
    };
  } else {
    return {
      cols: Math.max(d0.cols, d1.cols),
      rows: d0.rows + d1.rows,
    };
  }
};

/**
 * Checks if a target node in the layout tree can be split without exceeding grid limits:
 * - Max 6 columns (vierekkäistä)
 * - Max 4 rows (päällekkäistä)
 */
export const canSplitNode = (
  root: LayoutNode,
  targetNodeId: string,
  direction: 'horizontal' | 'vertical'
): boolean => {
  const simulated = rawSplitViewportNode(root, targetNodeId, direction);
  const dims = getLayoutDimensions(simulated);
  if (dims.cols > MAX_LAYOUT_COLS) return false;
  if (dims.rows > MAX_LAYOUT_ROWS) return false;
  return true;
};

/**
 * Internal raw split helper that performs tree modification.
 */
const rawSplitViewportNode = (
  root: LayoutNode,
  targetNodeId: string,
  direction: 'horizontal' | 'vertical'
): LayoutNode => {
  const nextIdx = getNextAvailableViewportIndex(root);

  const doSplit = (node: LayoutNode): LayoutNode => {
    if (node.type === 'viewport') {
      if (node.id === targetNodeId) {
        return {
          type: 'split',
          direction,
          id: `split_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          children: [
            { type: 'viewport', id: node.id, viewportIndex: node.viewportIndex },
            {
              type: 'viewport',
              id: `vp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              viewportIndex: nextIdx,
            },
          ],
        };
      }
      return node;
    }

    return {
      ...node,
      children: node.children.map(doSplit),
    };
  };

  return doSplit(root);
};

/**
 * Recursively splits a target viewport node by ID into two child viewports,
 * guarded by maximum column and row constraints.
 */
export const splitViewportNode = (
  root: LayoutNode,
  targetNodeId: string,
  direction: 'horizontal' | 'vertical'
): LayoutNode => {
  if (!canSplitNode(root, targetNodeId, direction)) {
    return root;
  }
  return rawSplitViewportNode(root, targetNodeId, direction);
};

/**
 * Recursively closes a viewport node by ID and collapses the parent split to the remaining sibling.
 */
export const closeViewportNode = (root: LayoutNode, targetNodeId: string): LayoutNode | null => {
  if (root.type === 'viewport') {
    return root.id === targetNodeId ? null : root;
  }

  const updatedChildren = root.children
    .map((child) => closeViewportNode(child, targetNodeId))
    .filter((child): child is LayoutNode => child !== null);

  if (updatedChildren.length === 0) return null;
  if (updatedChildren.length === 1) return updatedChildren[0];

  return {
    ...root,
    children: updatedChildren,
  };
};

/**
 * Automatically calculates the optimal hanging protocol layout and viewport bindings
 * based on loaded study series:
 * - 1 series: 1x1
 * - 2 series: 1x2 (horizontal split / 2 columns)
 * - 3 series: 1x3 (horizontal split / 3 columns)
 * - 4+ series: 2x2 (grid)
 * - Special case (Spine MRI with T2 Ax, T2 Sag, T1 Sag): 1+2 layout
 */
export const determineHangingProtocol = (
  studies: DICOMStudy[]
): { layout: LayoutNode; viewports: ViewportState[] } | null => {
  if (studies.length === 0) return null;

  // Flatten all series across loaded studies
  const allSeriesWithStudy: { studyUID: string; series: DICOMStudy['series'][0] }[] = [];
  studies.forEach((st) => {
    st.series.forEach((ser) => {
      allSeriesWithStudy.push({ studyUID: st.studyInstanceUID, series: ser });
    });
  });

  if (allSeriesWithStudy.length === 0) return null;

  const defaultVps = createDefaultViewports();

  // Special Case: Spine MRI with T2 Ax, T2 Sag, and T1 Sag (3 series) -> 1+2 Layout
  const t2Ax = allSeriesWithStudy.find(
    (item) =>
      item.series.seriesDescription.toLowerCase().includes('t2') &&
      (item.series.seriesDescription.toLowerCase().includes('tra') || item.series.seriesDescription.toLowerCase().includes('ax'))
  );
  const t2Sag = allSeriesWithStudy.find(
    (item) =>
      item.series.seriesDescription.toLowerCase().includes('t2') &&
      (item.series.seriesDescription.toLowerCase().includes('sag') || item.series.seriesDescription.toLowerCase().includes('sagit'))
  );
  const t1Sag = allSeriesWithStudy.find(
    (item) =>
      item.series.seriesDescription.toLowerCase().includes('t1') &&
      (item.series.seriesDescription.toLowerCase().includes('sag') || item.series.seriesDescription.toLowerCase().includes('sagit'))
  );

  if (t2Ax && t2Sag && t1Sag && allSeriesWithStudy.length === 3) {
    const hangingLayout: LayoutNode = {
      type: 'split',
      direction: 'horizontal',
      id: 'hanging_spine_mri',
      children: [
        { type: 'viewport', id: 'vp_t2_ax', viewportIndex: 0 },
        {
          type: 'split',
          direction: 'vertical',
          id: 'hanging_spine_sag_split',
          children: [
            { type: 'viewport', id: 'vp_t2_sag', viewportIndex: 1 },
            { type: 'viewport', id: 'vp_t1_sag', viewportIndex: 2 },
          ],
        },
      ],
    };
    defaultVps[0] = { studyInstanceUID: t2Ax.studyUID, seriesInstanceUID: t2Ax.series.seriesInstanceUID, imageIndex: 0 };
    defaultVps[1] = { studyInstanceUID: t2Sag.studyUID, seriesInstanceUID: t2Sag.series.seriesInstanceUID, imageIndex: 0 };
    defaultVps[2] = { studyInstanceUID: t1Sag.studyUID, seriesInstanceUID: t1Sag.series.seriesInstanceUID, imageIndex: 0 };
    return { layout: hangingLayout, viewports: defaultVps };
  }

  // 4 or more series -> 2x2 Grid Layout
  if (allSeriesWithStudy.length >= 4) {
    const s0 = allSeriesWithStudy[0];
    const s1 = allSeriesWithStudy[1];
    const s2 = allSeriesWithStudy[2];
    const s3 = allSeriesWithStudy[3];

    const hangingLayout: LayoutNode = {
      type: 'split',
      direction: 'vertical',
      id: 'hanging_2x2',
      children: [
        {
          type: 'split',
          direction: 'horizontal',
          id: 'hanging_2x2_top',
          children: [
            { type: 'viewport', id: 'vp_2x2_0', viewportIndex: 0 },
            { type: 'viewport', id: 'vp_2x2_1', viewportIndex: 1 },
          ],
        },
        {
          type: 'split',
          direction: 'horizontal',
          id: 'hanging_2x2_bottom',
          children: [
            { type: 'viewport', id: 'vp_2x2_2', viewportIndex: 2 },
            { type: 'viewport', id: 'vp_2x2_3', viewportIndex: 3 },
          ],
        },
      ],
    };
    defaultVps[0] = { studyInstanceUID: s0.studyUID, seriesInstanceUID: s0.series.seriesInstanceUID, imageIndex: 0 };
    defaultVps[1] = { studyInstanceUID: s1.studyUID, seriesInstanceUID: s1.series.seriesInstanceUID, imageIndex: 0 };
    defaultVps[2] = { studyInstanceUID: s2.studyUID, seriesInstanceUID: s2.series.seriesInstanceUID, imageIndex: 0 };
    defaultVps[3] = { studyInstanceUID: s3.studyUID, seriesInstanceUID: s3.series.seriesInstanceUID, imageIndex: 0 };
    return { layout: hangingLayout, viewports: defaultVps };
  }

  // 3 series (Generic) -> 1x3 Columns Layout
  if (allSeriesWithStudy.length === 3) {
    const s0 = allSeriesWithStudy[0];
    const s1 = allSeriesWithStudy[1];
    const s2 = allSeriesWithStudy[2];

    const hangingLayout: LayoutNode = {
      type: 'split',
      direction: 'horizontal',
      id: 'hanging_1x3',
      children: [
        { type: 'viewport', id: 'vp_1x3_0', viewportIndex: 0 },
        {
          type: 'split',
          direction: 'horizontal',
          id: 'hanging_1x3_sub',
          children: [
            { type: 'viewport', id: 'vp_1x3_1', viewportIndex: 1 },
            { type: 'viewport', id: 'vp_1x3_2', viewportIndex: 2 },
          ],
        },
      ],
    };
    defaultVps[0] = { studyInstanceUID: s0.studyUID, seriesInstanceUID: s0.series.seriesInstanceUID, imageIndex: 0 };
    defaultVps[1] = { studyInstanceUID: s1.studyUID, seriesInstanceUID: s1.series.seriesInstanceUID, imageIndex: 0 };
    defaultVps[2] = { studyInstanceUID: s2.studyUID, seriesInstanceUID: s2.series.seriesInstanceUID, imageIndex: 0 };
    return { layout: hangingLayout, viewports: defaultVps };
  }

  // 2 series -> 1x2 Columns Layout
  if (allSeriesWithStudy.length === 2) {
    let s0 = allSeriesWithStudy[0];
    let s1 = allSeriesWithStudy[1];

    // Prefer T2 Sag on Left (vp 0) and T1 Sag on Right (vp 1) if both are present
    if (t2Sag && t1Sag) {
      s0 = t2Sag;
      s1 = t1Sag;
    }

    const hangingLayout: LayoutNode = {
      type: 'split',
      direction: 'horizontal',
      id: 'hanging_1x2',
      children: [
        { type: 'viewport', id: 'vp_1x2_0', viewportIndex: 0 },
        { type: 'viewport', id: 'vp_1x2_1', viewportIndex: 1 },
      ],
    };
    defaultVps[0] = { studyInstanceUID: s0.studyUID, seriesInstanceUID: s0.series.seriesInstanceUID, imageIndex: 0 };
    defaultVps[1] = { studyInstanceUID: s1.studyUID, seriesInstanceUID: s1.series.seriesInstanceUID, imageIndex: 0 };
    return { layout: hangingLayout, viewports: defaultVps };
  }

  // 1 series -> 1x1 Single Viewport Layout
  const s0 = allSeriesWithStudy[0];
  const hangingLayout: LayoutNode = {
    type: 'viewport',
    id: 'root',
    viewportIndex: 0,
  };
  defaultVps[0] = { studyInstanceUID: s0.studyUID, seriesInstanceUID: s0.series.seriesInstanceUID, imageIndex: 0 };
  return { layout: hangingLayout, viewports: defaultVps };
};

/**
 * Creates a clean layout tree for 1, 2, 3, or 4 viewports for Quick Layout mode.
 */
export const createQuickLayout = (count: number): LayoutNode => {
  if (count === 1) {
    return { type: 'viewport', id: 'quick_1x1', viewportIndex: 0 };
  }
  if (count === 2) {
    return {
      type: 'split',
      direction: 'horizontal',
      id: 'quick_1x2',
      children: [
        { type: 'viewport', id: 'quick_vp_0', viewportIndex: 0 },
        { type: 'viewport', id: 'quick_vp_1', viewportIndex: 1 },
      ],
    };
  }
  if (count === 3) {
    return {
      type: 'split',
      direction: 'horizontal',
      id: 'quick_1x3',
      children: [
        { type: 'viewport', id: 'quick_vp_0', viewportIndex: 0 },
        {
          type: 'split',
          direction: 'horizontal',
          id: 'quick_1x3_sub',
          children: [
            { type: 'viewport', id: 'quick_vp_1', viewportIndex: 1 },
            { type: 'viewport', id: 'quick_vp_2', viewportIndex: 2 },
          ],
        },
      ],
    };
  }
  // count === 4 -> 2x2 Grid
  return {
    type: 'split',
    direction: 'vertical',
    id: 'quick_2x2',
    children: [
      {
        type: 'split',
        direction: 'horizontal',
        id: 'quick_2x2_top',
        children: [
          { type: 'viewport', id: 'quick_vp_0', viewportIndex: 0 },
          { type: 'viewport', id: 'quick_vp_1', viewportIndex: 1 },
        ],
      },
      {
        type: 'split',
        direction: 'horizontal',
        id: 'quick_2x2_bottom',
        children: [
          { type: 'viewport', id: 'quick_vp_2', viewportIndex: 2 },
          { type: 'viewport', id: 'quick_vp_3', viewportIndex: 3 },
        ],
      },
    ],
  };
};
