import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dicomParser from 'dicom-parser';
import { getDb } from '../db/db';
import { calculateOrientation, AnatomicalOrientation } from './orientationCalculator';

export interface DicomFileRecord {
  filePath: string;
  fileSizeBytes: number;
  fileSha256: string;
  sopInstanceUid: string;
  seriesInstanceUid: string;
  studyInstanceUid: string;
  patientId: string;
  patientName: string;
  patientBirthDate: string;
  studyDate: string;
  studyDescription: string;
  modality: string;
  seriesDescription: string;
  bodyPartExamined: string;
  protocolName: string;
  seriesNumber: number | null;
  instanceNumber: number | null;
  sliceLocation: number | null;
  sliceThickness: number | null;
  rows: number | null;
  columns: number | null;
  pixelSpacing: string | null;
  imageOrientationPatient: string | null;
  imagePositionPatient: string | null;
  calculatedOrientation: AnatomicalOrientation;
  metadataJson: string;
}

function parseNumberList(str: string | undefined | null): number[] | null {
  if (!str) return null;
  try {
    const parts = str.split('\\').map((p) => parseFloat(p.trim())).filter((n) => !isNaN(n));
    return parts.length > 0 ? parts : null;
  } catch {
    return null;
  }
}

export function parseDicomBuffer(
  fileBuffer: Buffer | Uint8Array,
  filePath: string = ''
): DicomFileRecord | null {
  try {
    const uint8Array =
      fileBuffer instanceof Uint8Array
        ? fileBuffer
        : new Uint8Array(fileBuffer);

    // Parse DICOM dataset
    const dataset = dicomParser.parseDicom(uint8Array);

    const sopInstanceUid = dataset.string('x00080018') || crypto.randomUUID();
    const seriesInstanceUid = dataset.string('x0020000e') || 'UNKNOWN_SERIES';
    const studyInstanceUid = dataset.string('x0020000d') || 'UNKNOWN_STUDY';

    const patientId = dataset.string('x00100020') || 'ANONYMOUS';
    const patientName = dataset.string('x00100010') || 'ANONYMOUS';
    const patientBirthDate = dataset.string('x00100030') || '';
    const studyDate = dataset.string('x00080020') || '';
    const studyDescription = dataset.string('x00081030') || '';
    const modality = dataset.string('x00080060') || 'OT';
    const seriesDescription = dataset.string('x0008103e') || '';
    const bodyPartExamined = dataset.string('x00180015') || '';
    const protocolName = dataset.string('x00181030') || '';

    const seriesNumStr = dataset.string('x00200011');
    const seriesNumber = seriesNumStr ? parseInt(seriesNumStr, 10) || null : null;

    const instNumStr = dataset.string('x00200013');
    const instanceNumber = instNumStr ? parseInt(instNumStr, 10) || null : null;

    const sliceLocStr = dataset.string('x00201041');
    const sliceLocation = sliceLocStr ? parseFloat(sliceLocStr) || null : null;

    const sliceThickStr = dataset.string('x00180050');
    const sliceThickness = sliceThickStr ? parseFloat(sliceThickStr) || null : null;

    const rows = dataset.uint16('x00280010') || null;
    const columns = dataset.uint16('x00280011') || null;

    const pixelSpacingRaw = dataset.string('x00280030');
    const pixelSpacing = pixelSpacingRaw ? JSON.stringify(parseNumberList(pixelSpacingRaw)) : null;

    const iopRaw = dataset.string('x00200037');
    const iopList = parseNumberList(iopRaw);
    const imageOrientationPatient = iopList ? JSON.stringify(iopList) : null;
    const calculatedOrientation = calculateOrientation(iopList);

    const ippRaw = dataset.string('x00200032');
    const imagePositionPatient = ippRaw ? JSON.stringify(parseNumberList(ippRaw)) : null;

    const sha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    const summaryMetadata = {
      patientId,
      patientName,
      studyDate,
      studyDescription,
      seriesDescription,
      modality,
      sopInstanceUid,
      seriesInstanceUid,
      studyInstanceUid,
      seriesNumber,
      instanceNumber,
      sliceLocation,
      sliceThickness,
      rows,
      columns,
      calculatedOrientation,
    };

    return {
      filePath,
      fileSizeBytes: fileBuffer.byteLength,
      fileSha256: sha256,
      sopInstanceUid,
      seriesInstanceUid,
      studyInstanceUid,
      patientId,
      patientName,
      patientBirthDate,
      studyDate,
      studyDescription,
      modality,
      seriesDescription,
      bodyPartExamined,
      protocolName,
      seriesNumber,
      instanceNumber,
      sliceLocation,
      sliceThickness,
      rows,
      columns,
      pixelSpacing,
      imageOrientationPatient,
      imagePositionPatient,
      calculatedOrientation,
      metadataJson: JSON.stringify(summaryMetadata),
    };
  } catch (err) {
    // Not a valid DICOM file or unparseable
    return null;
  }
}

export function parseDicomFile(filePath: string): DicomFileRecord | null {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    return parseDicomBuffer(fileBuffer, filePath);
  } catch {
    return null;
  }
}

