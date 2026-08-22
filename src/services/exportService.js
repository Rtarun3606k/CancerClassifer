import RNFS from 'react-native-fs';
import { zip } from 'react-native-zip-archive';

import { getAllDiagnoses } from './database';

const EXPORT_ROOT = `${RNFS.CachesDirectoryPath}/OSCC_Export`;

function getFileName(path) {
  if (!path) {
    return null;
  }

  return path.split('/').pop();
}

async function copyIfExists(source, destination) {
  if (!source) {
    return false;
  }

  const exists = await RNFS.exists(source);

  if (!exists) {
    console.log('EXPORT FILE MISSING:', source);
    return false;
  }

  await RNFS.copyFile(source, destination);

  return true;
}

export async function exportAllData() {
  console.log('========== OSCC EXPORT START ==========');

  const diagnoses = await getAllDiagnoses();

  if (!diagnoses.length) {
    throw new Error('There are no diagnoses to export.');
  }

  // Clean previous temporary export
  if (await RNFS.exists(EXPORT_ROOT)) {
    await RNFS.unlink(EXPORT_ROOT);
  }

  await RNFS.mkdir(EXPORT_ROOT);

  /*
   * Complete database export
   */
  await RNFS.writeFile(
    `${EXPORT_ROOT}/diagnoses.json`,
    JSON.stringify(diagnoses, null, 2),
    'utf8',
  );

  /*
   * Copy each diagnosis and its files
   */
  for (const diagnosis of diagnoses) {
    const diagnosisId = diagnosis.id;

    if (!diagnosisId) {
      continue;
    }

    const diagnosisFolder = `${EXPORT_ROOT}/${diagnosisId}`;

    await RNFS.mkdir(diagnosisFolder);

    // Store the SQLite record separately
    await RNFS.writeFile(
      `${diagnosisFolder}/diagnosis.json`,
      JSON.stringify(diagnosis, null, 2),
      'utf8',
    );

    // Image
    if (diagnosis.image_path) {
      await copyIfExists(
        diagnosis.image_path,
        `${diagnosisFolder}/${
          getFileName(diagnosis.image_path) || 'image.jpg'
        }`,
      );
    }

    // Audio
    if (diagnosis.audio_path) {
      await copyIfExists(
        diagnosis.audio_path,
        `${diagnosisFolder}/${
          getFileName(diagnosis.audio_path) || 'audio.wav'
        }`,
      );
    }

    // Report
    if (diagnosis.report_path) {
      await copyIfExists(
        diagnosis.report_path,
        `${diagnosisFolder}/report.pdf`,
      );
    }
  }

  /*
   * Create ZIP
   */
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  const zipName = `OSCC_Export_${timestamp}.zip`;

  const zipPath = `${RNFS.CachesDirectoryPath}/${zipName}`;

  if (await RNFS.exists(zipPath)) {
    await RNFS.unlink(zipPath);
  }

  await zip(EXPORT_ROOT, zipPath);

  /*
   * Move ZIP to Android Downloads
   */
  const downloadsPath = RNFS.DownloadDirectoryPath;

  if (!downloadsPath) {
    throw new Error('Android Downloads directory is unavailable.');
  }

  const finalPath = `${downloadsPath}/${zipName}`;

  if (await RNFS.exists(finalPath)) {
    await RNFS.unlink(finalPath);
  }

  await RNFS.copyFile(zipPath, finalPath);

  /*
   * Cleanup temporary files
   */
  await RNFS.unlink(EXPORT_ROOT);

  if (await RNFS.exists(zipPath)) {
    await RNFS.unlink(zipPath);
  }

  console.log('========== OSCC EXPORT COMPLETE ==========');

  console.log('EXPORT PATH:', finalPath);

  return finalPath;
}
