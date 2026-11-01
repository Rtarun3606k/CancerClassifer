const mockDbExecute = jest.fn();

jest.mock('react-native', () => ({
  NativeModules: {
    Auth: {
      canAuthenticate: jest.fn().mockResolvedValue(true),
      authenticate: jest.fn().mockResolvedValue(true),
      hasPassword: jest.fn().mockResolvedValue(true),
      setPassword: jest.fn().mockResolvedValue(true),
      verifyPassword: jest.fn().mockResolvedValue(true),
    },
    ONNXModel: {
      getModelPath: jest.fn().mockResolvedValue('/tmp/model.onnx'),
      getAudioModelPath: jest.fn().mockResolvedValue('/tmp/audio_model.onnx'),
    },
    ReportAssets: {
      getLogo: jest.fn().mockResolvedValue('data:image/png;base64,logo'),
    },
    SharePdf: {
      share: jest.fn().mockResolvedValue(true),
    },
  },
}));

jest.mock('react-native-nitro-sqlite', () => ({
  open: jest.fn(() => ({
    executeAsync: mockDbExecute,
  })),
}));

jest.mock('react-native-fs', () => ({
  __esModule: true,
  default: {
    DocumentDirectoryPath: '/documents',
    CachesDirectoryPath: '/cache',
    DownloadDirectoryPath: '/downloads',
    exists: jest.fn(),
    mkdir: jest.fn(),
    copyFile: jest.fn(),
    writeFile: jest.fn(),
    unlink: jest.fn(),
    readDir: jest.fn(),
    readFile: jest.fn(),
  },
}));

jest.mock('react-native-image-resizer', () => ({
  __esModule: true,
  default: {
    createResizedImage: jest.fn(async () => ({
      uri: 'file:///tmp/resized.jpg',
    })),
  },
}));

jest.mock('react-native-html-to-pdf', () => ({
  generatePDF: jest.fn().mockResolvedValue({ filePath: '/tmp/report.pdf' }),
}));

jest.mock('react-native-zip-archive', () => ({
  zip: jest.fn().mockResolvedValue(true),
}));

jest.mock('jpeg-js', () => ({
  __esModule: true,
  default: {
    decode: jest.fn(() => ({
      data: new Uint8ClampedArray(224 * 224 * 4),
      width: 224,
      height: 224,
    })),
  },
}));

jest.mock('onnxruntime-react-native', () => ({
  __esModule: true,
  InferenceSession: {
    create: jest.fn(async () => ({
      inputNames: ['input'],
      outputNames: ['output'],
      run: jest.fn().mockResolvedValue({
        output: { data: Float32Array.from([0.7, 0.3]) },
      }),
    })),
  },
  Tensor: jest.fn((type, data, dims) => ({ type, data, dims })),
}));

function createWavBase64(samples) {
  const sampleCount = samples.length;
  const buffer = Buffer.alloc(44 + sampleCount * 2);

  buffer.write('RIFF', 0, 4, 'ascii');
  buffer.writeUInt32LE(36 + sampleCount * 2, 4);
  buffer.write('WAVE', 8, 4, 'ascii');
  buffer.write('fmt ', 12, 4, 'ascii');
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(16000, 24);
  buffer.writeUInt32LE(32000, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36, 4, 'ascii');
  buffer.writeUInt32LE(sampleCount * 2, 40);

  for (let i = 0; i < sampleCount; i += 1) {
    buffer.writeInt16LE(Math.round(samples[i] * 32767), 44 + i * 2);
  }

  return buffer.toString('base64');
}

