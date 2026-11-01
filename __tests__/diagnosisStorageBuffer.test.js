jest.mock('react-native-fs', () => ({
  __esModule: true,
  default: {
    DocumentDirectoryPath: '/documents',
    exists: jest.fn(path => Promise.resolve(globalThis.__bufferFiles.has(path))),
    mkdir: jest.fn(path => {
      globalThis.__bufferFiles.add(path);
      return Promise.resolve();
    }),
    writeFile: jest.fn((path, data, encoding) => {
      globalThis.__bufferFiles.add(path);
      globalThis.__bufferWrites.push({ path, data, encoding });
      return Promise.resolve();
    }),
  },
}));

const RNFS = require('react-native-fs').default;
const {
  saveDiagnosisImageBuffer,
} = require('../src/services/diagnosisStorage');

describe('saveDiagnosisImageBuffer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    globalThis.__bufferFiles = new Set();
    globalThis.__bufferWrites = [];
  });

  test('writes a base64 JPEG inside the private diagnosis folder', async () => {
    const frameBuffer = new Uint8Array([1, 2, 3]).buffer;

    const path = await saveDiagnosisImageBuffer(
      frameBuffer,
      'diag-1',
      'images/live.jpg',
    );

    expect(path).toBe(
      '/documents/OralScan/diagnoses/diag-1/images/live.jpg',
    );
    expect(RNFS.mkdir).toHaveBeenCalledWith(
      '/documents/OralScan/diagnoses',
    );
    expect(RNFS.mkdir).toHaveBeenCalledWith(
      '/documents/OralScan/diagnoses/diag-1',
    );
    expect(RNFS.mkdir).toHaveBeenCalledWith(
      '/documents/OralScan/diagnoses/diag-1/images',
    );
    expect(globalThis.__bufferWrites).toEqual([
      {
        path,
        data: Buffer.from([1, 2, 3]).toString('base64'),
        encoding: 'base64',
      },
    ]);
  });

  test('rejects a missing frame or diagnosis ID', async () => {
    await expect(
      saveDiagnosisImageBuffer(null, 'diag-1'),
    ).rejects.toThrow('A frame is required to save the diagnosis image.');

    await expect(
      saveDiagnosisImageBuffer(new ArrayBuffer(1), ''),
    ).rejects.toThrow('Diagnosis ID is missing.');
  });
});
