import { describe, it, expect } from 'vitest';
import {
  findClosestParallelSliceIndex,
  pixelToPatient3D,
  patient3DToPixel,
  findClosestSliceTo3DPoint,
} from '../utils/syncScroll';
import { DICOMInstance } from '../utils/types';

describe('Synchronized Scrolling & 3D Spatial Matching', () => {
  const createMockInstance = (
    ipp: number[],
    iop: number[] = [1, 0, 0, 0, 1, 0],
    ps: number[] = [1, 1]
  ): DICOMInstance =>
    ({
      file: new File([], 'test.dcm'),
      imageId: `dicomfile:test_${ipp.join('_')}`,
      metadata: {
        imagePositionPatient: ipp,
        imageOrientationPatient: iop,
        pixelSpacing: ps,
        rows: 512,
        columns: 512,
        studyInstanceUID: '1.2.3',
        seriesInstanceUID: '1.2.3.1',
      },
    } as any);

  it('finds the closest matching slice index across parallel series', () => {
    // Source series: Axial slices at Z = 0, 5, 10, 15
    const sourceInstance = createMockInstance([0, 0, 10]);

    // Target series: Axial slices at Z = 0, 4.8, 9.9, 14.8
    const targetInstances = [
      createMockInstance([0, 0, 0]),
      createMockInstance([0, 0, 4.8]),
      createMockInstance([0, 0, 9.9]),
      createMockInstance([0, 0, 14.8]),
    ];

    const matchIdx = findClosestParallelSliceIndex(sourceInstance, targetInstances);
    expect(matchIdx).toBe(2); // Closest to Z=10 is Z=9.9 (index 2)
  });

  it('converts pixel coordinates to 3D patient coordinates and back accurately', () => {
    // Axial plane at origin
    const instance = createMockInstance([-100, -100, 50], [1, 0, 0, 0, 1, 0], [0.5, 0.5]);

    const pixelX = 100;
    const pixelY = 200;

    const p3D = pixelToPatient3D(pixelX, pixelY, instance);
    expect(p3D).not.toBeNull();
    // X = -100 + 100 * 0.5 = -50
    // Y = -100 + 200 * 0.5 = 0
    // Z = 50
    expect(p3D![0]).toBeCloseTo(-50);
    expect(p3D![1]).toBeCloseTo(0);
    expect(p3D![2]).toBeCloseTo(50);

    const projected = patient3DToPixel(p3D!, instance);
    expect(projected).not.toBeNull();
    expect(projected!.pixel.x).toBeCloseTo(pixelX);
    expect(projected!.pixel.y).toBeCloseTo(pixelY);
    expect(projected!.distanceToPlane).toBeCloseTo(0);
  });

  it('finds the closest orthogonal slice to a 3D target point', () => {
    // Sagittal stack with slices at X = -20, -10, 0, 10, 20
    const sagittalStack = [
      createMockInstance([-20, -100, 100], [0, 1, 0, 0, 0, -1]),
      createMockInstance([-10, -100, 100], [0, 1, 0, 0, 0, -1]),
      createMockInstance([0, -100, 100], [0, 1, 0, 0, 0, -1]),
      createMockInstance([10, -100, 100], [0, 1, 0, 0, 0, -1]),
      createMockInstance([20, -100, 100], [0, 1, 0, 0, 0, -1]),
    ];

    // Cursor clicked at X = 8.5
    const point3D: [number, number, number] = [8.5, 20, 45];
    const closestIdx = findClosestSliceTo3DPoint(point3D, sagittalStack);
    expect(closestIdx).toBe(3); // Closest to X=8.5 is X=10 (index 3)
  });
});
