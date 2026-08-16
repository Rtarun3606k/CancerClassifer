import FFT from 'fft.js';

const SAMPLE_RATE = 16000;
const TARGET_SAMPLES = SAMPLE_RATE * 3;

const N_FFT = 2048;
const HOP_LENGTH = 376;
const N_MELS = 128;

const EPSILON = 1e-6;

/*
 * Convert Hz to Mel using the Slaney/librosa-style scale.
 */
function hzToMel(hz) {
  return 2595 * Math.log10(1 + hz / 700);
}

function melToHz(mel) {
  return 700 * (Math.pow(10, mel / 2595) - 1);
}

/*
 * Hann window equivalent to scipy/librosa's periodic Hann window.
 */
function createHannWindow(size) {
  const window = new Float32Array(size);

  for (let i = 0; i < size; i++) {
    window[i] =
      0.5 -
      0.5 *
        Math.cos(
          (2 * Math.PI * i) / size,
        );
  }

  return window;
}

/*
 * Create the 128-band Mel filter bank.
 *
 * This follows the same basic triangular-filter construction
 * used by librosa.feature.melspectrogram().
 */
function createMelFilterBank() {
  const nFreqs = Math.floor(N_FFT / 2) + 1;

  const filters = Array.from(
    { length: N_MELS },
    () => new Float32Array(nFreqs),
  );

  const minMel = hzToMel(0);
  const maxMel = hzToMel(SAMPLE_RATE / 2);

  const melPoints = new Float32Array(
    N_MELS + 2,
  );

  for (let i = 0; i < N_MELS + 2; i++) {
    melPoints[i] =
      minMel +
      ((maxMel - minMel) * i) /
        (N_MELS + 1);
  }

  const hzPoints = Array.from(
    melPoints,
    melToHz,
  );

  const binPoints = hzPoints.map(
    hz =>
      Math.floor(
        ((N_FFT + 1) * hz) /
          SAMPLE_RATE,
      ),
  );

  for (let m = 1; m <= N_MELS; m++) {
    const left = binPoints[m - 1];
    const center = binPoints[m];
    const right = binPoints[m + 1];

    for (
      let k = left;
      k < center;
      k++
    ) {
      if (
        k >= 0 &&
        k < nFreqs &&
        center !== left
      ) {
        filters[m - 1][k] =
          (k - left) /
          (center - left);
      }
    }

    for (
      let k = center;
      k < right;
      k++
    ) {
      if (
        k >= 0 &&
        k < nFreqs &&
        right !== center
      ) {
        filters[m - 1][k] =
          (right - k) /
          (right - center);
      }
    }
  }

  return filters;
}

const HANN_WINDOW =
  createHannWindow(N_FFT);

const MEL_FILTERS =
  createMelFilterBank();

const fft = new FFT(N_FFT);

/*
 * Decode signed 16-bit PCM samples from a base64 string.
 */
export function pcm16Base64ToFloat32(
  base64,
) {
  const binary =
    global.atob(base64);

  const samples =
    new Float32Array(
      Math.floor(binary.length / 2),
    );

  for (let i = 0; i < samples.length; i++) {
    const lo =
      binary.charCodeAt(i * 2);

    const hi =
      binary.charCodeAt(i * 2 + 1);

    let value =
      lo | (hi << 8);

    if (value & 0x8000) {
      value -= 0x10000;
    }

    samples[i] =
      value / 32768;
  }

  return samples;
}

/*
 * Force audio to exactly 3 seconds.
 *
 * Longer audio is cropped.
 * Shorter audio is zero padded.
 */
export function padOrCropAudio(
  samples,
) {
  const output =
    new Float32Array(
      TARGET_SAMPLES,
    );

  const length =
    Math.min(
      samples.length,
      TARGET_SAMPLES,
    );

  output.set(
    samples.subarray(
      0,
      length,
    ),
  );

  return output;
}

/*
 * Reflect-pad the signal.
 *
 * librosa's STFT uses center=True by default,
 * which pads the signal before calculating frames.
 */
function reflectPad(
  samples,
  padding,
) {
  const output =
    new Float32Array(
      samples.length +
        padding * 2,
    );

  for (let i = 0; i < padding; i++) {
    const sourceIndex =
      Math.min(
        samples.length - 1,
        padding - i,
      );

    output[i] =
      samples[sourceIndex];
  }

  output.set(
    samples,
    padding,
  );

  for (
    let i = 0;
    i < padding;
    i++
  ) {
    const sourceIndex =
      Math.max(
        0,
        samples.length -
          2 -
          i,
      );

    output[
      padding +
        samples.length +
        i
    ] =
      samples[sourceIndex];
  }

  return output;
}

/*
 * Calculate power spectrum for one frame.
 */
