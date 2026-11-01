/**
 * Multi-image diagnosis tests.
 *
 * Covers selection, removal, independent inference, per-image failures,
 * persistence, PDF generation and ZIP export.
 */

const mockDbExecute = jest.fn();

let mockSchemaVersion = 2;

let mockImageRows = [];

let mockDiagnosisRows = [];

jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  Image: 'Image',
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  TextInput: 'TextInput',
  ActivityIndicator: 'ActivityIndicator',
  Alert: { alert: jest.fn() },
  StyleSheet: { create: styles => styles },
  NativeModules: {
    ONNXModel: {
      getModelPath: jest.fn().mockResolvedValue('/tmp/model.onnx'),
      getAudioModelPath: jest.fn().mockResolvedValue('/tmp/audio_model.onnx'),
    },
    ReportAssets: {
      getLogo: jest.fn().mockResolvedValue('data:image/png;base64,logo'),
    },
    SharePdf: {
      share: jest.fn(),
      open: jest.fn(),
      openAudio: jest.fn(),
    },
    Auth: {
      canAuthenticate: jest.fn().mockResolvedValue(true),
      authenticate: jest.fn().mockResolvedValue(true),
      hasPassword: jest.fn().mockResolvedValue(false),
      setPassword: jest.fn().mockResolvedValue(true),
      verifyPassword: jest.fn().mockResolvedValue(true),
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

jest.mock('react-native-image-picker', () => ({
  launchImageLibrary: jest.fn(),
  launchCamera: jest.fn(),
}));

jest.mock('react-native-html-to-pdf', () => ({
  generatePDF: jest.fn().mockResolvedValue({ filePath: '/tmp/report.pdf' }),
}));

jest.mock('react-native-zip-archive', () => ({
  zip: jest.fn().mockResolvedValue(true),
}));

jest.mock('../src/ml/model', () => ({
  classifyImage: jest.fn(),
}));

jest.mock('../src/services/diagnosisStorage', () => ({
  copyDiagnosisFile: jest.fn(),
  deleteDiagnosisFile: jest.fn(),
}));

const React = require('react');
const { act, create } = require('react-test-renderer');

const RNFS = require('react-native-fs').default;

const database = require('../src/services/database');
const reportGenerator = require('../src/report/reportGenerator');
const reportService = require('../src/services/reportService');
const exportService = require('../src/services/exportService');
const storage = require('../src/services/diagnosisStorage');
const { classifyImage } = require('../src/ml/model');
const {
  launchImageLibrary,
  launchCamera,
} = require('react-native-image-picker');
const {
  DiagnosisProvider,
  useDiagnosis,
  IMAGE_STATUS,
} = require('../src/context/DiagnosisContext');
const ImageAnalysisScreen =
  require('../src/screens/ImageAnalysisScreen').default;

const colors = {
  background: '#ffffff',
  primary: '#123456',
  onPrimary: '#ffffff',
  onBackground: '#111111',
  onSurface: '#222222',
  onSurfaceVariant: '#555555',
  surface: '#f4f4f4',
  surfaceContainer: '#efefef',
  surfaceContainerLow: '#f8f8f8',
  surfaceContainerHighest: '#e0e0e0',
  primaryContainer: '#ddeeff',
  onPrimaryContainer: '#111111',
  outline: '#c9c9c9',
  outlineVariant: '#dddddd',
  error: '#b3261e',
  errorContainer: '#f9dedc',
  onErrorContainer: '#410e0b',
};

function flatten(children) {
  if (Array.isArray(children)) {
    return children.map(flatten).join('');
  }

  if (children === null || children === undefined) {
    return '';
  }

  return String(children);
}

function texts(root) {
  return root.findAllByType('Text').map(node => flatten(node.props.children));
}

function press(root, label) {
  const target = root
    .findAllByType('Text')
    .find(node => flatten(node.props.children).trim() === label);

  if (!target) {
    throw new Error(`No pressable found with label "${label}"`);
  }

  let node = target.parent;

  while (node && node.type !== 'Pressable') {
    node = node.parent;
  }

  if (!node) {
    throw new Error(`Label "${label}" is not inside a Pressable`);
  }

  act(() => {
    node.props.onPress();
  });
}

function renderImageScreen() {
  let ctx;
  let root;

  function Harness() {
    ctx = useDiagnosis();

    return React.createElement(ImageAnalysisScreen, {
      colors,
      onComplete: jest.fn(),
      onBack: jest.fn(),
    });
  }

  act(() => {
    root = create(
      React.createElement(
        DiagnosisProvider,
        null,
        React.createElement(Harness),
      ),
    );
  });

  return { root: root.root, getContext: () => ctx };
}

beforeEach(() => {
  jest.clearAllMocks();

  mockSchemaVersion = 2;
  mockImageRows = [];
  mockDiagnosisRows = [];

  mockDbExecute.mockImplementation(async sql => {
    if (/PRAGMA user_version/.test(sql)) {
      return { rows: { _array: [{ user_version: mockSchemaVersion }] } };
    }

    if (/FROM diagnosis_images/.test(sql)) {
      return { rows: { _array: mockImageRows } };
    }

    if (/FROM diagnoses/.test(sql)) {
      return { rows: { _array: mockDiagnosisRows } };
    }

    return { rows: { _array: [] } };
  });

  RNFS.exists.mockResolvedValue(true);
  RNFS.mkdir.mockResolvedValue(true);
  RNFS.copyFile.mockResolvedValue(true);
  RNFS.writeFile.mockResolvedValue(true);
  RNFS.unlink.mockResolvedValue(true);
  RNFS.readDir.mockResolvedValue([]);
  RNFS.DownloadDirectoryPath = '/downloads';
  RNFS.readFile.mockResolvedValue(Buffer.from('img').toString('base64'));

  storage.copyDiagnosisFile.mockImplementation(
    async (source, diagnosisId, fileName) =>
      `/documents/OralScan/diagnoses/${diagnosisId}/${fileName}`,
  );
  storage.deleteDiagnosisFile.mockResolvedValue(true);
});

function prediction(className, cancer, nonCancer) {
  return {
    classIndex: className === 'CANCER' ? 0 : 1,
    className,
    probability: className === 'CANCER' ? cancer : nonCancer,
    probabilities: { CANCER: cancer, 'NON CANCER': nonCancer },
    logits: [cancer, nonCancer],
  };
}

describe('multiple image selection', () => {
  test('adds every selected image and skips duplicates / invalid files', async () => {
    launchImageLibrary.mockResolvedValue({
      assets: [
        { uri: 'file:///tmp/a.jpg', fileName: 'a.jpg', type: 'image/jpeg' },
        { uri: 'file:///tmp/a.jpg', fileName: 'a.jpg', type: 'image/jpeg' },
        { uri: 'file:///tmp/voice.mp3', fileName: 'voice.mp3', type: 'audio/mpeg' },
        { uri: 'file:///tmp/b.png', fileName: 'b.png', type: 'image/png' },
      ],
    });

    const { root, getContext } = renderImageScreen();

    await act(async () => {
      press(root, 'Add Images');
      await Promise.resolve();
    });

    const images = getContext().diagnosis.image.images;

    expect(images).toHaveLength(2);
    expect(images.map(image => image.fileName)).toEqual(['a.jpg', 'b.png']);
    expect(images.every(image => image.status === 'pending')).toBe(true);

    expect(texts(root).join(' ')).toContain('Skipped 2');
  });

  test('supports capturing a photo with the camera', async () => {
    launchCamera.mockResolvedValue({
      assets: [
        {
          uri: 'file:///tmp/camera.jpg',
          fileName: 'camera.jpg',
          type: 'image/jpeg',
        },
      ],
    });

    const { root, getContext } = renderImageScreen();

    await act(async () => {
      press(root, 'Take Photo');
      await Promise.resolve();
    });

    const images = getContext().diagnosis.image.images;

    expect(images).toHaveLength(1);
    expect(images[0].originalUri).toBe('file:///tmp/camera.jpg');
  });

  test('removes a single selected image without touching the others', async () => {
    launchImageLibrary.mockResolvedValue({
      assets: [
        { uri: 'file:///tmp/a.jpg', fileName: 'a.jpg', type: 'image/jpeg' },
        { uri: 'file:///tmp/b.jpg', fileName: 'b.jpg', type: 'image/jpeg' },
      ],
    });

    const { root, getContext } = renderImageScreen();

    await act(async () => {
      press(root, 'Add Images');
      await Promise.resolve();
    });

    expect(getContext().diagnosis.image.images).toHaveLength(2);

    const removeButtons = root
      .findAllByType('Text')
      .filter(node => flatten(node.props.children) === '✕');

    expect(removeButtons).toHaveLength(2);

    await act(async () => {
      let node = removeButtons[0].parent;

      while (node && node.type !== 'Pressable') {
        node = node.parent;
      }

      node.props.onPress();
      await Promise.resolve();
    });

    const images = getContext().diagnosis.image.images;

    expect(images).toHaveLength(1);
    expect(images[0].fileName).toBe('b.jpg');
  });

  test('ignores cancelled pickers', async () => {
    launchImageLibrary.mockResolvedValue({ didCancel: true });

    const { root, getContext } = renderImageScreen();

    await act(async () => {
      press(root, 'Add Images');
      await Promise.resolve();
    });

    expect(getContext().diagnosis.image.images).toHaveLength(0);
  });
});

describe('individual image inference', () => {
  async function renderWithImages(predictions) {
    launchImageLibrary.mockResolvedValue({
      assets: [
        { uri: 'file:///tmp/a.jpg', fileName: 'a.jpg', type: 'image/jpeg' },
        { uri: 'file:///tmp/b.jpg', fileName: 'b.jpg', type: 'image/jpeg' },
      ],
    });

    const rendered = renderImageScreen();

    await act(async () => {
      press(rendered.root, 'Add Images');
      await Promise.resolve();
    });

    predictions.forEach((value, index) => {
      if (value instanceof Error) {
        classifyImage.mockRejectedValueOnce(value);
      } else {
        classifyImage.mockResolvedValueOnce(value);
      }
    });

    await act(async () => {
      press(rendered.root, 'Analyze 2 Images');
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    return rendered;
  }

  test('classifies every image independently and stores each result', async () => {
    const { getContext, root } = await renderWithImages([
      prediction('CANCER', 0.91, 0.09),
      prediction('NON CANCER', 0.12, 0.88),
    ]);

    const images = getContext().diagnosis.image.images;

    expect(classifyImage).toHaveBeenCalledTimes(2);
    expect(classifyImage).toHaveBeenNthCalledWith(1, 'file:///tmp/a.jpg');
    expect(classifyImage).toHaveBeenNthCalledWith(2, 'file:///tmp/b.jpg');

    expect(images[0]).toMatchObject({
      status: IMAGE_STATUS.COMPLETED,
      path: expect.stringContaining('images/image-01.jpg'),
    });

    expect(images[1]).toMatchObject({
      status: IMAGE_STATUS.COMPLETED,
      path: expect.stringContaining('images/image-02.jpg'),
    });

    // Predictions are mapped per image, not combined.
    expect(images[0].result.className).toBe('CANCER');
    expect(images[0].result.probabilities.CANCER).toBeCloseTo(0.91);
    expect(images[1].result.className).toBe('NON CANCER');
    expect(images[1].result.probabilities['NON CANCER']).toBeCloseTo(0.88);

    const output = texts(root).join(' ');
    expect(output).toContain('Image 1');
    expect(output).toContain('Image 2');
    expect(output).toContain('CANCER');
  });

  test('an inference failure only affects the failing image', async () => {
    const { getContext } = await renderWithImages([
      new Error('Model crashed'),
      prediction('CANCER', 0.77, 0.23),
    ]);

    const images = getContext().diagnosis.image.images;

    expect(images[0].status).toBe(IMAGE_STATUS.FAILED);
    expect(images[0].error).toBe('Model crashed');
    expect(images[0].result).toBeNull();

    expect(images[1].status).toBe(IMAGE_STATUS.COMPLETED);
    expect(images[1].result.className).toBe('CANCER');
  });

  test('saves an individual doctor assessment and remarks per image', async () => {
    const { getContext, root } = await renderWithImages([
      prediction('CANCER', 0.9, 0.1),
      prediction('CANCER', 0.6, 0.4),
    ]);

    const cancerButtons = root
      .findAllByType('Text')
      .filter(node => flatten(node.props.children) === 'Cancer');

    // Two images -> two independent assessment controls.
    expect(cancerButtons).toHaveLength(2);

    act(() => {
      let node = cancerButtons[1].parent;

      while (node && node.type !== 'Pressable') {
        node = node.parent;
      }

      node.props.onPress();
    });

    const remarksInputs = root
      .findAllByType('TextInput')
      .filter(node => node.props.placeholder === 'Optional remarks');

    act(() => {
      remarksInputs[1].props.onChangeText('Needs biopsy');
    });

    const images = getContext().diagnosis.image.images;

    expect(images[0].doctorAssessment).toBe('');
    expect(images[1].doctorAssessment).toBe('Cancer');
    expect(images[1].doctorRemarks).toBe('Needs biopsy');
  });
});

describe('multi-image database persistence', () => {
  const diagnosis = {
    id: 'diag-multi',
    createdAt: '2024-05-01T00:00:00.000Z',
    patient: { name: 'Alice', dateOfBirth: '1990-01-01', age: 34 },
    hospitalDetails: { doctorName: 'Dr. Kim', hospitalName: 'Clinic' },
    selectedAnalyses: { image: true, audio: true },
    image: {
      images: [
        {
          id: 'img-a',
          path: '/docs/diag-multi/images/image-01.jpg',
          originalUri: 'file:///tmp/a.jpg',
          fileName: 'a.jpg',
          result: prediction('CANCER', 0.9, 0.1),
          doctorAssessment: 'Cancer',
          doctorRemarks: 'Refer',
          status: 'completed',
        },
        {
          id: 'img-b',
          path: '/docs/diag-multi/images/image-02.jpg',
          originalUri: 'file:///tmp/b.jpg',
          fileName: 'b.jpg',
          result: null,
          doctorAssessment: '',
          doctorRemarks: '',
          status: 'failed',
          error: 'Model crashed',
        },
      ],
    },
    audio: {
      path: '/docs/diag-multi/audio.wav',
      result: {
        prediction: 'Normal',
        confidence: 0.9,
        pathologyProbability: 0.1,
        normalProbability: 0.9,
      },
      doctorAssessment: 'Normal',
      doctorRemarks: '',
    },
  };

  function imageInsertCalls() {
    return mockDbExecute.mock.calls.filter(([sql]) =>
      /INSERT OR REPLACE INTO diagnosis_images/.test(sql),
    );
  }

  test('creates the normalized diagnosis_images table', async () => {
    await database.initializeDatabase();

    const sql = mockDbExecute.mock.calls.map(([statement]) => statement).join('\n');

    expect(sql).toContain('CREATE TABLE IF NOT EXISTS diagnosis_images');
    expect(sql).toContain('diagnosis_id TEXT NOT NULL');
    expect(sql).toContain('inference_status');
    expect(sql).toContain('doctor_assessment');
    expect(sql).toContain('PRAGMA user_version = 3');
  });

  test('migrates the version 2 schema in place without dropping diagnoses', async () => {
    mockSchemaVersion = 2;

    await database.initializeDatabase();

    const statements = mockDbExecute.mock.calls.map(([statement]) => statement);

    expect(statements.some(statement => /DROP TABLE/.test(statement))).toBe(
      false,
    );
    expect(statements).toContain(
      'ALTER TABLE diagnoses ADD COLUMN source TEXT',
    );
    expect(statements).toContain(
      'ALTER TABLE diagnosis_images ADD COLUMN inference_timestamp TEXT',
    );
    expect(statements).toContain(
      'ALTER TABLE diagnosis_images ADD COLUMN model_name TEXT',
    );
    expect(statements).toContain(
      'ALTER TABLE diagnosis_images ADD COLUMN model_version TEXT',
    );
    expect(statements).toContain('PRAGMA user_version = 3');
  });

  test('resets the legacy schema when the stored version is older', async () => {
    mockSchemaVersion = 1;

    await database.initializeDatabase();

    const dropped = mockDbExecute.mock.calls
      .map(([statement]) => statement)
      .filter(statement => /DROP TABLE/.test(statement));

    expect(dropped).toEqual([
      'DROP TABLE IF EXISTS diagnosis_images',
      'DROP TABLE IF EXISTS diagnoses',
    ]);
  });

  test('saves multiple image records against one diagnosis', async () => {
    await expect(database.saveDiagnosis(diagnosis)).resolves.toBe('diag-multi');

    const inserts = imageInsertCalls();

    expect(inserts).toHaveLength(2);

    const firstParams = inserts[0][1];
    const secondParams = inserts[1][1];

    expect(firstParams).toContain('img-a');
    expect(firstParams).toContain('CANCER');
    expect(firstParams).toContain('Cancer');
    expect(firstParams).toContain('completed');

    expect(secondParams).toContain('img-b');
    expect(secondParams).toContain('failed');
    expect(secondParams).toContain('Model crashed');

    const statements = mockDbExecute.mock.calls.map(([sql]) => sql);

    expect(statements).toContain('BEGIN TRANSACTION');
    expect(statements).toContain('COMMIT');
  });

  test('persists the diagnosis source and live inference metadata', async () => {
    const liveDiagnosis = {
      id: 'diag-live',
      createdAt: '2024-05-01T00:00:00.000Z',
      source: 'live_video',
      patient: {
        name: 'Live video session',
        dateOfBirth: '',
        age: 0,
      },
      selectedAnalyses: { image: true, audio: false },
      image: {
        images: [
          {
            id: 'img-live',
            path: '/docs/diag-live/images/live.jpg',
            fileName: 'live.jpg',
            result: prediction('NON CANCER', 0.2, 0.8),
            status: 'completed',
            inferenceTimestamp: '2024-05-01T10:15:00.000Z',
            modelName: 'MobileNetV3',
            modelVersion: '1.0',
          },
        ],
      },
      audio: {},
    };

    await expect(database.saveDiagnosis(liveDiagnosis)).resolves.toBe(
      'diag-live',
    );

    const diagnosisInsert = mockDbExecute.mock.calls.find(([sql]) =>
      /INSERT OR REPLACE INTO diagnoses/.test(sql),
    );

    expect(diagnosisInsert[1]).toContain('live_video');
    expect(diagnosisInsert[1]).toContain('Live video session');

    const imageInsert = imageInsertCalls()[0][1];

    expect(imageInsert).toContain('2024-05-01T10:15:00.000Z');
    expect(imageInsert).toContain('MobileNetV3');
    expect(imageInsert).toContain('1.0');
  });

  test('derives an audio source for audio-only diagnoses', async () => {
    await database.saveDiagnosis({
      id: 'diag-audio',
      patient: { name: 'Alice', dateOfBirth: '1990-01-01' },
      selectedAnalyses: { image: false, audio: true },
      image: { images: [] },
      audio: {
        path: '/docs/audio.wav',
        result: {
          prediction: 'Normal',
          confidence: 0.9,
          pathologyProbability: 0.1,
          normalProbability: 0.9,
        },
      },
    });

    const diagnosisInsert = mockDbExecute.mock.calls.find(([sql]) =>
      /INSERT OR REPLACE INTO diagnoses/.test(sql),
    );

    expect(diagnosisInsert[1]).toContain('audio_analysis');
  });

  test('retrieves all images belonging to a diagnosis', async () => {
    mockImageRows = [
      { id: 'img-a', diagnosis_id: 'diag-multi', image_order: 0 },
      { id: 'img-b', diagnosis_id: 'diag-multi', image_order: 1 },
    ];

    const rows = await database.getDiagnosisImages('diag-multi');

    expect(rows).toHaveLength(2);
    expect(rows.map(row => row.id)).toEqual(['img-a', 'img-b']);
  });

  test('returns a diagnosis together with its images', async () => {
    mockDiagnosisRows = [{ id: 'diag-multi', patient_name: 'Alice' }];
    mockImageRows = [{ id: 'img-a' }, { id: 'img-b' }];

    const result = await database.getDiagnosisWithImages('diag-multi');

    expect(result).toMatchObject({
      id: 'diag-multi',
      patient_name: 'Alice',
      image_count: 2,
    });
    expect(result.images).toHaveLength(2);
  });

  test('deletes an individual image record', async () => {
    await database.deleteDiagnosisImage('img-a');

    expect(mockDbExecute).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM diagnosis_images'),
      ['img-a'],
    );

    await expect(database.deleteDiagnosisImage(null)).rejects.toThrow(
      'Image ID is missing.',
    );
  });

  test('deletes all image records when the diagnosis is deleted', async () => {
    await database.deleteDiagnosis('diag-multi');

    const calls = mockDbExecute.mock.calls;

    expect(
      calls.some(
        ([sql, params]) =>
          /DELETE FROM diagnosis_images/.test(sql) &&
          params?.[0] === 'diag-multi',
      ),
    ).toBe(true);

    expect(
      calls.some(
        ([sql, params]) =>
          /DELETE FROM diagnoses/.test(sql) && params?.[0] === 'diag-multi',
      ),
    ).toBe(true);

    expect(calls.some(([sql]) => sql === 'COMMIT')).toBe(true);
  });

  test('saves an individual doctor assessment', async () => {
    await database.updateDiagnosisImageAssessment('img-a', {
      doctorAssessment: 'Cancer',
      doctorRemarks: 'Biopsy',
    });

    expect(mockDbExecute).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE diagnosis_images'),
      ['Cancer', 'Biopsy', 'img-a'],
    );

    await expect(
      database.updateDiagnosisImageAssessment(null, {}),
    ).rejects.toThrow('Image ID is missing.');
  });

  test('rejects a diagnosis with incomplete patient information', async () => {
    await expect(
      database.saveDiagnosis({ id: 'x', patient: {} }),
    ).rejects.toThrow('Patient details are incomplete.');
  });

  test('rolls back when a write inside the transaction fails', async () => {
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    mockDbExecute.mockImplementation(async sql => {
      if (/PRAGMA user_version/.test(sql)) {
        return { rows: { _array: [{ user_version: 2 }] } };
      }

      if (/INSERT OR REPLACE INTO diagnoses/.test(sql)) {
        throw new Error('write failed');
      }

      return { rows: { _array: [] } };
    });

    await expect(database.saveDiagnosis(diagnosis)).rejects.toThrow(
      'write failed',
    );

    expect(mockDbExecute).toHaveBeenCalledWith('ROLLBACK');

    // A failing rollback must not mask the original error.
    mockDbExecute.mockImplementation(async sql => {
      if (sql === 'BEGIN TRANSACTION') {
        return { rows: { _array: [] } };
      }

      if (sql === 'ROLLBACK') {
        throw new Error('rollback failed');
      }

      throw new Error('write failed');
    });

    await expect(database.saveDiagnosis(diagnosis)).rejects.toThrow(
      'write failed',
    );

    expect(consoleError).toHaveBeenCalled();

    consoleError.mockRestore();
  });

  test('falls back to schema version 0 when PRAGMA returns no rows', async () => {
    mockDbExecute.mockImplementation(async sql => {
      if (/PRAGMA user_version/.test(sql)) {
        return {};
      }

      return { rows: { _array: [] } };
    });

    await database.initializeDatabase();

    const statements = mockDbExecute.mock.calls.map(([sql]) => sql);

    expect(statements).toContain('DROP TABLE IF EXISTS diagnoses');
  });

  test('never resets data when the schema version cannot be read', async () => {
    const consoleWarn = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => {});

    mockDbExecute.mockImplementation(async sql => {
      if (sql.trim() === 'PRAGMA user_version') {
        throw new Error('unsupported');
      }

      return { rows: { _array: [] } };
    });

    await expect(database.initializeDatabase()).resolves.toBeUndefined();

    const statements = mockDbExecute.mock.calls.map(([sql]) => sql);

    expect(statements).not.toContain('DROP TABLE IF EXISTS diagnoses');
    expect(
      statements.some(statement =>
        /CREATE TABLE IF NOT EXISTS diagnosis_images/.test(statement),
      ),
    ).toBe(true);

    consoleWarn.mockRestore();
  });

  test('warns but continues when foreign keys cannot be enabled', async () => {    const consoleWarn = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => {});

    mockDbExecute.mockImplementation(async sql => {
      if (/PRAGMA user_version/.test(sql)) {
        return { rows: { _array: [{ user_version: 2 }] } };
      }

      if (/PRAGMA foreign_keys/.test(sql)) {
        throw new Error('not supported');
      }

      return { rows: { _array: [] } };
    });

    await expect(database.initializeDatabase()).resolves.toBeUndefined();

    expect(consoleWarn).toHaveBeenCalled();

    consoleWarn.mockRestore();
  });

  test('validates image lookups and single image writes', async () => {
    await expect(database.getDiagnosisImages(null)).rejects.toThrow(
      'Diagnosis ID is missing.',
    );

    mockDiagnosisRows = [];

    await expect(
      database.getDiagnosisWithImages('missing'),
    ).resolves.toBeNull();

    mockDiagnosisRows = [];

    await expect(database.getDiagnosisById('missing')).resolves.toBeNull();

    await expect(database.saveDiagnosisImage(null, {})).rejects.toThrow(
      'Diagnosis ID is missing.',
    );

    await expect(
      database.saveDiagnosisImage('diag', {}),
    ).rejects.toThrow('Image ID is missing.');

    await database.saveDiagnosisImage(
      'diag',
      {
        id: 'img-single',
        uri: 'file:///tmp/single.jpg',
        result: prediction('CANCER', 0.7, 0.3),
        status: 'completed',
      },
      3,
    );

    expect(mockDbExecute).toHaveBeenCalledWith(
      expect.stringContaining('INSERT OR REPLACE INTO diagnosis_images'),
      expect.arrayContaining(['img-single', 'diag', 3]),
    );

    await expect(database.deleteDiagnosis(null)).rejects.toThrow(
      'Diagnosis ID is missing.',
    );
  });
});

