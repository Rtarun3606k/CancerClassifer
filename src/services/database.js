import { open } from 'react-native-nitro-sqlite';

const db = open({
  name: 'oralscan.db',
});

export async function initializeDatabase() {
  await db.executeAsync(`
    CREATE TABLE IF NOT EXISTS diagnoses (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,

      patient_name TEXT NOT NULL,
      date_of_birth TEXT NOT NULL,
      age_at_diagnosis INTEGER NOT NULL,

      gender TEXT,
      country TEXT,
      state TEXT,
      city TEXT,

      image_selected INTEGER NOT NULL DEFAULT 0,
      audio_selected INTEGER NOT NULL DEFAULT 0,

      image_path TEXT,
      image_prediction TEXT,
      image_confidence REAL,
      image_cancer_probability REAL,
      image_non_cancer_probability REAL,

      audio_path TEXT,
      audio_prediction TEXT,
      audio_confidence REAL,
      audio_pathology_probability REAL,
      audio_normal_probability REAL,

      report_path TEXT
    );
  `);

  console.log('OralScan database initialized');
}

export async function saveDiagnosis(diagnosis) {
  if (!diagnosis) {
    throw new Error('Diagnosis data is missing.');
  }

  const { id, createdAt, patient, selectedAnalyses, image, audio, reportPath } =
    diagnosis;

  if (!id) {
    throw new Error('Diagnosis ID is missing.');
  }

  if (!patient?.name || !patient?.dateOfBirth) {
    throw new Error('Patient details are incomplete.');
  }

  const imageResult = image?.result;
  const audioResult = audio?.result;

  await db.executeAsync(
    `
    INSERT OR REPLACE INTO diagnoses (
      id,
      created_at,

      patient_name,
      date_of_birth,
      age_at_diagnosis,

      gender,
      country,
      state,
      city,

      image_selected,
      audio_selected,

      image_path,
      image_prediction,
      image_confidence,
      image_cancer_probability,
      image_non_cancer_probability,

      audio_path,
      audio_prediction,
      audio_confidence,
      audio_pathology_probability,
      audio_normal_probability,

      report_path
    )

    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?)
    `,
    [
      id,
      createdAt || new Date().toISOString(),

      patient.name,
      patient.dateOfBirth,
      patient.age ?? 0,

      patient.gender || null,
      patient.country || null,
      patient.state || null,
      patient.city || null,

      selectedAnalyses?.image ? 1 : 0,
      selectedAnalyses?.audio ? 1 : 0,

      image?.uri || null,
      imageResult?.className || null,
      imageResult?.probability ?? null,
      imageResult?.probabilities?.CANCER ?? null,
      imageResult?.probabilities?.['NON CANCER'] ?? null,

      audio?.path || null,
      audioResult?.prediction || null,
      audioResult?.confidence ?? null,
      audioResult?.pathologyProbability ?? null,
      audioResult?.normalProbability ?? null,

      reportPath || null,
    ],
  );

  console.log('Diagnosis saved:', id);

  return id;
}

export async function getAllDiagnoses() {
  const result = await db.executeAsync(`
    SELECT *
    FROM diagnoses
    ORDER BY created_at DESC
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

export async function deleteDiagnosis(id) {
  await db.executeAsync(
    `
    DELETE FROM diagnoses
    WHERE id = ?
    `,
    [id],
  );
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
