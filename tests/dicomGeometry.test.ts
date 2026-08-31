import { describe, it, expect } from 'vitest';
import {
  dot,
  cross,
  sub,
  add,
  mul,
  norm,
  normalize,
  getNormal,
  getDominantAxis,
  getOppositeAxis,
  getOrientationMarkers,
  calculateIntersection,
  sortInstancesAnatomically,
  getFormattedSliceLocation,
} from '../utils/dicomGeometry';

describe('3D Vector Arithmetic', () => {
  it('computes vector dot product correctly', () => {
    expect(dot([1, 0, 0], [0, 1, 0])).toBe(0);
    expect(dot([1, 2, 3], [4, 5, 6])).toBe(32); // 4 + 10 + 18 = 32
    expect(dot([2, -3, 4], [2, -3, 4])).toBe(29);
  });

  it('computes standard 3D cross products correctly (right-handed rule)', () => {
    // i x j = k
    expect(cross([1, 0, 0], [0, 1, 0])).toEqual([0, 0, 1]);
    // j x k = i
    expect(cross([0, 1, 0], [0, 0, 1])).toEqual([1, 0, 0]);
    // k x i = j
    expect(cross([0, 0, 1], [1, 0, 0])).toEqual([0, 1, 0]);
    // Anti-commutative: j x i = -k
    expect(cross([0, 1, 0], [1, 0, 0])).toEqual([0, 0, -1]);
    // Arbitrary vectors: [1,2,3] x [4,5,6] = [-3, 6, -3]
    expect(cross([1, 2, 3], [4, 5, 6])).toEqual([-3, 6, -3]);
  });

  it('computes vector subtraction and addition', () => {
    expect(sub([5, 7, 9], [1, 2, 3])).toEqual([4, 5, 6]);
    expect(add([1, 2, 3], [4, 5, 6])).toEqual([5, 7, 9]);
  });

  it('computes scalar multiplication', () => {
    expect(mul([2, -3, 4], 2.5)).toEqual([5, -7.5, 10]);
  });

  it('computes Euclidean norm and unit vector normalization', () => {
    expect(norm([3, 4, 0])).toBe(5);
    expect(norm([0, 0, 0])).toBe(0);

    const unit = normalize([0, 5, 0]);
    expect(unit).toEqual([0, 1, 0]);
    expect(norm(unit)).toBeCloseTo(1.0, 5);

    expect(normalize([0, 0, 0])).toEqual([0, 0, 0]);
  });
});

describe('DICOM Patient Orientation & Axes (RCS)', () => {
  it('determines dominant anatomical axis correctly', () => {
    expect(getDominantAxis([1, 0, 0])).toBe('L');
    expect(getDominantAxis([-1, 0, 0])).toBe('R');
    expect(getDominantAxis([0, 1, 0])).toBe('P');
    expect(getDominantAxis([0, -1, 0])).toBe('A');
    expect(getDominantAxis([0, 0, 1])).toBe('H');
    expect(getDominantAxis([0, 0, -1])).toBe('F');
  });

  it('returns correct opposing axis letter', () => {
    expect(getOppositeAxis('L')).toBe('R');
    expect(getOppositeAxis('R')).toBe('L');
    expect(getOppositeAxis('A')).toBe('P');
    expect(getOppositeAxis('P')).toBe('A');
    expect(getOppositeAxis('H')).toBe('F');
    expect(getOppositeAxis('F')).toBe('H');
  });

  it('computes orientation markers for standard Axial plane (IOP [1,0,0, 0,1,0])', () => {
    // Row: [1,0,0] -> R to L (Right side of image is Patient Left 'L', left side is Patient Right 'R')
    // Col: [0,1,0] -> A to P (Bottom of image is Posterior 'P', top is Anterior 'A')
    const markers = getOrientationMarkers([1, 0, 0, 0, 1, 0]);
    expect(markers).toEqual({
      top: 'A',
      bottom: 'P',
      left: 'R',
      right: 'L',
    });
  });

  it('computes orientation markers for standard Sagittal plane (IOP [0,1,0, 0,0,-1])', () => {
    // Row: [0,1,0] -> A to P (Right side is Posterior 'P', left is Anterior 'A')
    // Col: [0,0,-1] -> H to F (Bottom is Feet 'F', top is Head 'H')
    const markers = getOrientationMarkers([0, 1, 0, 0, 0, -1]);
    expect(markers).toEqual({
      top: 'H',
      bottom: 'F',
      left: 'A',
      right: 'P',
    });
  });

  it('computes orientation markers for standard Coronal plane (IOP [1,0,0, 0,0,-1])', () => {
    // Row: [1,0,0] -> R to L (Right side is Left 'L', left side is Right 'R')
    // Col: [0,0,-1] -> H to F (Bottom is Feet 'F', top is Head 'H')
    const markers = getOrientationMarkers([1, 0, 0, 0, 0, -1]);
    expect(markers).toEqual({
      top: 'H',
      bottom: 'F',
      left: 'R',
      right: 'L',
    });
  });

  it('handles empty or invalid IOP gracefully', () => {
    expect(getOrientationMarkers(null)).toEqual({ top: '', bottom: '', left: '', right: '' });
    expect(getOrientationMarkers([1, 0])).toEqual({ top: '', bottom: '', left: '', right: '' });
  });

  it('computes normal vector from orientation', () => {
    // Axial plane: Row=[1,0,0], Col=[0,1,0] -> Normal=[0,0,1]
    const axialNormal = getNormal([1, 0, 0, 0, 1, 0]);
    expect(axialNormal).toEqual([0, 0, 1]);

    // Sagittal plane: Row=[0,1,0], Col=[0,0,-1] -> Normal=[-1,0,0]
    const sagNormal = getNormal([0, 1, 0, 0, 0, -1]);
    expect(sagNormal).toEqual([-1, 0, 0]);
  });
});

