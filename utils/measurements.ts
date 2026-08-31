import { LengthMeasurement, DICOMStudy } from './types';

/**
 * Generates formatted label string for Length, Angle, and Polygon ROI measurements.
 */
export const calculateMeasurementLengthText = (
  m: LengthMeasurement,
  index: number,
  allStudies: DICOMStudy[]
): string => {
  const label = String.fromCharCode(65 + (index % 26)); // A, B, C...

  if (m.type === 'roi') {
    if (!m.points || m.points.length < 3) return `ROI ${label}: --`;
    let area = 0;
    for (let i = 0; i < m.points.length; i++) {
      const p1 = m.points[i];
      const p2 = m.points[(i + 1) % m.points.length];
      area += p1.x * p2.y - p2.x * p1.y;
    }
    area = Math.abs(area) / 2;

    let pixelSpacing: number[] | null = null;
    let modality: string | null = null;
    for (const study of allStudies) {
      for (const series of study.series) {
        const inst = series.instances.find((i) => i.imageId === m.imageId);
        if (inst) {
          pixelSpacing = inst.metadata.pixelSpacing;
          modality = inst.metadata.modality || series.modality;
          break;
        }
      }
      if (pixelSpacing || modality) break;
    }

    let areaText = '';
    if (pixelSpacing && pixelSpacing.length >= 2) {
      const psArea = pixelSpacing[0] * pixelSpacing[1];
      area = area * psArea;
      areaText = area.toFixed(1) + ' mm²';
    } else {
      areaText = area.toFixed(1) + ' px²';
    }
    const meanPart = m.mean !== undefined ? ` (mean ${m.mean}${modality === 'CT' ? ' HU' : ''})` : '';
    return `ROI ${label}: ${m.isClosed ? areaText + meanPart : '--'}`;
  }

  if (m.type === 'angle') {
    if (!m.start || !m.end || !m.start2 || !m.end2) return `Angle ${label}: --`;
    const v1 = { x: m.start.x - m.end.x, y: m.start.y - m.end.y };
    const v2 = { x: m.end2.x - m.start2.x, y: m.end2.y - m.start2.y };
    const dot = v1.x * v2.x + v1.y * v2.y;
    const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
    const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
    if (mag1 === 0 || mag2 === 0) return `Angle ${label}: --`;
    const angleRad = Math.acos(Math.max(-1, Math.min(1, dot / (mag1 * mag2))));
    const angleDeg = (angleRad * 180) / Math.PI;
    return `Angle ${label}: ${angleDeg.toFixed(1)}°`;
  }

  // Length measurement
  if (!m.start || !m.end) return `Length ${label}: --`;
  const dx = m.end.x - m.start.x;
  const dy = m.end.y - m.start.y;

  let pixelSpacing: number[] | null = null;
  for (const study of allStudies) {
    for (const series of study.series) {
      const inst = series.instances.find((i) => i.imageId === m.imageId);
      if (inst) {
        pixelSpacing = inst.metadata.pixelSpacing;
        break;
      }
    }
    if (pixelSpacing) break;
  }

  if (pixelSpacing && pixelSpacing.length >= 2) {
    const mmX = dx * pixelSpacing[1];
    const mmY = dy * pixelSpacing[0];
    const lengthMm = Math.sqrt(mmX * mmX + mmY * mmY);
    return `${label}: ${lengthMm.toFixed(1)} mm`;
  }

  const lengthPx = Math.sqrt(dx * dx + dy * dy);
  return `${label}: ${lengthPx.toFixed(1)} px`;
};
