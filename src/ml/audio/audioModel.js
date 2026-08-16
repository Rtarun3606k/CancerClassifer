import * as ort from 'onnxruntime-react-native';
import RNFS from 'react-native-fs';
import { NativeModules } from 'react-native';
const { ONNXModel } = NativeModules;
import { audioToTensorData, resampleAudio } from './audioProcessor';

let session = null;

async function loadAudioModel() {
  if (session) {
    return session;
  }

  const modelPath = await ONNXModel.getAudioModelPath();

  console.log('Loading audio model...');
  console.log('Model path:', modelPath);

  const exists = await RNFS.exists(modelPath);

  if (!exists) {
    throw new Error(`Audio model not found: ${modelPath}`);
  }

  session = await ort.InferenceSession.create(modelPath);

  console.log('AUDIO MODEL LOADED');
  console.log('Inputs:', session.inputNames);
  console.log('Outputs:', session.outputNames);

  return session;
}

async function readWavFile(path) {
  let filePath = path;

  if (filePath.startsWith('file://')) {
    filePath = filePath.replace('file://', '');
  }

  const exists = await RNFS.exists(filePath);

  if (!exists) {
    throw new Error(`Audio file not found: ${filePath}`);
  }

  const base64 = await RNFS.readFile(filePath, 'base64');

  return base64;
}

function base64ToBytes(base64) {
  const binary = global.atob(base64);

  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

/*
 * WAV:
 *
 * 44-byte standard PCM header
 * followed by 16-bit little-endian PCM.
 */
function wavBase64ToFloat32(base64) {
  const binary = atob(base64);

  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  const view = new DataView(bytes.buffer);

  // WAV header
  const channels = view.getUint16(22, true);

  const sampleRate = view.getUint32(24, true);

  const bitsPerSample = view.getUint16(34, true);

  console.log('WAV channels:', channels);

  console.log('WAV sample rate:', sampleRate);

  console.log('WAV bits:', bitsPerSample);

  if (channels !== 1) {
    throw new Error(`Expected mono audio, got ${channels} channels.`);
  }

  if (bitsPerSample !== 16) {
    throw new Error(`Expected 16-bit audio, got ${bitsPerSample}-bit.`);
  }

  // Find "data" chunk instead of assuming
  // it always starts at byte 44.
  let dataOffset = 12;

  while (dataOffset + 8 <= bytes.length) {
    const chunkId = String.fromCharCode(
      bytes[dataOffset],
      bytes[dataOffset + 1],
      bytes[dataOffset + 2],
      bytes[dataOffset + 3],
    );

    const chunkSize = view.getUint32(dataOffset + 4, true);

    if (chunkId === 'data') {
      dataOffset += 8;
      break;
    }

    dataOffset += 8 + chunkSize;
  }

  const sampleCount = Math.floor((bytes.length - dataOffset) / 2);

  const samples = new Float32Array(sampleCount);

  for (let i = 0; i < sampleCount; i++) {
    const pcm = view.getInt16(dataOffset + i * 2, true);

    samples[i] = pcm / 32768;
  }

  return {
    samples,
    sampleRate,
  };
}

export async function classifyAudio(
  audioPath,
) {
  console.log(
    'CLASSIFYING AUDIO:',
    audioPath,
  );

  const model =
    await loadAudioModel();

  const base64 =
    await readWavFile(audioPath);

  const {
    samples,
    sampleRate,
  } =
    wavBase64ToFloat32(base64);

  console.log(
    'Original PCM samples:',
    samples.length,
  );

  console.log(
    'Original sample rate:',
    sampleRate,
  );

  const normalizedSamples =
    resampleAudio(
      samples,
      sampleRate,
      16000,
    );

  console.log(
    'Resampled sample rate: 16000',
  );

  console.log(
    'Resampled samples:',
    normalizedSamples.length,
  );

  const tensorData =
    audioToTensorData(
      normalizedSamples,
    );

  console.log(
    'Audio tensor length:',
    tensorData.length,
  );

  if (
    tensorData.length !==
    128 * 128 * 3
  ) {
    throw new Error(
      `Invalid audio tensor size: ${tensorData.length}`,
    );
  }

  const tensor =
    new ort.Tensor(
      'float32',
      tensorData,
      [1, 128, 128, 3],
    );

  console.log(
    'Audio tensor shape:',
    tensor.dims,
  );

  const inputName =
    model.inputNames[0];

  const outputName =
    model.outputNames[0];

  const outputs =
    await model.run({
      [inputName]: tensor,
    });

  const output =
    outputs[outputName];

  if (!output) {
    throw new Error(
      `Output "${outputName}" not found.`,
    );
  }

  const pathologyProbability =
    Number(output.data[0]);

  const normalProbability =
    1 - pathologyProbability;

  const isPathology =
    pathologyProbability >= 0.5;

  const confidence =
    Math.max(
      pathologyProbability,
      normalProbability,
    );

  const result = {
    prediction:
      isPathology
        ? 'Vocal Pathology'
        : 'Normal',

    pathologyProbability,

    normalProbability,

    confidence,

    confidencePercentage:
      confidence * 100,

    rawOutput:
      Array.from(output.data),
  };

  console.log(
    'AUDIO MODEL RESULT:',
    result,
  );

  return result;
}
