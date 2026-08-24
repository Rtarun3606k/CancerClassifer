jest.mock('onnxruntime-react-native', () => ({
  Tensor: jest.fn((type, data, dims) => ({ type, data, dims })),
}));

jest.mock('react-native', () => ({
  NativeModules: {
    AndroidTheme: {
      getTheme: jest.fn().mockResolvedValue({
        primary: 0xff112233,
        primaryContainer: 0xff445566,
        onPrimary: 0xff778899,
        background: 0xff99aabb,
        onBackground: 0xffccbbaa,
        surface: 0xffddeeff,
        onSurface: 0xffaabbcc,
        onSurfaceVariant: 0xff112244,
        error: 0xff0000ff,
        errorContainer: 0xff00ff00,
        onErrorContainer: 0xffff0000,
      }),
    },
  },
}));

const { softmax } = require('../src/ml/softmax');
const { INPUT_SIZE, CLASS_NAMES, MEAN, STD } = require('../src/ml/constants');
const { imageToTensor } = require('../src/ml/tensor');
const { createDiagnosisId } = require('../src/utils/diagnosisId');
const { getExtensionFromFile } = require('../src/utils/getFileExtision');
const { getAndroidTheme } = require('../src/theme');
const { NativeModules } = require('react-native');

describe('src utility and model logic', () => {
  test('softmax converts logits to probabilities', () => {
    const result = softmax([1, 2, 3]);

    expect(result).toHaveLength(3);
    expect(result[0] + result[1] + result[2]).toBeCloseTo(1, 6);
    expect(result[2]).toBeGreaterThan(result[1]);
  });

  test('constants reflect expected model configuration', () => {
    expect(INPUT_SIZE).toBe(224);
    expect(CLASS_NAMES).toEqual(['CANCER', 'NON CANCER']);
    expect(MEAN).toEqual([0.485, 0.456, 0.406]);
    expect(STD).toEqual([0.229, 0.224, 0.225]);
  });

  test('imageToTensor normalizes pixel channels and emits the expected tensor shape', () => {
    const ort = require('onnxruntime-react-native');
    const image = {
      data: new Uint8ClampedArray([
        255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255,
      ]),
      width: 2,
      height: 1,
    };

    const tensor = imageToTensor(image);

    expect(ort.Tensor).toHaveBeenCalled();
    expect(tensor.type).toBe('float32');
    expect(tensor.dims).toEqual([1, 3, 224, 224]);
  });

  test('createDiagnosisId produces a date-based identifier with a suffix', () => {
    const result = createDiagnosisId();

    expect(result).toMatch(/^\d{17}_\w+$/);
  });

  test('getExtensionFromFile derives extensions from filenames and mime types', () => {
    expect(getExtensionFromFile({ name: 'photo.jpeg' })).toBe('jpeg');
    expect(getExtensionFromFile({ type: 'image/png' })).toBe('png');
    expect(getExtensionFromFile({ type: 'audio/mpeg' })).toBe('mp3');
    expect(getExtensionFromFile(null, 'bin')).toBe('bin');
  });

  test('theme helper returns Android theme values from native modules', async () => {
    NativeModules.AndroidTheme = {
      getTheme: jest.fn().mockResolvedValue({
        primary: 0xff112233,
        primaryContainer: 0xff445566,
        onPrimary: 0xff778899,
        background: 0xff99aabb,
        onBackground: 0xffccbbaa,
        surface: 0xffddeeff,
        onSurface: 0xffaabbcc,
        onSurfaceVariant: 0xff112244,
        error: 0xff0000ff,
        errorContainer: 0xff00ff00,
        onErrorContainer: 0xffff0000,
      }),
    };

    const theme = await getAndroidTheme();

    expect(theme.primary).toBe(0xff112233);
    expect(theme.background).toBe(0xff99aabb);
  });
});
