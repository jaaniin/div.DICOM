/**
 * 3D DICOM Geometry & Coordinate Math Utilities
 */

export type Vector3 = [number, number, number];

export interface OrientationMarkers {
  top: string;
  bottom: string;
  left: string;
  right: string;
}

export interface ImagePlaneMetadata {
  imagePositionPatient?: number[] | null;
  imageOrientationPatient?: number[] | null;
  pixelSpacing?: number[] | null;
  sliceLocation?: number | null;
  rows?: number | null;
  columns?: number | null;
}

export const dot = (a: Vector3 | number[], b: Vector3 | number[]): number => {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
};

export const cross = (a: Vector3 | number[], b: Vector3 | number[]): Vector3 => {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
};

export const sub = (a: Vector3 | number[], b: Vector3 | number[]): Vector3 => {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
};

export const add = (a: Vector3 | number[], b: Vector3 | number[]): Vector3 => {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
};

export const mul = (a: Vector3 | number[], s: number): Vector3 => {
  return [a[0] * s, a[1] * s, a[2] * s];
};

export const norm = (a: Vector3 | number[]): number => {
  return Math.sqrt(dot(a, a));
};

export const normalize = (a: Vector3 | number[]): Vector3 => {
  const n = norm(a);
  if (n === 0) return [0, 0, 0];
  return [a[0] / n, a[1] / n, a[2] / n];
};

export const getNormal = (iop: number[]): Vector3 => {
  const rowVector: Vector3 = [iop[0], iop[1], iop[2]];
  const colVector: Vector3 = [iop[3], iop[4], iop[5]];
  return normalize(cross(rowVector, colVector));
};

export const getDominantAxis = (vector: number[]): string => {
  const absX = Math.abs(vector[0]);
  const absY = Math.abs(vector[1]);
  const absZ = Math.abs(vector[2]);

  if (absX > absY && absX > absZ) {
    return vector[0] > 0 ? 'L' : 'R';
  } else if (absY > absX && absY > absZ) {
    return vector[1] > 0 ? 'P' : 'A';
  } else {
    return vector[2] > 0 ? 'H' : 'F';
  }
};

export const getOppositeAxis = (axis: string): string => {
  switch (axis) {
    case 'L': return 'R';
    case 'R': return 'L';
    case 'A': return 'P';
    case 'P': return 'A';
    case 'H': return 'F';
    case 'F': return 'H';
    default: return '';
  }
};

export const getOrientationMarkers = (iop: number[] | null | undefined): OrientationMarkers => {
  if (!iop || iop.length < 6) return { top: '', bottom: '', left: '', right: '', };

  const rowVector = iop.slice(0, 3);
  const colVector = iop.slice(3, 6);

  const right = getDominantAxis(rowVector);
  const left = getOppositeAxis(right);
  const bottom = getDominantAxis(colVector);
  const top = getOppositeAxis(bottom);

  return { top, bottom, left, right, };
};

