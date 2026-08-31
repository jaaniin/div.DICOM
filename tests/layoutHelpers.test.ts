import { describe, it, expect } from 'vitest';
import {
  getVisibleViewportIndices,
  splitViewportNode,
  closeViewportNode,
  determineHangingProtocol,
} from '../utils/layoutHelpers';
import { isSystemOrMetadataFile } from '../utils/dicomFiles';
import { LayoutNode, DICOMStudy } from '../utils/types';

describe('Layout Helpers', () => {
  const rootNode: LayoutNode = {
    type: 'viewport',
    id: 'vp_root',
    viewportIndex: 0,
  };

  it('extracts visible viewport indices correctly', () => {
    expect(getVisibleViewportIndices(rootNode)).toEqual([0]);

    const splitNode: LayoutNode = {
      type: 'split',
      direction: 'horizontal',
      id: 'split_1',
      children: [
        { type: 'viewport', id: 'vp_0', viewportIndex: 0 },
        { type: 'viewport', id: 'vp_1', viewportIndex: 1 },
      ],
    };
    expect(getVisibleViewportIndices(splitNode)).toEqual([0, 1]);
  });

  it('splits a viewport node horizontally into two children with distinct indices', () => {
    const splitTree = splitViewportNode(rootNode, 'vp_root', 'horizontal');
    expect(splitTree.type).toBe('split');
    if (splitTree.type === 'split') {
      expect(splitTree.direction).toBe('horizontal');
      expect(splitTree.children).toHaveLength(2);
      expect(splitTree.children[0].type).toBe('viewport');
      expect(splitTree.children[1].type).toBe('viewport');
      expect(getVisibleViewportIndices(splitTree)).toEqual([0, 1]);
    }
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
    // Prefer T2 Sag on Left (V0), T1 Sag on Right (V1)
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
