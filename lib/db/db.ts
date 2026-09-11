import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

let dbInstance: Database.Database | null = null;

export function setDb(db: Database.Database | null) {
  dbInstance = db;
}

export function getDb(): Database.Database {
  if (dbInstance) {
    return dbInstance;
  }

  if (process.env.NODE_ENV === 'test') {
    dbInstance = new Database(':memory:');
    initDbSchema(dbInstance);
    return dbInstance;
  }

  const dbDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const dbPath = path.join(dbDir, 'dicom_inbox.db');
  dbInstance = new Database(dbPath);
  dbInstance.pragma('journal_mode = WAL');
  dbInstance.pragma('synchronous = NORMAL');

  initDbSchema(dbInstance);

  return dbInstance;
}

export function initDbSchema(db: Database.Database) {
  const tableInfo = db
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='dicom_inbox'")
    .get() as { sql?: string } | undefined;

  if (tableInfo?.sql && tableInfo.sql.includes('sop_instance_uid TEXT UNIQUE')) {
    // Migrate existing table to remove UNIQUE from sop_instance_uid
    db.exec(`
      CREATE TABLE dicom_inbox_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_path TEXT UNIQUE NOT NULL,
        file_size_bytes INTEGER NOT NULL,
        file_sha256 TEXT,
        sop_instance_uid TEXT NOT NULL,
        series_instance_uid TEXT NOT NULL,
        study_instance_uid TEXT NOT NULL,
        patient_id TEXT,
        patient_name TEXT,
        patient_birth_date TEXT,
        study_date TEXT,
        study_description TEXT,
        modality TEXT DEFAULT 'MR',
        series_description TEXT,
        body_part_examined TEXT,
        protocol_name TEXT,
        series_number INTEGER,
        instance_number INTEGER,
        slice_location REAL,
        slice_thickness REAL,
        rows INTEGER,
        columns INTEGER,
        pixel_spacing TEXT,
        image_orientation_patient TEXT,
        image_position_patient TEXT,
        calculated_orientation TEXT,
        metadata_json TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      INSERT OR IGNORE INTO dicom_inbox_new SELECT * FROM dicom_inbox;
      DROP TABLE dicom_inbox;
      ALTER TABLE dicom_inbox_new RENAME TO dicom_inbox;
    `);
  } else {
    db.exec(`
      CREATE TABLE IF NOT EXISTS dicom_inbox (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_path TEXT UNIQUE NOT NULL,
        file_size_bytes INTEGER NOT NULL,
        file_sha256 TEXT,
        sop_instance_uid TEXT NOT NULL,
        series_instance_uid TEXT NOT NULL,
        study_instance_uid TEXT NOT NULL,
        patient_id TEXT,
        patient_name TEXT,
        patient_birth_date TEXT,
        study_date TEXT,
        study_description TEXT,
        modality TEXT DEFAULT 'MR',
        series_description TEXT,
        body_part_examined TEXT,
        protocol_name TEXT,
        series_number INTEGER,
        instance_number INTEGER,
        slice_location REAL,
        slice_thickness REAL,
        rows INTEGER,
        columns INTEGER,
        pixel_spacing TEXT,
        image_orientation_patient TEXT,
        image_position_patient TEXT,
        calculated_orientation TEXT,
        metadata_json TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
    `);
  }

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_dicom_inbox_sop ON dicom_inbox (sop_instance_uid);
    CREATE INDEX IF NOT EXISTS idx_dicom_inbox_series ON dicom_inbox (series_instance_uid);
    CREATE INDEX IF NOT EXISTS idx_dicom_inbox_study ON dicom_inbox (study_instance_uid);
    CREATE INDEX IF NOT EXISTS idx_dicom_inbox_patient ON dicom_inbox (patient_id);
    CREATE INDEX IF NOT EXISTS idx_dicom_inbox_orientation ON dicom_inbox (calculated_orientation);
    CREATE INDEX IF NOT EXISTS idx_dicom_inbox_modality ON dicom_inbox (modality);
  `);
}
