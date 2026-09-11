import { getDb } from './db';
import type {
  StudyFilters,
  BrowserSeriesInstance,
  BrowserSeriesItem,
  BrowserStudyItem,
  FacetCount,
  BrowserFacets,
} from '@/utils/types';

export type {
  StudyFilters,
  BrowserSeriesInstance,
  BrowserSeriesItem,
  BrowserStudyItem,
  FacetCount,
  BrowserFacets,
};

export function getStudiesWithSeries(filters: StudyFilters = {}): BrowserStudyItem[] {
  const db = getDb();

  let whereClauses: string[] = ['1=1'];
  const params: Record<string, any> = {};

  if (filters.modality && filters.modality !== 'ALL') {
    whereClauses.push('modality = @modality');
    params.modality = filters.modality;
  }

  if (filters.orientation && filters.orientation !== 'ALL') {
    whereClauses.push('calculated_orientation = @orientation');
    params.orientation = filters.orientation;
  }

  if (filters.search && filters.search.trim() !== '') {
    whereClauses.push(`(
      patient_name LIKE @search OR
      patient_id LIKE @search OR
      study_description LIKE @search OR
      series_description LIKE @search OR
      protocol_name LIKE @search
    )`);
    params.search = `%${filters.search.trim()}%`;
  }

  if (filters.startDate) {
    whereClauses.push('study_date >= @startDate');
    params.startDate = filters.startDate.replace(/-/g, '');
  }

  if (filters.endDate) {
    whereClauses.push('study_date <= @endDate');
    params.endDate = filters.endDate.replace(/-/g, '');
  }

  const whereSql = whereClauses.join(' AND ');

  // Fetch all matching slices ordered for grouping
  const query = `
    SELECT 
      study_instance_uid, patient_id, patient_name, patient_birth_date,
      study_date, study_description,
      series_instance_uid, series_description, modality, series_number,
      slice_thickness, rows, columns, calculated_orientation,
      sop_instance_uid, instance_number, slice_location, file_path
    FROM dicom_inbox
    WHERE ${whereSql}
    ORDER BY 
      study_date DESC,
      study_instance_uid,
      series_number ASC,
      instance_number ASC,
      slice_location ASC
  `;

  const rows = db.prepare(query).all(params) as any[];

  // Group into Studies and Series
  const studyMap = new Map<string, BrowserStudyItem>();
  const seriesMap = new Map<string, BrowserSeriesItem & { allInstances: BrowserSeriesInstance[] }>();

  for (const row of rows) {
    const studyUid = row.study_instance_uid || 'UNKNOWN_STUDY';
    const seriesUid = row.series_instance_uid || 'UNKNOWN_SERIES';

    if (!studyMap.has(studyUid)) {
      studyMap.set(studyUid, {
        studyInstanceUid: studyUid,
        patientId: row.patient_id || '',
        patientName: row.patient_name || 'ANONYMOUS',
        patientBirthDate: row.patient_birth_date || '',
        studyDate: row.study_date || '',
        studyDescription: row.study_description || '',
        seriesCount: 0,
        totalInstances: 0,
        series: [],
      });
    }

    const study = studyMap.get(studyUid)!;

    if (!seriesMap.has(seriesUid)) {
      const newSeries: BrowserSeriesItem & { allInstances: BrowserSeriesInstance[] } = {
        seriesInstanceUid: seriesUid,
        seriesDescription: row.series_description || 'Unnamed Series',
        modality: row.modality || 'OT',
        seriesNumber: row.series_number,
        calculatedOrientation: row.calculated_orientation || 'OBLIQUE',
        sliceThickness: row.slice_thickness,
        rows: row.rows,
        columns: row.columns,
        instanceCount: 0,
        previewFilePath: row.file_path,
        previewSopUid: row.sop_instance_uid,
        allInstances: [],
      };
      seriesMap.set(seriesUid, newSeries);
      study.series.push(newSeries);
    }

    const series = seriesMap.get(seriesUid)!;
    if (!series.allInstances.some((inst) => inst.sopInstanceUid === row.sop_instance_uid)) {
      series.allInstances.push({
        sopInstanceUid: row.sop_instance_uid,
        instanceNumber: row.instance_number,
        sliceLocation: row.slice_location,
        filePath: row.file_path,
      });
      series.instanceCount++;
      study.totalInstances++;
    }
  }

  // Update middle-slice preview and apply minSlices filter
  const resultStudies: BrowserStudyItem[] = [];

  for (const study of studyMap.values()) {
    study.series = study.series.filter((s) => {
      const fullSeries = seriesMap.get(s.seriesInstanceUid)!;
      if (filters.minSlices && fullSeries.instanceCount < filters.minSlices) {
        return false;
      }
      // Pick middle slice for thumbnail
      const midIdx = Math.floor(fullSeries.allInstances.length / 2);
      const midInst = fullSeries.allInstances[midIdx];
      if (midInst) {
        s.previewFilePath = midInst.filePath;
        s.previewSopUid = midInst.sopInstanceUid;
      }
      return true;
    });

    study.seriesCount = study.series.length;
    if (study.series.length > 0) {
      resultStudies.push(study);
    }
  }

  // Sort studies if needed
  if (filters.sortBy === 'patientName') {
    resultStudies.sort((a, b) => (filters.sortOrder === 'desc' ? b.patientName.localeCompare(a.patientName) : a.patientName.localeCompare(b.patientName)));
  } else if (filters.sortBy === 'patientId') {
    resultStudies.sort((a, b) => (filters.sortOrder === 'desc' ? b.patientId.localeCompare(a.patientId) : a.patientId.localeCompare(b.patientId)));
  } else if (filters.sortBy === 'seriesCount') {
    resultStudies.sort((a, b) => (filters.sortOrder === 'desc' ? b.seriesCount - a.seriesCount : a.seriesCount - b.seriesCount));
  } else if (filters.sortBy === 'studyDate') {
    resultStudies.sort((a, b) => (filters.sortOrder === 'asc' ? a.studyDate.localeCompare(b.studyDate) : b.studyDate.localeCompare(a.studyDate)));
  }

  return resultStudies;
}

