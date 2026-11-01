var mockAppStateListener = null;
var mockBackHandlerListener = null;

jest.mock('react-native', () => {
  const React = require('react');

  const element = name => {
    const MockElement = ({ children, ...props }) =>
      React.createElement(name, props, children);

    MockElement.displayName = `Mock${name}`;

    return MockElement;
  };

  const Modal = ({ visible, children }) =>
    visible ? React.createElement('Modal', null, children) : null;

  Modal.displayName = 'MockModal';

  return {
    View: element('View'),
    Text: element('Text'),
    Image: element('Image'),
    Pressable: element('Pressable'),
    ScrollView: element('ScrollView'),
    ActivityIndicator: element('ActivityIndicator'),
    Modal,
    StyleSheet: {
      create: styles => styles,
      absoluteFill: { position: 'absolute' },
    },
    AppState: {
      currentState: 'active',
      addEventListener: jest.fn((event, listener) => {
        mockAppStateListener = listener;
        globalThis.__appStateListener = listener;

        return {
          remove: jest.fn(),
        };
      }),
    },
    BackHandler: {
      addEventListener: jest.fn((event, listener) => {
        mockBackHandlerListener = listener;
        globalThis.__backHandlerListener = listener;

        return {
          remove: jest.fn(),
        };
      }),
    },
    Linking: {
      openSettings: jest.fn().mockResolvedValue(undefined),
    },
  };
});

jest.mock('react-native-vision-camera', () => {
  const React = require('react');

  const MockCamera = props => React.createElement('Camera', props);
  MockCamera.displayName = 'MockCamera';

  return {
    Camera: MockCamera,
    useCameraPermission: () => globalThis.__cameraPermission,
    useCameraDevice: () => globalThis.__cameraDevice,
  };
});

jest.mock('../src/ml/liveInference', () => {
  const AI_STATUS = {
    OFF: 'off',
    LOADING: 'loading',
    READY: 'ready',
    ANALYZING: 'analyzing',
    PAUSED: 'paused',
    ERROR: 'error',
  };

  function createEmptyStats() {
    return {
      processed: 0,
      dropped: 0,
      lastDurationMs: 0,
      averageDurationMs: 0,
      actualHz: 0,
      lastCompletedAt: null,
    };
  }

  class MockLiveInferenceEngine {
    constructor(options) {
      this.options = options;
      this.start = jest.fn(async () => {
        options.onStatus(AI_STATUS.READY);
      });
      this.stop = jest.fn();
      globalThis.__liveEngine = this;
    }
  }

  return {
    AI_STATUS,
    LiveInferenceEngine: MockLiveInferenceEngine,
    createEmptyStats,
  };
});

jest.mock('../src/services/liveSessionStore', () => {
  const POSITIVE_SAVE_INTERVAL_MS = 3000;

  return {
    POSITIVE_SAVE_INTERVAL_MS,
    MAX_POSITIVES_PER_SESSION: 30,
    createLiveSessionId: jest.fn(() => {
      globalThis.__sessionCounter += 1;

      return `live-test-${globalThis.__sessionCounter}`;
    }),
    loadLiveSessions: jest.fn(async () =>
      (globalThis.__liveSessions || []).map(session => ({
        ...session,
        positives: session.positives.map(item => ({ ...item })),
      })),
    ),
    startLiveSession: jest.fn(async (sessionId, startedAt) => {
      if (globalThis.__failStartSession) {
        throw globalThis.__failStartSession;
      }

      let session = globalThis.__liveSessions.find(
        item => item.id === sessionId,
      );

      if (!session) {
        session = {
          id: sessionId,
          startedAt: startedAt ?? Date.now(),
          updatedAt: startedAt ?? Date.now(),
          positives: [],
        };
        globalThis.__liveSessions.unshift(session);
      }

      return {
        ...session,
        positives: session.positives.map(item => ({ ...item })),
      };
    }),
    saveLivePositive: jest.fn(
      async ({ sessionId, frameBuffer, prediction, capturedAt }) => {
        if (globalThis.__failSavePositive) {
          throw globalThis.__failSavePositive;
        }

        if (globalThis.__saveLimit) {
          return null;
        }

        const session = globalThis.__liveSessions.find(
          item => item.id === sessionId,
        );

        if (!session) {
          throw new Error('Live session not found.');
        }

        const item = {
          id: `case-${capturedAt}`,
          capturedAt,
          className: prediction.className,
          confidence: prediction.probability,
          probabilities: prediction.probabilities,
          imagePath: `/tmp/${capturedAt}.jpg`,
          frameBuffer,
        };

        session.positives = [item, ...session.positives];

        return item;
      },
    ),
  };
});

