import AudioRecord from 'react-native-audio-record';

const SAMPLE_RATE = 16000;
const CHANNELS = 1;
const BITS_PER_SAMPLE = 16;

export function initAudioRecorder() {
  AudioRecord.init({
    sampleRate: SAMPLE_RATE,
    channels: CHANNELS,
    bitsPerSample: BITS_PER_SAMPLE,
    audioSource: 6,
    wavFile: 'oralscan_audio.wav',
  });
}

export function startRecording() {
  initAudioRecorder();

  console.log('Starting audio recording...');

  AudioRecord.start();
}

export async function stopRecording() {
  const audioPath =
    await AudioRecord.stop();

  console.log(
    'Recording saved:',
    audioPath,
  );

  return audioPath;
}
