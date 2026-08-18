import RNFS from 'react-native-fs';

const ROOT = `${RNFS.DocumentDirectoryPath}/OralScan/diagnoses`;

export async function initializeDiagnosisStorage() {
  const exists = await RNFS.exists(ROOT);

  if (!exists) {
    await RNFS.mkdir(ROOT);
  }
}

export async function createDiagnosisFolder(id) {
  await initializeDiagnosisStorage();

  const folder = `${ROOT}/${id}`;

  const exists = await RNFS.exists(folder);

  if (!exists) {
    await RNFS.mkdir(folder);
  }

  return folder;
}

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

  const exists = await RNFS.exists(source);

  if (!exists) {
    throw new Error(`Source file does not exist: ${source}`);
  }

  await RNFS.copyFile(source, destination);

  return destination;
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