describe('Scout Plane Intersections (Cross-Referencing)', () => {
  it('calculates 2D intersection line between orthogonal Axial and Sagittal planes', () => {
    // Source Image A: Axial plane at Z = 0
    const metaAxial = {
      imagePositionPatient: [-100, -100, 0],
      imageOrientationPatient: [1, 0, 0, 0, 1, 0],
      pixelSpacing: [1, 1],
      rows: 200,
      columns: 200,
    };

    // Target Image B: Sagittal plane at X = 0
    const metaSagittal = {
      imagePositionPatient: [0, -100, 100],
      imageOrientationPatient: [0, 1, 0, 0, 0, -1],
      pixelSpacing: [1, 1],
      rows: 200,
      columns: 200,
    };

    const intersection = calculateIntersection(metaAxial, metaSagittal);
    expect(intersection).not.toBeNull();
    expect(intersection).toHaveLength(2);

    // On sagittal plane (B), the intersection line should cross horizontally at Y coordinate for Z=0
    // Origin of B is at Z = 100, so Z = 0 corresponds to y = 100 on B
    const [p1, p2] = intersection!;
    expect(p1.y).toBeCloseTo(100, 1);
    expect(p2.y).toBeCloseTo(100, 1);
  });

  it('returns null for parallel planes', () => {
    // Plane 1: Axial at Z = 0
    const metaA = {
      imagePositionPatient: [-100, -100, 0],
      imageOrientationPatient: [1, 0, 0, 0, 1, 0],
      pixelSpacing: [1, 1],
      rows: 200,
      columns: 200,
    };

    // Plane 2: Axial at Z = 10 (parallel, offset)
    const metaB = {
      imagePositionPatient: [-100, -100, 10],
      imageOrientationPatient: [1, 0, 0, 0, 1, 0],
      pixelSpacing: [1, 1],
      rows: 200,
      columns: 200,
    };

    expect(calculateIntersection(metaA, metaB)).toBeNull();
  });

  it('returns null if metaA lacks pixelSpacing', () => {
    const metaA = {
      imagePositionPatient: [-100, -100, 0],
      imageOrientationPatient: [1, 0, 0, 0, 1, 0],
      rows: 200,
      columns: 200,
    };
    const metaB = {
      imagePositionPatient: [0, -100, 100],
      imageOrientationPatient: [0, 1, 0, 0, 0, -1],
      pixelSpacing: [1, 1],
      rows: 200,
      columns: 200,
    };
    expect(calculateIntersection(metaA, metaB)).toBeNull();
  });
});

