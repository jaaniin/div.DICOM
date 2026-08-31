import { describe, it, expect } from 'vitest';
import {
  getVisibleViewportIndices,
  getNextAvailableViewportIndex,
  splitViewportNode,
  closeViewportNode,
  determineHangingProtocol,
  getLayoutDimensions,
  canSplitNode,
  createQuickLayout,
  MAX_LAYOUT_COLS,
  MAX_LAYOUT_ROWS,
} from '../utils/layoutHelpers';
import { LayoutNode, DICOMStudy } from '../utils/types';
import { isSystemOrMetadataFile } from '../utils/dicomFiles';

const getLeafViewportIds = (node: LayoutNode): string[] => {
  if (node.type === 'viewport') return [node.id];
  return node.children.flatMap(getLeafViewportIds);
};

describe('Layout Helpers (getVisibleViewportIndices & getNextAvailableViewportIndex)', () => {
  it('returns viewport index for a single viewport node', () => {
    const singleNode: LayoutNode = { type: 'viewport', id: 'vp_0', viewportIndex: 0 };
    expect(getVisibleViewportIndices(singleNode)).toEqual([0]);
  });

  it('traverses split nodes to return all leaf viewport indices', () => {
    const splitTree: LayoutNode = {
      type: 'split',
      direction: 'horizontal',
      id: 'split_root',
      children: [
        { type: 'viewport', id: 'vp_0', viewportIndex: 0 },
        {
          type: 'split',
          direction: 'vertical',
          id: 'split_right',
          children: [
            { type: 'viewport', id: 'vp_1', viewportIndex: 1 },
            { type: 'viewport', id: 'vp_2', viewportIndex: 2 },
          ],
        },
      ],
    };
    expect(getVisibleViewportIndices(splitTree)).toEqual([0, 1, 2]);
  });

  it('finds the next available unused viewport index above 3 when 0..3 are used', () => {
    const grid2x2: LayoutNode = {
      type: 'split',
      direction: 'vertical',
      id: 'grid_root',
      children: [
        {
          type: 'split',
          direction: 'horizontal',
          id: 'top',
          children: [
            { type: 'viewport', id: 'vp_0', viewportIndex: 0 },
            { type: 'viewport', id: 'vp_1', viewportIndex: 1 },
          ],
        },
        {
          type: 'split',
          direction: 'horizontal',
          id: 'bottom',
          children: [
            { type: 'viewport', id: 'vp_2', viewportIndex: 2 },
            { type: 'viewport', id: 'vp_3', viewportIndex: 3 },
          ],
        },
      ],
    };

    expect(getNextAvailableViewportIndex(grid2x2)).toBe(4);
  });
});

describe('Layout Dimensions and Split Limits', () => {
  it('computes dimensions correctly for 1x1, 1x2, 2x2, and 1+2 layouts', () => {
    const singleNode: LayoutNode = { type: 'viewport', id: 'vp_0', viewportIndex: 0 };
    expect(getLayoutDimensions(singleNode)).toEqual({ cols: 1, rows: 1 });

    const layout1x2: LayoutNode = {
      type: 'split',
      direction: 'horizontal',
      id: 's_1x2',
      children: [
        { type: 'viewport', id: 'vp_0', viewportIndex: 0 },
        { type: 'viewport', id: 'vp_1', viewportIndex: 1 },
      ],
    };
    expect(getLayoutDimensions(layout1x2)).toEqual({ cols: 2, rows: 1 });

    const layout2x2: LayoutNode = {
      type: 'split',
      direction: 'vertical',
      id: 's_2x2',
      children: [
        layout1x2,
        {
          type: 'split',
          direction: 'horizontal',
          id: 's_1x2_b',
          children: [
            { type: 'viewport', id: 'vp_2', viewportIndex: 2 },
            { type: 'viewport', id: 'vp_3', viewportIndex: 3 },
          ],
        },
      ],
    };
    expect(getLayoutDimensions(layout2x2)).toEqual({ cols: 2, rows: 2 });
  });

  it('allows splits within max constraints (max 6 cols, max 4 rows)', () => {
    let tree: LayoutNode = { type: 'viewport', id: 'vp_0', viewportIndex: 0 };

    // Split horizontally 5 times to reach 6 columns
    for (let i = 0; i < 5; i++) {
      const leaves = getLeafViewportIds(tree);
      const targetId = leaves[leaves.length - 1];
      expect(canSplitNode(tree, targetId, 'horizontal')).toBe(true);
      tree = splitViewportNode(tree, targetId, 'horizontal');
    }

    const dims = getLayoutDimensions(tree);
    expect(dims.cols).toBe(6);

    // 7th horizontal split should be disallowed
    const leaves = getLeafViewportIds(tree);
    expect(canSplitNode(tree, leaves[0], 'horizontal')).toBe(false);
  });

  it('allows splits up to max 4 rows and prevents 5th row', () => {
    let tree: LayoutNode = { type: 'viewport', id: 'vp_0', viewportIndex: 0 };

    // Split vertically 3 times to reach 4 rows
    for (let i = 0; i < 3; i++) {
      const leaves = getLeafViewportIds(tree);
      const targetId = leaves[leaves.length - 1];
      expect(canSplitNode(tree, targetId, 'vertical')).toBe(true);
      tree = splitViewportNode(tree, targetId, 'vertical');
    }

    const dims = getLayoutDimensions(tree);
    expect(dims.rows).toBe(4);

    // 5th vertical split should be disallowed
    const leaves = getLeafViewportIds(tree);
    expect(canSplitNode(tree, leaves[0], 'vertical')).toBe(false);
  });
});

