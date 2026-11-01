import { open } from 'react-native-nitro-sqlite';

import {
  deriveDiagnosisSource,
  DIAGNOSIS_SOURCE,
} from '../utils/diagnosisSource';
import { getDiagnosisImages as getImageEntries } from '../utils/diagnosisImages';

const db = open({
  name: 'oralscan.db',
});

/**
 * Schema version.
 *
 * 1 - original single-image schema
 * 2 - multi-image schema (diagnosis_images table)
 * 3 - diagnosis source plus live inference / model metadata
 *
 * Versions older than 2 are reset because the multi-image tables are a hard
 * requirement for the current diagnosis shape. Version 2 is migrated in place
 * with guarded ALTER TABLE statements so existing diagnoses remain readable.
 */
export const SCHEMA_VERSION = 3;

const MULTI_IMAGE_SCHEMA_VERSION = 2;

async function tableHasColumn(table, column) {
  try {
    const result = await db.executeAsync(`PRAGMA table_info(${table})`);

    const rows = result?.rows?._array || result?.rows || [];

    return rows.some(row => row?.name === column);
  } catch (error) {
    console.warn(
      `Could not inspect ${table}.${column}:`,
      error?.message,
    );

    return false;
  }
}

async function ensureColumn(table, column, definition) {
  if (await tableHasColumn(table, column)) {
    return;
  }

  try {
    await db.executeAsync(
      `ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`,
    );
  } catch (error) {
    // A concurrent initialization or a column added by a newer build is not
    // a fatal condition; the table is still usable.
    console.warn(
      `Could not add ${table}.${column}:`,
      error?.message,
    );
  }
}

async function withTransaction(work) {
  await db.executeAsync('BEGIN TRANSACTION');

  try {
    const result = await work();

    await db.executeAsync('COMMIT');

    return result;
  } catch (error) {
    try {
      await db.executeAsync('ROLLBACK');
    } catch (rollbackError) {
      console.error('DATABASE ROLLBACK ERROR:', rollbackError);
    }

    throw error;
  }
}

async function getSchemaVersion() {
  try {
    const result = await db.executeAsync('PRAGMA user_version');

    const row = result?.rows?._array?.[0] || result?.rows?.[0] || {};

    const version = Number(row.user_version ?? 0);

    return Number.isFinite(version) ? version : 0;
  } catch (error) {
    // Never risk a destructive reset when the version cannot be read.
    console.warn('Could not read SQLite schema version:', error?.message);

    return SCHEMA_VERSION;
  }
}

export async function initializeDatabase() {
  const version = await getSchemaVersion();

  if (version < MULTI_IMAGE_SCHEMA_VERSION) {
    // Clean reset of the legacy single-image schema.
    await db.executeAsync('DROP TABLE IF EXISTS diagnosis_images');
    await db.executeAsync('DROP TABLE IF EXISTS diagnoses');
  }

  await db.executeAsync(`
    CREATE TABLE IF NOT EXISTS diagnoses (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,

      source TEXT,

      patient_name TEXT NOT NULL,
      date_of_birth TEXT NOT NULL,
      age_at_diagnosis INTEGER NOT NULL,

      gender TEXT,
      country TEXT,
      state TEXT,
      city TEXT,

      doctor_name TEXT,
      hospital_name TEXT,

      image_selected INTEGER NOT NULL DEFAULT 0,
      audio_selected INTEGER NOT NULL DEFAULT 0,

      audio_path TEXT,
      audio_prediction TEXT,
      audio_confidence REAL,
      audio_pathology_probability REAL,
      audio_normal_probability REAL,
      audio_doctor_assessment TEXT,
      audio_doctor_remarks TEXT,

      report_path TEXT
    );
  `);

  await db.executeAsync(`
    CREATE TABLE IF NOT EXISTS diagnosis_images (
      id TEXT PRIMARY KEY,
      diagnosis_id TEXT NOT NULL,

      image_order INTEGER NOT NULL DEFAULT 0,

      image_path TEXT,
      image_original_uri TEXT,
      image_file_name TEXT,

      image_prediction TEXT,
      image_confidence REAL,
      image_cancer_probability REAL,
      image_non_cancer_probability REAL,

      doctor_assessment TEXT,
      doctor_remarks TEXT,

      inference_status TEXT NOT NULL DEFAULT 'pending',
      error_message TEXT,

      inference_timestamp TEXT,
      model_name TEXT,
      model_version TEXT,

      created_at TEXT,

      FOREIGN KEY (diagnosis_id) REFERENCES diagnoses (id) ON DELETE CASCADE
    );
  `);

  // In-place migration for databases created before schema version 3.
  await ensureColumn('diagnoses', 'source', 'TEXT');
  await ensureColumn(
    'diagnosis_images',
    'inference_timestamp',
    'TEXT',
  );
  await ensureColumn('diagnosis_images', 'model_name', 'TEXT');
  await ensureColumn('diagnosis_images', 'model_version', 'TEXT');

  await db.executeAsync(`
    CREATE INDEX IF NOT EXISTS idx_diagnosis_images_diagnosis_id
    ON diagnosis_images (diagnosis_id);
  `);

  await db.executeAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);

  try {
    await db.executeAsync('PRAGMA foreign_keys = ON');
  } catch (error) {
    console.warn('Could not enable SQLite foreign keys:', error?.message);
  }

  console.log('OralScan database initialized');
}

