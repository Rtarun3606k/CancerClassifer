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

export async function generateReport({ imageUri, result }) {
  if (!imageUri) {
    throw new Error('No image available for the report.');
  }

  if (!result || result.error) {
    throw new Error('No valid analysis result available.');
  }

  const now = new Date();

  const cancerProbability = result.probabilities?.CANCER ?? 0;

  const nonCancerProbability = result.probabilities?.['NON CANCER'] ?? 0;

  const confidence = ((result.probability ?? 0) * 100).toFixed(1);

  const cancerPercentage = (cancerProbability * 100).toFixed(1);

  const nonCancerPercentage = (nonCancerProbability * 100).toFixed(1);

  const isCancer = result.classIndex === 0;

  const predictionColor = isCancer ? '#B3261E' : '#146C2E';

  // Convert selected cancer/oral image to base64.
  const imageBase64 = await imageToBase64(imageUri);
  async function logoToBase64() {
    if (!ReportAssets) {
      throw new Error('ReportAssets native module is not available.');
    }

    return await ReportAssets.getLogo();
  }

  const logoBase64 = await logoToBase64();

  const html = `
<!DOCTYPE html>

<html>

<head>

<meta charset="UTF-8">

<style>

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

.logo-placeholder {
  width: 58px;
  height: 58px;
  border-radius: 16px;
  background: #eeeeee;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 15px;
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

.logo-letter {
  font-size: 28px;
  font-weight: bold;
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

/* META */

.meta {
  margin-top: 20px;
  background: #f5f5f5;
  border-radius: 12px;
  padding: 15px;
}

.meta-row {
  margin-bottom: 6px;
  font-size: 12px;
}

.meta-label {
  color: #6b7280;
}

/* IMAGE */

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
  margin-top: 20px;
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
  color: ${predictionColor};
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

    <div class="logo-placeholder">
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
        AI-powered oral image analysis
      </div>

    </div>

  </div>


  <!-- TITLE -->

  <div class="title">
    Oral Image Analysis Report
  </div>

  <div class="subtitle">
    Generated automatically from an on-device AI model
  </div>


  <!-- META -->

  <div class="meta">

    <div class="meta-row">
      <span class="meta-label">Date:</span>
      ${formatDate(now)}
    </div>

    <div class="meta-row">
      <span class="meta-label">Time:</span>
      ${formatTime(now)}
    </div>

    <div class="meta-row">
      <span class="meta-label">Model:</span>
      MobileNetV3
    </div>

    <div class="meta-row">
      <span class="meta-label">Inference:</span>
      On-device
    </div>

  </div>


  <!-- ANALYZED IMAGE -->

  <div class="section">

    <div class="section-title">
      ANALYZED IMAGE
    </div>

    <div class="image-container">

      <img
        class="analysis-image"
        src="${imageBase64}"
      />

    </div>

  </div>


  <!-- MODEL RESULT -->

  <div class="section">

    <div class="section-title">
      MODEL RESULT
    </div>

    <div class="result">

      <div class="prediction-label">
        Prediction
      </div>

      <div class="prediction">
        ${result.className}
      </div>

      <div class="confidence">
        Confidence:
        <strong>${confidence}%</strong>
      </div>


      <!-- CANCER -->

      <div class="bar-row">

        <div class="bar-header">

          <span>
            CANCER
          </span>

          <strong>
            ${cancerPercentage}%
          </strong>

        </div>

        <div class="bar-background">

          <div
            class="bar"
            style="width:${cancerPercentage}%"
          ></div>

        </div>

      </div>


      <!-- NON CANCER -->

      <div class="bar-row">

        <div class="bar-header">

          <span>
            NON CANCER
          </span>

          <strong>
            ${nonCancerPercentage}%
          </strong>

        </div>

        <div class="bar-background">

          <div
            class="bar"
            style="width:${nonCancerPercentage}%"
          ></div>

        </div>

      </div>

    </div>

  </div>


  <!-- MODEL INFORMATION -->

  <div class="section">

    <div class="section-title">
      MODEL INFORMATION
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


  <!-- DISCLAIMER -->

  <div class="notice">

    <div class="notice-title">
      Important Medical Notice
    </div>

    <div class="notice-text">

      This report contains an AI model prediction
      intended for research and demonstration purposes
      only. It is not a medical diagnosis and should not
      replace professional medical evaluation.

      Always consult a qualified healthcare professional
      for proper evaluation and diagnosis.

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
    fileName: `OralScan_Report_${now.getTime()}`,
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