function powerSpectrum(
  frame,
) {
  const input =
    fft.createComplexArray();

  for (let i = 0; i < input.length; i++) {
    input[i] = 0;
  }

  for (
    let i = 0;
    i < N_FFT;
    i++
  ) {
    input[2 * i] =
      frame[i] *
      HANN_WINDOW[i];

    input[2 * i + 1] = 0;
  }

  const output =
    fft.createComplexArray();

  fft.transform(
    output,
    input,
  );

  const spectrum =
    new Float32Array(
      N_FFT / 2 + 1,
    );

  for (
    let k = 0;
    k <= N_FFT / 2;
    k++
  ) {
    const real =
      output[2 * k];

    const imag =
      output[2 * k + 1];

    spectrum[k] =
      real * real +
      imag * imag;
  }

  return spectrum;
}

/*
 * Calculate Mel spectrogram.
 *
 * Output:
 * [128][128]
 */
export function audioToMelSpectrogram(
  samples,
) {
  const padded =
    reflectPad(
      samples,
      Math.floor(N_FFT / 2),
    );

  const frameCount =
    1 +
    Math.floor(
      (padded.length - N_FFT) /
        HOP_LENGTH,
    );

  const mel =
    Array.from(
      { length: N_MELS },
      () =>
        new Float32Array(
          frameCount,
        ),
    );

  for (
    let frameIndex = 0;
    frameIndex < frameCount;
    frameIndex++
  ) {
    const start =
      frameIndex *
      HOP_LENGTH;

    const frame =
      padded.subarray(
        start,
        start + N_FFT,
      );

    const power =
      powerSpectrum(frame);

    for (
      let m = 0;
      m < N_MELS;
      m++
    ) {
      let energy = 0;

      const filter =
        MEL_FILTERS[m];

      for (
        let k = 0;
        k < power.length;
        k++
      ) {
        energy +=
          power[k] *
          filter[k];
      }

      mel[m][frameIndex] =
        energy;
    }
  }

  return mel;
}

/*
 * Convert power spectrogram to dB.
 *
 * Equivalent conceptually to:
 *
 * librosa.power_to_db(
 *   mel,
 *   ref=np.max
 * )
 */
function powerToDb(mel) {
  let maxPower = 0;

  for (const row of mel) {
    for (const value of row) {
      if (value > maxPower) {
        maxPower = value;
      }
    }
  }

  const reference =
    Math.max(
      maxPower,
      EPSILON,
    );

  const melDb =
    Array.from(
      { length: mel.length },
      () =>
        new Float32Array(
          mel[0].length,
        ),
    );

  for (
    let m = 0;
    m < mel.length;
    m++
  ) {
    for (
      let t = 0;
      t < mel[m].length;
      t++
    ) {
      const value =
        Math.max(
          mel[m][t],
          EPSILON,
        );

      melDb[m][t] =
        10 *
        Math.log10(
          value / reference,
        );
    }
  }

  return melDb;
}

/*
 * Normalize exactly like the training notebook:
 *
 * (mel_db - min) /
 * (max - min + 1e-6)
 */
function normalizeMel(
  melDb,
) {
  let min = Infinity;
  let max = -Infinity;

  for (const row of melDb) {
    for (const value of row) {
      if (value < min) min = value;
      if (value > max) max = value;
    }
  }

  const denominator =
    max - min + EPSILON;

  const normalized =
    Array.from(
      { length: melDb.length },
      () =>
        new Float32Array(
          melDb[0].length,
        ),
    );

  for (
    let m = 0;
    m < melDb.length;
    m++
  ) {
    for (
      let t = 0;
      t < melDb[m].length;
      t++
    ) {
      normalized[m][t] =
        (melDb[m][t] - min) /
        denominator;
    }
  }

  return normalized;
}

/*
 * Convert the 128 x 128 spectrogram
 * into [1, 128, 128, 3].
 *
 * The training notebook duplicates the
 * same channel three times.
 */
export function melToTensorData(
  mel,
) {
  const height = N_MELS;
  const width = mel[0].length;

  if (width !== 128) {
    throw new Error(
      `Expected 128 Mel frames, got ${width}`,
    );
  }

  const data =
    new Float32Array(
      height *
        width *
        3,
    );

  let index = 0;

  for (
    let y = 0;
    y < height;
    y++
  ) {
    for (
      let x = 0;
      x < width;
      x++
    ) {
      const value =
        mel[y][x];

      data[index++] = value;
      data[index++] = value;
      data[index++] = value;
    }
  }

  return data;
}

export function audioToTensorData(
  samples,
) {
  console.log(
    'Audio samples:',
    samples.length,
  );

  const fixed =
    padOrCropAudio(samples);

  console.log(
    'Fixed audio samples:',
    fixed.length,
  );

  const mel =
    audioToMelSpectrogram(
      fixed,
    );

  console.log(
    'Mel spectrogram:',
    mel.length,
    'x',
    mel[0].length,
  );

  const melDb =
    powerToDb(mel);

  const normalized =
    normalizeMel(melDb);

  return melToTensorData(
    normalized,
  );
}

export const AUDIO_CONFIG = {
  SAMPLE_RATE,
  TARGET_SAMPLES,
  N_FFT,
  HOP_LENGTH,
  N_MELS,
};
