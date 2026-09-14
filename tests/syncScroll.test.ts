import { describe, it, expect } from 'vitest';
import {
  findClosestParallelSliceIndex,
  pixelToPatient3D,
  patient3DToPixel,
  findClosestSliceTo3DPoint,
  createViewportSyncAnchor,
  calculateLinkedSliceIndex,
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

  it('maintains anatomical alignment in DICOM coordinate space and handles unequal stack bounds and direction reversal', () => {
    // MRI series: 50 axial slices from Z = 0 to 98 (step 2 mm)
    const mriInstances = Array.from({ length: 50 }, (_, i) =>
      createMockInstance([0, 0, i * 2])
    );
    const mriSeries = {
      seriesInstanceUID: '1.2.mri',
      instances: mriInstances,
    };

    // CT series: 10 axial slices from Z = 10 to 28 (step 2 mm, smaller coverage)
    const ctInstances = Array.from({ length: 10 }, (_, i) =>
      createMockInstance([0, 0, 10 + i * 2])
    );
    const ctSeries = {
      seriesInstanceUID: '1.2.ct',
      instances: ctInstances,
    };

    // User establishes anchor: MRI at slice 5 (Z = 10 mm), CT at slice 0 (Z = 10 mm)
    const mriAnchor = createViewportSyncAnchor(mriSeries, 5)!;
    const ctAnchor = createViewportSyncAnchor(ctSeries, 0)!;

    expect(mriAnchor).not.toBeNull();
    expect(ctAnchor).not.toBeNull();
    expect(mriAnchor.anchorPosAlongNormal).toBe(10);
    expect(ctAnchor.anchorPosAlongNormal).toBe(10);

    // 1. Scrolling forward within both ranges:
    // MRI moves from slice 5 (Z=10) to slice 9 (Z=18)
    const ctIdxAt18 = calculateLinkedSliceIndex(
      mriAnchor,
      9,
      mriInstances[9],
      ctAnchor,
      ctInstances
    );
    expect(ctIdxAt18).toBe(4); // Z=18 in CT is slice index 4 (10 + 4*2 = 18)

    // 2. MRI moves to slice 14 (Z=28) -> exactly CT's last slice (index 9)
    const ctIdxAt28 = calculateLinkedSliceIndex(
      mriAnchor,
      14,
      mriInstances[14],
      ctAnchor,
      ctInstances
    );
    expect(ctIdxAt28).toBe(9); // Last slice in CT

    // 3. MRI scrolls PAST CT's range: MRI moves to slice 20 (Z=40) and slice 30 (Z=60)
    const ctIdxAt40 = calculateLinkedSliceIndex(
      mriAnchor,
      20,
      mriInstances[20],
      ctAnchor,
      ctInstances
    );
    expect(ctIdxAt40).toBe(9); // Clamped at CT's last slice

    const ctIdxAt60 = calculateLinkedSliceIndex(
      mriAnchor,
      30,
      mriInstances[30],
      ctAnchor,
      ctInstances
    );
    expect(ctIdxAt60).toBe(9); // Still clamped at last slice

    // 4. CRUCIAL USER REQUIREMENT:
    // User reverses scrolling direction!
    // MRI scrolls back from slice 30 (Z=60) to slice 25 (Z=50) -> CT should NOT move!
    const ctIdxAt50 = calculateLinkedSliceIndex(
      mriAnchor,
      25,
      mriInstances[25],
      ctAnchor,
      ctInstances
    );
    expect(ctIdxAt50).toBe(9); // Remains clamped, DOES NOT scroll prematurely!

    // MRI scrolls back to slice 16 (Z=32) -> CT still stays at 9
    const ctIdxAt32 = calculateLinkedSliceIndex(
      mriAnchor,
      16,
      mriInstances[16],
      ctAnchor,
      ctInstances
    );
    expect(ctIdxAt32).toBe(9);

    // MRI scrolls back to slice 14 (Z=28) -> target coordinate enters CT range at Z=28
    const ctIdxAtReturn28 = calculateLinkedSliceIndex(
      mriAnchor,
      14,
      mriInstances[14],
      ctAnchor,
      ctInstances
    );
    expect(ctIdxAtReturn28).toBe(9);

    // MRI scrolls back to slice 13 (Z=26) -> CT smoothly resumes scrolling back at index 8!
    const ctIdxAt26 = calculateLinkedSliceIndex(
      mriAnchor,
      13,
      mriInstances[13],
      ctAnchor,
      ctInstances
    );
    expect(ctIdxAt26).toBe(8);

    // MRI returns all the way back to original anchor at slice 5 (Z=10)
    const ctIdxAtStart = calculateLinkedSliceIndex(
      mriAnchor,
      5,
      mriInstances[5],
      ctAnchor,
      ctInstances
    );
    expect(ctIdxAtStart).toBe(0); // Exact original slice 0!
  });

  it('supports reverse-oriented slice stacks (anti-parallel normal vectors)', () => {
    // MRI: normal pointing [0, 0, 1], slices at Z = 0, 10, 20, 30
    const mriInstances = [
      createMockInstance([0, 0, 0], [1, 0, 0, 0, 1, 0]),
      createMockInstance([0, 0, 10], [1, 0, 0, 0, 1, 0]),
      createMockInstance([0, 0, 20], [1, 0, 0, 0, 1, 0]),
      createMockInstance([0, 0, 30], [1, 0, 0, 0, 1, 0]),
    ];
    // CT: normal pointing [0, 0, -1], slices at Z = 30, 20, 10, 0
    // (Notice IOP row=[1,0,0], col=[0,-1,0] -> normal=[0, 0, -1])
    const ctInstances = [
      createMockInstance([0, 0, 30], [1, 0, 0, 0, -1, 0]),
      createMockInstance([0, 0, 20], [1, 0, 0, 0, -1, 0]),
      createMockInstance([0, 0, 10], [1, 0, 0, 0, -1, 0]),
      createMockInstance([0, 0, 0], [1, 0, 0, 0, -1, 0]),
    ];

    const mriAnchor = createViewportSyncAnchor({ seriesInstanceUID: 'm', instances: mriInstances }, 0)!;
    const ctAnchor = createViewportSyncAnchor({ seriesInstanceUID: 'c', instances: ctInstances }, 3)!;

    // MRI moves from Z=0 (idx 0) to Z=10 (idx 1) -> +10mm along Z
    const ctIdx = calculateLinkedSliceIndex(
      mriAnchor,
      1,
      mriInstances[1],
      ctAnchor,
      ctInstances
    );
    // In CT, slice at Z=10 is index 2!
    expect(ctIdx).toBe(2);
  });
});