describe('Dynamic Tree Splitting and Closing', () => {
  it('splits a target viewport horizontally with a unique viewport index', () => {
    const singleNode: LayoutNode = { type: 'viewport', id: 'vp_0', viewportIndex: 0 };
    const splitTree = splitViewportNode(singleNode, 'vp_0', 'horizontal');

    expect(splitTree.type).toBe('split');
    if (splitTree.type === 'split') {
      expect(splitTree.direction).toBe('horizontal');
      expect(splitTree.children).toHaveLength(2);
      expect(splitTree.children[0].type).toBe('viewport');
      expect(splitTree.children[1].type).toBe('viewport');
      expect(getVisibleViewportIndices(splitTree)).toEqual([0, 1]);
    }
  });

  it('correctly allocates unique index when splitting a nested viewport inside a 2x2 grid', () => {
    const grid2x2: LayoutNode = {
      type: 'split',
      direction: 'vertical',
      id: 'grid_root',
      children: [
        {
          type: 'split',
          direction: 'horizontal',
          id: 'top',
          children: [
            { type: 'viewport', id: 'vp_0', viewportIndex: 0 },
            { type: 'viewport', id: 'vp_1', viewportIndex: 1 },
          ],
        },
        {
          type: 'split',
          direction: 'horizontal',
          id: 'bottom',
          children: [
            { type: 'viewport', id: 'vp_2', viewportIndex: 2 },
            { type: 'viewport', id: 'vp_3', viewportIndex: 3 },
          ],
        },
      ],
    };

    const splitTree = splitViewportNode(grid2x2, 'vp_0', 'vertical');
    const visibleIndices = getVisibleViewportIndices(splitTree);
    expect(visibleIndices).toEqual([0, 4, 1, 2, 3]);
    expect(new Set(visibleIndices).size).toBe(5);
  });

  it('closes a viewport node and collapses the split to the remaining child', () => {
    const splitTree: LayoutNode = {
      type: 'split',
      direction: 'horizontal',
      id: 'split_1',
      children: [
        { type: 'viewport', id: 'vp_0', viewportIndex: 0 },
        { type: 'viewport', id: 'vp_1', viewportIndex: 1 },
      ],
    };

    const remainingTree = closeViewportNode(splitTree, 'vp_1');
    expect(remainingTree).not.toBeNull();
    expect(remainingTree?.type).toBe('viewport');
    if (remainingTree?.type === 'viewport') {
      expect(remainingTree.viewportIndex).toBe(0);
    }
  });
});

