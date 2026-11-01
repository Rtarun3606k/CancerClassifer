/**
 * Source of a saved diagnosis.
 *
 * `source` is persisted with the diagnosis so History and Diagnosis Details
 * can use one shared page for image, audio and live-video records.
 */
export const DIAGNOSIS_SOURCE = {
  IMAGE: 'image_analysis',
  AUDIO: 'audio_analysis',
  LIVE: 'live_video',
};

const SOURCE_LABELS = {
  [DIAGNOSIS_SOURCE.IMAGE]: 'Image Analysis',
  [DIAGNOSIS_SOURCE.AUDIO]: 'Audio Analysis',
  [DIAGNOSIS_SOURCE.LIVE]: 'Live Video Detection',
};

export function normalizeDiagnosisSource(value) {
  return Object.values(DIAGNOSIS_SOURCE).includes(value) ? value : null;
}

/**
 * Resolves a stored source, falling back to the analysis flags for records
 * created before the source column existed.
 */
export function deriveDiagnosisSource({
  source,
  hasImage = false,
  hasAudio = false,
} = {}) {
  const normalized = normalizeDiagnosisSource(source);

  if (normalized) {
    return normalized;
  }

  if (hasImage) {
    return DIAGNOSIS_SOURCE.IMAGE;
  }

  if (hasAudio) {
    return DIAGNOSIS_SOURCE.AUDIO;
  }

  return DIAGNOSIS_SOURCE.IMAGE;
}

export function diagnosisSourceFromRow(row = {}) {
  return deriveDiagnosisSource({
    source: row.source,
    hasImage:
      Number(row.image_selected) === 1 ||
      Number(row.image_count) > 0,
    hasAudio:
      Number(row.audio_selected) === 1 ||
      !!row.audio_prediction,
  });
}

export function getDiagnosisSourceLabel(source) {
  const normalized = normalizeDiagnosisSource(source);

  return SOURCE_LABELS[normalized] ?? SOURCE_LABELS[DIAGNOSIS_SOURCE.IMAGE];
}