jest.mock('../src/services/liveHistory', () => ({
  saveLiveDiagnosisToHistory: jest.fn(async () => ({
    diagnosisId: globalThis.__historyDiagnosisId || 'diag-live-test',
    imagePath: '/documents/OralScan/diagnoses/diag-live-test/images/live.jpg',
  })),
}));

jest.mock('../src/context/DiagnosisContext', () => ({
  useDiagnosis: () => globalThis.__diagnosisContext,
}));

const React = require('react');
const { create, act } = require('react-test-renderer');
const { AppState, Linking } = require('react-native');

const LiveVideoScreen =
  require('../src/screens/LiveVideoScreen').default;
const HomeScreen = require('../src/screens/HomeScreen').default;
const {
  saveLivePositive,
  startLiveSession,
} = require('../src/services/liveSessionStore');
const {
  saveLiveDiagnosisToHistory,
} = require('../src/services/liveHistory');

const colors = {
  background: '#ffffff',
  primary: '#1b6b3a',
  tertiary: '#8a5a00',
  onBackground: '#111111',
  surface: '#f7f7f7',
  surfaceContainer: '#eeeeee',
  surfaceContainerLow: '#fafafa',
  surfaceContainerHighest: '#dddddd',
  surfaceContainerHighestColor: '#dddddd',
  onSurface: '#222222',
  onSurfaceVariant: '#555555',
  outline: '#bbbbbb',
  outlineVariant: '#cccccc',
  primaryContainer: '#d9f2e2',
  onPrimary: '#ffffff',
  onPrimaryContainer: '#12351e',
  error: '#b3261e',
  errorContainer: '#f9dedc',
  onErrorContainer: '#410e0b',
};

function textParts(value) {
  if (value === null || value === undefined) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap(textParts);
  }

  if (typeof value === 'string' || typeof value === 'number') {
    return [String(value)];
  }

  return [];
}

function instance(root) {
  return root.root ?? root;
}

function hasText(root, expected) {
  return instance(root)
    .findAllByType('Text')
    .some(node =>
      textParts(node.props.children).join('').includes(expected),
    );
}

function button(root, label) {
  return instance(root).findByProps({
    accessibilityLabel: label,
  });
}

function cameraViews(root) {
  return instance(root).findAllByType('Camera');
}