export const calculateIntersection = (
  metaA: ImagePlaneMetadata,
  metaB: ImagePlaneMetadata
): [{ x: number; y: number }, { x: number; y: number }] | null => {
  if (
    !metaA.imagePositionPatient ||
    !metaA.imageOrientationPatient ||
    !metaB.imagePositionPatient ||
    !metaB.imageOrientationPatient ||
    !metaA.pixelSpacing ||
    !metaB.pixelSpacing ||
    !metaB.rows ||
    !metaB.columns
  ) {
    return null;
  }

  const iopA = metaA.imageOrientationPatient;
  const iopB = metaB.imageOrientationPatient;
  const ippA: Vector3 = [metaA.imagePositionPatient[0], metaA.imagePositionPatient[1], metaA.imagePositionPatient[2]];
  const ippB: Vector3 = [metaB.imagePositionPatient[0], metaB.imagePositionPatient[1], metaB.imagePositionPatient[2]];

  const normalA = getNormal(iopA);
  const normalB = getNormal(iopB);

  const lineDir = cross(normalA, normalB);
  if (norm(lineDir) < 1e-4) {
    return null; // Parallel planes
  }

  const rowB: Vector3 = [iopB[0], iopB[1], iopB[2]];
  const colB: Vector3 = [iopB[3], iopB[4], iopB[5]];

  const cornersA: Vector3[] = [
    ippA,
    add(ippA, mul(iopA.slice(0, 3) as Vector3, (metaA.columns || 1) * (metaA.pixelSpacing?.[1] || 1))),
    add(ippA, mul(iopA.slice(3, 6) as Vector3, (metaA.rows || 1) * (metaA.pixelSpacing?.[0] || 1))),
    add(
      add(ippA, mul(iopA.slice(0, 3) as Vector3, (metaA.columns || 1) * (metaA.pixelSpacing?.[1] || 1))),
      mul(iopA.slice(3, 6) as Vector3, (metaA.rows || 1) * (metaA.pixelSpacing?.[0] || 1))
    ),
  ];

  const edgesA = [
    [cornersA[0], cornersA[1]],
    [cornersA[1], cornersA[3]],
    [cornersA[3], cornersA[2]],
    [cornersA[2], cornersA[0]],
  ];

  const intersectPoints: Vector3[] = [];
  const planeD_B = -dot(normalB, ippB);

  for (const [p1, p2] of edgesA) {
    const d1 = dot(normalB, p1) + planeD_B;
    const d2 = dot(normalB, p2) + planeD_B;

    if (Math.abs(d1 - d2) > 1e-6 && ((d1 <= 0 && d2 >= 0) || (d1 >= 0 && d2 <= 0))) {
      const t = d1 / (d1 - d2);
      const pt = add(p1, mul(sub(p2, p1), t));
      intersectPoints.push(pt);
    }
  }

  if (intersectPoints.length < 2) return null;

  const [pt1, pt2] = intersectPoints;
  const projectToPixel = (pt: Vector3): { x: number; y: number } => {
    const diff = sub(pt, ippB);
    const xMm = dot(diff, rowB);
    const yMm = dot(diff, colB);
    return {
      x: xMm / metaB.pixelSpacing![1],
      y: yMm / metaB.pixelSpacing![0],
    };
  };

  return [projectToPixel(pt1), projectToPixel(pt2)];
};

/**
 * Sorts DICOM instances in a series according to patient anatomical coordinates
 * by computing the scalar projection along the slice normal vector.
 * Essential for interleaved MRI acquisitions and multi-slice stacks.
 */
export const sortInstancesAnatomically = <
  T extends { metadata: ImagePlaneMetadata & { instanceNumber?: number; sliceLocation?: number | string | null } }
>(
  instances: T[]
): T[] => {
  if (instances.length <= 1) return [...instances];

  // Find a reference instance with valid orientation
  const refInstance = instances.find(
    (inst) =>
      inst.metadata?.imageOrientationPatient &&
      inst.metadata.imageOrientationPatient.length >= 6 &&
      !isNaN(inst.metadata.imageOrientationPatient[0])
  );

  if (!refInstance || !refInstance.metadata.imageOrientationPatient) {
    // Check if sliceLocation is available across instances
    const hasSliceLocation = instances.some(
      (inst) => inst.metadata.sliceLocation !== undefined && inst.metadata.sliceLocation !== null && !isNaN(Number(inst.metadata.sliceLocation))
    );

    if (hasSliceLocation) {
      return [...instances].sort((a, b) => {
        const locA = Number(a.metadata.sliceLocation ?? 0);
        const locB = Number(b.metadata.sliceLocation ?? 0);
        if (locA !== locB) return locA - locB;
        return (a.metadata.instanceNumber ?? 0) - (b.metadata.instanceNumber ?? 0);
      });
    }

    // Fallback to instanceNumber
    return [...instances].sort((a, b) => {
      const numA = a.metadata.instanceNumber ?? 0;
      const numB = b.metadata.instanceNumber ?? 0;
      return numA - numB;
    });
  }

  const refIOP = refInstance.metadata.imageOrientationPatient;
  const normal = getNormal(refIOP);
  const refRow = [refIOP[0], refIOP[1], refIOP[2]];
  const refCol = [refIOP[3], refIOP[4], refIOP[5]];

  const validInstances = instances.filter((inst) => {
    if (!inst.metadata.imageOrientationPatient) return true;
    const iop = inst.metadata.imageOrientationPatient;
    if (iop.length < 6 || isNaN(iop[0])) return true;
    const row = [iop[0], iop[1], iop[2]];
    const col = [iop[3], iop[4], iop[5]];
    return Math.abs(dot(refRow, row)) > 0.99 && Math.abs(dot(refCol, col)) > 0.99;
  });

  const excludedInstances = instances.filter((inst) => !validInstances.includes(inst));

  const sortedValid = [...validInstances].sort((a, b) => {
    const posA = a.metadata.imagePositionPatient;
    const posB = b.metadata.imagePositionPatient;

    if (
      posA && posB && posA.length >= 3 && posB.length >= 3 &&
      !isNaN(posA[0]) && !isNaN(posA[1]) && !isNaN(posA[2]) &&
      !isNaN(posB[0]) && !isNaN(posB[1]) && !isNaN(posB[2])
    ) {
      const projA = dot([posA[0], posA[1], posA[2]], normal);
      const projB = dot([posB[0], posB[1], posB[2]], normal);
      const diff = projA - projB;
      if (Math.abs(diff) > 1e-4) return diff;
    }

    if (a.metadata.sliceLocation !== undefined && a.metadata.sliceLocation !== null &&
        b.metadata.sliceLocation !== undefined && b.metadata.sliceLocation !== null) {
      const locA = Number(a.metadata.sliceLocation);
      const locB = Number(b.metadata.sliceLocation);
      if (!isNaN(locA) && !isNaN(locB) && Math.abs(locA - locB) > 1e-4) return locA - locB;
    }

    const numA = a.metadata.instanceNumber ?? 0;
    const numB = b.metadata.instanceNumber ?? 0;
    return numA - numB;
  });

  return [...sortedValid, ...excludedInstances];
};


