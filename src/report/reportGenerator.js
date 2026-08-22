import { generatePDF } from 'react-native-html-to-pdf';
import RNFS from 'react-native-fs';
import { NativeModules } from 'react-native';

const { SharePdf, ReportAssets } = NativeModules;

function formatDate(date) {
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function formatTime(date) {
  return date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function calculateAge(dateOfBirth) {
  if (!dateOfBirth) {
    return null;
  }

  const dob = new Date(dateOfBirth);
  const today = new Date();

  let age = today.getFullYear() - dob.getFullYear();

  const monthDifference = today.getMonth() - dob.getMonth();

  if (
    monthDifference < 0 ||
    (monthDifference === 0 && today.getDate() < dob.getDate())
  ) {
    age--;
  }

  return age;
}

async function imageToBase64(uri) {
  if (!uri) {
    throw new Error('Image URI is missing.');
  }

  let path = uri;

  if (path.startsWith('file://')) {
    path = path.replace('file://', '');
  }

  if (path.startsWith('content://')) {
    throw new Error(
      'The selected image uses a content URI. Please provide the image originalPath.',
    );
  }

  const exists = await RNFS.exists(path);

  if (!exists) {
    throw new Error(`Image file does not exist: ${path}`);
  }

  const base64 = await RNFS.readFile(path, 'base64');

  return `data:image/jpeg;base64,${base64}`;
}

async function logoToBase64() {
  if (!ReportAssets) {
    throw new Error('ReportAssets native module is not available.');
  }

  return await ReportAssets.getLogo();
}

function probabilityBar(label, value) {
  const percentage = ((value ?? 0) * 100).toFixed(1);

  return `
    <div class="bar-row">

      <div class="bar-header">
        <span>${label}</span>

        <strong>
          ${percentage}%
        </strong>
      </div>

      <div class="bar-background">
        <div
          class="bar"
          style="width:${percentage}%"
        ></div>
      </div>

    </div>
  `;
}

function createImageSection(image) {
  if (!image?.result) {
    return '';
  }

  const result = image.result;

  const cancerProbability = result.probabilities?.CANCER ?? 0;

  const nonCancerProbability = result.probabilities?.['NON CANCER'] ?? 0;

  const confidence = ((result.probability ?? 0) * 100).toFixed(1);

  const isCancer = result.classIndex === 0;

  const predictionColor = isCancer ? '#B3261E' : '#146C2E';

  return `
    <div class="section">

      <div class="section-title">
        IMAGE ANALYSIS
      </div>

      ${
        image.base64
          ? `
            <div class="image-container">
              <img
                class="analysis-image"
                src="${image.base64}"
              />
            </div>
          `
          : ''
      }

      <div class="result">

        <div class="prediction-label">
          Prediction
        </div>

        <div
          class="prediction"
          style="color:${predictionColor}"
        >
          ${result.className ?? 'Unknown'}
        </div>

        <div class="confidence">
          Confidence:
          <strong>
            ${confidence}%
          </strong>
        </div>

        ${probabilityBar('CANCER', cancerProbability)}

        ${probabilityBar('NON CANCER', nonCancerProbability)}

${
  image.doctorAssessment || image.doctorRemarks
    ? `
      <div class="doctor-assessment">

        <div class="doctor-assessment-title">
          DOCTOR ASSESSMENT
        </div>

        <div class="patient-row">
          <span class="label">
            Assessment
          </span>

          <span class="value">
            ${image.doctorAssessment || 'Not provided'}
          </span>
        </div>

        <div class="remarks">

          <div class="remarks-label">
            Remarks
          </div>

          <div class="remarks-value">
            ${image.doctorRemarks || 'No remarks provided'}
          </div>

        </div>

      </div>
    `
    : ''
}

      </div>

    </div>

    <div class="section">

      <div class="section-title">
        IMAGE MODEL INFORMATION
      </div>

      <table class="info-table">

        <tr>
          <td class="info-label">
            Model
          </td>

          <td>
            MobileNetV3
          </td>
        </tr>

        <tr>
          <td class="info-label">
            Platform
          </td>

          <td>
            Android
          </td>
        </tr>

        <tr>
          <td class="info-label">
            Inference
          </td>

          <td>
            On-device
          </td>
        </tr>

        <tr>
          <td class="info-label">
            Input
          </td>

          <td>
            Oral image
          </td>
        </tr>

      </table>

    </div>
  `;
}

function createAudioSection(audio) {
  if (!audio?.result) {
    return '';
  }

  const result = audio.result;

  const pathologyProbability = result.pathologyProbability ?? 0;

  const normalProbability = result.normalProbability ?? 0;

  const confidence = ((result.confidence ?? 0) * 100).toFixed(1);

  const prediction = result.prediction ?? 'Unknown';

  const isPathology = prediction === 'Vocal Pathology';

  const predictionColor = isPathology ? '#B3261E' : '#146C2E';

  return `
    <div class="section">

      <div class="section-title">
        VOICE ANALYSIS
      </div>

      <div class="result">

        <div class="prediction-label">
          Prediction
        </div>

        <div
          class="prediction"
          style="color:${predictionColor}"
        >
          ${prediction}
        </div>

        <div class="confidence">
          Confidence:
          <strong>
            ${confidence}%
          </strong>
        </div>

        ${probabilityBar('NORMAL', normalProbability)}

        ${probabilityBar('VOCAL PATHOLOGY', pathologyProbability)}

${
  audio.doctorAssessment || audio.doctorRemarks
    ? `
      <div class="doctor-assessment">

        <div class="doctor-assessment-title">
          DOCTOR ASSESSMENT
        </div>

        <div class="patient-row">
          <span class="label">
            Assessment
          </span>

          <span class="value">
            ${audio.doctorAssessment || 'Not provided'}
          </span>
        </div>

        <div class="remarks">

          <div class="remarks-label">
            Remarks
          </div>

          <div class="remarks-value">
            ${audio.doctorRemarks || 'No remarks provided'}
          </div>

        </div>

      </div>
    `
    : ''
}

      </div>

    </div>

    <div class="section">

      <div class="section-title">
        VOICE MODEL INFORMATION
      </div>

      <table class="info-table">

        <tr>
          <td class="info-label">
            Model
          </td>

          <td>
            Stage 1 Vocal Classifier
          </td>
        </tr>

        <tr>
          <td class="info-label">
            Platform
          </td>

          <td>
            Android
          </td>
        </tr>

        <tr>
          <td class="info-label">
            Inference
          </td>

          <td>
            On-device
          </td>
        </tr>

        <tr>
          <td class="info-label">
            Input
          </td>

          <td>
            Voice recording
          </td>
        </tr>

      </table>

    </div>
  `;
}

export async function generateReport({
  patient,
  hospitalDetails,
  image,
  audio,
  selectedAnalyses,
}) {
  if (!patient) {
    throw new Error('Patient information is missing.');
  }

  const hasImage = !!selectedAnalyses?.image && !!image?.result;

  const hasAudio = !!selectedAnalyses?.audio && !!audio?.result;

  if (!hasImage && !hasAudio) {
    throw new Error('No valid analysis results available.');
  }

  const now = new Date();

  const age = calculateAge(patient.dateOfBirth);

  // Prepare image only when required.
  let imageBase64 = null;

  if (hasImage && image?.uri) {
    imageBase64 = await imageToBase64(image.uri);
  }

  const logoBase64 = await logoToBase64();

  const imageSection = hasImage
    ? createImageSection({
        ...image,
        base64: imageBase64,
      })
    : '';

  const audioSection = hasAudio ? createAudioSection(audio) : '';

  const html = `
<!DOCTYPE html>

<html>

<head>

<meta charset="UTF-8">

<style>

.clinician-details {
  margin-top: 18px;
  padding: 18px;
  border: 1px solid #dddddd;
  border-radius: 10px;
}

.clinician-title {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.8px;
  margin-bottom: 14px;
}

.doctor-assessment {
  margin-top: 22px;
  padding-top: 18px;
  border-top: 1px solid #dddddd;
}

.doctor-assessment-title {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.8px;
  margin-bottom: 12px;
}

.remarks {
  margin-top: 12px;
}

.remarks-label {
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 5px;
}

.remarks-value {
  font-size: 13px;
  line-height: 1.5;
  padding: 10px;
  background: #f7f7f7;
  border-radius: 6px;
}

@page {
  size: A4;
  margin: 0;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  padding: 0;
  font-family: Arial, Helvetica, sans-serif;
  color: #202124;
  background: #ffffff;
}

.page {
  padding: 42px;
}

/* HEADER */

.header {
  display: flex;
  align-items: center;
  border-bottom: 2px solid #e0e0e0;
  padding-bottom: 20px;
}

.logo-container {
  width: 58px;
  height: 58px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 15px;
}

.logo {
  width: 58px;
  height: 58px;
  object-fit: contain;
}

.brand {
  font-size: 24px;
  font-weight: bold;
}

.brand-subtitle {
  color: #6b7280;
  font-size: 12px;
  margin-top: 4px;
}

/* TITLE */

.title {
  margin-top: 32px;
  font-size: 24px;
  font-weight: bold;
}

.subtitle {
  margin-top: 6px;
  color: #6b7280;
  font-size: 12px;
}

/* PATIENT */

.patient-details {
  margin-top: 20px;
  padding: 15px;
  background: #f5f5f5;
  border-radius: 12px;
}

.patient-row {
  margin-bottom: 7px;
  font-size: 12px;
}

.patient-row:last-child {
  margin-bottom: 0;
}

.label {
  color: #6b7280;
  display: inline-block;
  width: 120px;
}

.value {
  font-weight: 600;
}

/* META */

.meta {
  margin-top: 14px;
  background: #f5f5f5;
  border-radius: 12px;
  padding: 15px;
}

.meta-row {
  margin-bottom: 6px;
  font-size: 12px;
}

.meta-row:last-child {
  margin-bottom: 0;
}

.meta-label {
  color: #6b7280;
}

/* SECTION */

.section {
  margin-top: 28px;
}

.section-title {
  font-size: 12px;
  font-weight: bold;
  color: #6b7280;
  letter-spacing: 1px;
  margin-bottom: 14px;
}

/* IMAGE */

.image-container {
  width: 100%;
  height: 260px;
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid #e0e0e0;
  text-align: center;
  background: #fafafa;
}

.analysis-image {
  width: 100%;
  height: 260px;
  object-fit: contain;
}

/* RESULT */

.result {
  margin-top: 14px;
  padding: 20px;
  background: #f7f7f7;
  border-radius: 14px;
}

.prediction-label {
  color: #6b7280;
  font-size: 12px;
}

.prediction {
  margin-top: 5px;
  font-size: 28px;
  font-weight: bold;
}

.confidence {
  margin-top: 8px;
  font-size: 14px;
}

/* PROBABILITY */

.bar-row {
  margin-top: 18px;
}

.bar-header {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  margin-bottom: 6px;
}

.bar-background {
  height: 8px;
  background: #e0e0e0;
  border-radius: 5px;
}

.bar {
  height: 8px;
  border-radius: 5px;
  background: #4f46e5;
}

/* MODEL INFO */

.info-table {
  margin-top: 10px;
  width: 100%;
  border-collapse: collapse;
}

.info-table td {
  padding: 8px 0;
  border-bottom: 1px solid #eeeeee;
  font-size: 12px;
}

.info-label {
  color: #6b7280;
}

/* DISCLAIMER */

.notice {
  margin-top: 28px;
  padding: 16px;
  background: #f9dedd;
  border-radius: 12px;
}

.notice-title {
  font-weight: bold;
  font-size: 13px;
  color: #410e0b;
}

.notice-text {
  margin-top: 6px;
  font-size: 11px;
  line-height: 17px;
  color: #410e0b;
}

/* FOOTER */

.footer {
  margin-top: 30px;
  padding-top: 15px;
  border-top: 1px solid #eeeeee;
  text-align: center;
  color: #9ca3af;
  font-size: 10px;
}

</style>

</head>

<body>

<div class="page">

  <!-- HEADER -->

  <div class="header">

    <div class="logo-container">

      <img
        class="logo"
        src="${logoBase64}"
      />

    </div>

    <div>

      <div class="brand">
        OralScan
      </div>

      <div class="brand-subtitle">
        AI-assisted oral screening
      </div>

    </div>

  </div>


  <!-- TITLE -->

  <div class="title">
    Diagnosis Report
  </div>

  <div class="subtitle">
    Generated automatically from on-device AI models
  </div>


  <!-- PATIENT -->

  <div class="patient-details">

    <div class="patient-row">
      <span class="label">
        Patient Name
      </span>

      <span class="value">
        ${patient.name}
      </span>
    </div>

    <div class="patient-row">
      <span class="label">
        Date of Birth
      </span>

      <span class="value">
        ${patient.dateOfBirth}
      </span>
    </div>

    <div class="patient-row">
      <span class="label">
        Age
      </span>

      <span class="value">
        ${age !== null ? `${age} years` : 'Not provided'}
      </span>
    </div>

    <div class="patient-row">
      <span class="label">
        Gender
      </span>

      <span class="value">
        ${patient.gender || 'Not provided'}
      </span>
    </div>

    <div class="patient-row">
      <span class="label">
        Location
      </span>

      <span class="value">
        ${
          [patient.city, patient.state, patient.country]
            .filter(Boolean)
            .join(', ') || 'Not provided'
        }
      </span>
    </div>



  </div>


  <!-- META -->

<!-- CLINICIAN -->

<div class="clinician-details">

  <div class="clinician-title">
    CLINIC / DOCTOR DETAILS
  </div>

  <div class="patient-row">
    <span class="label">
      Doctor Name
    </span>

    <span class="value">
      ${hospitalDetails?.doctorName || 'Not provided'}
    </span>
  </div>

  <div class="patient-row">
    <span class="label">
      Hospital / Clinic
    </span>

    <span class="value">
      ${hospitalDetails?.hospitalName || 'Not provided'}
    </span>
  </div>

</div>

  <div class="meta">

    <div class="meta-row">
      <span class="meta-label">
        Date:
      </span>
      ${formatDate(now)}
    </div>

    <div class="meta-row">
      <span class="meta-label">
        Time:
      </span>
      ${formatTime(now)}
    </div>

    <div class="meta-row">
      <span class="meta-label">
        Analyses:
      </span>
      ${[hasImage ? 'Image' : null, hasAudio ? 'Voice' : null]
        .filter(Boolean)
        .join(' + ')}
    </div>

    <div class="meta-row">
      <span class="meta-label">
        Inference:
      </span>
      On-device
    </div>

  </div>


  <!-- IMAGE ANALYSIS -->

  ${imageSection}


  <!-- AUDIO ANALYSIS -->

  ${audioSection}


  <!-- DISCLAIMER -->

  <div class="notice">

    <div class="notice-title">
      Important Medical Notice
    </div>

    <div class="notice-text">

      This report contains AI model predictions
      intended for research and demonstration
      purposes only. It is not a medical diagnosis
      and should not replace professional medical
      evaluation.

      Always consult a qualified healthcare
      professional for proper evaluation and
      diagnosis.

    </div>

  </div>


  <!-- FOOTER -->

  <div class="footer">
    OralScan • AI-assisted research tool
  </div>

</div>

</body>

</html>
`;

  const file = await generatePDF({
    html,
    fileName: `OralScan_Diagnosis_Report_${now.getTime()}`,
    directory: 'Documents',
  });

  if (!file.filePath) {
    throw new Error('Failed to generate PDF.');
  }

  return file.filePath;
}

export async function shareReport(filePath) {
  if (!filePath) {
    throw new Error('No report file available.');
  }

  console.log('SHARING PDF PATH:', filePath);

  if (!SharePdf) {
    throw new Error('SharePdf native module is not available.');
  }

  await SharePdf.share(filePath);
}
