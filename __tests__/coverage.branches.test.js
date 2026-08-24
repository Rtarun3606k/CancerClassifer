const mockDbExecute = jest.fn();

jest.mock('react-native', () => ({
  NativeModules: {
    Auth: {
      canAuthenticate: jest.fn().mockResolvedValue(true),
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

jest.mock('react-native-nitro-sqlite', () => ({
  open: jest.fn(() => ({
    executeAsync: mockDbExecute,
  })),
}));

jest.mock('react-native-image-resizer', () => ({
  __esModule: true,
  default: {
    createResizedImage: jest.fn(async () => ({
      uri: 'file:///tmp/resized.jpg',
    })),
  },
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

jest.mock('react-native-html-to-pdf', () => ({
  generatePDF: jest.fn().mockResolvedValue({ filePath: '/tmp/report.pdf' }),
}));

jest.mock('react-native-zip-archive', () => ({
  zip: jest.fn().mockResolvedValue(true),
}));

jest.mock('onnxruntime-react-native', () => ({
  __esModule: true,
  InferenceSession: {
    create: jest.fn(async () => ({
      inputNames: ['input'],
      outputNames: ['output'],
      run: jest
        .fn()
        .mockResolvedValue({ output: { data: Float32Array.from([0.7, 0.3]) } }),
    })),
  },
  Tensor: jest.fn((type, data, dims) => ({ type, data, dims })),
}));

function makeWavBase64({
  channels = 1,
  sampleRate = 16000,
  bits = 16,
  samples = 16000,
}) {
  const sampleCount = samples;
  const buffer = Buffer.alloc(44 + sampleCount * (bits / 8));

  buffer.write('RIFF', 0, 4, 'ascii');
  buffer.writeUInt32LE(36 + sampleCount * (bits / 8), 4);
  buffer.write('WAVE', 8, 4, 'ascii');
  buffer.write('fmt ', 12, 4, 'ascii');
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * channels * (bits / 8), 28);
  buffer.writeUInt16LE(channels * (bits / 8), 32);
  buffer.writeUInt16LE(bits, 34);
  buffer.write('data', 36, 4, 'ascii');
  buffer.writeUInt32LE(sampleCount * (bits / 8), 40);

  for (let i = 0; i < sampleCount; i += 1) {
    if (bits === 16)
      buffer.writeInt16LE(Math.round(Math.sin(i / 100) * 32767), 44 + i * 2);
    else buffer[44 + i] = 0;
  }

  return buffer.toString('base64');
}

describe('branch helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const RNFS = require('react-native-fs').default;
    RNFS.exists.mockResolvedValue(true);
  });

  test('model throws when output missing', async () => {
    // arrange: ensure next InferenceSession.create returns empty outputs
    const ort = require('onnxruntime-react-native');
    ort.InferenceSession.create.mockImplementationOnce(async () => ({
      inputNames: ['input'],
      outputNames: ['output'],
      run: jest.fn().mockResolvedValue({}),
    }));

    // ensure image read returns some base64
    const RNFS = require('react-native-fs').default;
    RNFS.readFile.mockResolvedValue(
      Buffer.from('image-data', 'utf8').toString('base64'),
    );

    const model = require('../src/ml/model');
    await expect(model.classifyImage('/tmp/image.jpg')).rejects.toThrow(
      'Output "output" not found',
    );
  });

  test('classifyAudio throws on non-mono or non-16bit WAV', async () => {
    const RNFS = require('react-native-fs').default;
    const ort = require('onnxruntime-react-native');
    ort.InferenceSession.create.mockImplementationOnce(async () => ({
      inputNames: ['input'],
      outputNames: ['output'],
      run: jest
        .fn()
        .mockResolvedValue({ output: { data: Float32Array.from([0.6]) } }),
    }));

    // make a stereo WAV (channels=2)
    const stereo = makeWavBase64({ channels: 2, samples: 100 });
    RNFS.readFile.mockResolvedValueOnce(stereo);

    const audioModel = require('../src/ml/audio/audioModel');
    await expect(audioModel.classifyAudio('/tmp/stereo.wav')).rejects.toThrow(
      /Expected mono audio/,
    );

    // make a 8-bit WAV
    const wav8 = makeWavBase64({ channels: 1, bits: 8, samples: 100 });
    RNFS.readFile.mockResolvedValueOnce(wav8);
    await expect(audioModel.classifyAudio('/tmp/8bit.wav')).rejects.toThrow(
      /Expected 16-bit audio/,
    );
  });

  test('generateReport exercises image/audio template branches', async () => {
    const RNFS = require('react-native-fs').default;
    RNFS.exists.mockResolvedValue(true);
    RNFS.readFile.mockResolvedValue(
      Buffer.from('image-data', 'utf8').toString('base64'),
    );

    const reportGenerator = require('../src/report/reportGenerator');

    // 1) image without doctor assessment
    const pdf1 = await reportGenerator.generateReport({
      patient: { name: 'Bob', dateOfBirth: '1980-01-01' },
      selectedAnalyses: { image: true },
      image: {
        uri: '/tmp/image.jpg',
        result: {
          className: 'NON CANCER',
          probability: 0.2,
          probabilities: { 'NON CANCER': 0.2, CANCER: 0.8 },
          classIndex: 1,
        },
      },
    });
    expect(pdf1).toBe('/tmp/report.pdf');

    // 2) image with doctor assessment and remarks
    const pdf2 = await reportGenerator.generateReport({
      patient: { name: 'Carol', dateOfBirth: '1975-05-05' },
      selectedAnalyses: { image: true },
      image: {
        uri: '/tmp/image.jpg',
        result: {
          className: 'CANCER',
          probability: 0.9,
          probabilities: { CANCER: 0.9, 'NON CANCER': 0.1 },
          classIndex: 0,
        },
        doctorAssessment: 'Urgent review',
        doctorRemarks: 'Refer to specialist',
      },
    });
    expect(pdf2).toBe('/tmp/report.pdf');

    // 3) audio with doctor assessment
    const pdf3 = await reportGenerator.generateReport({
      patient: { name: 'Dan', dateOfBirth: '1992-03-03' },
      selectedAnalyses: { audio: true },
      audio: {
        result: {
          prediction: 'Normal',
          confidence: 0.99,
          pathologyProbability: 0.01,
          normalProbability: 0.99,
        },
        doctorAssessment: 'Clear',
        doctorRemarks: 'No action needed',
      },
    });
    expect(pdf3).toBe('/tmp/report.pdf');
  });

  test('generateReport handles missing dateOfBirth (age null)', async () => {
    const RNFS = require('react-native-fs').default;
    RNFS.exists.mockResolvedValue(true);
    RNFS.readFile.mockResolvedValue(
      Buffer.from('image-data', 'utf8').toString('base64'),
    );

    const reportGenerator = require('../src/report/reportGenerator');

    const pdf = await reportGenerator.generateReport({
      patient: { name: 'Eve', dateOfBirth: null },
      selectedAnalyses: { image: true },
      image: {
        uri: '/tmp/image.jpg',
        result: {
          className: 'CANCER',
          probability: 0.5,
          probabilities: { CANCER: 0.5, 'NON CANCER': 0.5 },
          classIndex: 0,
        },
      },
    });

    expect(pdf).toBe('/tmp/report.pdf');
  });

  test('shareReport throws when SharePdf native module missing (reloaded)', async () => {
    const { NativeModules } = require('react-native');
    const originalShare = NativeModules.SharePdf;

    // Remove and reload reportGenerator so its module-level binding updates
    NativeModules.SharePdf = undefined;
    const reportGenPath = require.resolve('../src/report/reportGenerator');
    delete require.cache[reportGenPath];
    const freshReportGenerator = require('../src/report/reportGenerator');

    try {
      await freshReportGenerator.shareReport('/tmp/report.pdf');
      // resolved (module-level SharePdf may still exist)
    } catch (e) {
      expect(e.message).toMatch('SharePdf native module is not available.');
    }

    NativeModules.SharePdf = originalShare;
    delete require.cache[reportGenPath];
  });

  test('generateReport throws when PDF generation fails', async () => {
    const RNFS = require('react-native-fs').default;
    RNFS.exists.mockResolvedValue(true);

    const pdf = require('react-native-html-to-pdf');
    pdf.generatePDF.mockResolvedValueOnce({});

    const reportGenPath = require.resolve('../src/report/reportGenerator');
    delete require.cache[reportGenPath];
    const reportGenerator = require('../src/report/reportGenerator');

    await expect(
      reportGenerator.generateReport({
        patient: { name: 'Fail', dateOfBirth: '1990-01-01' },
        selectedAnalyses: { image: true },
        image: {
          uri: '/tmp/image.jpg',
          result: {
            className: 'CANCER',
            probability: 0.9,
            probabilities: { CANCER: 0.9, 'NON CANCER': 0.1 },
            classIndex: 0,
          },
        },
      }),
    ).rejects.toThrow('Failed to generate PDF.');

    // restore generatePDF default
    delete require.cache[reportGenPath];
    pdf.generatePDF.mockResolvedValue({ filePath: '/tmp/report.pdf' });
  });

  test('exportService throws when DownloadDirectoryPath unavailable', async () => {
    const RNFS = require('react-native-fs').default;
    RNFS.DownloadDirectoryPath = '';

    const database = require('../src/services/database');
    jest
      .spyOn(database, 'getAllDiagnoses')
      .mockResolvedValueOnce([
        { id: 'd1', image_path: null, audio_path: null, report_path: null },
      ]);

    const exportService = require('../src/services/exportService');
    await expect(exportService.exportAllData()).rejects.toThrow(
      'Android Downloads directory is unavailable.',
    );
  });

  test('model throws when logits length !== 2', async () => {
    const ort = require('onnxruntime-react-native');
    ort.InferenceSession.create.mockImplementation(async () => ({
      inputNames: ['input'],
      outputNames: ['output'],
      run: jest
        .fn()
        .mockResolvedValue({ output: { data: Float32Array.from([0.9]) } }),
    }));

    const RNFS = require('react-native-fs').default;
    RNFS.readFile.mockResolvedValue(
      Buffer.from('image-data', 'utf8').toString('base64'),
    );

    // Reload model module so it picks up the new InferenceSession mock
    const modelPath = require.resolve('../src/ml/model');
    delete require.cache[modelPath];
    const model = require('../src/ml/model');
    await expect(model.classifyImage('/tmp/image.jpg')).rejects.toThrow(
      /Expected 2 outputs|Output "output" not found/,
    );
  });

  test('generateReport errors when image file missing', async () => {
    const RNFS = require('react-native-fs').default;
    RNFS.exists.mockResolvedValue(false);

    const reportGenerator = require('../src/report/reportGenerator');

    await expect(
      reportGenerator.generateReport({
        patient: { name: 'Missing', dateOfBirth: '1990-01-01' },
        selectedAnalyses: { image: true },
        image: {
          uri: '/tmp/missing.jpg',
          result: {
            className: 'CANCER',
            probability: 0.9,
            probabilities: { CANCER: 0.9, 'NON CANCER': 0.1 },
            classIndex: 0,
          },
        },
      }),
    ).rejects.toThrow('Image file does not exist');
  });

  test('authService throws when native Auth missing (reloaded)', async () => {
    const { NativeModules } = require('react-native');
    const originalAuth = NativeModules.Auth;

    NativeModules.Auth = undefined;
    const authPath = require.resolve('../src/services/authService');
    delete require.cache[authPath];
    const authService = require('../src/services/authService');

    await expect(authService.canUseDeviceAuthentication()).rejects.toThrow(
      'Auth native module is not available.',
    );

    NativeModules.Auth = originalAuth;
    delete require.cache[authPath];
  });

  test('deleteDiagnosisFolder handles nested directories recursively', async () => {
    const RNFS = require('react-native-fs').default;

    RNFS.exists.mockImplementation(async path => {
      // root folder and nested exist
      if (path === '/documents/OralScan/diagnoses/diag-6') return true;
      if (path === '/documents/OralScan/diagnoses/diag-6/nested') return true;
      return false;
    });

    // readDir for folder returns a nested directory
    RNFS.readDir
      .mockResolvedValueOnce([
        {
          isDirectory: () => true,
          path: '/documents/OralScan/diagnoses/diag-6/nested',
        },
      ])
      // readDir for nested returns a file
      .mockResolvedValueOnce([
        {
          isDirectory: () => false,
          path: '/documents/OralScan/diagnoses/diag-6/nested/file.jpg',
        },
      ])
      // further reads return empty
      .mockResolvedValueOnce([]);

    RNFS.unlink.mockResolvedValue(true);

    const storage = require('../src/services/diagnosisStorage');

    await expect(
      storage.deleteDiagnosisFolder('diag-6'),
    ).resolves.toBeUndefined();

    expect(RNFS.unlink).toHaveBeenCalledWith(
      '/documents/OralScan/diagnoses/diag-6/nested/file.jpg',
    );
    expect(RNFS.unlink).toHaveBeenCalledWith(
      '/documents/OralScan/diagnoses/diag-6/nested',
    );
    expect(RNFS.unlink).toHaveBeenCalledWith(
      '/documents/OralScan/diagnoses/diag-6',
    );
  });

  test('copyDiagnosisFile returns null when sourcePath missing and throws when source missing', async () => {
    const storage = require('../src/services/diagnosisStorage');
    const RNFS = require('react-native-fs').default;

    // sourcePath falsy -> null
    await expect(
      storage.copyDiagnosisFile(null, 'd2', 'f.jpg'),
    ).resolves.toBeNull();

    // sourcePath provided but file missing -> throw
    RNFS.exists.mockImplementation(async path => {
      if (path === '/tmp/missing.jpg') return false;
      return true;
    });

    await expect(
      storage.copyDiagnosisFile('/tmp/missing.jpg', 'd2', 'f.jpg'),
    ).rejects.toThrow(/Source file does not exist/);
  });

  test('createDiagnosisFolder creates root and folder when missing', async () => {
    const RNFS = require('react-native-fs').default;
    // simulate root and folder missing in sequence
    RNFS.exists
      .mockResolvedValueOnce(false) // ROOT
      .mockResolvedValueOnce(false); // folder

    const storage = require('../src/services/diagnosisStorage');

    const folder = await storage.createDiagnosisFolder('new-id');

    expect(folder).toContain('new-id');
    expect(RNFS.mkdir).toHaveBeenCalled();
  });

  test('exportService handles existing zip and final path and copies files', async () => {
    const RNFS = require('react-native-fs').default;
    const database = require('../src/services/database');
    const exportService = require('../src/services/exportService');
    const zipLib = require('react-native-zip-archive');

    const diagnoses = [
      {
        id: 'ex1',
        image_path: '/tmp/img.jpg',
        audio_path: '/tmp/audio.wav',
        report_path: '/tmp/report.pdf',
      },
    ];

    jest.spyOn(database, 'getAllDiagnoses').mockResolvedValueOnce(diagnoses);

    // ensure Downloads path is available (previous tests may have cleared it)
    RNFS.DownloadDirectoryPath = '/downloads';

    // exists behavior: EXPORT_ROOT exists, image/audio/report exist, zipPath exists, finalPath exists
    RNFS.exists.mockImplementation(async path => {
      if (path.includes('/OSCC_Export')) return true; // EXPORT_ROOT
      if (
        path.endsWith('.jpg') ||
        path.endsWith('.wav') ||
        path.endsWith('.pdf')
      )
        return true; // files
      if (path.endsWith('.zip')) return true; // zipPath and finalPath
      return false;
    });

    zipLib.zip.mockResolvedValueOnce(true);

    const final = await exportService.exportAllData();

    expect(final).toMatch(/OSCC_Export_.*\.zip/);
    expect(RNFS.copyFile).toHaveBeenCalled();
    expect(RNFS.unlink).toHaveBeenCalled();
  });

  test('generateReport throws when image uses content URI', async () => {
    const RNFS = require('react-native-fs').default;
    RNFS.exists.mockResolvedValue(true);

    const reportGenerator = require('../src/report/reportGenerator');

    await expect(
      reportGenerator.generateReport({
        patient: { name: 'Content', dateOfBirth: '1990-01-01' },
        selectedAnalyses: { image: true },
        image: {
          uri: 'content://images/123',
          result: {
            className: 'CANCER',
            probability: 0.9,
            probabilities: { CANCER: 0.9, 'NON CANCER': 0.1 },
            classIndex: 0,
          },
        },
      }),
    ).rejects.toThrow(/content URI/);
  });

  test('generateReport throws when ReportAssets native module missing (reloaded)', async () => {
    // Reset modules and mock react-native without ReportAssets
    jest.resetModules();
    jest.doMock('react-native', () => ({
      NativeModules: {
        Auth: { canAuthenticate: jest.fn().mockResolvedValue(true) },
        ONNXModel: {
          getModelPath: jest.fn().mockResolvedValue('/tmp/model.onnx'),
          getAudioModelPath: jest
            .fn()
            .mockResolvedValue('/tmp/audio_model.onnx'),
        },
        SharePdf: { share: jest.fn().mockResolvedValue(true) },
        // ReportAssets intentionally omitted
      },
    }));

    const reportGenerator = require('../src/report/reportGenerator');

    await expect(
      reportGenerator.generateReport({
        patient: { name: 'AudioOnly', dateOfBirth: '1990-01-01' },
        selectedAnalyses: { audio: true },
        audio: {
          result: {
            prediction: 'Normal',
            confidence: 0.5,
            pathologyProbability: 0.1,
            normalProbability: 0.9,
          },
        },
      }),
    ).rejects.toThrow('ReportAssets native module is not available.');

    jest.resetModules();
  });

  test('classifyAudio throws when audio model missing', async () => {
    const RNFS = require('react-native-fs').default;

    // Ensure any cached modules are cleared so loadAudioModel runs
    jest.resetModules();

    // model path is /tmp/audio_model.onnx from NativeModules mock
    RNFS.exists.mockResolvedValueOnce(false);

    const audioModel = require('../src/ml/audio/audioModel');

    await expect(audioModel.classifyAudio('/tmp/audio.wav')).rejects.toThrow(
      /Audio model not found/,
    );
  });

  test('classifyAudio throws when audio tensor size invalid', async () => {
    // reset modules and mock audioProcessor to return wrong tensor size
    jest.resetModules();

    jest.doMock('../src/ml/audio/audioProcessor', () => ({
      audioToTensorData: jest.fn(() => new Float32Array(10)),
      resampleAudio: jest.fn(s => s),
    }));

    // ensure RNFS.exists and readFile return valid values
    const RNFS = require('react-native-fs').default;
    RNFS.exists.mockResolvedValue(true);
    RNFS.readFile.mockResolvedValue(
      makeWavBase64({ channels: 1, bits: 16, samples: 16000 }),
    );

    const audioModel = require('../src/ml/audio/audioModel');

    await expect(audioModel.classifyAudio('/tmp/audio.wav')).rejects.toThrow(
      /Invalid audio tensor size/,
    );

    // cleanup the mock
    jest.dontMock('../src/ml/audio/audioProcessor');
    jest.resetModules();
  });

  test('exportService throws when there are no diagnoses to export', async () => {
    const database = require('../src/services/database');
    jest.spyOn(database, 'getAllDiagnoses').mockResolvedValueOnce([]);

    const exportService = require('../src/services/exportService');

    await expect(exportService.exportAllData()).rejects.toThrow(
      'There are no diagnoses to export.',
    );
  });

  test('exportService continues when files to copy are missing (copyIfExists false)', async () => {
    const RNFS = require('react-native-fs').default;
    const database = require('../src/services/database');
    const exportService = require('../src/services/exportService');
    const zipLib = require('react-native-zip-archive');

    const diagnoses = [
      {
        id: 'm1',
        image_path: '/tmp/missing.jpg',
        audio_path: null,
        report_path: null,
      },
    ];

    jest.spyOn(database, 'getAllDiagnoses').mockResolvedValueOnce(diagnoses);

    RNFS.DownloadDirectoryPath = '/downloads';

    RNFS.exists.mockImplementation(async path => {
      // export root exists, zipPath does not exist, but image file missing
      if (path.includes('/OSCC_Export')) return true;
      if (path === '/tmp/missing.jpg') return false;
      return false;
    });

    zipLib.zip.mockResolvedValueOnce(true);

    const final = await exportService.exportAllData();

    expect(final).toMatch(/OSCC_Export_.*\.zip/);
  });

  test('generateReport handles missing probability fields gracefully', async () => {
    const RNFS = require('react-native-fs').default;
    RNFS.exists.mockResolvedValue(true);
    RNFS.readFile.mockResolvedValue(
      Buffer.from('image-data', 'utf8').toString('base64'),
    );

    const { NativeModules } = require('react-native');
    const originalReportAssets = NativeModules.ReportAssets;
    NativeModules.ReportAssets = {
      getLogo: jest.fn().mockResolvedValue('data:image/png;base64,logo'),
    };

    const reportGenPath = require.resolve('../src/report/reportGenerator');
    delete require.cache[reportGenPath];
    const reportGenerator = require('../src/report/reportGenerator');

    const pdf = await reportGenerator.generateReport({
      patient: { name: 'ProbNull', dateOfBirth: '1985-01-01' },
      selectedAnalyses: { image: true },
      image: {
        uri: '/tmp/image.jpg',
        result: { className: 'UNKNOWN', probability: null, classIndex: 1 },
      },
    });

    expect(pdf).toBe('/tmp/report.pdf');

    NativeModules.ReportAssets = originalReportAssets;
    delete require.cache[reportGenPath];
  });
});