describe('Anatomical Slice Sorting (sortInstancesAnatomically)', () => {
  it('correctly re-orders interleaved MRI acquisition into anatomical spatial order', () => {
    // Interleaved Axial MRI acquisition: 1 (Z=0), 3 (Z=20), 5 (Z=40), 2 (Z=10), 4 (Z=30)
    const iop = [1, 0, 0, 0, 1, 0];
    const interleavedInstances = [
      { id: '1', metadata: { imagePositionPatient: [0, 0, 0], imageOrientationPatient: iop, instanceNumber: 1 } },
      { id: '3', metadata: { imagePositionPatient: [0, 0, 20], imageOrientationPatient: iop, instanceNumber: 3 } },
      { id: '5', metadata: { imagePositionPatient: [0, 0, 40], imageOrientationPatient: iop, instanceNumber: 5 } },
      { id: '2', metadata: { imagePositionPatient: [0, 0, 10], imageOrientationPatient: iop, instanceNumber: 2 } },
      { id: '4', metadata: { imagePositionPatient: [0, 0, 30], imageOrientationPatient: iop, instanceNumber: 4 } },
    ];

    const sorted = sortInstancesAnatomically(interleavedInstances);
    const sortedIds = sorted.map((inst) => inst.id);
    expect(sortedIds).toEqual(['1', '2', '3', '4', '5']);
  });

  it('correctly sorts interleaved Sagittal MRI slices along X axis', () => {
    // Sagittal normal is [-1, 0, 0]
    const iop = [0, 1, 0, 0, 0, -1];
    const sagittalInterleaved = [
      { id: 'S1', metadata: { imagePositionPatient: [-40, 0, 0], imageOrientationPatient: iop, instanceNumber: 1 } },
      { id: 'S3', metadata: { imagePositionPatient: [0, 0, 0], imageOrientationPatient: iop, instanceNumber: 3 } },
      { id: 'S2', metadata: { imagePositionPatient: [-20, 0, 0], imageOrientationPatient: iop, instanceNumber: 2 } },
      { id: 'S4', metadata: { imagePositionPatient: [20, 0, 0], imageOrientationPatient: iop, instanceNumber: 4 } },
    ];

    const sorted = sortInstancesAnatomically(sagittalInterleaved);
    const sortedPositions = sorted.map((inst) => inst.metadata.imagePositionPatient[0]);
    // Sagittal normal is [-1,0,0], so dot([x,0,0], [-1,0,0]) = -x.
    // S4 (-20) < S3 (0) < S2 (20) < S1 (40) in normal projection
    expect(sortedPositions).toEqual([20, 0, -20, -40]);
  });

  it('falls back to instanceNumber when spatial coordinates are missing', () => {
    const nonSpatial = [
      { id: 'B', metadata: { instanceNumber: 2 } },
      { id: 'A', metadata: { instanceNumber: 1 } },
      { id: 'C', metadata: { instanceNumber: 3 } },
    ];

    const sorted = sortInstancesAnatomically(nonSpatial);
    expect(sorted.map((i) => i.id)).toEqual(['A', 'B', 'C']);
  });

  it('excludes orthogonal scout slices from the primary sort stack', () => {
    const axIop = [1, 0, 0, 0, 1, 0];
    const sagIop = [0, 1, 0, 0, 0, -1];
    
    const mixedInstances = [
      { id: 'Ax1', metadata: { imagePositionPatient: [0, 0, 10], imageOrientationPatient: axIop, instanceNumber: 1 } },
      { id: 'Sag1', metadata: { imagePositionPatient: [0, 0, 0], imageOrientationPatient: sagIop, instanceNumber: 2 } }, // Orthogonal
      { id: 'Ax2', metadata: { imagePositionPatient: [0, 0, -10], imageOrientationPatient: axIop, instanceNumber: 3 } },
      { id: 'Ax3', metadata: { imagePositionPatient: [0, 0, 20], imageOrientationPatient: axIop, instanceNumber: 4 } },
    ];

    const sorted = sortInstancesAnatomically(mixedInstances);
    const sortedIds = sorted.map((inst) => inst.id);
    
    // Axial normal is [0, 0, 1]. Projection is just Z coordinate.
    // So Ax2 (-10) < Ax1 (10) < Ax3 (20)
    // Sag1 should be appended at the end because it's orthogonal
    expect(sortedIds).toEqual(['Ax2', 'Ax1', 'Ax3', 'Sag1']);
  });
});