describe('multi-image PDF report', () => {
  function imageEntry(index, className) {
    return {
      id: `img-${index}`,
      path: `/docs/diag/images/image-0${index}.jpg`,
      fileName: `image-0${index}.jpg`,
      result:
        className === 'CANCER'
          ? prediction('CANCER', 0.9, 0.1)
          : prediction('NON CANCER', 0.2, 0.8),
      doctorAssessment: className === 'CANCER' ? 'Cancer' : 'Non Cancer',
      doctorRemarks: `Remark ${index}`,
      status: 'completed',
    };
  }

  function htmlOfLastCall() {
    const generatePDF = require('react-native-html-to-pdf').generatePDF;

    const calls = generatePDF.mock.calls;

    return calls[calls.length - 1][0].html;
  }

  test('renders a separate section for every analyzed image', async () => {
    const filePath = await reportGenerator.generateReport({
      patient: {
        name: 'Alice',
        dateOfBirth: '1990-01-01',
        gender: 'Female',
        city: 'Boston',
        state: 'MA',
        country: 'USA',
      },
      hospitalDetails: { doctorName: 'Dr. Kim', hospitalName: 'Clinic' },
      selectedAnalyses: { image: true, audio: true },
      image: {
        images: [
          imageEntry(1, 'CANCER'),
          imageEntry(2, 'NON CANCER'),
          imageEntry(3, 'CANCER'),
        ],
      },
      audio: {
        result: {
          prediction: 'Normal',
          confidence: 0.8,
          pathologyProbability: 0.2,
          normalProbability: 0.8,
        },
        doctorAssessment: 'Normal',
        doctorRemarks: 'Stable',
      },
    });

    expect(filePath).toBe('/tmp/report.pdf');

    const html = htmlOfLastCall();

    expect(html).toContain('IMAGE ANALYSIS (3 IMAGES)');
    expect(html).toContain('Image 1');
    expect(html).toContain('Image 2');
    expect(html).toContain('Image 3');

    expect(html).toContain('image-01.jpg');
    expect(html).toContain('image-02.jpg');
    expect(html).toContain('image-03.jpg');

    expect(html).toContain('Remark 1');
    expect(html).toContain('Remark 2');
    expect(html).toContain('Remark 3');

    // Audio section is preserved.
    expect(html).toContain('VOICE ANALYSIS');
    expect(html).toContain('Normal');

    // Medical disclaimer is preserved.
    expect(html).toContain('not a medical diagnosis');

    // Multi-page safety.
    expect(html).toContain('page-break-inside: avoid');

    // Patient / hospital details.
    expect(html).toContain('Alice');
    expect(html).toContain('Dr. Kim');
    expect(html).toContain('Boston');
  });

  test('renders image-left and prediction/comments-right without image probability bars', async () => {
    await reportGenerator.generateReport({
      patient: {
        name: 'Alice',
        dateOfBirth: '1990-01-01',
      },
      hospitalDetails: { doctorName: 'Dr. Kim', hospitalName: 'Clinic' },
      selectedAnalyses: { image: true },
      source: 'live_video',
      image: {
        images: [
          {
            ...imageEntry(1, 'CANCER'),
            inferenceTimestamp: '2026-10-31T12:30:05.000Z',
            modelName: 'MobileNetV3',
            modelVersion: '1.0',
          },
        ],
      },
    });

    const html = htmlOfLastCall();

    const imageSection = html.split('IMAGE MODEL INFORMATION')[0];

    expect(imageSection).toContain('Live Video Detection');
    expect(imageSection).toContain('AI prediction');
    expect(imageSection).toContain('MobileNetV3');
    expect(imageSection).toContain('Inference');
    expect(imageSection).not.toContain('class="bar-row"');

    const layout = imageSection.indexOf('class="image-layout"');
    const imageColumn = imageSection.indexOf('class="image-column"');
    const imageDetails = imageSection.indexOf('class="image-details"');

    expect(layout).toBeGreaterThan(-1);
    expect(imageColumn).toBeGreaterThan(layout);
    expect(imageDetails).toBeGreaterThan(imageColumn);
  });

  test('handles failed images without dropping the rest of the report', async () => {
    await reportGenerator.generateReport({
      patient: { name: 'Bob', dateOfBirth: '1980-01-01' },
      selectedAnalyses: { image: true },
      image: {
        images: [
          imageEntry(1, 'CANCER'),
          {
            id: 'img-2',
            path: '/docs/diag/images/image-02.jpg',
            fileName: 'image-02.jpg',
            result: null,
            status: 'failed',
            error: 'Inference crashed',
            doctorAssessment: '',
            doctorRemarks: '',
          },
        ],
      },
    });

    const html = htmlOfLastCall();

    expect(html).toContain('Inference failed');
    expect(html).toContain('Inference crashed');
    expect(html).toContain('Image 1');
  });

  test('reportService supports image-only, audio-only and combined diagnoses', async () => {
    const base = {
      patient: { name: 'Carol', dateOfBirth: '1975-05-05' },
      hospitalDetails: { doctorName: 'Dr. Who', hospitalName: 'Clinic' },
    };

    await expect(
      reportService.createDiagnosisReport({
        ...base,
        selectedAnalyses: { image: true, audio: false },
        image: { images: [imageEntry(1, 'CANCER')] },
        audio: { result: null },
      }),
    ).resolves.toBe('/tmp/report.pdf');

    await expect(
      reportService.createDiagnosisReport({
        ...base,
        selectedAnalyses: { image: false, audio: true },
        image: { images: [] },
        audio: {
          result: {
            prediction: 'Normal',
            confidence: 0.7,
            pathologyProbability: 0.3,
            normalProbability: 0.7,
          },
        },
      }),
    ).resolves.toBe('/tmp/report.pdf');

    await expect(
      reportService.createDiagnosisReport({
        ...base,
        selectedAnalyses: { image: true, audio: true },
        image: { images: [imageEntry(1, 'NON CANCER')] },
        audio: {
          result: {
            prediction: 'Vocal Pathology',
            confidence: 0.6,
            pathologyProbability: 0.6,
            normalProbability: 0.4,
          },
        },
      }),
    ).resolves.toBe('/tmp/report.pdf');

    await expect(
      reportService.createDiagnosisReport({
        ...base,
        selectedAnalyses: { image: true, audio: true },
        image: { images: [] },
        audio: { result: null },
      }),
    ).rejects.toThrow('No valid analysis results available.');
  });
});

