import { generateReport } from '../report/reportGenerator';

export async function createDiagnosisReport(diagnosis) {
  if (!diagnosis) {
    throw new Error('Diagnosis data is missing.');
  }

  const {
    patient,
    selectedAnalyses,
    image,
    audio,
  } = diagnosis;

  if (!patient?.name || !patient?.dateOfBirth) {
    throw new Error('Patient details are incomplete.');
  }

  if (
    !selectedAnalyses?.image &&
    !selectedAnalyses?.audio
  ) {
    throw new Error('No analysis was selected.');
  }

  const reportData = {
    patient,

    image: selectedAnalyses.image
      ? image
      : null,

    audio: selectedAnalyses.audio
      ? audio
      : null,

    selectedAnalyses,
  };

  console.log(
    'GENERATING DIAGNOSIS REPORT:',
    reportData,
  );

  const filePath =
    await generateReport(reportData);

  console.log(
    'DIAGNOSIS PDF:',
    filePath,
  );

  return filePath;
}
