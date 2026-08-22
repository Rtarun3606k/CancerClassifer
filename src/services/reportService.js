import { generateReport } from '../report/reportGenerator';

export async function createDiagnosisReport(diagnosis) {
  if (!diagnosis) {
    throw new Error('Diagnosis data is missing.');
  }

  const { patient, hospitalDetails, selectedAnalyses, image, audio } =
    diagnosis;

  if (!patient?.name || !patient?.dateOfBirth) {
    throw new Error('Patient details are incomplete.');
  }

  if (!selectedAnalyses?.image && !selectedAnalyses?.audio) {
    throw new Error('No analysis was selected.');
  }

  const reportData = {
    patient: diagnosis.patient,
    hospitalDetails: diagnosis.hospitalDetails,
    image: diagnosis.image,
    audio: diagnosis.audio,
    selectedAnalyses: diagnosis.selectedAnalyses,
  };

  console.log('GENERATING DIAGNOSIS REPORT:', reportData);

  const filePath = await generateReport(reportData);

  console.log('DIAGNOSIS PDF:', filePath);

  return filePath;
}
