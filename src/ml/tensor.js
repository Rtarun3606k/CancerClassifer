import * as ort from 'onnxruntime-react-native';

import {
  INPUT_SIZE,
  MEAN,
  STD,
} from './constants';

export function imageToTensor(image) {
  const {
    data,
    width,
    height,
  } = image;

  const channelSize =
    width * height;

  const tensorData =
    new Float32Array(
      3 * channelSize,
    );

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixelIndex =
        (y * width + x) * 4;

      const r =
        data[pixelIndex] / 255.0;

      const g =
        data[pixelIndex + 1] / 255.0;

      const b =
        data[pixelIndex + 2] / 255.0;

      const index =
        y * width + x;

      // R channel
      tensorData[index] =
        (r - MEAN[0]) / STD[0];

      // G channel
      tensorData[
        channelSize + index
      ] =
        (g - MEAN[1]) / STD[1];

      // B channel
      tensorData[
        2 * channelSize + index
      ] =
        (b - MEAN[2]) / STD[2];
    }
  }

  return new ort.Tensor(
    'float32',
    tensorData,
    [
      1,
      3,
      INPUT_SIZE,
      INPUT_SIZE,
    ],
  );
}
