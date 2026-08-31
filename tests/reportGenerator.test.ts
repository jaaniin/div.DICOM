import { describe, it, expect } from 'vitest';
import { generateReportText, generateReportFilename } from '../utils/reportGenerator';
import { DICOMStudy } from '../utils/types';

describe('Report Generator', () => {
  const mockStudy: DICOMStudy = {
    studyInstanceUID: '1.2.3.4.5',
    patientName: 'DOE^JOHN',
    patientId: '12345678',
    patientBirthDate: '19800101',
    patientSex: 'M',
    patientAge: '044Y',
    studyDate: '20260830',
    studyTime: '123000',
    studyDescription: 'MRI LUMBAR SPINE',
    accessionNumber: 'ACC123',
    referringPhysician: 'DR SMITH',
    institutionName: 'CENTRAL HOSPITAL',
    series: [],
  };

  it('generates structured report text with patient header and findings', () => {
    const timestamp = new Date('2026-08-30T12:00:00Z');
    const report = generateReportText({
      studies: [mockStudy],
      findings: 'L4-L5 disc protrusion causing mild neural exit foraminal narrowing.',
      timestamp,
    });

    expect(report).toContain('DOE^JOHN');
    expect(report).toContain('12345678');
    expect(report).toContain('MRI LUMBAR SPINE');
    expect(report).toContain('L4-L5 disc protrusion');
    expect(report).toContain('CENTRAL HOSPITAL');
  });

  it('generates sanitized filename for report download', () => {
    const timestamp = new Date('2026-08-30T14:35:00Z');
    const filename = generateReportFilename([mockStudy], timestamp);

    expect(filename).toContain('Report');
    expect(filename).toContain('DOE_JOHN');
    expect(filename.endsWith('.txt')).toBe(true);
  });

  it('handles empty studies gracefully', () => {
    const timestamp = new Date('2026-08-30T12:00:00Z');
    const report = generateReportText({
      studies: [],
      findings: 'No abnormalities.',
      timestamp,
    });

    expect(report).toContain('No abnormalities.');
  });
});