export function getFacets(): BrowserFacets {
  const db = getDb();

  const modalityRows = db.prepare(`
    SELECT modality as name, COUNT(DISTINCT series_instance_uid) as count
    FROM dicom_inbox
    WHERE modality IS NOT NULL AND modality != ''
    GROUP BY modality
    ORDER BY count DESC
  `).all() as FacetCount[];

  const orientationRows = db.prepare(`
    SELECT calculated_orientation as name, COUNT(DISTINCT series_instance_uid) as count
    FROM dicom_inbox
    WHERE calculated_orientation IS NOT NULL AND calculated_orientation != ''
    GROUP BY calculated_orientation
    ORDER BY count DESC
  `).all() as FacetCount[];

  const totals = db.prepare(`
    SELECT 
      COUNT(DISTINCT study_instance_uid) as totalStudies,
      COUNT(DISTINCT series_instance_uid) as totalSeries,
      COUNT(DISTINCT sop_instance_uid) as totalInstances
    FROM dicom_inbox
  `).get() as { totalStudies: number; totalSeries: number; totalInstances: number };

  return {
    modalities: modalityRows,
    orientations: orientationRows,
    totalStudies: totals?.totalStudies || 0,
    totalSeries: totals?.totalSeries || 0,
    totalInstances: totals?.totalInstances || 0,
  };
}

export function getSeriesInstances(seriesInstanceUid: string): BrowserSeriesInstance[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT sop_instance_uid, instance_number, slice_location, file_path
    FROM dicom_inbox
    WHERE series_instance_uid = ?
    ORDER BY instance_number ASC, slice_location ASC
  `).all(seriesInstanceUid) as any[];

  return rows.map((r) => ({
    sopInstanceUid: r.sop_instance_uid,
    instanceNumber: r.instance_number,
    sliceLocation: r.slice_location,
    filePath: r.file_path,
  }));
}

export function getStudyInstances(studyInstanceUid: string): BrowserSeriesInstance[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT sop_instance_uid, instance_number, slice_location, file_path
    FROM dicom_inbox
    WHERE study_instance_uid = ?
    ORDER BY series_number ASC, instance_number ASC, slice_location ASC
  `).all(studyInstanceUid) as any[];

  return rows.map((r) => ({
    sopInstanceUid: r.sop_instance_uid,
    instanceNumber: r.instance_number,
    sliceLocation: r.slice_location,
    filePath: r.file_path,
  }));
}

export function getMultipleSeriesInstances(seriesInstanceUids: string[]): BrowserSeriesInstance[] {
  if (!seriesInstanceUids || seriesInstanceUids.length === 0) return [];
  const db = getDb();
  const placeholders = seriesInstanceUids.map(() => '?').join(',');
  const rows = db.prepare(`
    SELECT sop_instance_uid, instance_number, slice_location, file_path
    FROM dicom_inbox
    WHERE series_instance_uid IN (${placeholders})
    ORDER BY study_date DESC, series_number ASC, instance_number ASC, slice_location ASC
  `).all(...seriesInstanceUids) as any[];

  return rows.map((r) => ({
    sopInstanceUid: r.sop_instance_uid,
    instanceNumber: r.instance_number,
    sliceLocation: r.slice_location,
    filePath: r.file_path,
  }));
}