export function saveUploadedDicomBuffer(
  buffer: Buffer,
  originalFilename?: string
): DicomFileRecord | null {
  const tempParsed = parseDicomBuffer(buffer, '');
  if (!tempParsed) {
    return null;
  }

  // Organize under data/inbox/studyUid/seriesUid
  const sanitizedStudy = tempParsed.studyInstanceUid.replace(/[^a-zA-Z0-9.-]/g, '_');
  const sanitizedSeries = tempParsed.seriesInstanceUid.replace(/[^a-zA-Z0-9.-]/g, '_');
  const sanitizedSop = tempParsed.sopInstanceUid.replace(/[^a-zA-Z0-9.-]/g, '_');

  const inboxDir = path.join(process.cwd(), 'data', 'inbox', sanitizedStudy, sanitizedSeries);
  if (!fs.existsSync(inboxDir)) {
    fs.mkdirSync(inboxDir, { recursive: true });
  }

  const filename = `${sanitizedSop}.dcm`;
  const destFilePath = path.join(inboxDir, filename);

  fs.writeFileSync(destFilePath, buffer);

  const record: DicomFileRecord = {
    ...tempParsed,
    filePath: destFilePath,
  };

  saveDicomRecord(record);
  return record;
}

export function saveDicomRecord(record: DicomFileRecord): void {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO dicom_inbox (
      file_path, file_size_bytes, file_sha256,
      sop_instance_uid, series_instance_uid, study_instance_uid,
      patient_id, patient_name, patient_birth_date,
      study_date, study_description,
      modality, series_description, body_part_examined, protocol_name,
      series_number, instance_number,
      slice_location, slice_thickness,
      rows, columns, pixel_spacing,
      image_orientation_patient, image_position_patient,
      calculated_orientation, metadata_json,
      updated_at
    ) VALUES (
      @filePath, @fileSizeBytes, @fileSha256,
      @sopInstanceUid, @seriesInstanceUid, @studyInstanceUid,
      @patientId, @patientName, @patientBirthDate,
      @studyDate, @studyDescription,
      @modality, @seriesDescription, @bodyPartExamined, @protocolName,
      @seriesNumber, @instanceNumber,
      @sliceLocation, @sliceThickness,
      @rows, @columns, @pixelSpacing,
      @imageOrientationPatient, @imagePositionPatient,
      @calculatedOrientation, @metadataJson,
      datetime('now')
    )
    ON CONFLICT(file_path) DO UPDATE SET
      file_size_bytes = excluded.file_size_bytes,
      file_sha256 = excluded.file_sha256,
      sop_instance_uid = excluded.sop_instance_uid,
      series_instance_uid = excluded.series_instance_uid,
      study_instance_uid = excluded.study_instance_uid,
      patient_id = excluded.patient_id,
      patient_name = excluded.patient_name,
      patient_birth_date = excluded.patient_birth_date,
      study_date = excluded.study_date,
      study_description = excluded.study_description,
      modality = excluded.modality,
      series_description = excluded.series_description,
      body_part_examined = excluded.body_part_examined,
      protocol_name = excluded.protocol_name,
      series_number = excluded.series_number,
      instance_number = excluded.instance_number,
      slice_location = excluded.slice_location,
      slice_thickness = excluded.slice_thickness,
      rows = excluded.rows,
      columns = excluded.columns,
      pixel_spacing = excluded.pixel_spacing,
      image_orientation_patient = excluded.image_orientation_patient,
      image_position_patient = excluded.image_position_patient,
      calculated_orientation = excluded.calculated_orientation,
      metadata_json = excluded.metadata_json,
      updated_at = datetime('now')
  `);

  stmt.run(record);
}

function getAllFilesRecursively(dir: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(dir)) return fileList;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === '__READ_ONLY__') {
      continue;
    }
    const fullPath = path.join(dir, entry.name);
    try {
      if (entry.isDirectory()) {
        getAllFilesRecursively(fullPath, fileList);
      } else if (entry.isFile()) {
        fileList.push(fullPath);
      }
    } catch {
      // Ignore permission or access errors
    }
  }
  return fileList;
}

export interface ScanResult {
  totalFilesFound: number;
  dicomFilesIndexed: number;
  elapsedMs: number;
}

export async function scanDirectory(
  targetDir: string,
  onProgress?: (processed: number, total: number) => void
): Promise<ScanResult> {
  const startTime = Date.now();
  const allFiles = getAllFilesRecursively(targetDir);
  let dicomCount = 0;

  const db = getDb();
  const insertMany = db.transaction((records: DicomFileRecord[]) => {
    for (const rec of records) {
      try {
        saveDicomRecord(rec);
      } catch (err) {
        console.warn(`Failed to save record ${rec.filePath}:`, err);
      }
    }
  });

  const batch: DicomFileRecord[] = [];
  const BATCH_SIZE = 100;

  for (let i = 0; i < allFiles.length; i++) {
    const file = allFiles[i];
    const parsed = parseDicomFile(file);
    if (parsed) {
      batch.push(parsed);
      dicomCount++;
    }

    if (batch.length >= BATCH_SIZE) {
      insertMany(batch);
      batch.length = 0;
    }

    if (onProgress && (i % 50 === 0 || i === allFiles.length - 1)) {
      onProgress(i + 1, allFiles.length);
    }
  }

  if (batch.length > 0) {
    insertMany(batch);
  }

  return {
    totalFilesFound: allFiles.length,
    dicomFilesIndexed: dicomCount,
    elapsedMs: Date.now() - startTime,
  };
}