/**
 * Computes the formatted slice location string (e.g. "Loc: R 15.5 mm", "Loc: H 42.0 mm", "Loc: P 8.2 mm")
 * based on the slice center in Patient Reference Coordinates (RCS) along the dominant slice normal axis (RL, HF, AP).
 */
export const getFormattedSliceLocation = (
  meta?: ImagePlaneMetadata | null
): string | null => {
  if (!meta) return null;

  const ipp = meta.imagePositionPatient;
  const iop = meta.imageOrientationPatient;

  // 1. If full 3D patient geometry is available
  if (ipp && ipp.length >= 3 && !isNaN(ipp[0]) && !isNaN(ipp[1]) && !isNaN(ipp[2])) {
    let center: Vector3 = [ipp[0], ipp[1], ipp[2]];

    // If orientation, pixel spacing and FOV dimensions are present, calculate exact slice center
    if (
      iop &&
      iop.length >= 6 &&
      !isNaN(iop[0]) &&
      meta.rows &&
      meta.columns &&
      meta.pixelSpacing &&
      meta.pixelSpacing.length >= 2
    ) {
      const rowVec: Vector3 = [iop[0], iop[1], iop[2]];
      const colVec: Vector3 = [iop[3], iop[4], iop[5]];
      const dx = meta.pixelSpacing[1];
      const dy = meta.pixelSpacing[0];
      const halfWidth = ((meta.columns - 1) * dx) / 2;
      const halfHeight = ((meta.rows - 1) * dy) / 2;

      center = add(add(center, mul(rowVec, halfWidth)), mul(colVec, halfHeight));
    }

    if (iop && iop.length >= 6 && !isNaN(iop[0])) {
      const normal = getNormal(iop);
      const absX = Math.abs(normal[0]);
      const absY = Math.abs(normal[1]);
      const absZ = Math.abs(normal[2]);

      let dir = '';
      let val = 0;

      if (absX > absY && absX > absZ) {
        // Sagittal plane: X-axis (R - L)
        // In DICOM RCS: +X is Left (L), -X is Right (R)
        val = center[0];
        if (Math.abs(val) >= 0.05) {
          dir = val > 0 ? 'L' : 'R';
        }
      } else if (absY > absX && absY > absZ) {
        // Coronal plane: Y-axis (A - P)
        // In DICOM RCS: +Y is Posterior (P), -Y is Anterior (A)
        val = center[1];
        if (Math.abs(val) >= 0.05) {
          dir = val > 0 ? 'P' : 'A';
        }
      } else {
        // Axial plane: Z-axis (H - F)
        // In DICOM RCS: +Z is Head/Superior (H), -Z is Feet/Inferior (F)
        val = center[2];
        if (Math.abs(val) >= 0.05) {
          dir = val > 0 ? 'H' : 'F';
        }
      }

      const distStr = Math.abs(val).toFixed(1);
      return dir ? `Loc: ${dir} ${distStr} mm` : `Loc: ${distStr} mm`;
    }
  }

  // 2. Fallback to sliceLocation tag if available
  if (meta.sliceLocation !== undefined && meta.sliceLocation !== null) {
    const loc = Number(meta.sliceLocation);
    if (!isNaN(loc)) {
      return `Loc: ${Math.abs(loc).toFixed(1)} mm`;
    }
  }

  return null;
};

// Aliases for backwards compatibility
export const crossProduct = cross;
export const dotProduct = dot;
export const subVectors = sub;
export const addVectors = add;
export const scaleVector = mul;