describe('Hanging Protocols (determineHangingProtocol)', () => {
  it('creates 1x1 layout for 1 series', () => {
    const mockStudy: DICOMStudy = {
      studyInstanceUID: '1.2.840',
      patientName: 'Single Series Patient',
      patientId: 'P01',
      studyDate: '20260830',
      series: [
        {
          seriesInstanceUID: 'ser_1',
          seriesDescription: 'Chest CT',
          modality: 'CT',
          instances: [{ file: new File([], 'ct.dcm'), imageId: 'id1', metadata: {} } as any],
        },
      ],
    };

    const protocol = determineHangingProtocol([mockStudy]);
    expect(protocol).not.toBeNull();
    expect(protocol!.layout.type).toBe('viewport');
    expect(protocol!.viewports[0].seriesInstanceUID).toBe('ser_1');
    expect(getVisibleViewportIndices(protocol!.layout)).toEqual([0]);
  });

  it('creates 1x2 columns layout for 2 series', () => {
    const mockStudy: DICOMStudy = {
      studyInstanceUID: '1.2.840',
      patientName: 'Two Series Patient',
      patientId: 'P02',
      studyDate: '20260830',
      series: [
        {
          seriesInstanceUID: 'ser_t1',
          seriesDescription: 'T1 SAG FSE',
          modality: 'MR',
          instances: [{ file: new File([], 't1.dcm'), imageId: 'id1', metadata: {} } as any],
        },
        {
          seriesInstanceUID: 'ser_t2',
          seriesDescription: 'T2 SAG FSE',
          modality: 'MR',
          instances: [{ file: new File([], 't2.dcm'), imageId: 'id2', metadata: {} } as any],
        },
      ],
    };

    const protocol = determineHangingProtocol([mockStudy]);
    expect(protocol).not.toBeNull();
    expect(protocol!.layout.type).toBe('split');
    if (protocol!.layout.type === 'split') {
      expect(protocol!.layout.direction).toBe('horizontal');
      expect(getVisibleViewportIndices(protocol!.layout)).toEqual([0, 1]);
    }
    expect(protocol!.viewports[0].seriesInstanceUID).toBe('ser_t2');
    expect(protocol!.viewports[1].seriesInstanceUID).toBe('ser_t1');
  });

  it('creates 1x3 columns layout for 3 generic series', () => {
    const mockStudy: DICOMStudy = {
      studyInstanceUID: '1.2.840',
      patientName: 'Three Series Patient',
      patientId: 'P03',
      studyDate: '20260830',
      series: [
        {
          seriesInstanceUID: 'ser_c1',
          seriesDescription: 'Brain FLAIR AX',
          modality: 'MR',
          instances: [{ file: new File([], 'f.dcm'), imageId: 'id1', metadata: {} } as any],
        },
        {
          seriesInstanceUID: 'ser_c2',
          seriesDescription: 'Brain DWI AX',
          modality: 'MR',
          instances: [{ file: new File([], 'd.dcm'), imageId: 'id2', metadata: {} } as any],
        },
        {
          seriesInstanceUID: 'ser_c3',
          seriesDescription: 'Brain ADC AX',
          modality: 'MR',
          instances: [{ file: new File([], 'a.dcm'), imageId: 'id3', metadata: {} } as any],
        },
      ],
    };

    const protocol = determineHangingProtocol([mockStudy]);
    expect(protocol).not.toBeNull();
    expect(getVisibleViewportIndices(protocol!.layout)).toEqual([0, 1, 2]);
    expect(protocol!.viewports[0].seriesInstanceUID).toBe('ser_c1');
    expect(protocol!.viewports[1].seriesInstanceUID).toBe('ser_c2');
    expect(protocol!.viewports[2].seriesInstanceUID).toBe('ser_c3');
  });

  it('creates 1+2 layout specifically for 3-series Spine MRI (T2 Ax + T2 Sag + T1 Sag)', () => {
    const mockStudy: DICOMStudy = {
      studyInstanceUID: '1.2.840',
      patientName: 'Spine MRI Patient',
      patientId: 'P04',
      studyDate: '20260830',
      series: [
        {
          seriesInstanceUID: 'ser_t2_ax',
          seriesDescription: 'T2 AX FSE',
          modality: 'MR',
          instances: [{ file: new File([], 'ax.dcm'), imageId: 'id1', metadata: {} } as any],
        },
        {
          seriesInstanceUID: 'ser_t2_sag',
          seriesDescription: 'T2 SAG FSE',
          modality: 'MR',
          instances: [{ file: new File([], 'sag2.dcm'), imageId: 'id2', metadata: {} } as any],
        },
        {
          seriesInstanceUID: 'ser_t1_sag',
          seriesDescription: 'T1 SAG FSE',
          modality: 'MR',
          instances: [{ file: new File([], 'sag1.dcm'), imageId: 'id3', metadata: {} } as any],
        },
      ],
    };

    const protocol = determineHangingProtocol([mockStudy]);
    expect(protocol).not.toBeNull();
    expect(getVisibleViewportIndices(protocol!.layout)).toEqual([0, 1, 2]);
    expect(protocol!.viewports[0].seriesInstanceUID).toBe('ser_t2_ax');
    expect(protocol!.viewports[1].seriesInstanceUID).toBe('ser_t2_sag');
    expect(protocol!.viewports[2].seriesInstanceUID).toBe('ser_t1_sag');
  });

  it('creates 2x2 grid layout for 4 series', () => {
    const mockStudy: DICOMStudy = {
      studyInstanceUID: '1.2.840',
      patientName: 'Four Series Patient',
      patientId: 'P05',
      studyDate: '20260830',
      series: [
        {
          seriesInstanceUID: 'ser_1',
          seriesDescription: 'Series 1',
          modality: 'MR',
          instances: [{ file: new File([], '1.dcm'), imageId: 'id1', metadata: {} } as any],
        },
        {
          seriesInstanceUID: 'ser_2',
          seriesDescription: 'Series 2',
          modality: 'MR',
          instances: [{ file: new File([], '2.dcm'), imageId: 'id2', metadata: {} } as any],
        },
        {
          seriesInstanceUID: 'ser_3',
          seriesDescription: 'Series 3',
          modality: 'MR',
          instances: [{ file: new File([], '3.dcm'), imageId: 'id3', metadata: {} } as any],
        },
        {
          seriesInstanceUID: 'ser_4',
          seriesDescription: 'Series 4',
          modality: 'MR',
          instances: [{ file: new File([], '4.dcm'), imageId: 'id4', metadata: {} } as any],
        },
      ],
    };

    const protocol = determineHangingProtocol([mockStudy]);
    expect(protocol).not.toBeNull();
    expect(getVisibleViewportIndices(protocol!.layout)).toEqual([0, 1, 2, 3]);
    expect(protocol!.viewports[0].seriesInstanceUID).toBe('ser_1');
    expect(protocol!.viewports[1].seriesInstanceUID).toBe('ser_2');
    expect(protocol!.viewports[2].seriesInstanceUID).toBe('ser_3');
    expect(protocol!.viewports[3].seriesInstanceUID).toBe('ser_4');
  });
});

