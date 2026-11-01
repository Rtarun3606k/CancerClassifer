import React, { createContext, useContext, useState } from 'react';

import { createDiagnosisId } from '../utils/diagnosisId';
import { createImageId } from '../utils/imageId';

const DiagnosisContext = createContext(null);

export const IMAGE_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
};

/**
 * Builds a single image entry for the multi-image diagnosis structure.
 *
 * Every image keeps its own model result, its own doctor assessment and its
 * own inference status so a failure on one image never affects the others.
 */
export function createEmptyImage(overrides = {}) {
  return {
    id: overrides.id || createImageId(),

    // Display uri. Once the file is copied into the diagnosis folder this is
    // the permanent path.
    uri: overrides.uri ?? null,

    // Original picker / camera uri, kept for diagnostics only.
    originalUri: overrides.originalUri ?? null,

    // Permanent path inside the OralScan diagnosis folder.
    path: overrides.path ?? null,

    fileName: overrides.fileName ?? null,

    mimeType: overrides.mimeType ?? null,

    result: overrides.result ?? null,

    doctorAssessment: overrides.doctorAssessment ?? '',
    doctorRemarks: overrides.doctorRemarks ?? '',

    status: overrides.status ?? IMAGE_STATUS.PENDING,

    error: overrides.error ?? null,
  };
}

function createEmptyDiagnosis() {
  return {
    id: createDiagnosisId(),

    createdAt: new Date().toISOString(),

    patient: {
      name: '',
      dateOfBirth: '',
      gender: '',
      country: '',
      state: '',
      city: '',
    },
    hospitalDetails: {
      doctorName: '',
      hospitalName: '',
    },

    image: {
      images: [],
    },

    audio: {
      path: null,
      result: null,
      doctorAssessment: '',
      doctorRemarks: '',
    },

    selectedAnalyses: {
      image: false,
      audio: false,
    },

    reportPath: null,
  };
}

export function DiagnosisProvider({ children }) {
  const [diagnosis, setDiagnosis] = useState(createEmptyDiagnosis());

  const updatePatient = updates => {
    setDiagnosis(prev => ({
      ...prev,

      patient: {
        ...prev.patient,
        ...updates,
      },
    }));
  };

  const setSelectedAnalyses = analyses => {
    setDiagnosis(prev => ({
      ...prev,

      selectedAnalyses: {
        ...prev.selectedAnalyses,
        ...analyses,
      },
    }));
  };

  const setHospitalDetails = ({ doctorName, hospitalName }) => {
    setDiagnosis(prev => ({
      ...prev,

      hospitalDetails: {
        hospitalName,
        doctorName,
      },
    }));
  };

  /**
   * Adds one or more images to the active diagnosis.
   *
   * Accepts partial image objects. Returns the generated image identifiers so
   * callers can start inference for exactly the images they just added.
   */
  const addImages = entries => {
    const list = (Array.isArray(entries) ? entries : [entries]).filter(Boolean);

    if (!list.length) {
      return [];
    }

    const prepared = list.map(entry =>
      entry.id ? { ...createEmptyImage(), ...entry } : createEmptyImage(entry),
    );

    setDiagnosis(prev => ({
      ...prev,

      image: {
        images: [...prev.image.images, ...prepared],
      },
    }));

    return prepared.map(item => item.id);
  };

  const addImage = entry => addImages([entry])[0] ?? null;

  const removeImage = imageId => {
    if (!imageId) {
      return;
    }

    setDiagnosis(prev => ({
      ...prev,

      image: {
        images: prev.image.images.filter(item => item.id !== imageId),
      },
    }));
  };

  const clearImages = () => {
    setDiagnosis(prev => ({
      ...prev,

      image: {
        images: [],
      },
    }));
  };

  const updateImage = (imageId, updates) => {
    if (!imageId) {
      return;
    }

    setDiagnosis(prev => ({
      ...prev,

      image: {
        images: prev.image.images.map(item =>
          item.id === imageId ? { ...item, ...updates } : item,
        ),
      },
    }));
  };

  const setImageAssessment = (
    imageId,
    { doctorAssessment, doctorRemarks } = {},
  ) => {
    updateImage(imageId, {
      ...(doctorAssessment !== undefined ? { doctorAssessment } : {}),
      ...(doctorRemarks !== undefined ? { doctorRemarks } : {}),
    });
  };

  /**
   * Convenience wrapper kept for single image updates.
   *
   * When `id` is provided the matching image is updated. Without an `id` the
   * first image of the diagnosis is updated (and created when none exists) so
   * legacy callers keep working.
   */
  const setImageResult = ({
    id,
    uri,
    path,
    result,
    doctorAssessment,
    doctorRemarks,
    status,
    error,
  }) => {
    const updates = {
      ...(uri !== undefined ? { uri } : {}),
      ...(path !== undefined ? { path } : {}),
      ...(result !== undefined ? { result } : {}),
      ...(doctorAssessment !== undefined ? { doctorAssessment } : {}),
      ...(doctorRemarks !== undefined ? { doctorRemarks } : {}),
      ...(status !== undefined ? { status } : {}),
      ...(error !== undefined ? { error } : {}),
    };

    setDiagnosis(prev => {
      const images = prev.image.images;

      const targetId = id || images[0]?.id || null;

      if (targetId && images.some(item => item.id === targetId)) {
        return {
          ...prev,
          image: {
            images: images.map(item =>
              item.id === targetId ? { ...item, ...updates } : item,
            ),
          },
        };
      }

      return {
        ...prev,
        image: {
          images: [
            ...images,
            createEmptyImage({ ...updates, ...(id ? { id } : {}) }),
          ],
        },
      };
    });
  };

  const setAudioResult = ({ path, result, doctorAssessment, doctorRemarks }) => {
    setDiagnosis(prev => ({
      ...prev,

      audio: {
        path,
        result,
        doctorAssessment,
        doctorRemarks,
      },
    }));
  };

  const setReportPath = reportPath => {
    setDiagnosis(prev => ({
      ...prev,
      reportPath,
    }));
  };

  const clearDiagnosis = () => {
    setDiagnosis(createEmptyDiagnosis());
  };

  const startNewDiagnosis = () => {
    const newDiagnosis = createEmptyDiagnosis();

    console.log('STARTING NEW DIAGNOSIS:', newDiagnosis.id);

    setDiagnosis(newDiagnosis);

    return newDiagnosis.id;
  };

  return (
    <DiagnosisContext.Provider
      value={{
        diagnosis,

        updatePatient,

        startNewDiagnosis,

        setSelectedAnalyses,

        addImage,
        addImages,
        removeImage,
        clearImages,
        updateImage,
        setImageAssessment,

        // Backwards compatible single-image helper.
        setImageResult,

        setAudioResult,

        setReportPath,

        clearDiagnosis,

        setHospitalDetails,
      }}
    >
      {children}
    </DiagnosisContext.Provider>
  );
}

export function useDiagnosis() {
  const context = useContext(DiagnosisContext);

  if (!context) {
    throw new Error('useDiagnosis must be used inside DiagnosisProvider');
  }

  return context;
}
