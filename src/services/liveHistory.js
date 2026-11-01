import { createDiagnosisId } from '../utils/diagnosisId';
import { DIAGNOSIS_SOURCE } from '../utils/diagnosisSource';
import { createImageId } from '../utils/imageId';
import { saveDiagnosis } from './database';
import {
  deleteDiagnosisFolder,
  saveDiagnosisImageBuffer,
} from './diagnosisStorage';

export const LIVE_HISTORY_PLACEHOLDER_PATIENT = 'Live video session';
export const LIVE_HISTORY_DEFAULT_MODEL = 'MobileNetV3';

function calculateAge(dateOfBirth) {
  if (!dateOfBirth) {
    return 0;
  }

  const birthDate = new Date(dateOfBirth);

  if (Number.isNaN(birthDate.getTime())) {
    return 0;
  }

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();

  const monthDifference = today.getMonth() - birthDate.getMonth();

  if (
    monthDifference < 0 ||
    (monthDifference === 0 &&
      today.getDate() < birthDate.getDate())
  ) {
    age -= 1;
  }

  return Math.max(0, age);
}

export function buildLivePatient(patient = {}) {
  const dateOfBirth = patient?.dateOfBirth || '';

  return {
    name: patient?.name || LIVE_HISTORY_PLACEHOLDER_PATIENT,
    dateOfBirth,
    age: patient?.age ?? calculateAge(dateOfBirth),
    gender: patient?.gender || '',
    country: patient?.country || '',
    state: patient?.state || '',
    city: patient?.city || '',
  };
}

export function buildLiveDiagnosis({
  diagnosisId,
  imageId,
  imagePath,
  prediction,
  capturedAt = Date.now(),
  patient,
  hospitalDetails,
  modelName,
  modelVersion,
}) {
  const timestamp = Number(capturedAt) || Date.now();
  const createdAt = new Date(timestamp).toISOString();
  const fileName = imagePath.split('/').pop();

  return {
    id: diagnosisId,
    createdAt,
    source: DIAGNOSIS_SOURCE.LIVE,

    patient: buildLivePatient(patient),

    hospitalDetails: {
      doctorName: hospitalDetails?.doctorName || '',
      hospitalName: hospitalDetails?.hospitalName || '',
    },

    selectedAnalyses: {
      image: true,
      audio: false,
    },

    image: {
      images: [
        {
          id: imageId,
          uri: imagePath,
          originalUri: imagePath,
          path: imagePath,
          fileName,
          mimeType: 'image/jpeg',
          result: {
            classIndex: prediction.classIndex,
            className: prediction.className,
            probability: prediction.probability,
            probabilities: {
              ...prediction.probabilities,
            },
          },
          doctorAssessment: '',
          doctorRemarks: '',
          status: 'completed',
          error: null,
          createdAt,
          inferenceTimestamp: createdAt,
          modelName: modelName || LIVE_HISTORY_DEFAULT_MODEL,
          modelVersion: modelVersion || null,
        },
      ],
    },

    audio: {
      path: null,
      result: null,
      doctorAssessment: '',
      doctorRemarks: '',
    },

    reportPath: null,
  };
}

/**
 * Saves the latest live prediction and its matching camera frame as a normal
 * diagnosis record. Called only from the explicit Save to History action.
 */
export async function saveLiveDiagnosisToHistory({
  prediction,
  frameBuffer,
  capturedAt = Date.now(),
  patient,
  hospitalDetails,
  modelName,
  modelVersion,
} = {}) {
  if (!prediction?.className) {
    throw new Error('A prediction is required to save to history.');
  }

  if (!frameBuffer) {
    throw new Error('A camera frame is required to save to history.');
  }

  const diagnosisId = createDiagnosisId();
  const imageId = createImageId();
  const fileName = `images/live-${capturedAt}-${imageId}.jpg`;

  let imagePath = null;

  try {
    imagePath = await saveDiagnosisImageBuffer(
      frameBuffer,
      diagnosisId,
      fileName,
    );

    const diagnosis = buildLiveDiagnosis({
      diagnosisId,
      imageId,
      imagePath,
      prediction,
      capturedAt,
      patient,
      hospitalDetails,
      modelName,
      modelVersion,
    });

    await saveDiagnosis(diagnosis);

    return {
      diagnosisId,
      imagePath,
    };
  } catch (error) {
    // Do not leave an orphaned image folder behind when the database write
    // fails after the frame was already written.
    try {
      await deleteDiagnosisFolder(diagnosisId);
    } catch {
      // Cleanup is best effort; the original error is more useful.
    }

    throw error;
  }
}
