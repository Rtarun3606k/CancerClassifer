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

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(null),
  },
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

jest.mock('react-native-html-to-pdf', () => ({
  __esModule: true,
  generatePDF: jest.fn(),
}));

jest.mock('react-native-image-resizer', () => ({
  __esModule: true,
  default: { createResizedImage: jest.fn() },
}));

jest.mock('react-native-nitro-sqlite', () => ({
  open: jest.fn(),
}));

jest.mock('react-native-zip-archive', () => ({
  zip: jest.fn(),
}));

jest.mock('react-native', () => {
  const React = require('react');
  const element =
    name =>
    ({ children, ...props }) =>
      React.createElement(name, props, children);

  return {
    SafeAreaView: element('SafeAreaView'),
    View: element('View'),
    Text: element('Text'),
    Button: element('Button'),
    Image: element('Image'),
    ActivityIndicator: element('ActivityIndicator'),
    StatusBar: element('StatusBar'),
    StyleSheet: { create: styles => styles },
    Alert: { alert: jest.fn() },
    NativeModules: {
      AndroidTheme: {
        getTheme: jest.fn().mockResolvedValue({
          isDark: false,
          primary: 0xff112233,
          secondary: 0xff445566,
          tertiary: 0xff778899,
          background: 0xff99aabb,
          onBackground: 0xffccbbaa,
          error: 0xff0000ff,
        }),
      },
      ONNXModel: {
        getAudioModelPath: jest.fn().mockResolvedValue('/tmp/audio_model.onnx'),
      },
    },
  };
});

jest.mock('react-native-image-picker', () => ({
  launchImageLibrary: jest.fn(),
}));

jest.mock('../src/ml/model', () => ({
  classifyImage: jest.fn(),
}));

jest.mock('../src/services/database', () => ({
  initializeDatabase: jest.fn().mockResolvedValue(),
}));

jest.mock('../src/Onboarding', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../src/screens/PatientDetailsScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../src/screens/ImageAnalysisScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../src/screens/AudioAnalysisScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../src/screens/AnalysisSelectionScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../src/screens/HistoryScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../src/screens/HomeScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../src/screens/DisclaimerScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../src/components/AppHeader', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../src/screens/ResultsScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../src/screens/DiagnosisDetailsScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../src/screens/LiveVideoScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../src/screens/AuthScreen', () => ({
  __esModule: true,
  default: () => null,
}));

const React = require('react');
const ReactTestRenderer = require('react-test-renderer');
const App = require('../App').default;

test('renders the main app shell', async () => {
  let root;
  await ReactTestRenderer.act(async () => {
    root = ReactTestRenderer.create(React.createElement(App));
  });

  expect(root).toBeTruthy();
});
