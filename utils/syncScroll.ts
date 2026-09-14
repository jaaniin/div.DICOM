import { Vector3, dot, sub, getNormal, norm } from './dicomGeometry';
import { DICOMInstance } from './types';

/**
 * Finds the index of the instance in targetInstances whose plane is closest to the source slice position along the plane normal.
 */
export const findClosestParallelSliceIndex = (
  sourceInstance: DICOMInstance,
  targetInstances: DICOMInstance[]
): number => {
  if (
    !sourceInstance?.metadata.imagePositionPatient ||
    !sourceInstance?.metadata.imageOrientationPatient ||
    targetInstances.length === 0
  ) {
    return -1;
  }

  const sourcePos: Vector3 = [
    sourceInstance.metadata.imagePositionPatient[0],
    sourceInstance.metadata.imagePositionPatient[1],
    sourceInstance.metadata.imagePositionPatient[2],
  ];
  const sourceNormal = getNormal(sourceInstance.metadata.imageOrientationPatient);

  let minDistance = Infinity;
  let bestIndex = -1;

  targetInstances.forEach((inst, idx) => {
    if (!inst.metadata.imagePositionPatient || !inst.metadata.imageOrientationPatient) return;

    const targetNormal = getNormal(inst.metadata.imageOrientationPatient);
    // Only match parallel or anti-parallel planes
    if (Math.abs(dot(sourceNormal, targetNormal)) > 0.99) {
      const targetPos: Vector3 = [
        inst.metadata.imagePositionPatient[0],
        inst.metadata.imagePositionPatient[1],
        inst.metadata.imagePositionPatient[2],
      ];
      const distance = Math.abs(dot(sub(targetPos, sourcePos), sourceNormal));
      if (distance < minDistance) {
        minDistance = distance;
        bestIndex = idx;
      }
    }
  });

  return bestIndex;
};

/**
 * Computes 3D Patient RCS coordinate from 2D pixel coordinates on an image instance.
 */
export const pixelToPatient3D = (
  pixelX: number,
  pixelY: number,
  instance: DICOMInstance
): Vector3 | null => {
  if (
    !instance.metadata.imagePositionPatient ||
    !instance.metadata.imageOrientationPatient ||
    !instance.metadata.pixelSpacing
  ) {
    return null;
  }

  const ipp = instance.metadata.imagePositionPatient;
  const iop = instance.metadata.imageOrientationPatient;
  const ps = instance.metadata.pixelSpacing;

  const rowVec: Vector3 = [iop[0], iop[1], iop[2]];
  const colVec: Vector3 = [iop[3], iop[4], iop[5]];

  const xMm = pixelX * ps[1];
  const yMm = pixelY * ps[0];

  return [
    ipp[0] + rowVec[0] * xMm + colVec[0] * yMm,
    ipp[1] + rowVec[1] * xMm + colVec[1] * yMm,
    ipp[2] + rowVec[2] * xMm + colVec[2] * yMm,
  ];
};

/**
 * Projects a 3D Patient coordinate onto a target instance plane and returns pixel coordinates and distance from plane.
 */
export const patient3DToPixel = (
  point3D: Vector3,
  targetInstance: DICOMInstance
): { pixel: { x: number; y: number }; distanceToPlane: number } | null => {
  if (
    !targetInstance.metadata.imagePositionPatient ||
    !targetInstance.metadata.imageOrientationPatient ||
    !targetInstance.metadata.pixelSpacing
  ) {
    return null;
  }

  const ipp: Vector3 = [
    targetInstance.metadata.imagePositionPatient[0],
    targetInstance.metadata.imagePositionPatient[1],
    targetInstance.metadata.imagePositionPatient[2],
  ];
  const iop = targetInstance.metadata.imageOrientationPatient;
  const ps = targetInstance.metadata.pixelSpacing;

  const rowVec: Vector3 = [iop[0], iop[1], iop[2]];
  const colVec: Vector3 = [iop[3], iop[4], iop[5]];
  const normal = getNormal(iop);

  const diff = sub(point3D, ipp);
  const distanceToPlane = Math.abs(dot(diff, normal));

  const xMm = dot(diff, rowVec);
  const yMm = dot(diff, colVec);

  return {
    pixel: {
      x: xMm / ps[1],
      y: yMm / ps[0],
    },
    distanceToPlane,
  };
};

/**
 * Finds the slice in a target series that is closest to a 3D coordinate point.
 */
export const findClosestSliceTo3DPoint = (
  point3D: Vector3,
  instances: DICOMInstance[]
): number => {
  let minDistance = Infinity;
  let bestIndex = 0;

  instances.forEach((inst, idx) => {
    if (!inst.metadata.imagePositionPatient || !inst.metadata.imageOrientationPatient) return;
    const ipp: Vector3 = [
      inst.metadata.imagePositionPatient[0],
      inst.metadata.imagePositionPatient[1],
      inst.metadata.imagePositionPatient[2],
    ];
    const normal = getNormal(inst.metadata.imageOrientationPatient);
    const dist = Math.abs(dot(sub(point3D, ipp), normal));
    if (dist < minDistance) {
      minDistance = dist;
      bestIndex = idx;
    }
  });

  return bestIndex;
};

