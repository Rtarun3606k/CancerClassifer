import { Buffer } from 'buffer';
import RNFS from 'react-native-fs';

const ROOT = `${RNFS.DocumentDirectoryPath}/OralScan/diagnoses`;

export function getDiagnosisFolderPath(diagnosisId) {
  return `${ROOT}/${diagnosisId}`;
}

export async function initializeDiagnosisStorage() {
  const exists = await RNFS.exists(ROOT);

  if (!exists) {
    await RNFS.mkdir(ROOT);
  }
}

export async function ensureDirectory(path) {
  if (!path) {
    return;
  }

  const exists = await RNFS.exists(path);

  if (!exists) {
    await RNFS.mkdir(path);
  }
}

export async function createDiagnosisFolder(id, subfolder = null) {
  await initializeDiagnosisStorage();

  const folder = `${ROOT}/${id}`;

  await ensureDirectory(folder);

  if (subfolder) {
    await ensureDirectory(`${folder}/${subfolder}`);

    return `${folder}/${subfolder}`;
  }

  return folder;
}

/**
 * Copies a file into the diagnosis folder.
 *
 * `fileName` may contain sub folders (e.g. `images/image-01.jpg`); the parent
 * directory is created automatically so multiple images can live side by side.
 */
export async function copyDiagnosisFile(sourcePath, diagnosisId, fileName) {
  if (!sourcePath) {
    return null;
  }

  const folder = await createDiagnosisFolder(diagnosisId);

  let source = sourcePath;

  if (source.startsWith('file://')) {
    source = source.replace('file://', '');
  }

  const destination = `${folder}/${fileName}`;

  const parentDirectory = destination.substring(
    0,
    destination.lastIndexOf('/'),
  );

  await ensureDirectory(parentDirectory);

  const exists = await RNFS.exists(source);

  if (!exists) {
    throw new Error(`Source file does not exist: ${source}`);
  }

  await RNFS.copyFile(source, destination);

  return destination;
}

/**
 * Writes an encoded camera frame into the diagnosis folder.
 *
 * The frame is stored inside the existing private diagnosis directory so the
 * normal History / delete / export flows can manage it like any other image.
 */
export async function saveDiagnosisImageBuffer(
  frameBuffer,
  diagnosisId,
  fileName = 'images/live-frame.jpg',
) {
  if (!frameBuffer) {
    throw new Error('A frame is required to save the diagnosis image.');
  }

  if (!diagnosisId) {
    throw new Error('Diagnosis ID is missing.');
  }

  const folder = await createDiagnosisFolder(diagnosisId);

  const destination = `${folder}/${fileName}`;

  const parentDirectory = destination.substring(
    0,
    destination.lastIndexOf('/'),
  );

  await ensureDirectory(parentDirectory);

  await RNFS.writeFile(
    destination,
    Buffer.from(frameBuffer).toString('base64'),
    'base64',
  );

  return destination;
}

export async function deleteDiagnosisFile(filePath) {
  if (!filePath) {
    return false;
  }

  let path = filePath;

  if (path.startsWith('file://')) {
    path = path.replace('file://', '');
  }

  const exists = await RNFS.exists(path);

  if (!exists) {
    return false;
  }

  await RNFS.unlink(path);

  return true;
}

export async function deleteDiagnosisFolder(diagnosisId) {
  if (!diagnosisId) {
    throw new Error('Diagnosis ID is missing.');
  }

  const folder = `${ROOT}/${diagnosisId}`;

  const exists = await RNFS.exists(folder);

  if (!exists) {
    return;
  }

  const items = await RNFS.readDir(folder);

  for (const item of items) {
    if (item.isDirectory()) {
      await deleteDirectory(item.path);
    } else {
      await RNFS.unlink(item.path);
    }
  }

  await RNFS.unlink(folder);

  console.log('Diagnosis folder deleted:', folder);
}

async function deleteDirectory(path) {
  const items = await RNFS.readDir(path);

  for (const item of items) {
    if (item.isDirectory()) {
      await deleteDirectory(item.path);
    } else {
      await RNFS.unlink(item.path);
    }
  }

  await RNFS.unlink(path);
}