/**
 * Persists all images of a diagnosis.
 *
 * The images are treated as a set: previous rows for the diagnosis are
 * removed and replaced with the current state, inside the caller's
 * transaction.
 */
async function saveDiagnosisImages(diagnosisId, images) {
  await db.executeAsync(
    `
    DELETE FROM diagnosis_images
    WHERE diagnosis_id = ?
    `,
    [diagnosisId],
  );

  for (let index = 0; index < images.length; index += 1) {
    const image = images[index];
    const result = image?.result;

    await db.executeAsync(
      `
      INSERT OR REPLACE INTO diagnosis_images (
        id,
        diagnosis_id,
        image_order,

        image_path,
        image_original_uri,
        image_file_name,

        image_prediction,
        image_confidence,
        image_cancer_probability,
        image_non_cancer_probability,

        doctor_assessment,
        doctor_remarks,

        inference_status,
        error_message,

        inference_timestamp,
        model_name,
        model_version,

        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        image.id,
        diagnosisId,
        index,

        image.path || image.uri || null,
        image.originalUri || image.uri || null,
        image.fileName || null,

        result?.className ?? null,
        result?.probability ?? null,
        result?.probabilities?.CANCER ?? null,
        result?.probabilities?.['NON CANCER'] ?? null,

        image.doctorAssessment || null,
        image.doctorRemarks || null,

        image.status || 'pending',
        image.error || null,

        image.inferenceTimestamp || null,
        image.modelName || null,
        image.modelVersion || null,

        image.createdAt || new Date().toISOString(),
      ],
    );
  }
}

export async function saveDiagnosis(diagnosis) {
  if (!diagnosis) {
    throw new Error('Diagnosis data is missing.');
  }

  const {
    id,
    createdAt,
    patient,
    hospitalDetails,
    selectedAnalyses,
    image,
    audio,
    reportPath,
  } = diagnosis;

  if (!id) {
    throw new Error('Diagnosis ID is missing.');
  }

  const images = getImageEntries(image).filter(item => !!item?.id);

  const hasImage =
    !!selectedAnalyses?.image || images.length > 0;

  const hasAudio = !!selectedAnalyses?.audio;

  const source = deriveDiagnosisSource({
    source: diagnosis.source,
    hasImage,
    hasAudio,
  });

  const isLive = source === DIAGNOSIS_SOURCE.LIVE;

  // Live records can be saved without a patient form. Every other flow still
  // requires the patient details collected before the analysis.
  if (!isLive && (!patient?.name || !patient?.dateOfBirth)) {
    throw new Error('Patient details are incomplete.');
  }

  const patientName =
    patient?.name || (isLive ? 'Live video session' : '');
  const dateOfBirth = patient?.dateOfBirth || '';

  const audioResult = audio?.result;

  await withTransaction(async () => {
    await db.executeAsync(
      `
      INSERT OR REPLACE INTO diagnoses (
        id,
        created_at,

        source,

        patient_name,
        date_of_birth,
        age_at_diagnosis,

        gender,
        country,
        state,
        city,

        doctor_name,
        hospital_name,

        image_selected,
        audio_selected,

        audio_path,
        audio_prediction,
        audio_confidence,
        audio_pathology_probability,
        audio_normal_probability,
        audio_doctor_assessment,
        audio_doctor_remarks,

        report_path
      )

      VALUES (
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?,
        ?, ?,
        ?, ?, ?, ?, ?, ?, ?,
        ?
      )
      `,
      [
        id,
        createdAt || new Date().toISOString(),

        source,

        patientName,
        dateOfBirth,
        patient?.age ?? 0,

        patient?.gender || null,
        patient?.country || null,
        patient?.state || null,
        patient?.city || null,

        hospitalDetails?.doctorName || null,
        hospitalDetails?.hospitalName || null,

        hasImage ? 1 : 0,
        hasAudio ? 1 : 0,

        audio?.path || null,
        audioResult?.prediction || null,
        audioResult?.confidence ?? null,
        audioResult?.pathologyProbability ?? null,
        audioResult?.normalProbability ?? null,
        audio?.doctorAssessment || null,
        audio?.doctorRemarks || null,

        reportPath || null,
      ],
    );

    await saveDiagnosisImages(id, images);
  });

  console.log('Diagnosis saved:', id, `(${images.length} images)`);

  return id;
}

export async function getAllDiagnoses() {
  const result = await db.executeAsync(`
    SELECT
      d.*,
      (
        SELECT COUNT(*)
        FROM diagnosis_images di
        WHERE di.diagnosis_id = d.id
      ) AS image_count,
      (
        SELECT COUNT(*)
        FROM diagnosis_images di
        WHERE di.diagnosis_id = d.id
          AND di.image_prediction = 'CANCER'
      ) AS image_cancer_count,
      (
        SELECT di.image_path
        FROM diagnosis_images di
        WHERE di.diagnosis_id = d.id
        ORDER BY di.image_order ASC, di.created_at ASC
        LIMIT 1
      ) AS thumbnail_path,
      (
        SELECT di.image_prediction
        FROM diagnosis_images di
        WHERE di.diagnosis_id = d.id
        ORDER BY di.image_order ASC, di.created_at ASC
        LIMIT 1
      ) AS primary_image_prediction,
      (
        SELECT di.image_confidence
        FROM diagnosis_images di
        WHERE di.diagnosis_id = d.id
        ORDER BY di.image_order ASC, di.created_at ASC
        LIMIT 1
      ) AS primary_image_confidence
    FROM diagnoses d
    ORDER BY d.created_at DESC
  `);

  return result.rows?._array || [];
}

export async function getDiagnosisById(id) {
  const result = await db.executeAsync(
    `
    SELECT *
    FROM diagnoses
    WHERE id = ?
    `,
    [id],
  );

  return result.rows?._array?.[0] || null;
}

export async function getDiagnosisImages(diagnosisId) {
  if (!diagnosisId) {
    throw new Error('Diagnosis ID is missing.');
  }

  const result = await db.executeAsync(
    `
    SELECT *
    FROM diagnosis_images
    WHERE diagnosis_id = ?
    ORDER BY image_order ASC, created_at ASC
    `,
    [diagnosisId],
  );

  return result.rows?._array || [];
}

/**
 * Returns a diagnosis together with all of its images.
 */
export async function getDiagnosisWithImages(id) {
  const diagnosis = await getDiagnosisById(id);

  if (!diagnosis) {
    return null;
  }

  const images = await getDiagnosisImages(id);

  return {
    ...diagnosis,
    images,
    image_count: images.length,
  };
}

export async function saveDiagnosisImage(diagnosisId, image, order = 0) {
  if (!diagnosisId) {
    throw new Error('Diagnosis ID is missing.');
  }

  if (!image?.id) {
    throw new Error('Image ID is missing.');
  }

  const result = image.result;

  await db.executeAsync(
    `
    INSERT OR REPLACE INTO diagnosis_images (
      id,
      diagnosis_id,
      image_order,

      image_path,
      image_original_uri,
      image_file_name,

      image_prediction,
      image_confidence,
      image_cancer_probability,
      image_non_cancer_probability,

      doctor_assessment,
      doctor_remarks,

      inference_status,
      error_message,

      inference_timestamp,
      model_name,
      model_version,

      created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      image.id,
      diagnosisId,
      order,

      image.path || image.uri || null,
      image.originalUri || image.uri || null,
      image.fileName || null,

      result?.className ?? null,
      result?.probability ?? null,
      result?.probabilities?.CANCER ?? null,
      result?.probabilities?.['NON CANCER'] ?? null,

      image.doctorAssessment || null,
      image.doctorRemarks || null,

      image.status || 'pending',
      image.error || null,

      image.inferenceTimestamp || null,
      image.modelName || null,
      image.modelVersion || null,

      image.createdAt || new Date().toISOString(),
    ],
  );
}

export async function updateDiagnosisImageAssessment(
  imageId,
  { doctorAssessment, doctorRemarks },
) {
  if (!imageId) {
    throw new Error('Image ID is missing.');
  }

  await db.executeAsync(
    `
    UPDATE diagnosis_images
    SET
      doctor_assessment = ?,
      doctor_remarks = ?
    WHERE id = ?
    `,
    [
      doctorAssessment || null,
      doctorRemarks || null,
      imageId,
    ],
  );
}

export async function deleteDiagnosisImage(imageId) {
  if (!imageId) {
    throw new Error('Image ID is missing.');
  }

  await db.executeAsync(
    `
    DELETE FROM diagnosis_images
    WHERE id = ?
    `,
    [imageId],
  );
}

export async function deleteDiagnosis(id) {
  if (!id) {
    throw new Error('Diagnosis ID is missing.');
  }

  await withTransaction(async () => {
    await db.executeAsync(
      `
      DELETE FROM diagnosis_images
      WHERE diagnosis_id = ?
      `,
      [id],
    );

    await db.executeAsync(
      `
      DELETE FROM diagnoses
      WHERE id = ?
      `,
      [id],
    );
  });
}

export async function updateDiagnosisReportPath(id, reportPath) {
  if (!id) {
    throw new Error('Diagnosis ID is missing.');
  }

  await db.executeAsync(
    `
    UPDATE diagnoses
    SET report_path = ?
    WHERE id = ?
    `,
    [reportPath, id],
  );

  console.log('Report path updated:', id);
}
