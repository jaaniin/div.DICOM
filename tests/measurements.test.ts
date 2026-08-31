import { describe, it, expect } from 'vitest';
import { calculateMeasurementLengthText, calculateRoiStatistics } from '../utils/measurements';
import { LengthMeasurement, DICOMStudy } from '../utils/types';

describe('measurements utils', () => {
  const dummyStudies: DICOMStudy[] = [
    {
      studyInstanceUID: 'st1',
      patientName: 'Test Patient',
      patientId: 'P01',
      studyDate: '20260101',
      series: [
        {
          seriesInstanceUID: 'ser1',
          seriesDescription: 'T1',
          modality: 'MR',
          instances: [
            {
              file: {} as any,
              imageId: 'img1',
              metadata: {
                patientName: 'Test',
                patientId: 'P01',
                studyDate: '20260101',
                seriesDescription: 'T1',
                modality: 'MR',
                studyInstanceUID: 'st1',
                seriesInstanceUID: 'ser1',
                instanceNumber: 1,
                imagePositionPatient: [0, 0, 0],
                imageOrientationPatient: [1, 0, 0, 0, 1, 0],
                pixelSpacing: [0.5, 0.5],
                rows: 512,
                columns: 512,
              },
            },
          ],
        },
      ],
    },
  ];

  it('calculates length measurement in mm when pixel spacing is available', () => {
    const m: LengthMeasurement = {
      id: 'm1',
      imageId: 'img1',
      type: 'length',
      start: { x: 0, y: 0 },
      end: { x: 10, y: 0 },
    };
    const text = calculateMeasurementLengthText(m, 0, dummyStudies);
    expect(text).toBe('A: 5.0 mm');
  });

  it('calculates angle measurement correctly', () => {
    const m: LengthMeasurement = {
      id: 'm2',
      imageId: 'img1',
      type: 'angle',
      start: { x: 0, y: 10 },
      end: { x: 0, y: 0 },
      start2: { x: 0, y: 0 },
      end2: { x: 10, y: 0 },
    };
    const text = calculateMeasurementLengthText(m, 1, dummyStudies);
    expect(text).toBe('Angle B: 90.0°');
  });

  it('calculates ROI polygon area and statistics correctly', () => {
    // 10x10 square in pixel coords
    const points = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    // Create mock image 20x20
    const pixelData = new Int16Array(20 * 20);
    pixelData.fill(100);

    const mockImage = {
      width: 20,
      height: 20,
      columns: 20,
      rows: 20,
      slope: 1,
      intercept: 0,
      getPixelData: () => pixelData,
    };

    const stats = calculateRoiStatistics(points, mockImage, [1.0, 1.0]);
    expect(stats.area).toBe(100);
    expect(stats.mean).toBe(100);
    expect(stats.min).toBe(100);
    expect(stats.max).toBe(100);
    expect(stats.stdDev).toBe(0);
  });
});