describe('DICOM File Filter', () => {
  it('identifies Windows Zone.Identifier metadata files', () => {
    expect(isSystemOrMetadataFile(new File([], 'image.dcm:Zone.Identifier'))).toBe(true);
    expect(isSystemOrMetadataFile(new File([], 'image.dcm.Zone.Identifier'))).toBe(true);
  });

  it('identifies OS hidden files like .DS_Store and Thumbs.db', () => {
    expect(isSystemOrMetadataFile(new File([], '.DS_Store'))).toBe(true);
    expect(isSystemOrMetadataFile(new File([], '._IMG001'))).toBe(true);
    expect(isSystemOrMetadataFile(new File([], 'Thumbs.db'))).toBe(true);
    expect(isSystemOrMetadataFile(new File([], 'desktop.ini'))).toBe(true);
  });

  it('allows valid DICOM files with size >= 132 bytes', () => {
    const validDicom = new File([new ArrayBuffer(500)], 'series_001.dcm');
    expect(isSystemOrMetadataFile(validDicom)).toBe(false);
  });
});

describe('Quick Layout Generator (createQuickLayout)', () => {
  it('creates 1x1 layout for 1 viewport', () => {
    const layout = createQuickLayout(1);
    expect(layout.type).toBe('viewport');
    expect(getVisibleViewportIndices(layout)).toEqual([0]);
  });

  it('creates 1x2 columns layout for 2 viewports', () => {
    const layout = createQuickLayout(2);
    expect(layout.type).toBe('split');
    if (layout.type === 'split') {
      expect(layout.direction).toBe('horizontal');
    }
    expect(getVisibleViewportIndices(layout)).toEqual([0, 1]);
  });

  it('creates 1x3 columns layout for 3 viewports', () => {
    const layout = createQuickLayout(3);
    expect(layout.type).toBe('split');
    if (layout.type === 'split') {
      expect(layout.direction).toBe('horizontal');
    }
    expect(getVisibleViewportIndices(layout)).toEqual([0, 1, 2]);
  });

  it('creates 2x2 grid layout for 4 viewports', () => {
    const layout = createQuickLayout(4);
    expect(layout.type).toBe('split');
    if (layout.type === 'split') {
      expect(layout.direction).toBe('vertical');
    }
    expect(getVisibleViewportIndices(layout)).toEqual([0, 1, 2, 3]);
  });
});
