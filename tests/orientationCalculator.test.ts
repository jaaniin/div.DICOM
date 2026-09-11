import { describe, it, expect } from 'vitest';
import { calculateOrientation } from '../lib/dicom/orientationCalculator';

describe('orientationCalculator', () => {
  it('should detect standard SAGITTAL orientation', () => {
    // Normal vector pointing along X (Right-Left): [0, 1, 0, 0, 0, -1] -> N = (1*-1 - 0*0, 0*0 - 0*-1, 0*0 - 1*0) = (-1, 0, 0)
    const sagittalIop = [0, 1, 0, 0, 0, -1];
    expect(calculateOrientation(sagittalIop)).toBe('SAGITTAL');
  });

  it('should detect standard CORONAL orientation', () => {
    // Normal vector pointing along Y (Anterior-Posterior): [1, 0, 0, 0, 0, -1] -> N = (0, 1, 0)
    const coronalIop = [1, 0, 0, 0, 0, -1];
    expect(calculateOrientation(coronalIop)).toBe('CORONAL');
  });

  it('should detect standard AXIAL (Transverse) orientation', () => {
    // Normal vector pointing along Z (Head-Feet): [1, 0, 0, 0, 1, 0] -> N = (0, 0, 1)
    const axialIop = [1, 0, 0, 0, 1, 0];
    expect(calculateOrientation(axialIop)).toBe('AXIAL');
  });

  it('should detect OBLIQUE orientation for angled slice', () => {
    const obliqueIop = [0.577, 0.577, 0.577, -0.577, 0.577, 0];
    expect(calculateOrientation(obliqueIop)).toBe('OBLIQUE');
  });

  it('should handle missing or invalid IOP input gracefully', () => {
    expect(calculateOrientation(null)).toBe('OBLIQUE');
    expect(calculateOrientation(undefined)).toBe('OBLIQUE');
    expect(calculateOrientation([])).toBe('OBLIQUE');
    expect(calculateOrientation([1, 0, 0])).toBe('OBLIQUE');
  });
});