export interface LinkedSyncAnchor {
  seriesInstanceUID: string;
  anchorIndex: number;
  anchorPosAlongNormal: number | null;
  normal: Vector3 | null;
  slicePositions: number[] | null;
}

/**
 * Creates or updates an anchor snapshot for synchronized scrolling across linked series.
 */
export const createViewportSyncAnchor = (
  series: { seriesInstanceUID: string; instances: DICOMInstance[] },
  currentImageIndex: number
): LinkedSyncAnchor | null => {
  if (!series || !series.instances || series.instances.length === 0) return null;
  const clampedIndex = Math.max(0, Math.min(series.instances.length - 1, currentImageIndex));
  const currentInst = series.instances[clampedIndex];
  if (!currentInst) return null;

  let normal: Vector3 | null = null;
  let anchorPosAlongNormal: number | null = null;
  let slicePositions: number[] | null = null;

  const iop = currentInst.metadata?.imageOrientationPatient;
  const ipp = currentInst.metadata?.imagePositionPatient;

  if (iop && iop.length >= 6 && !isNaN(iop[0])) {
    normal = getNormal(iop);
    if (ipp && ipp.length >= 3 && !isNaN(ipp[0])) {
      anchorPosAlongNormal = dot([ipp[0], ipp[1], ipp[2]], normal);

      slicePositions = series.instances.map((inst) => {
        const instIpp = inst.metadata?.imagePositionPatient;
        if (instIpp && instIpp.length >= 3 && !isNaN(instIpp[0])) {
          return dot([instIpp[0], instIpp[1], instIpp[2]], normal!);
        }
        return 0;
      });
    }
  }

  return {
    seriesInstanceUID: series.seriesInstanceUID,
    anchorIndex: clampedIndex,
    anchorPosAlongNormal,
    normal,
    slicePositions,
  };
};

/**
 * Calculates the synchronized slice index for a target series based on the source series'
 * new slice index and their established synchronization anchors.
 * Preserves the exact anatomical/coordinate alignment in DICOM 3D patient space,
 * including proper clamping and direction reversal recovery when stacks have unequal coverage.
 */
export const calculateLinkedSliceIndex = (
  sourceAnchor: LinkedSyncAnchor,
  sourceNewIndex: number,
  sourceInstance: DICOMInstance,
  targetAnchor: LinkedSyncAnchor,
  targetInstances: DICOMInstance[]
): number => {
  if (targetInstances.length === 0) return 0;
  const maxTargetIndex = targetInstances.length - 1;

  // 1. Physical millimeter DICOM coordinate-space synchronization
  if (
    sourceAnchor.normal &&
    sourceAnchor.anchorPosAlongNormal !== null &&
    targetAnchor.normal &&
    targetAnchor.anchorPosAlongNormal !== null &&
    targetAnchor.slicePositions &&
    targetAnchor.slicePositions.length === targetInstances.length &&
    sourceInstance.metadata?.imagePositionPatient &&
    sourceInstance.metadata.imagePositionPatient.length >= 3
  ) {
    const alignment = dot(sourceAnchor.normal, targetAnchor.normal);

    // Parallel or anti-parallel slice planes
    if (Math.abs(alignment) > 0.9) {
      const dir = alignment > 0 ? 1 : -1;
      const sourceIpp = sourceInstance.metadata.imagePositionPatient;
      const sourceNewPos = dot([sourceIpp[0], sourceIpp[1], sourceIpp[2]], sourceAnchor.normal);
      const sourceDeltaMm = sourceNewPos - sourceAnchor.anchorPosAlongNormal;
      const targetDesiredPos = targetAnchor.anchorPosAlongNormal + sourceDeltaMm * dir;

      const positions = targetAnchor.slicePositions;
      const posFirst = positions[0];
      const posLast = positions[positions.length - 1];
      const minPos = Math.min(posFirst, posLast);
      const maxPos = Math.max(posFirst, posLast);

      if (targetDesiredPos >= maxPos) {
        return posLast >= posFirst ? maxTargetIndex : 0;
      }
      if (targetDesiredPos <= minPos) {
        return posFirst <= posLast ? 0 : maxTargetIndex;
      }

      let minDiff = Infinity;
      let bestIdx = 0;
      for (let k = 0; k < positions.length; k++) {
        const diff = Math.abs(positions[k] - targetDesiredPos);
        if (diff < minDiff) {
          minDiff = diff;
          bestIdx = k;
        }
      }
      return bestIdx;
    }
  }

  // 2. Fallback: Virtual slice index offset with bounds clamping that preserves alignment on reversal
  const indexDelta = sourceNewIndex - sourceAnchor.anchorIndex;
  const targetDesiredIndex = targetAnchor.anchorIndex + indexDelta;
  return Math.max(0, Math.min(maxTargetIndex, targetDesiredIndex));
};
