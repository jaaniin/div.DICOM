/**
 * 3D Anatomical Slice Orientation Calculator
 * Computes anatomical plane (SAGITTAL, CORONAL, AXIAL, OBLIQUE) from ImageOrientationPatient cosine vectors [Xx, Xy, Xz, Yx, Yy, Yz].
 */

export type AnatomicalOrientation = 'SAGITTAL' | 'CORONAL' | 'AXIAL' | 'OBLIQUE';

export function calculateOrientation(iop: number[] | null | undefined): AnatomicalOrientation {
  if (!iop || !Array.isArray(iop) || iop.length < 6) {
    return 'OBLIQUE';
  }

  const [x1, x2, x3, y1, y2, y3] = iop;

  // Normal vector as cross product N = X x Y
  const nx = x2 * y3 - x3 * y2;
  const ny = x3 * y1 - x1 * y3;
  const nz = x1 * y2 - x2 * y1;

  const absX = Math.abs(nx);
  const absY = Math.abs(ny);
  const absZ = Math.abs(nz);

  // Orthogonal threshold (> 0.75 is ~41.4 degrees deviation)
  const threshold = 0.75;

  if (absX >= absY && absX >= absZ && absX > threshold) {
    return 'SAGITTAL'; // Normal vector points Right-Left
  } else if (absY >= absX && absY >= absZ && absY > threshold) {
    return 'CORONAL'; // Normal vector points Anterior-Posterior
  } else if (absZ >= absX && absZ >= absY && absZ > threshold) {
    return 'AXIAL'; // Normal vector points Head-Feet
  }

  return 'OBLIQUE';
}
