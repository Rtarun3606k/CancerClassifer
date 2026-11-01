jest.mock('onnxruntime-react-native', () => ({
  __esModule: true,
  InferenceSession: {
    create: jest.fn().mockResolvedValue({
      inputNames: ['input'],
      outputNames: ['output'],
    }),
  },
  Tensor: jest.fn((type, data, dims) => ({ type, data, dims })),
}));

jest.mock('react-native-date-picker', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('react-native-fs', () => ({
  __esModule: true,
  default: {
    CachesDirectoryPath: '/tmp',
    exists: jest.fn().mockResolvedValue(true),
    copyFile: jest.fn().mockResolvedValue(),
  },
}));

jest.mock('@react-native-documents/picker', () => ({
  pick: jest.fn().mockResolvedValue([]),
  types: { audio: 'audio' },
}));

jest.mock('react-native-audio-record', () => ({
  __esModule: true,
  default: {
    startRecording: jest.fn(),
    stopRecording: jest.fn(),
  },
}));

jest.mock('react-native', () => {
  const React = require('react');
  const element =
    name =>
    ({ children, ...props }) =>
      React.createElement(name, props, children);

  return {
    View: element('View'),
    Text: element('Text'),
    Image: element('Image'),
    Pressable: element('Pressable'),
    ScrollView: element('ScrollView'),
    TextInput: element('TextInput'),
    ActivityIndicator: element('ActivityIndicator'),
    StyleSheet: { create: styles => styles },
    Alert: { alert: jest.fn() },
    NativeModules: {
      SharePdf: { open: jest.fn(), share: jest.fn(), openAudio: jest.fn() },
      AndroidTheme: { getTheme: jest.fn() },
      Auth: {
        canAuthenticate: jest.fn().mockResolvedValue(true),
        authenticate: jest.fn().mockResolvedValue(true),
        hasPassword: jest.fn().mockResolvedValue(false),
        setPassword: jest.fn().mockResolvedValue(true),
        verifyPassword: jest.fn().mockResolvedValue(true),
      },
      ONNXModel: {
        getAudioModelPath: jest.fn().mockResolvedValue('/tmp/audio_model.onnx'),
      },
    },
  };
});

jest.mock('../../src/context/DiagnosisContext', () => ({
  useDiagnosis: jest.fn(),
}));

jest.mock('../../src/services/database', () => ({
  getAllDiagnoses: jest.fn(),
  getDiagnosisById: jest.fn(),
  getDiagnosisWithImages: jest.fn(),
  getDiagnosisImages: jest.fn().mockResolvedValue([]),
  deleteDiagnosis: jest.fn(),
}));

jest.mock('../../src/services/diagnosisStorage', () => ({
  deleteDiagnosisFolder: jest.fn(),
}));

jest.mock('../../src/services/exportService', () => ({
  exportAllData: jest.fn(),
}));

jest.mock('../../src/services/authService', () => ({
  authenticateWithDevice: jest.fn(),
  canUseDeviceAuthentication: jest.fn(),
  hasPassword: jest.fn(),
  setPassword: jest.fn(),
  verifyPassword: jest.fn(),
}));

jest.mock('../../oralscan.png', () => 'mocked-image');

const React = require('react');
const { create, act } = require('react-test-renderer');
const { Alert, NativeModules } = require('react-native');

const { useDiagnosis } = require('../../src/context/DiagnosisContext');
const AnalysisSelectionScreen =
  require('../../src/screens/AnalysisSelectionScreen').default;
const AuthScreen = require('../../src/screens/AuthScreen').default;
const DiagnosisDetailsScreen =
  require('../../src/screens/DiagnosisDetailsScreen').default;
const HistoryScreen = require('../../src/screens/HistoryScreen').default;
const HomeScreen = require('../../src/screens/HomeScreen').default;
const database = require('../../src/services/database');
const authService = require('../../src/services/authService');

describe('screen renders', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    NativeModules.SharePdf = {
      open: jest.fn(),
      share: jest.fn(),
      openAudio: jest.fn(),
    };
    NativeModules.AndroidTheme = { getTheme: jest.fn() };
    NativeModules.Auth = {
      canAuthenticate: jest.fn().mockResolvedValue(true),
      authenticate: jest.fn().mockResolvedValue(true),
      hasPassword: jest.fn().mockResolvedValue(false),
      setPassword: jest.fn().mockResolvedValue(true),
      verifyPassword: jest.fn().mockResolvedValue(true),
    };
    Alert.alert = jest.fn();
  });

  test('AnalysisSelectionScreen renders the selection view', () => {
    useDiagnosis.mockReturnValue({
      setSelectedAnalyses: jest.fn(),
      setHospitalDetails: jest.fn(),
    });

    const colors = {
      background: '#ffffff',
      primary: '#123456',
      onBackground: '#111111',
      onSurfaceVariant: '#333333',
      surface: '#eeeeee',
      surfaceContainer: '#f5f5f5',
      surfaceContainerLow: '#f8f8f8',
      surfaceContainerHighest: '#dddddd',
      outlineVariant: '#cccccc',
      onSurface: '#222222',
      onPrimary: '#ffffff',
      outline: '#bbbbbb',
    };

    let component;
    act(() => {
      component = create(
        React.createElement(AnalysisSelectionScreen, {
          colors,
          onStart: jest.fn(),
          onBack: jest.fn(),
        }),
      );
    });

    const textValues = component.root
      .findAllByType('Text')
      .map(node => node.props.children);
    expect(textValues.join(' ')).toContain('Choose analysis');
    expect(textValues.join(' ')).toContain('Image Analysis');
  });

  test('HomeScreen renders patient details', () => {
    useDiagnosis.mockReturnValue({
      diagnosis: {
        patient: {
          name: 'Alice Smith',
          dateOfBirth: '1990-06-15',
          gender: 'Female',
          city: 'Boston',
          state: 'MA',
          country: 'USA',
        },
        image: { result: { className: 'CANCER', probability: 0.91 } },
        audio: { result: { prediction: 'Normal' } },
      },
      startNewDiagnosis: jest.fn(() => 'diag-001'),
    });

    const colors = {
      background: '#ffffff',
      primary: '#123456',
      onPrimary: '#ffffff',
      primaryContainer: '#eff6ff',
      onPrimaryContainer: '#111111',
      surface: '#f6f6f6',
      outlineVariant: '#d0d0d0',
      onSurface: '#111111',
      onSurfaceVariant: '#555555',
    };

    let component;
    act(() => {
      component = create(
        React.createElement(HomeScreen, {
          colors,
          onImage: jest.fn(),
          onAudio: jest.fn(),
          onStartDiagnosis: jest.fn(),
          onHistory: jest.fn(),
        }),
      );
    });

    const textValues = component.root
      .findAllByType('Text')
      .map(node => node.props.children);
    expect(textValues.join(' ')).toContain('Alice Smith');
    expect(textValues.join(' ')).toContain('Analysis');
  });

  test('HistoryScreen renders the history and export button', async () => {
    database.getAllDiagnoses.mockResolvedValue([
      {
        id: 'diag-1',
        patient_name: 'Jane Doe',
        image_selected: 1,
        audio_selected: 0,
        report_path: null,
      },
    ]);

    const colors = {
      background: '#ffffff',
      primary: '#123456',
      onPrimary: '#ffffff',
      onSurfaceVariant: '#555555',
      onBackground: '#111111',
      onSurface: '#222222',
      surface: '#f4f4f4',
      outlineVariant: '#d0d0d0',
    };

    let component;
    await act(async () => {
      component = create(
        React.createElement(HistoryScreen, {
          colors,
          onBack: jest.fn(),
          onSelectDiagnosis: jest.fn(),
        }),
      );
      await Promise.resolve();
    });

    const textValues = component.root
      .findAllByType('Text')
      .map(node => node.props.children);
    expect(textValues.join(' ')).toContain('History');
    expect(textValues.join(' ')).toContain('Export Data');
  });

  test('HistoryScreen labels live records with thumbnail and prediction', async () => {
    database.getAllDiagnoses.mockResolvedValue([
      {
        id: 'live-1',
        patient_name: 'Live video session',
        created_at: '2026-10-31T12:30:05.000Z',
        source: 'live_video',
        image_selected: 1,
        audio_selected: 0,
        image_count: 1,
        thumbnail_path: '/tmp/live.jpg',
        primary_image_prediction: 'CANCER',
        primary_image_confidence: 0.91,
        report_path: null,
      },
    ]);

    const colors = {
      background: '#ffffff',
      primary: '#123456',
      onPrimary: '#ffffff',
      onSurfaceVariant: '#555555',
      onBackground: '#111111',
      onSurface: '#222222',
      surface: '#f4f4f4',
      outlineVariant: '#d0d0d0',
      primaryContainer: '#eff6ff',
      onPrimaryContainer: '#111111',
    };

    let component;
    await act(async () => {
      component = create(
        React.createElement(HistoryScreen, {
          colors,
          onBack: jest.fn(),
          onSelectDiagnosis: jest.fn(),
        }),
      );
      await Promise.resolve();
    });

    const textValues = component.root
      .findAllByType('Text')
      .map(node => node.props.children);

    expect(textValues.join(' ')).toContain('Live Video Detection');
    expect(textValues.join(' ')).toContain('Cancer · 91.0%');

    const thumbnail = component.root.findByProps({
      accessibilityLabel: 'Live detection thumbnail',
    });

    expect(thumbnail.props.source.uri).toBe('file:///tmp/live.jpg');
  });

  test('DiagnosisDetailsScreen renders live metadata and AI notice', async () => {
    database.getDiagnosisWithImages.mockResolvedValue({
      id: 'live-1',
      created_at: '2026-10-31T12:30:05.000Z',
      source: 'live_video',
      patient_name: 'Live video session',
      date_of_birth: '',
      image_selected: 1,
      audio_selected: 0,
      report_path: null,
      images: [
        {
          id: 'img-live',
          image_path: '/tmp/live.jpg',
          image_prediction: 'CANCER',
          image_confidence: 0.91,
          image_cancer_probability: 0.91,
          image_non_cancer_probability: 0.09,
          inference_status: 'completed',
          inference_timestamp: '2026-10-31T12:30:05.000Z',
          model_name: 'MobileNetV3',
          model_version: '1.0',
        },
      ],
    });

    const colors = {
      background: '#ffffff',
      primary: '#123456',
      onPrimary: '#ffffff',
      onBackground: '#111111',
      onSurface: '#222222',
      onSurfaceVariant: '#555555',
      surface: '#f4f4f4',
      outlineVariant: '#d0d0d0',
      outline: '#c9c9c9',
      primaryContainer: '#eff6ff',
      onPrimaryContainer: '#111111',
    };

    let component;
    await act(async () => {
      component = create(
        React.createElement(DiagnosisDetailsScreen, {
          colors,
          diagnosisId: 'live-1',
          onBack: jest.fn(),
        }),
      );
      await Promise.resolve();
    });

    const textValues = component.root
      .findAllByType('Text')
      .map(node => node.props.children)
      .join(' ');

    expect(textValues).toContain('Live Video Detection');
    expect(textValues).toContain('AI-generated live video prediction');
    expect(textValues).toContain('MobileNetV3 · 1.0');
    expect(textValues).toContain('Inference time');
  });

  test('DiagnosisDetailsScreen renders diagnosis details', async () => {
    database.getDiagnosisWithImages.mockResolvedValue({
      id: 'diag-1',
      created_at: '2024-05-01T00:00:00.000Z',
      patient_name: 'Jane Doe',
      date_of_birth: '1995-02-01',
      gender: 'Female',
      age_at_diagnosis: 29,
      doctor_name: 'Dr. Lee',
      hospital_name: 'City Clinic',
      image_selected: 1,
      audio_selected: 0,
      report_path: '/tmp/report.pdf',
      images: [
        {
          id: 'img-1',
          image_order: 0,
          image_path: '/tmp/image.jpg',
          image_prediction: 'CANCER',
          image_confidence: 0.9,
          image_cancer_probability: 0.9,
          image_non_cancer_probability: 0.1,
          doctor_assessment: 'Cancer',
          doctor_remarks: 'Refer to specialist',
          inference_status: 'completed',
        },
        {
          id: 'img-2',
          image_order: 1,
          image_path: '/tmp/image2.jpg',
          image_prediction: 'NON CANCER',
          image_confidence: 0.8,
          image_cancer_probability: 0.2,
          image_non_cancer_probability: 0.8,
          doctor_assessment: 'Non Cancer',
          doctor_remarks: '',
          inference_status: 'completed',
        },
      ],
    });

    const colors = {
      background: '#ffffff',
      primary: '#123456',
      onPrimary: '#ffffff',
      onBackground: '#111111',
      onSurface: '#222222',
      onSurfaceVariant: '#555555',
      surface: '#f4f4f4',
      outlineVariant: '#d0d0d0',
      outline: '#c9c9c9',
    };

    let component;
    await act(async () => {
      component = create(
        React.createElement(DiagnosisDetailsScreen, {
          colors,
          diagnosisId: 'diag-1',
          onBack: jest.fn(),
        }),
      );
      await Promise.resolve();
    });

    const textValues = component.root
      .findAllByType('Text')
      .map(node => node.props.children);
    expect(textValues.join(' ')).toContain('Diagnosis Details');
    expect(textValues.join(' ')).toContain('Jane Doe');
    expect(textValues.join(' ')).toContain('Dr. Lee');
  });

  test('AuthScreen renders the auth screen when device auth is unavailable', async () => {
    authService.canUseDeviceAuthentication.mockResolvedValue(false);
    authService.hasPassword.mockResolvedValue(false);

    const colors = {
      background: '#ffffff',
      primary: '#123456',
      onPrimary: '#ffffff',
      onBackground: '#111111',
      onSurfaceVariant: '#555555',
    };

    let component;
    await act(async () => {
      component = create(
        React.createElement(AuthScreen, {
          colors,
          onAuthenticated: jest.fn(),
        }),
      );
      await Promise.resolve();
    });

    const textValues = component.root
      .findAllByType('Text')
      .map(node => node.props.children);
    expect(textValues.join(' ')).toContain('OSCC');
  });
});
