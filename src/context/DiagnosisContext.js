import React, {
  createContext,
  useContext,
  useState,
} from 'react';

import { createDiagnosisId } from '../utils/diagnosisId';

const DiagnosisContext = createContext(null);

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

    image: {
      uri: null,
      result: null,
    },

    audio: {
      path: null,
      result: null,
    },

    selectedAnalyses: {
      image: false,
      audio: false,
    },

    reportPath: null,
  };
}

export function DiagnosisProvider({ children }) {
  const [diagnosis, setDiagnosis] = useState(
    createEmptyDiagnosis(),
  );

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

  const setImageResult = ({ uri, result }) => {
    setDiagnosis(prev => ({
      ...prev,

      image: {
        uri,
        result,
      },
    }));
  };

  const setAudioResult = ({ path, result }) => {
    setDiagnosis(prev => ({
      ...prev,

      audio: {
        path,
        result,
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

    console.log(
      'STARTING NEW DIAGNOSIS:',
      newDiagnosis.id,
    );

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

        setImageResult,

        setAudioResult,

        setReportPath,

        clearDiagnosis,
      }}
    >
      {children}
    </DiagnosisContext.Provider>
  );
}

export function useDiagnosis() {
  const context = useContext(DiagnosisContext);

  if (!context) {
    throw new Error(
      'useDiagnosis must be used inside DiagnosisProvider',
    );
  }

  return context;
}