describe('Slice Location in RCS (getFormattedSliceLocation)', () => {
  it('formats Sagittal slice location correctly for Right and Left offsets', () => {
    // Standard Sagittal: IOP = [0, 1, 0, 0, 0, -1] -> Normal = [-1, 0, 0] (X-axis)
    const sagIop = [0, 1, 0, 0, 0, -1];

    // Right of midline (X = -15.5)
    const metaRight = {
      imagePositionPatient: [-15.5, -120.0, 50.0],
      imageOrientationPatient: sagIop,
      rows: 256,
      columns: 256,
      pixelSpacing: [1.0, 1.0],
    };
    expect(getFormattedSliceLocation(metaRight)).toBe('Loc: R 15.5 mm');

    // Left of midline (X = 12.0)
    const metaLeft = {
      imagePositionPatient: [12.0, -120.0, 50.0],
      imageOrientationPatient: sagIop,
      rows: 256,
      columns: 256,
      pixelSpacing: [1.0, 1.0],
    };
    expect(getFormattedSliceLocation(metaLeft)).toBe('Loc: L 12.0 mm');
  });

  it('formats Coronal slice location correctly for Anterior and Posterior offsets', () => {
    // Standard Coronal: IOP = [1, 0, 0, 0, 0, -1] -> Normal = [0, 1, 0] (Y-axis)
    const corIop = [1, 0, 0, 0, 0, -1];

    // Anterior of midline (Y = -24.3)
    const metaAnt = {
      imagePositionPatient: [-100.0, -24.3, 50.0],
      imageOrientationPatient: corIop,
      rows: 256,
      columns: 256,
      pixelSpacing: [1.0, 1.0],
    };
    expect(getFormattedSliceLocation(metaAnt)).toBe('Loc: A 24.3 mm');

    // Posterior of midline (Y = 10.0)
    const metaPost = {
      imagePositionPatient: [-100.0, 10.0, 50.0],
      imageOrientationPatient: corIop,
      rows: 256,
      columns: 256,
      pixelSpacing: [1.0, 1.0],
    };
    expect(getFormattedSliceLocation(metaPost)).toBe('Loc: P 10.0 mm');
  });

  it('formats Axial slice location correctly for Head and Feet offsets', () => {
    // Standard Axial: IOP = [1, 0, 0, 0, 1, 0] -> Normal = [0, 0, 1] (Z-axis)
    const axIop = [1, 0, 0, 0, 1, 0];

    // Head / Superior (Z = 15.0)
    const metaHead = {
      imagePositionPatient: [-100.0, -100.0, 15.0],
      imageOrientationPatient: axIop,
      rows: 256,
      columns: 256,
      pixelSpacing: [1.0, 1.0],
    };
    expect(getFormattedSliceLocation(metaHead)).toBe('Loc: H 15.0 mm');

    // Feet / Inferior (Z = -40.2)
    const metaFeet = {
      imagePositionPatient: [-100.0, -100.0, -40.2],
      imageOrientationPatient: axIop,
      rows: 256,
      columns: 256,
      pixelSpacing: [1.0, 1.0],
    };
    expect(getFormattedSliceLocation(metaFeet)).toBe('Loc: F 40.2 mm');
  });

  it('formats centerline location at 0.0 mm without direction prefix', () => {
    const metaCenter = {
      imagePositionPatient: [0.0, -100.0, 50.0],
      imageOrientationPatient: [0, 1, 0, 0, 0, -1],
      rows: 256,
      columns: 256,
      pixelSpacing: [1.0, 1.0],
    };
    expect(getFormattedSliceLocation(metaCenter)).toBe('Loc: 0.0 mm');
  });

  it('falls back to sliceLocation tag when full 3D geometry is unavailable', () => {
    expect(getFormattedSliceLocation({ sliceLocation: 15.5 })).toBe('Loc: 15.5 mm');
    expect(getFormattedSliceLocation({ sliceLocation: -20.0 })).toBe('Loc: 20.0 mm');
  });

  it('returns null when no coordinate or location data is present', () => {
    expect(getFormattedSliceLocation(null)).toBeNull();
    expect(getFormattedSliceLocation({})).toBeNull();
  });
});
