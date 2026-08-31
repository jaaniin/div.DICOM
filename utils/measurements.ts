import { LengthMeasurement, DICOMStudy, Point } from './types';

export interface RoiStatistics {
  area: number;
  mean?: number;
  stdDev?: number;
  min?: number;
  max?: number;
}

/**
 * Calculates ROI statistics (Area, Mean, StdDev, Min, Max) inside a polygon from image pixel data.
 */
export const calculateRoiStatistics = (
  points: Point[],
  image?: any,
  pixelSpacing?: number[] | null
): RoiStatistics => {
  if (!points || points.length < 3) {
    return { area: 0 };
  }

  // 1. Calculate Polygon Area via Shoelace Formula
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    area += p1.x * p2.y - p2.x * p1.y;
  }
  area = Math.abs(area) / 2;

  if (pixelSpacing && pixelSpacing.length >= 2) {
    const psArea = pixelSpacing[0] * pixelSpacing[1];
    area = area * psArea;
  }

  if (!image) {
    return { area };
  }

  try {
    const pixelData = typeof image.getPixelData === 'function' ? image.getPixelData() : image.pixelData;
    if (!pixelData) return { area };

    const width = image.width || image.columns;
    const height = image.height || image.rows;
    if (!width || !height) return { area };

    const slope = image.slope ?? 1;
    const intercept = image.intercept ?? 0;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    points.forEach((p) => {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    });

    const isInside = (x: number, y: number) => {
      let inside = false;
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const xi = points[i].x, yi = points[i].y;
        const xj = points[j].x, yj = points[j].y;
        const intersect = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi);
        if (intersect) inside = !inside;
      }
      return inside;
    };

    let sum = 0;
    let sumSq = 0;
    let count = 0;
    let minVal = Infinity;
    let maxVal = -Infinity;

    const startY = Math.max(0, Math.floor(minY));
    const endY = Math.min(height - 1, Math.ceil(maxY));
    const startX = Math.max(0, Math.floor(minX));
    const endX = Math.min(width - 1, Math.ceil(maxX));

    for (let y = startY; y <= endY; y++) {
      for (let x = startX; x <= endX; x++) {
        if (isInside(x, y)) {
          let val = pixelData[y * width + x];
          val = val * slope + intercept;
          sum += val;
          sumSq += val * val;
          if (val < minVal) minVal = val;
          if (val > maxVal) maxVal = val;
          count++;
        }
      }
    }

    if (count > 0) {
      const mean = sum / count;
      const variance = Math.max(0, (sumSq - (sum * sum) / count) / count);
      return {
        area,
        mean: Math.round(mean * 10) / 10,
        stdDev: Math.round(Math.sqrt(variance) * 10) / 10,
        min: Math.round(minVal),
        max: Math.round(maxVal),
      };
    }
  } catch (err) {
    console.warn('Failed to calculate ROI statistics:', err);
  }

  return { area };
};

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
    let pixelSpacing: number[] | null = null;
    for (const study of allStudies) {
      for (const series of study.series) {
        const inst = series.instances.find((i) => i.imageId === m.imageId);
        if (inst) {
          pixelSpacing = inst.metadata.pixelSpacing || null;
          break;
        }
      }
      if (pixelSpacing) break;
    }
    const scaleX = pixelSpacing && pixelSpacing.length >= 2 ? pixelSpacing[1] : 1;
    const scaleY = pixelSpacing && pixelSpacing.length >= 2 ? pixelSpacing[0] : 1;
    const v1 = { x: (m.start.x - m.end.x) * scaleX, y: (m.start.y - m.end.y) * scaleY };
    const v2 = { x: (m.end2.x - m.start2.x) * scaleX, y: (m.end2.y - m.start2.y) * scaleY };
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
