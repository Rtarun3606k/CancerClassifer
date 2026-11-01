import RNFS from 'react-native-fs';
import { zip } from 'react-native-zip-archive';

import { getAllDiagnoses, getDiagnosisImages } from './database';
import { getExtensionFromPath } from '../utils/getFileExtision';

const EXPORT_ROOT = `${RNFS.CachesDirectoryPath}/OSCC_Export`;

function normalizePath(path) {
  if (!path) {
    return null;
  }

  return path.startsWith('file://') ? path.replace('file://', '') : path;
}

async function copyIfExists(source, destination) {
  const path = normalizePath(source);

  if (!path) {
    return false;
  }

  const exists = await RNFS.exists(path);

  if (!exists) {
    console.log('EXPORT FILE MISSING:', path);

    return false;
  }

  await RNFS.copyFile(path, destination);

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
   * Complete database export (diagnosis rows only, keeps previous behaviour).
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

    const images = await getDiagnosisImages(diagnosisId);

    // Store the complete diagnosis record, including every image result,
    // doctor assessment and remark.
    await RNFS.writeFile(
      `${diagnosisFolder}/diagnosis.json`,
      JSON.stringify(
        {
          ...diagnosis,
          image_count: images.length,
          images,
        },
        null,
        2,
      ),
      'utf8',
    );

    // Images
    if (images.length) {
      await RNFS.mkdir(`${diagnosisFolder}/images`);

      for (let index = 0; index < images.length; index += 1) {
        const image = images[index];

        const source = image.image_path;

        const extension =
          getExtensionFromPath(source) ||
          getExtensionFromPath(image.image_file_name) ||
          'jpg';

        const fileName = `image-${String(index + 1).padStart(2, '0')}.${extension}`;

        await copyIfExists(source, `${diagnosisFolder}/images/${fileName}`);
      }
    }

    // Audio
    if (diagnosis.audio_path) {
      await RNFS.mkdir(`${diagnosisFolder}/audio`);

      const extension = getExtensionFromPath(diagnosis.audio_path) || 'wav';

      await copyIfExists(
        diagnosis.audio_path,
        `${diagnosisFolder}/audio/recording.${extension}`,
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
