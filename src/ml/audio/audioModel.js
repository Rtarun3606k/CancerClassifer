import * as ort from 'onnxruntime-react-native';
import RNFS from 'react-native-fs';
import { NativeModules } from 'react-native';
const { ONNXModel } = NativeModules;
import { audioToTensorData } from './audioProcessor';

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
  const bytes = base64ToBytes(base64);

  if (bytes.length < 44) {
    throw new Error('Invalid WAV file.');
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  const riff = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);

  const wave = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);

  if (riff !== 'RIFF' || wave !== 'WAVE') {
    throw new Error('Audio file is not a WAV file.');
  }

  const channels = view.getUint16(22, true);

  const sampleRate = view.getUint32(24, true);

  const bitsPerSample = view.getUint16(34, true);

  console.log('WAV channels:', channels);

  console.log('WAV sample rate:', sampleRate);

  console.log('WAV bits:', bitsPerSample);

  if (channels !== 1) {
    throw new Error(`Expected mono WAV, got ${channels} channels.`);
  }

  if (sampleRate !== 16000) {
    throw new Error(`Expected 16000 Hz audio, got ${sampleRate} Hz.`);
  }

  if (bitsPerSample !== 16) {
    throw new Error(`Expected 16-bit PCM, got ${bitsPerSample}-bit.`);
  }

  /*
   * Find the "data" chunk instead of assuming
   * that the PCM data always starts at byte 44.
   */
  let offset = 12;
  let dataOffset = -1;
  let dataSize = 0;

  while (offset + 8 <= bytes.length) {
    const chunkId = String.fromCharCode(
      bytes[offset],
      bytes[offset + 1],
      bytes[offset + 2],
      bytes[offset + 3],
    );

    const chunkSize = view.getUint32(offset + 4, true);

    if (chunkId === 'data') {
      dataOffset = offset + 8;

      dataSize = chunkSize;

      break;
    }

    offset += 8 + chunkSize;

    /*
     * WAV chunks are word aligned.
     */
    if (chunkSize % 2 !== 0) {
      offset++;
    }
  }

  if (dataOffset < 0) {
    throw new Error('WAV data chunk not found.');
  }

  const sampleCount = Math.floor(dataSize / 2);

  const samples = new Float32Array(sampleCount);

  for (let i = 0; i < sampleCount; i++) {
    const value = view.getInt16(dataOffset + i * 2, true);

    samples[i] = value / 32768;
  }

  return samples;
}

export async function classifyAudio(audioPath) {
  console.log('CLASSIFYING AUDIO:', audioPath);

  const model = await loadAudioModel();

  const base64 = await readWavFile(audioPath);

  const samples = wavBase64ToFloat32(base64);

  console.log('PCM samples:', samples.length);

  const tensorData = audioToTensorData(samples);

  console.log('Audio tensor length:', tensorData.length);

  if (tensorData.length !== 128 * 128 * 3) {
    throw new Error(`Invalid audio tensor size: ${tensorData.length}`);
  }

  const tensor = new ort.Tensor('float32', tensorData, [1, 128, 128, 3]);

  console.log('Audio tensor shape:', tensor.dims);

  const inputName = model.inputNames[0];

  const outputName = model.outputNames[0];

  const outputs = await model.run({
    [inputName]: tensor,
  });

  const output = outputs[outputName];

  if (!output) {
    throw new Error(`Output "${outputName}" not found.`);
  }

 const pathologyProbability = Number(output.data[0]);

if (
  !Number.isFinite(pathologyProbability) ||
  pathologyProbability < 0 ||
  pathologyProbability > 1
) {
  throw new Error(
    `Invalid pathology probability: ${pathologyProbability}`,
  );
}

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
  prediction: isPathology
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

return result;}