describe('multi-image ZIP export', () => {
  test('exports every image, the report, the audio and the metadata', async () => {
    const diagnoseRow = {
      id: 'diag-export',
      patient_name: 'Alice',
      image_selected: 1,
      audio_selected: 1,
      audio_path: '/docs/diag-export/audio/recording.wav',
      report_path: '/docs/diag-export/report.pdf',
    };

    jest
      .spyOn(database, 'getAllDiagnoses')
      .mockResolvedValueOnce([diagnoseRow]);

    jest.spyOn(database, 'getDiagnosisImages').mockResolvedValueOnce([
      {
        id: 'img-1',
        image_path: '/docs/diag-export/images/image-01.jpg',
        image_prediction: 'CANCER',
        doctor_assessment: 'Cancer',
        doctor_remarks: 'Refer',
        inference_status: 'completed',
      },
      {
        id: 'img-2',
        image_path: '/docs/diag-export/images/image-02.png',
        image_prediction: 'NON CANCER',
        doctor_assessment: 'Non Cancer',
        doctor_remarks: '',
        inference_status: 'completed',
      },
    ]);

    const result = await exportService.exportAllData();

    expect(result).toMatch(/OSCC_Export_.*\.zip$/);

    const copiedTo = RNFS.copyFile.mock.calls.map(([, destination]) => destination);

    expect(copiedTo).toContain(
      '/cache/OSCC_Export/diag-export/images/image-01.jpg',
    );
    expect(copiedTo).toContain(
      '/cache/OSCC_Export/diag-export/images/image-02.png',
    );
    expect(copiedTo).toContain(
      '/cache/OSCC_Export/diag-export/audio/recording.wav',
    );
    expect(copiedTo).toContain('/cache/OSCC_Export/diag-export/report.pdf');

    const metadataWrite = RNFS.writeFile.mock.calls.find(
      ([path]) => path === '/cache/OSCC_Export/diag-export/diagnosis.json',
    );

    expect(metadataWrite).toBeTruthy();

    const payload = JSON.parse(metadataWrite[1]);

    expect(payload.images).toHaveLength(2);
    expect(payload.image_count).toBe(2);
    expect(payload.images[0].image_prediction).toBe('CANCER');
    expect(payload.images[1].doctor_assessment).toBe('Non Cancer');
  });

  test('exports a diagnosis that only contains audio', async () => {
    jest.spyOn(database, 'getAllDiagnoses').mockResolvedValueOnce([
      {
        id: 'diag-audio',
        audio_path: '/docs/diag-audio/audio.wav',
        report_path: null,
      },
    ]);

    jest.spyOn(database, 'getDiagnosisImages').mockResolvedValueOnce([]);

    await exportService.exportAllData();

    const copiedTo = RNFS.copyFile.mock.calls.map(([, destination]) => destination);

    expect(copiedTo).toContain(
      '/cache/OSCC_Export/diag-audio/audio/recording.wav',
    );
  });
});