function makePermission(overrides = {}) {
  return {
    hasPermission: true,
    canRequestPermission: false,
    requestPermission: jest.fn().mockResolvedValue(true),
    ...overrides,
  };
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

async function renderScreen(overrides = {}) {
  let root;

  await act(async () => {
    root = create(
      React.createElement(LiveVideoScreen, {
        colors,
        onBack: jest.fn(),
        ...overrides,
      }),
    );
    await flush();
  });

  return root;
}

async function updateScreen(root, overrides = {}) {
  await act(async () => {
    root.update(
      React.createElement(LiveVideoScreen, {
        colors,
        onBack: jest.fn(),
        ...overrides,
      }),
    );
    await flush();
  });
}

async function activatePreview(root) {
  if (cameraViews(root).length === 0) {
    await act(async () => {
      button(root, 'Start camera').props.onPress();
      await flush();
    });
  }

  act(() => {
    cameraViews(root)[0].props.onPreviewStarted();
  });
}

async function startInference(root) {
  await act(async () => {
    button(root, 'Start inference').props.onPress();
    await flush();
  });
}

async function startCameraAndInference(root) {
  await activatePreview(root);
  await startInference(root);
}

function makeResult(overrides = {}) {
  const timestamp = overrides.timestamp ?? Date.now();

  return {
    classIndex: 0,
    className: 'CANCER',
    probability: 0.82,
    probabilities: {
      CANCER: 0.82,
      'NON CANCER': 0.18,
    },
    logits: [1.5, -0.2],
    durationMs: 123,
    timestamp,
    ...overrides,
  };
}

async function reportResult(result) {
  await act(async () => {
    globalThis.__liveEngine.options.onResult(result);
    await flush();
  });
}

describe('LiveVideoScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAppStateListener = null;
    mockBackHandlerListener = null;
    AppState.currentState = 'active';

    globalThis.__appStateListener = null;
    globalThis.__backHandlerListener = null;
    globalThis.__liveEngine = null;
    globalThis.__cameraDevice = {
      id: 'back-camera',
      position: 'back',
    };
    globalThis.__cameraPermission = makePermission();
    globalThis.__liveSessions = [];
    globalThis.__sessionCounter = 0;
    globalThis.__failStartSession = null;
    globalThis.__failSavePositive = null;
    globalThis.__saveLimit = false;
    globalThis.__historyDiagnosisId = null;
    globalThis.__diagnosisContext = {
      diagnosis: {
        patient: {
          name: 'Alice Smith',
          dateOfBirth: '1990-06-15',
          gender: 'Female',
          country: 'India',
          state: 'Kerala',
          city: 'Kochi',
        },
        hospitalDetails: {
          doctorName: 'Dr. Lee',
          hospitalName: 'City Clinic',
        },
        image: { images: [] },
        audio: {},
      },
    };
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('auto-starts a full-screen preview but leaves inference off', async () => {
    const root = await renderScreen();

    expect(hasText(root, 'Live detection')).toBe(true);
    expect(cameraViews(root)).toHaveLength(1);
    expect(hasText(root, 'Starting camera')).toBe(true);
    expect(hasText(root, 'AI off')).toBe(true);
    expect(hasText(root, 'Waiting for frames')).toBe(true);
    expect(hasText(root, 'Start inference')).toBe(true);
    expect(button(root, 'Start inference').props.disabled).toBe(true);
    expect(hasText(root, 'Show inference stats')).toBe(false);
    expect(
      hasText(
        root,
        'Experimental AI-assisted screening. Results are generated for research and testing purposes only and are not a medical diagnosis.',
      ),
    ).toBe(true);

    act(() => {
      cameraViews(root)[0].props.onPreviewStarted();
    });

    expect(hasText(root, 'Camera live')).toBe(true);
    expect(button(root, 'Start inference').props.disabled).toBe(false);
    expect(globalThis.__liveEngine.start).not.toHaveBeenCalled();
    expect(startLiveSession).not.toHaveBeenCalled();
  });

  test('requests camera permission automatically when undecided', async () => {
    const permission = makePermission({
      hasPermission: false,
      canRequestPermission: true,
      requestPermission: jest.fn(async () => {
        permission.hasPermission = true;

        return true;
      }),
    });

    globalThis.__cameraPermission = permission;

    const root = await renderScreen();

    expect(permission.requestPermission).toHaveBeenCalledTimes(1);
    expect(cameraViews(root)).toHaveLength(1);
    expect(hasText(root, 'Starting camera')).toBe(true);
  });

  test('shows a permission-denied state with a retry action', async () => {
    const permission = makePermission({
      hasPermission: false,
      canRequestPermission: true,
      requestPermission: jest.fn().mockResolvedValue(false),
    });

    globalThis.__cameraPermission = permission;

    const root = await renderScreen();

    expect(hasText(root, 'Permission needed')).toBe(true);
    expect(hasText(root, 'Camera permission needed')).toBe(true);
    expect(hasText(root, 'Camera permission was denied')).toBe(true);
    expect(button(root, 'Grant camera permission')).toBeTruthy();
    expect(cameraViews(root)).toHaveLength(0);
  });

  test('opens Android settings when permission is permanently blocked', async () => {
    const permission = makePermission({
      hasPermission: false,
      canRequestPermission: false,
    });

    globalThis.__cameraPermission = permission;

    const root = await renderScreen();

    expect(hasText(root, 'Camera access blocked')).toBe(true);
    expect(button(root, 'Open Settings')).toBeTruthy();
    expect(button(root, 'Try camera permission again')).toBeTruthy();

    await act(async () => {
      button(root, 'Open Settings').props.onPress();
      await flush();
    });

    expect(Linking.openSettings).toHaveBeenCalledTimes(1);
    expect(permission.requestPermission).not.toHaveBeenCalled();
    expect(cameraViews(root)).toHaveLength(0);
  });

  test('allows a manual start after permission is granted in settings', async () => {
    const permission = makePermission({
      hasPermission: false,
      canRequestPermission: false,
    });

    globalThis.__cameraPermission = permission;

    const root = await renderScreen();

    permission.hasPermission = true;
    await updateScreen(root);

    expect(hasText(root, 'Camera off')).toBe(true);
    expect(button(root, 'Start camera')).toBeTruthy();
    expect(cameraViews(root)).toHaveLength(0);

    await act(async () => {
      button(root, 'Start camera').props.onPress();
      await flush();
    });

    expect(cameraViews(root)).toHaveLength(1);
  });

  test('reports camera errors and allows a manual retry', async () => {
    const root = await renderScreen();

    act(() => {
      cameraViews(root)[0].props.onError(
        new Error('camera exploded'),
      );
    });

    expect(hasText(root, 'Camera error')).toBe(true);
    expect(hasText(root, 'camera exploded')).toBe(true);
    expect(cameraViews(root)).toHaveLength(0);

    await act(async () => {
      button(root, 'Start camera').props.onPress();
      await flush();
    });

    expect(cameraViews(root)).toHaveLength(1);
  });

  test('handles camera interruptions without restarting automatically', async () => {
    const root = await renderScreen();

    act(() => {
      cameraViews(root)[0].props.onPreviewStarted();
      cameraViews(root)[0].props.onInterruptionStarted();
    });

    expect(hasText(root, 'Camera interrupted')).toBe(true);
    expect(hasText(root, 'camera was interrupted')).toBe(true);
    expect(cameraViews(root)).toHaveLength(0);
  });

  test('reports an error when no rear camera becomes available', async () => {
    jest.useFakeTimers();
    globalThis.__cameraDevice = undefined;

    const root = await renderScreen();

    expect(cameraViews(root)).toHaveLength(0);
    expect(hasText(root, 'Starting camera')).toBe(true);

    act(() => {
      jest.advanceTimersByTime(5000);
    });

    expect(hasText(root, 'Camera error')).toBe(true);
    expect(hasText(root, 'No rear camera is available')).toBe(true);
  });

  test('does not auto-start while the screen is not focused', async () => {
    const root = await renderScreen({ isFocused: false });

    expect(cameraViews(root)).toHaveLength(0);
    expect(hasText(root, 'Camera off')).toBe(true);

    await act(async () => {
      button(root, 'Start camera').props.onPress();
      await flush();
    });

    expect(cameraViews(root)).toHaveLength(0);
  });

  test('releases the camera if permission is revoked while streaming', async () => {
    const root = await renderScreen();

    act(() => {
      cameraViews(root)[0].props.onPreviewStarted();
    });

    globalThis.__cameraPermission = makePermission({
      hasPermission: false,
      canRequestPermission: false,
    });
    await updateScreen(root);

    expect(hasText(root, 'Permission needed')).toBe(true);
    expect(hasText(root, 'Camera permission was revoked')).toBe(true);
    expect(cameraViews(root)).toHaveLength(0);
  });

  test('does not enable inference until the camera preview is active', async () => {
    const root = await renderScreen();

    expect(button(root, 'Start inference').props.disabled).toBe(true);

    act(() => {
      cameraViews(root)[0].props.onPreviewStarted();
    });

    expect(button(root, 'Start inference').props.disabled).toBe(false);
  });

  test('starts inference with a new session and pauses without stopping the camera', async () => {
    const root = await renderScreen();

    await startCameraAndInference(root);

    expect(startLiveSession).toHaveBeenCalledWith('live-test-1');
    expect(globalThis.__liveEngine.start).toHaveBeenCalledTimes(1);
    expect(hasText(root, 'Model ready')).toBe(true);
    expect(button(root, 'Stop inference')).toBeTruthy();
    expect(cameraViews(root)).toHaveLength(1);

    const stopCallsBeforePause =
      globalThis.__liveEngine.stop.mock.calls.length;

    act(() => {
      button(root, 'Stop inference').props.onPress();
    });

    expect(globalThis.__liveEngine.stop).toHaveBeenCalledTimes(
      stopCallsBeforePause + 1,
    );
    expect(hasText(root, 'Paused')).toBe(true);
    expect(cameraViews(root)).toHaveLength(1);
    expect(button(root, 'Start inference')).toBeTruthy();
  });

  test('creates a new unique session every time inference starts', async () => {
    const root = await renderScreen();

    await startCameraAndInference(root);

    act(() => {
      button(root, 'Stop inference').props.onPress();
    });

    await startInference(root);

    expect(startLiveSession).toHaveBeenNthCalledWith(
      1,
      'live-test-1',
    );
    expect(startLiveSession).toHaveBeenNthCalledWith(
      2,
      'live-test-2',
    );
    expect(globalThis.__liveEngine.start).toHaveBeenCalledTimes(2);
  });

  test('shows an error and returns to a retry state if inference start fails', async () => {
    const root = await renderScreen();

    await activatePreview(root);

    globalThis.__liveEngine.start.mockRejectedValueOnce(
      new Error('unable to start AI'),
    );

    await startInference(root);

    expect(hasText(root, 'unable to start AI')).toBe(true);
    expect(hasText(root, 'Inference error')).toBe(true);
    expect(button(root, 'Retry inference')).toBeTruthy();
    expect(cameraViews(root)).toHaveLength(1);
  });

  test('renders probabilities and reveals rate, processed, and dropped stats', async () => {
    const root = await renderScreen();

    await startCameraAndInference(root);

    act(() => {
      globalThis.__liveEngine.options.onStats({
        processed: 3,
        dropped: 1,
        lastDurationMs: 123,
        averageDurationMs: 120,
        actualHz: 0.95,
        lastCompletedAt: 1000,
      });
      globalThis.__liveEngine.options.onResult(
        makeResult({
          timestamp: Date.UTC(2026, 9, 31, 12, 30, 5),
        }),
      );
    });

    expect(hasText(root, 'Potential finding: Cancer')).toBe(true);
    expect(hasText(root, 'Confidence 82.0%')).toBe(true);
    expect(hasText(root, 'Cancer')).toBe(true);
    expect(hasText(root, '82.0%')).toBe(true);
    expect(hasText(root, 'Non-cancer')).toBe(true);
    expect(hasText(root, '18.0%')).toBe(true);

    await act(async () => {
      button(root, 'Show inference stats').props.onPress();
      await flush();
    });

    expect(hasText(root, '0.95/s')).toBe(true);
    expect(hasText(root, 'Processed')).toBe(true);
    expect(hasText(root, 'Dropped')).toBe(true);
    expect(hasText(root, '123 ms')).toBe(true);
    expect(hasText(root, 'Session live-test-1')).toBe(true);
  });

  test('explicitly saves the latest non-cancer prediction and frame to History', async () => {
    const root = await renderScreen();
    const frameBuffer = new ArrayBuffer(8);
    const timestamp = Date.UTC(2026, 9, 31, 12, 30, 5);

    await startCameraAndInference(root);

    await reportResult(
      makeResult({
        classIndex: 1,
        className: 'NON CANCER',
        probability: 0.74,
        probabilities: {
          CANCER: 0.26,
          'NON CANCER': 0.74,
        },
        frameBuffer,
        timestamp,
        model: {
          name: 'MobileNetV3',
          version: '1.0',
        },
      }),
    );

    expect(button(root, 'Save to History').props.disabled).toBe(false);

    await act(async () => {
      button(root, 'Save to History').props.onPress();
      await flush();
    });

    expect(saveLiveDiagnosisToHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        prediction: expect.objectContaining({
          className: 'NON CANCER',
          timestamp,
        }),
        frameBuffer,
        capturedAt: timestamp,
        patient: expect.objectContaining({
          name: 'Alice Smith',
        }),
        hospitalDetails: {
          doctorName: 'Dr. Lee',
          hospitalName: 'City Clinic',
        },
        modelName: 'MobileNetV3',
        modelVersion: '1.0',
      }),
    );
    expect(hasText(root, 'Saved to history (diag-live-test).')).toBe(true);
    expect(button(root, 'Save to History').props.disabled).toBe(true);
  });

  test('disables Save to History without a matching frame', async () => {
    const root = await renderScreen();

    await startCameraAndInference(root);

    await reportResult(
      makeResult({
        timestamp: Date.UTC(2026, 9, 31, 12, 30, 5),
      }),
    );

    expect(button(root, 'Save to History').props.disabled).toBe(true);
    expect(saveLiveDiagnosisToHistory).not.toHaveBeenCalled();
  });

  test('reports a history-save failure and allows retrying', async () => {
    const root = await renderScreen();

    await startCameraAndInference(root);

    await reportResult(
      makeResult({
        frameBuffer: new ArrayBuffer(4),
        timestamp: Date.UTC(2026, 9, 31, 12, 30, 5),
      }),
    );

    saveLiveDiagnosisToHistory.mockRejectedValueOnce(
      new Error('database is locked'),
    );

    await act(async () => {
      button(root, 'Save to History').props.onPress();
      await flush();
    });

    expect(hasText(root, 'database is locked')).toBe(true);
    expect(button(root, 'Save to History').props.disabled).toBe(false);
  });

  test('saves CANCER frames, throttles them, and ignores non-cancer results', async () => {
    const root = await renderScreen();
    const base = Date.now();
    const frameBuffer = new ArrayBuffer(8);

    await startCameraAndInference(root);

    await reportResult(
      makeResult({
        frameBuffer,
        timestamp: base,
      }),
    );

    expect(saveLivePositive).toHaveBeenCalledTimes(1);
    expect(saveLivePositive).toHaveBeenLastCalledWith(
      expect.objectContaining({
        sessionId: 'live-test-1',
        frameBuffer,
        capturedAt: base,
      }),
    );
    expect(globalThis.__liveSessions[0].positives).toHaveLength(1);

    await reportResult(
      makeResult({
        frameBuffer,
        timestamp: base + 1000,
      }),
    );

    expect(saveLivePositive).toHaveBeenCalledTimes(1);

    await reportResult(
      makeResult({
        frameBuffer,
        timestamp: base + 2000,
      }),
    );

    expect(saveLivePositive).toHaveBeenCalledTimes(1);

    await reportResult(
      makeResult({
        classIndex: 1,
        className: 'NON CANCER',
        probability: 0.74,
        probabilities: {
          CANCER: 0.26,
          'NON CANCER': 0.74,
        },
        frameBuffer,
        timestamp: base + 3000,
      }),
    );

    expect(saveLivePositive).toHaveBeenCalledTimes(1);

    await reportResult(
      makeResult({
        frameBuffer,
        timestamp: base + 4000,
      }),
    );

    expect(saveLivePositive).toHaveBeenCalledTimes(2);
    expect(globalThis.__liveSessions[0].positives).toHaveLength(2);
  });

  test('shows the positive-case drawer with saved sessions and thumbnails', async () => {
    const root = await renderScreen();
    const base = Date.now();

    await startCameraAndInference(root);
    await reportResult(
      makeResult({
        frameBuffer: new ArrayBuffer(8),
        timestamp: base,
      }),
    );

    await act(async () => {
      button(root, 'Open positive cases').props.onPress();
      await flush();
    });

    expect(hasText(root, 'Positive cases')).toBe(true);
    expect(hasText(root, 'Current session')).toBe(true);
    expect(hasText(root, 'live-test-1')).toBe(true);
    expect(hasText(root, 'Cancer 82.0%')).toBe(true);

    const thumbnail = instance(root).findByType('Image');

    expect(thumbnail.props.source.uri).toBe(
      `file:///tmp/${base}.jpg`,
    );

    act(() => {
      button(root, 'Close positive cases').props.onPress();
    });

    expect(hasText(root, 'Positive cases')).toBe(false);
  });

  test('shows an empty drawer state when no positives exist', async () => {
    const root = await renderScreen();

    act(() => {
      button(root, 'Open positive cases').props.onPress();
    });

    expect(hasText(root, 'Positive cases')).toBe(true);
    expect(hasText(root, 'No positive cases yet')).toBe(true);
  });

  test('reports positive-save failures and per-session limits', async () => {
    const root = await renderScreen();

    await startCameraAndInference(root);

    globalThis.__failSavePositive = new Error('disk full');

    await reportResult(
      makeResult({
        frameBuffer: new ArrayBuffer(8),
        timestamp: Date.now(),
      }),
    );

    expect(hasText(root, 'disk full')).toBe(true);

    act(() => {
      button(root, 'Open positive cases').props.onPress();
    });

    expect(hasText(root, 'Positive cases')).toBe(true);
  });

  test('reports the positive-case limit without crashing inference', async () => {
    const root = await renderScreen();

    await startCameraAndInference(root);
    globalThis.__saveLimit = true;

    await reportResult(
      makeResult({
        frameBuffer: new ArrayBuffer(8),
        timestamp: Date.now(),
      }),
    );

    expect(
      hasText(root, 'Positive case limit reached (30 per session).'),
    ).toBe(true);
    expect(hasText(root, 'Potential finding: Cancer')).toBe(true);
  });

  test('shows inference errors without stopping the preview and clears them on a valid result', async () => {
    const root = await renderScreen();

    await startCameraAndInference(root);

    act(() => {
      globalThis.__liveEngine.options.onStatus('error');
      globalThis.__liveEngine.options.onError(
        new Error('invalid frame'),
      );
    });

    expect(hasText(root, 'Inference error')).toBe(true);
    expect(hasText(root, 'invalid frame')).toBe(true);
    expect(cameraViews(root)).toHaveLength(1);

    await reportResult(
      makeResult({
        classIndex: 1,
        className: 'NON CANCER',
        probability: 0.74,
        probabilities: {
          CANCER: 0.26,
          'NON CANCER': 0.74,
        },
        timestamp: Date.UTC(2026, 9, 31, 12, 31, 0),
      }),
    );

    expect(hasText(root, 'Potential finding: Non-cancer')).toBe(true);
    expect(hasText(root, 'invalid frame')).toBe(false);
    expect(cameraViews(root)).toHaveLength(1);
  });

  test('reports storage failures but still starts inference', async () => {
    const root = await renderScreen();

    globalThis.__failStartSession = new Error('storage failed');

    await startCameraAndInference(root);

    expect(hasText(root, 'storage failed')).toBe(true);
    expect(hasText(root, 'Model ready')).toBe(true);
    expect(button(root, 'Stop inference')).toBeTruthy();
  });

  test('stops inference and clears results when the app backgrounds or unmounts', async () => {
    const root = await renderScreen();

    await startCameraAndInference(root);
    await reportResult(makeResult({ timestamp: Date.now() }));

    const engine = globalThis.__liveEngine;

    act(() => {
      mockAppStateListener('background');
    });

    expect(engine.stop).toHaveBeenCalled();
    expect(hasText(root, 'AI off')).toBe(true);
    expect(hasText(root, 'Potential finding: Cancer')).toBe(false);
    expect(hasText(root, 'Waiting for frames')).toBe(true);
    expect(cameraViews(root)).toHaveLength(0);

    act(() => {
      mockAppStateListener('active');
    });

    expect(cameraViews(root)).toHaveLength(0);

    const stopCallsBeforeUnmount = engine.stop.mock.calls.length;

    act(() => {
      root.unmount();
    });

    expect(engine.stop.mock.calls.length).toBeGreaterThan(
      stopCallsBeforeUnmount,
    );
  });

  test('handles hardware back, including closing the drawer first', async () => {
    const onBack = jest.fn();
    const root = await renderScreen({ onBack });

    await activatePreview(root);

    act(() => {
      button(root, 'Open positive cases').props.onPress();
    });

    expect(hasText(root, 'Positive cases')).toBe(true);

    act(() => {
      globalThis.__backHandlerListener();
    });

    expect(onBack).not.toHaveBeenCalled();
    expect(hasText(root, 'Positive cases')).toBe(false);

    act(() => {
      globalThis.__backHandlerListener();
    });

    expect(onBack).toHaveBeenCalledTimes(1);
    expect(cameraViews(root)).toHaveLength(0);
  });

  test('Home screen exposes the Live Video Detection entry point', () => {
    globalThis.__diagnosisContext = {
      diagnosis: {
        patient: {},
        image: { images: [] },
        audio: {},
      },
      startNewDiagnosis: jest.fn(),
    };

    const onLiveVideo = jest.fn();
    let root;

    act(() => {
      root = create(
        React.createElement(HomeScreen, {
          colors,
          onImage: jest.fn(),
          onAudio: jest.fn(),
          onStartDiagnosis: jest.fn(),
          onHistory: jest.fn(),
          onLiveVideo,
        }),
      );
    });

    expect(hasText(root, 'Live Video Detection')).toBe(true);

    const entry = instance(root)
      .findAllByType('Pressable')
      .find(node => node.props.onPress === onLiveVideo);

    expect(entry).toBeTruthy();

    act(() => {
      entry.props.onPress();
    });

    expect(onLiveVideo).toHaveBeenCalledTimes(1);
  });
});