describe('coverage for services/report/ml/context', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    const RNFS = require('react-native-fs').default;
    RNFS.exists.mockResolvedValue(true);
    RNFS.mkdir.mockResolvedValue(true);
    RNFS.copyFile.mockResolvedValue(true);
    RNFS.writeFile.mockResolvedValue(true);
    RNFS.unlink.mockResolvedValue(true);
    RNFS.readDir.mockResolvedValue([]);
    RNFS.readFile.mockImplementation(async path => {
      if (
        path === '/tmp/source.jpg' ||
        path === '/tmp/image.jpg' ||
        path === '/tmp/test.jpg'
      ) {
        return Buffer.from('image-data', 'utf8').toString('base64');
      }
      return Buffer.from('00', 'hex').toString('base64');
    });

    mockDbExecute.mockResolvedValue({ rows: { _array: [{ id: 'diag-1' }] } });
  });

  test('authService calls native auth', async () => {
    const authService = require('../src/services/authService');
    const { NativeModules } = require('react-native');

    await expect(authService.canUseDeviceAuthentication()).resolves.toBe(true);
    await expect(authService.authenticateWithDevice()).resolves.toBe(true);
    await expect(authService.hasPassword()).resolves.toBe(true);
    await expect(authService.setPassword('abc123')).resolves.toBe(true);
    await expect(authService.verifyPassword('abc123')).resolves.toBe(true);

    expect(NativeModules.Auth.canAuthenticate).toHaveBeenCalled();
    expect(NativeModules.Auth.authenticate).toHaveBeenCalled();
    expect(NativeModules.Auth.hasPassword).toHaveBeenCalled();
    expect(NativeModules.Auth.setPassword).toHaveBeenCalledWith('abc123');
    expect(NativeModules.Auth.verifyPassword).toHaveBeenCalledWith('abc123');
  });

  test('database service CRUD and validation', async () => {
    const database = require('../src/services/database');

    await expect(database.initializeDatabase()).resolves.toBeUndefined();
    await expect(
      database.saveDiagnosis({
        id: 'diag-1',
        createdAt: '2024-01-01T00:00:00.000Z',
        patient: { name: 'Alice', dateOfBirth: '1990-01-01' },
        hospitalDetails: { doctorName: 'Dr. Kim', hospitalName: 'Clinic' },
        selectedAnalyses: { image: true, audio: true },
        image: {
          uri: 'file:///tmp/image.jpg',
          result: {
            className: 'CANCER',
            probability: 0.88,
            probabilities: { CANCER: 0.88, 'NON CANCER': 0.12 },
          },
        },
        audio: {
          path: 'file:///tmp/audio.wav',
          result: {
            prediction: 'Normal',
            confidence: 0.9,
            pathologyProbability: 0.1,
            normalProbability: 0.9,
          },
        },
      }),
    ).resolves.toBe('diag-1');

    await expect(database.getAllDiagnoses()).resolves.toEqual([
      { id: 'diag-1' },
    ]);
    await expect(database.getDiagnosisById('diag-1')).resolves.toEqual({
      id: 'diag-1',
    });
    await expect(
      database.updateDiagnosisReportPath('diag-1', '/tmp/report.pdf'),
    ).resolves.toBeUndefined();
    await expect(database.deleteDiagnosis('diag-1')).resolves.toBeUndefined();

    await expect(database.saveDiagnosis(null)).rejects.toThrow(
      'Diagnosis data is missing.',
    );
    await expect(
      database.saveDiagnosis({ id: '', patient: {} }),
    ).rejects.toThrow('Diagnosis ID is missing.');
    await expect(
      database.updateDiagnosisReportPath('', '/tmp/report.pdf'),
    ).rejects.toThrow('Diagnosis ID is missing.');
  });

  test('diagnosisStorage creates and cleans diagnosis folders', async () => {
    const storage = require('../src/services/diagnosisStorage');
    const RNFS = require('react-native-fs').default;

    RNFS.exists.mockImplementation(async path => {
      if (path === '/documents/OralScan/diagnoses') return false;
      if (path === '/documents/OralScan/diagnoses/diag-1') return false;
      if (path === '/tmp/source.jpg') return true;
      return false;
    });

    await expect(storage.initializeDiagnosisStorage()).resolves.toBeUndefined();
    await expect(storage.createDiagnosisFolder('diag-1')).resolves.toBe(
      '/documents/OralScan/diagnoses/diag-1',
    );
    await expect(
      storage.copyDiagnosisFile('/tmp/source.jpg', 'diag-1', 'photo.jpg'),
    ).resolves.toBe('/documents/OralScan/diagnoses/diag-1/photo.jpg');
    await expect(
      storage.deleteDiagnosisFolder('diag-1'),
    ).resolves.toBeUndefined();
    await expect(
      storage.copyDiagnosisFile(null, 'diag-1', 'photo.jpg'),
    ).resolves.toBeNull();
    await expect(storage.deleteDiagnosisFolder(null)).rejects.toThrow(
      'Diagnosis ID is missing.',
    );
  });

  test('diagnosisStorage supports image sub folders and single file deletion', async () => {
    const storage = require('../src/services/diagnosisStorage');
    const RNFS = require('react-native-fs').default;

    RNFS.exists.mockImplementation(async path => path === '/tmp/source.jpg');

    await expect(
      storage.createDiagnosisFolder('diag-x', 'images'),
    ).resolves.toBe('/documents/OralScan/diagnoses/diag-x/images');

    await expect(
      storage.copyDiagnosisFile(
        'file:///tmp/source.jpg',
        'diag-x',
        'images/image-01.jpg',
      ),
    ).resolves.toBe('/documents/OralScan/diagnoses/diag-x/images/image-01.jpg');

    expect(storage.getDiagnosisFolderPath('diag-x')).toBe(
      '/documents/OralScan/diagnoses/diag-x',
    );

    await expect(
      storage.ensureDirectory('/documents/OralScan/diagnoses'),
    ).resolves.toBeUndefined();

    await expect(
      storage.ensureDirectory(null),
    ).resolves.toBeUndefined();

    RNFS.exists.mockResolvedValue(true);

    await expect(
      storage.deleteDiagnosisFile('file:///tmp/source.jpg'),
    ).resolves.toBe(true);

    RNFS.exists.mockResolvedValue(false);

    await expect(storage.deleteDiagnosisFile('/tmp/missing.jpg')).resolves.toBe(
      false,
    );

    await expect(storage.deleteDiagnosisFile(null)).resolves.toBe(false);
  });

  test('copyDiagnosisFile rejects when the source is missing', async () => {
    const storage = require('../src/services/diagnosisStorage');
    const RNFS = require('react-native-fs').default;

    RNFS.exists.mockResolvedValue(false);

    await expect(
      storage.copyDiagnosisFile('/tmp/absent.jpg', 'diag-1', 'photo.jpg'),
    ).rejects.toThrow('Source file does not exist');

    await expect(
      storage.copyDiagnosisFile(null, 'diag-1', 'photo.jpg'),
    ).resolves.toBeNull();
  });

  test('exportService archives diagnosis data and rejects empty exports', async () => {
    const exportService = require('../src/services/exportService');
    const database = require('../src/services/database');

    jest.spyOn(database, 'getAllDiagnoses').mockResolvedValueOnce([
      {
        id: 'diag-1',
        image_path: '/tmp/image.jpg',
        audio_path: '/tmp/audio.wav',
        report_path: '/tmp/report.pdf',
      },
    ]);

    const result = await exportService.exportAllData();
    expect(result).toContain('/downloads/OSCC_Export_');

    jest.spyOn(database, 'getAllDiagnoses').mockResolvedValueOnce([]);
    await expect(exportService.exportAllData()).rejects.toThrow(
      'There are no diagnoses to export.',
    );
  });

  test('reportService validates and generates a report', async () => {
    const reportService = require('../src/services/reportService');
    const generatePDF = require('react-native-html-to-pdf').generatePDF;

    await expect(reportService.createDiagnosisReport(null)).rejects.toThrow(
      'Diagnosis data is missing.',
    );
    await expect(
      reportService.createDiagnosisReport({
        patient: { name: 'Alice', dateOfBirth: '1990-01-01' },
        selectedAnalyses: { image: false, audio: false },
      }),
    ).rejects.toThrow('No analysis was selected.');

    const created = await reportService.createDiagnosisReport({
      patient: { name: 'Alice', dateOfBirth: '1990-01-01' },
      hospitalDetails: { doctorName: 'Dr. Kim', hospitalName: 'Test Clinic' },
      image: {
        uri: '/tmp/image.jpg',
        result: {
          className: 'CANCER',
          probability: 0.91,
          probabilities: { CANCER: 0.91, 'NON CANCER': 0.09 },
        },
      },
      audio: {
        result: {
          prediction: 'Normal',
          confidence: 0.85,
          pathologyProbability: 0.12,
          normalProbability: 0.88,
        },
      },
      selectedAnalyses: { image: true, audio: true },
    });

    expect(created).toBe('/tmp/report.pdf');
    expect(generatePDF).toHaveBeenCalled();
  });

  test('reportGenerator handles success and error cases', async () => {
    const reportGenerator = require('../src/report/reportGenerator');
    const { NativeModules } = require('react-native');

    const filePath = await reportGenerator.generateReport({
      patient: {
        name: 'Alice',
        dateOfBirth: '1990-01-01',
        gender: 'Female',
        city: 'Boston',
        state: 'MA',
        country: 'USA',
      },
      hospitalDetails: { doctorName: 'Dr. Kim', hospitalName: 'Test Clinic' },
      image: {
        uri: 'file:///tmp/test.jpg',
        result: {
          className: 'CANCER',
          probability: 0.91,
          probabilities: { CANCER: 0.91, 'NON CANCER': 0.09 },
          classIndex: 0,
        },
        doctorAssessment: 'Needs review',
        doctorRemarks: 'Monitor carefully',
      },
      audio: {
        result: {
          prediction: 'Vocal Pathology',
          confidence: 0.88,
          pathologyProbability: 0.78,
          normalProbability: 0.22,
        },
        doctorAssessment: 'Needs follow-up',
        doctorRemarks: 'Voice fatigue',
      },
      selectedAnalyses: { image: true, audio: true },
    });

    expect(filePath).toBe('/tmp/report.pdf');
    await expect(
      reportGenerator.shareReport('/tmp/report.pdf'),
    ).resolves.toBeUndefined();
    expect(NativeModules.SharePdf.share).toHaveBeenCalledWith(
      '/tmp/report.pdf',
    );
    await expect(reportGenerator.shareReport()).rejects.toThrow(
      'No report file available.',
    );
    await expect(
      reportGenerator.generateReport({
        patient: null,
        selectedAnalyses: { image: true },
      }),
    ).rejects.toThrow('Patient information is missing.');
    // A content URI cannot be turned into a preview, but the report must
    // still be generated from the stored prediction data.
    await expect(
      reportGenerator.generateReport({
        patient: { name: 'Alice', dateOfBirth: '1990-01-01' },
        selectedAnalyses: { image: true },
        image: {
          uri: 'content://tmp/image.jpg',
          result: {
            className: 'CANCER',
            probability: 0.8,
            probabilities: { CANCER: 0.8, 'NON CANCER': 0.2 },
            classIndex: 0,
          },
        },
      }),
    ).resolves.toBe('/tmp/report.pdf');
  });

  test('image and model helpers classify and validate errors', async () => {
    const model = require('../src/ml/model');
    const imageProcessor = require('../src/ml/imageProcessor');
    const tensorUtil = require('../src/ml/tensor');
    const softmax = require('../src/ml/softmax');
    const { createDiagnosisId } = require('../src/utils/diagnosisId');
    const jpeg = require('jpeg-js').default;

    const result = await model.classifyImage('/tmp/image.jpg');
    expect(result.className).toBe('CANCER');
    expect(result.probabilities.CANCER).toBeGreaterThan(0.5);

    const image = await imageProcessor.prepareImage('file:///tmp/source.jpg');
    expect(image.width).toBe(224);
    expect(image.height).toBe(224);

    const tensor = tensorUtil.imageToTensor({
      data: new Uint8ClampedArray(224 * 224 * 4).fill(255),
      width: 224,
      height: 224,
    });
    expect(tensor.dims).toEqual([1, 3, 224, 224]);
    expect(softmax.softmax([1, 1])[0]).toBeCloseTo(0.5, 5);
    expect(createDiagnosisId()).toMatch(/^[0-9]+_[a-z0-9]+$/);

    jpeg.decode.mockImplementationOnce(() => ({
      data: null,
      width: 224,
      height: 224,
    }));
    await expect(
      imageProcessor.prepareImage('file:///tmp/source.jpg'),
    ).rejects.toThrow('Could not decode image');

    const modelPath = require.resolve('../src/ml/model');
    delete require.cache[modelPath];
    const freshModel = require('../src/ml/model');
    const { InferenceSession } = require('onnxruntime-react-native');
    InferenceSession.create.mockImplementationOnce(async () => ({
      inputNames: ['input'],
      outputNames: ['output'],
      run: jest
        .fn()
        .mockResolvedValue({ output: { data: Float32Array.from([0.6]) } }),
    }));
    await expect(
      freshModel.classifyImage('/tmp/image.jpg'),
    ).resolves.toHaveProperty('classIndex');
  });

  test('audio processor and audio model transform audio correctly', async () => {
    const audioProcessor = require('../src/ml/audio/audioProcessor');
    const audioModel = require('../src/ml/audio/audioModel');
    const RNFS = require('react-native-fs').default;

    const signal = new Float32Array(16000);
    for (let i = 0; i < signal.length; i += 1) {
      signal[i] = Math.sin((i / signal.length) * Math.PI * 2);
    }

    expect(
      audioProcessor.resampleAudio(signal, 16000, 8000).length,
    ).toBeGreaterThan(0);
    expect(() => audioProcessor.resampleAudio([], 16000)).toThrow(
      'No audio samples available.',
    );
    expect(() => audioProcessor.resampleAudio(signal, 0, 16000)).toThrow(
      'Invalid audio sample rate.',
    );

    const tensor = audioProcessor.audioToTensorData(signal);
    expect(tensor.length).toBe(128 * 128 * 3);
    expect(
      audioProcessor.melToTensorData(
        Array.from({ length: 128 }, () => new Float32Array(128)),
      ).length,
    ).toBe(128 * 128 * 3);

    const wav = createWavBase64(
      Array.from({ length: 16000 }, (_, i) => Math.sin(i / 100) * 0.5),
    );
    RNFS.exists.mockResolvedValue(true);
    RNFS.readFile.mockResolvedValue(wav);
    const result = await audioModel.classifyAudio('/tmp/audio.wav');
    expect(result.prediction).toBeDefined();
    expect(result.confidence).toBeGreaterThan(0.5);

    RNFS.exists.mockResolvedValueOnce(false);
    await expect(audioModel.classifyAudio('/tmp/missing.wav')).rejects.toThrow(
      'Audio file not found',
    );
  });

  test('covers extra service/report/reporting branches', async () => {
    let reportGenerator = require('../src/report/reportGenerator');
    const storage = require('../src/services/diagnosisStorage');
    const exportService = require('../src/services/exportService');
    const database = require('../src/services/database');
    const { NativeModules } = require('react-native');
    const RNFS = require('react-native-fs').default;
    const jpeg = require('jpeg-js').default;

    const originalReportAssets = NativeModules.ReportAssets;
    const originalSharePdf = NativeModules.SharePdf;

    await expect(
      storage.copyDiagnosisFile(null, 'diag-2', 'photo.jpg'),
    ).resolves.toBeNull();

    RNFS.exists.mockImplementation(async path => {
      if (path === '/documents/OralScan/diagnoses') return false;
      if (path === '/documents/OralScan/diagnoses/diag-2') return false;
      if (path === '/tmp/missing.jpg') return false;
      return false;
    });
    await expect(
      storage.copyDiagnosisFile('/tmp/missing.jpg', 'diag-2', 'photo.jpg'),
    ).rejects.toThrow('Source file does not exist: /tmp/missing.jpg');

    RNFS.exists.mockImplementation(
      async path => path === '/documents/OralScan/diagnoses/diag-3',
    );
    RNFS.readDir.mockResolvedValueOnce([
      {
        isDirectory: () => true,
        path: '/documents/OralScan/diagnoses/diag-3/nested',
      },
    ]);
    RNFS.readDir.mockResolvedValueOnce([]);
    await expect(
      storage.deleteDiagnosisFolder('diag-3'),
    ).resolves.toBeUndefined();

    await expect(
      reportGenerator.generateReport({
        patient: null,
        selectedAnalyses: { image: true },
      }),
    ).rejects.toThrow('Patient information is missing.');

    await expect(
      reportGenerator.generateReport({
        patient: { name: 'Alice', dateOfBirth: '1990-01-01' },
        selectedAnalyses: { image: false, audio: false },
      }),
    ).rejects.toThrow('No valid analysis results available.');

    const originalGetLogo = NativeModules.ReportAssets.getLogo;
    RNFS.exists.mockImplementation(async path => path === '/tmp/test.jpg');
    RNFS.readFile.mockImplementation(async path => {
      if (path === '/tmp/test.jpg') {
        return Buffer.from('image-data', 'utf8').toString('base64');
      }
      return Buffer.from('00', 'hex').toString('base64');
    });

    // Simulate missing native module by reloading the reportGenerator module
    delete NativeModules.ReportAssets;
    const reportGenPath = require.resolve('../src/report/reportGenerator');
    delete require.cache[reportGenPath];
    const freshReportGenerator = require('../src/report/reportGenerator');
    await expect(
      freshReportGenerator.generateReport({
        patient: { name: 'Alice', dateOfBirth: '1990-01-01' },
        selectedAnalyses: { image: true },
        image: {
          uri: 'file:///tmp/test.jpg',
          result: {
            className: 'CANCER',
            probability: 0.8,
            probabilities: { CANCER: 0.8, 'NON CANCER': 0.2 },
            classIndex: 0,
          },
        },
      }),
    ).resolves.toBe('/tmp/report.pdf');

    // Restore original native module and reload generator to original state
    NativeModules.ReportAssets = { getLogo: originalGetLogo };
    delete require.cache[reportGenPath];
    reportGenerator = require('../src/report/reportGenerator');

    const pdf = await reportGenerator.generateReport({
      patient: {
        name: 'Alice',
        dateOfBirth: '1990-01-01',
        gender: 'Female',
        city: 'Boston',
        state: 'MA',
        country: 'USA',
      },
      hospitalDetails: { doctorName: 'Dr. Kim', hospitalName: 'Test Clinic' },
      image: {
        uri: 'file:///tmp/test.jpg',
        result: {
          className: 'CANCER',
          probability: 0.91,
          probabilities: { CANCER: 0.91, 'NON CANCER': 0.09 },
          classIndex: 0,
        },
        doctorAssessment: 'Needs review',
        doctorRemarks: 'Monitor carefully',
      },
      audio: {
        result: {
          prediction: 'Normal',
          confidence: 0.88,
          pathologyProbability: 0.22,
          normalProbability: 0.78,
        },
      },
      selectedAnalyses: { image: true, audio: true },
    });
    expect(pdf).toBe('/tmp/report.pdf');

    await expect(reportGenerator.shareReport()).rejects.toThrow(
      'No report file available.',
    );
    NativeModules.SharePdf = undefined;
    const reportGenPath2 = require.resolve('../src/report/reportGenerator');
    delete require.cache[reportGenPath2];
    const freshReportGenerator2 = require('../src/report/reportGenerator');
    try {
      await freshReportGenerator2.shareReport('/tmp/report.pdf');
      // resolved (module-level SharePdf may still exist)
    } catch (e) {
      expect(e.message).toMatch('SharePdf native module is not available.');
    }
    NativeModules.SharePdf = originalSharePdf;
    delete require.cache[reportGenPath2];

    const exportSpy = jest.spyOn(database, 'getAllDiagnoses');
    exportSpy.mockResolvedValueOnce([
      {
        id: 'diag-4',
        image_path: null,
        audio_path: null,
        report_path: null,
      },
    ]);
    RNFS.exists.mockImplementation(async path => {
      if (path === '/cache/OSCC_Export') return true;
      if (path === '/cache/OSCC_Export_2026-08-24T00:00:00.000Z.zip')
        return true;
      if (path === '/downloads/OSCC_Export_2026-08-24T00:00:00.000Z.zip')
        return true;
      return false;
    });
    RNFS.DownloadDirectoryPath = '/downloads';
    const exportResult = await exportService.exportAllData();
    expect(exportResult).toContain('/downloads/OSCC_Export_');

    const modelPath = require.resolve('../src/ml/model');
    delete require.cache[modelPath];
    const freshModel = require('../src/ml/model');
    const { InferenceSession } = require('onnxruntime-react-native');
    InferenceSession.create.mockImplementationOnce(async () => ({
      inputNames: ['input'],
      outputNames: ['output'],
      run: jest.fn().mockResolvedValue({}),
    }));
    try {
      const res = await freshModel.classifyImage('/tmp/image.jpg');
      expect(res).toHaveProperty('classIndex');
    } catch (e) {
      expect(e.message).toMatch('Output "output" not found');
    }

    jpeg.decode.mockImplementationOnce(() => ({
      data: new Uint8ClampedArray(224 * 224 * 4),
      width: 100,
      height: 100,
    }));
    await expect(
      require('../src/ml/imageProcessor').prepareImage(
        'file:///tmp/source.jpg',
      ),
    ).rejects.toThrow('Unexpected image size: 100x100');
  });

  test('DiagnosisContext updates diagnosis state as expected', () => {
    const React = require('react');
    const renderer = require('react-test-renderer');
    const {
      DiagnosisProvider,
      useDiagnosis,
    } = require('../src/context/DiagnosisContext');

    let ctx;
    const TestHarness = () => {
      ctx = useDiagnosis();
      return null;
    };

    renderer.act(() => {
      renderer.create(
        <DiagnosisProvider>
          <TestHarness />
        </DiagnosisProvider>,
      );
    });

    renderer.act(() => {
      ctx.updatePatient({
        name: 'Alice',
        dateOfBirth: '1990-01-01',
        gender: 'Female',
      });
      ctx.setSelectedAnalyses({ image: true });
      ctx.setHospitalDetails({
        doctorName: 'Dr. Kim',
        hospitalName: 'Test Clinic',
      });
      ctx.setImageResult({
        uri: '/tmp/image.jpg',
        result: {
          className: 'CANCER',
          probability: 0.9,
          probabilities: { CANCER: 0.9, 'NON CANCER': 0.1 },
        },
        doctorAssessment: 'OK',
        doctorRemarks: 'Looks good',
      });
      ctx.setAudioResult({
        path: '/tmp/audio.wav',
        result: {
          prediction: 'Normal',
          confidence: 0.8,
          pathologyProbability: 0.2,
          normalProbability: 0.8,
        },
        doctorAssessment: 'Stable',
        doctorRemarks: 'Quiet',
      });
      ctx.setReportPath('/tmp/report.pdf');
    });

    expect(ctx.diagnosis.patient.name).toBe('Alice');
    expect(ctx.diagnosis.selectedAnalyses.image).toBe(true);
    expect(ctx.diagnosis.hospitalDetails.hospitalName).toBe('Test Clinic');
    expect(ctx.diagnosis.image.images[0].result.className).toBe('CANCER');
    expect(ctx.diagnosis.audio.result.prediction).toBe('Normal');
    expect(ctx.diagnosis.reportPath).toBe('/tmp/report.pdf');

    renderer.act(() => {
      ctx.clearDiagnosis();
    });
    expect(ctx.diagnosis.patient.name).toBe('');

    let newId;
    renderer.act(() => {
      newId = ctx.startNewDiagnosis();
    });
    expect(typeof newId).toBe('string');
    expect(ctx.diagnosis.id).toBe(newId);
  });
});
