jest.mock('react-native', () => ({
  NativeModules: {
    ONNXModel: {
      getModelPath: jest.fn().mockResolvedValue('/tmp/model.onnx'),
    },
  },
}));

jest.mock('onnxruntime-react-native', () => ({
  __esModule: true,
  InferenceSession: {
    create: jest.fn(),
  },
  Tensor: jest.fn((type, data, dims) => ({
    type,
    data,
    dims,
  })),
}));

jest.mock('react-native-fs', () => ({
  __esModule: true,
  default: {
    readFile: jest.fn(),
    exists: jest.fn(),
  },
}));

jest.mock('react-native-image-resizer', () => ({
  __esModule: true,
  default: {
    createResizedImage: jest.fn(),
  },
}));

jest.mock('jpeg-js', () => ({
  __esModule: true,
  default: {
    decode: jest.fn(),
  },
}));

const flush = () =>
  new Promise(resolve => {
    setImmediate(resolve);
  });

function makePrediction(overrides = {}) {
  return {
    classIndex: 0,
    className: 'CANCER',
    probability: 0.8,
    probabilities: {
      CANCER: 0.8,
      'NON CANCER': 0.2,
    },
    logits: [1.4, -0.4],
    ...overrides,
  };
}

function makeEngineHarness(overrides = {}) {
  let tickCallback = null;
  let now = 0;
  let timerId = 0;

  const onStatus = jest.fn();
  const onResult = jest.fn();
  const onStats = jest.fn();
  const onError = jest.fn();
  const onFatal = jest.fn();
  const takeSnapshot = jest.fn(async () => ({
    dispose: jest.fn(),
  }));
  const loadModelFn = jest.fn(async () => ({}));
  const runInference = jest.fn(async () => makePrediction());
  const preprocessFrame = jest.fn(async () => ({
    data: new Uint8ClampedArray(224 * 224 * 4),
    width: 224,
    height: 224,
  }));
  const setIntervalFn = jest.fn(callback => {
    tickCallback = callback;
    timerId += 1;

    return `timer-${timerId}`;
  });
  const clearIntervalFn = jest.fn();

  const engine = new (require('../src/ml/liveInference').LiveInferenceEngine)({
    takeSnapshot,
    loadModelFn,
    runInference,
    preprocessFrame,
    intervalMs: 1000,
    now: () => now,
    setIntervalFn,
    clearIntervalFn,
    onStatus,
    onResult,
    onStats,
    onError,
    onFatal,
    ...overrides,
  });

  return {
    engine,
    onStatus,
    onResult,
    onStats,
    onError,
    onFatal,
    takeSnapshot,
    loadModelFn,
    runInference,
    preprocessFrame,
    setIntervalFn,
    clearIntervalFn,
    getTick: () => tickCallback,
    setNow: value => {
      now = value;
    },
    advanceNow: value => {
      now += value;
    },
  };
}

describe('live inference preprocessing and model reuse', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    const { NativeModules } = require('react-native');
    NativeModules.ONNXModel.getModelPath.mockResolvedValue('/tmp/model.onnx');

    const jpeg = require('jpeg-js').default;
    jpeg.decode.mockReturnValue({
      data: new Uint8ClampedArray(224 * 224 * 4),
      width: 224,
      height: 224,
    });
  });

  test('preprocesses a camera snapshot with the same 224x224 JPEG 100 path', async () => {
    const { preprocessSnapshot } = require('../src/ml/liveFrame');
    const jpeg = require('jpeg-js').default;
    const resized = {
      toEncodedImageDataAsync: jest.fn().mockResolvedValue({
        buffer: new Uint8Array([1, 2, 3]).buffer,
      }),
      dispose: jest.fn(),
    };
    const snapshot = {
      resizeAsync: jest.fn().mockResolvedValue(resized),
      dispose: jest.fn(),
    };

    const result = await preprocessSnapshot(snapshot);

    expect(snapshot.resizeAsync).toHaveBeenCalledWith(224, 224);
    expect(resized.toEncodedImageDataAsync).toHaveBeenCalledWith('jpg', 100);
    expect(jpeg.decode).toHaveBeenCalledWith(expect.any(Uint8Array), {
      useTArray: true,
    });
    expect(result.image.width).toBe(224);
    expect(result.image.height).toBe(224);
    expect(result.image.data).toHaveLength(224 * 224 * 4);
    expect(result.frameBuffer).toEqual(
      new Uint8Array([1, 2, 3]).buffer,
    );
    expect(resized.dispose).toHaveBeenCalledTimes(1);
  });

  test('does not dispose an image that is also the original snapshot', async () => {
    const { preprocessSnapshot } = require('../src/ml/liveFrame');
    const snapshot = {
      resizeAsync: jest.fn(),
      toEncodedImageDataAsync: jest.fn().mockResolvedValue({
        buffer: new ArrayBuffer(1),
      }),
      dispose: jest.fn(),
    };

    snapshot.resizeAsync.mockResolvedValue(snapshot);

    await expect(preprocessSnapshot(snapshot)).resolves.toBeTruthy();
    expect(snapshot.dispose).not.toHaveBeenCalled();
  });

  test('rejects invalid frames and leaves the resized image disposed', async () => {
    const { preprocessSnapshot } = require('../src/ml/liveFrame');

    await expect(preprocessSnapshot(null)).rejects.toThrow(
      'Invalid camera frame.',
    );

    const invalidResized = {
      dispose: jest.fn(),
    };
    const snapshot = {
      resizeAsync: jest.fn().mockResolvedValue(invalidResized),
    };

    await expect(preprocessSnapshot(snapshot)).rejects.toThrow(
      'Camera frame could not be resized.',
    );
    expect(invalidResized.dispose).toHaveBeenCalledTimes(1);

    const noBuffer = {
      toEncodedImageDataAsync: jest.fn().mockResolvedValue({}),
      dispose: jest.fn(),
    };

    await expect(
      preprocessSnapshot({
        resizeAsync: jest.fn().mockResolvedValue(noBuffer),
      }),
    ).rejects.toThrow('Camera frame could not be encoded.');

    const jpeg = require('jpeg-js').default;
    jpeg.decode.mockReturnValueOnce({
      data: null,
      width: 224,
      height: 224,
    });

    await expect(
      preprocessSnapshot({
        resizeAsync: jest.fn().mockResolvedValue({
          toEncodedImageDataAsync: jest.fn().mockResolvedValue({
            buffer: new ArrayBuffer(1),
          }),
          dispose: jest.fn(),
        }),
      }),
    ).rejects.toThrow('Could not decode camera frame');

    jpeg.decode.mockReturnValueOnce({
      data: new Uint8ClampedArray(4),
      width: 112,
      height: 112,
    });

    await expect(
      preprocessSnapshot({
        resizeAsync: jest.fn().mockResolvedValue({
          toEncodedImageDataAsync: jest.fn().mockResolvedValue({
            buffer: new ArrayBuffer(1),
          }),
          dispose: jest.fn(),
        }),
      }),
    ).rejects.toThrow('Unexpected camera frame size: 112x112');
  });

  test('loads the ONNX session once and reuses it', async () => {
    const ort = require('onnxruntime-react-native');
    const session = {
      inputNames: ['input'],
      outputNames: ['output'],
      run: jest.fn(),
    };
    ort.InferenceSession.create.mockResolvedValue(session);

    const model = require('../src/ml/model');

    const first = await model.loadModel();
    const second = await model.loadModel();

    expect(first).toBe(session);
    expect(second).toBe(session);
    expect(ort.InferenceSession.create).toHaveBeenCalledTimes(1);
    expect(ort.InferenceSession.create).toHaveBeenCalledWith('/tmp/model.onnx');
  });

  test('shares a concurrent model initialization and retries after failure', async () => {
    const ort = require('onnxruntime-react-native');
    const session = {
      inputNames: ['input'],
      outputNames: ['output'],
      run: jest.fn(),
    };
    ort.InferenceSession.create
      .mockRejectedValueOnce(new Error('model init failed'))
      .mockResolvedValueOnce(session);

    const model = require('../src/ml/model');

    await expect(model.loadModel()).rejects.toThrow('model init failed');
    await expect(model.loadModel()).resolves.toBe(session);
    expect(ort.InferenceSession.create).toHaveBeenCalledTimes(2);

    ort.InferenceSession.create.mockClear();
    ort.InferenceSession.create.mockResolvedValue(session);

    const [a, b] = await Promise.all([
      model.loadModel(),
      model.loadModel(),
    ]);

    expect(a).toBe(session);
    expect(b).toBe(session);
    expect(ort.InferenceSession.create).not.toHaveBeenCalled();
  });

  test('maps logits with the existing class indices and probabilities', () => {
    const { buildPrediction } = require('../src/ml/model');

    const cancer = buildPrediction([2, 0]);
    expect(cancer.classIndex).toBe(0);
    expect(cancer.className).toBe('CANCER');
    expect(cancer.probability).toBeGreaterThan(0.5);
    expect(
      cancer.probabilities.CANCER +
        cancer.probabilities['NON CANCER'],
    ).toBeCloseTo(1, 6);

    const nonCancer = buildPrediction([0, 2]);
    expect(nonCancer.classIndex).toBe(1);
    expect(nonCancer.className).toBe('NON CANCER');
    expect(nonCancer.probability).toBeGreaterThan(0.5);
    expect(() => buildPrediction([1])).toThrow('Expected 2 outputs');
  });

  test('runs the shared model on a 224x224 RGBA image and validates outputs', async () => {
    const ort = require('onnxruntime-react-native');
    const session = {
      inputNames: ['input'],
      outputNames: ['output'],
      run: jest.fn().mockResolvedValue({
        output: {
          data: Float32Array.from([0.7, 0.3]),
        },
      }),
    };
    ort.InferenceSession.create.mockResolvedValue(session);

    const model = require('../src/ml/model');
    const image = {
      data: new Uint8ClampedArray(224 * 224 * 4),
      width: 224,
      height: 224,
    };

    const result = await model.runInferenceOnImage(image);

    expect(ort.Tensor).toHaveBeenCalledWith(
      'float32',
      expect.any(Float32Array),
      [1, 3, 224, 224],
    );
    expect(session.run).toHaveBeenCalledWith({
      input: expect.objectContaining({
        type: 'float32',
        dims: [1, 3, 224, 224],
      }),
    });
    expect(result.className).toBe('CANCER');
    expect(result.probabilities.CANCER).toBeGreaterThan(0.5);

    session.run.mockResolvedValueOnce({});
    await expect(
      model.runInferenceOnImage(image),
    ).rejects.toThrow('Output "output" not found');
  });
});

describe('LiveInferenceEngine', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  test('loads the model, schedules samples, and reports a valid result', async () => {
    const harness = makeEngineHarness();
    harness.setNow(0);

    await harness.engine.start();

    expect(harness.onStatus).toHaveBeenNthCalledWith(1, 'loading');
    expect(harness.onStatus).toHaveBeenNthCalledWith(2, 'ready');
    expect(harness.setIntervalFn).toHaveBeenCalledWith(
      expect.any(Function),
      1000,
    );
    expect(harness.onStats).toHaveBeenCalledWith(
      expect.objectContaining({ processed: 0, dropped: 0 }),
    );

    harness.setNow(1000);
    harness.runInference.mockImplementationOnce(async () => {
      harness.advanceNow(120);
      return makePrediction();
    });

    await harness.getTick()();

    expect(harness.takeSnapshot).toHaveBeenCalledTimes(1);
    expect(harness.preprocessFrame).toHaveBeenCalledTimes(1);
    expect(harness.runInference).toHaveBeenCalledTimes(1);
    expect(harness.onStatus).toHaveBeenCalledWith('analyzing');
    expect(harness.onStatus).toHaveBeenLastCalledWith('ready');
    expect(harness.onResult).toHaveBeenCalledWith(
      expect.objectContaining({
        className: 'CANCER',
        durationMs: 120,
        timestamp: 1120,
      }),
    );
    expect(harness.onStats).toHaveBeenLastCalledWith(
      expect.objectContaining({
        processed: 1,
        dropped: 0,
        lastDurationMs: 120,
        averageDurationMs: 120,
        actualHz: expect.any(Number),
      }),
    );
  });

  test('attaches the encoded frame to every live result', async () => {
    const harness = makeEngineHarness();
    const frameBuffer = new ArrayBuffer(8);
    const image = {
      data: new Uint8ClampedArray(224 * 224 * 4),
      width: 224,
      height: 224,
    };

    harness.preprocessFrame.mockResolvedValue({
      image,
      frameBuffer,
    });

    await harness.engine.start();
    await harness.getTick()();

    expect(harness.onResult).toHaveBeenLastCalledWith(
      expect.objectContaining({
        frameBuffer,
        className: 'CANCER',
        model: expect.objectContaining({
          name: 'MobileNetV3',
        }),
      }),
    );

    harness.runInference.mockResolvedValueOnce(
      makePrediction({
        classIndex: 1,
        className: 'NON CANCER',
        probability: 0.8,
        probabilities: {
          CANCER: 0.2,
          'NON CANCER': 0.8,
        },
      }),
    );

    await harness.getTick()();

    expect(harness.onResult).toHaveBeenLastCalledWith(
      expect.objectContaining({
        frameBuffer,
        className: 'NON CANCER',
      }),
    );
  });

  test('drops a scheduled sample while inference is still running', async () => {
    const harness = makeEngineHarness();
    let resolveSnapshot;
    const snapshot = { dispose: jest.fn() };

    harness.takeSnapshot.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          resolveSnapshot = resolve;
        }),
    );

    await harness.engine.start();

    const first = harness.engine.tick();

    await harness.engine.tick();

    expect(harness.takeSnapshot).toHaveBeenCalledTimes(1);
    expect(harness.onStats).toHaveBeenLastCalledWith(
      expect.objectContaining({ dropped: 1 }),
    );

    resolveSnapshot(snapshot);
    await first;

    expect(snapshot.dispose).toHaveBeenCalledTimes(1);
    expect(harness.onResult).toHaveBeenCalledTimes(1);
    expect(harness.engine.getStats().dropped).toBe(1);
  });

  test('stops sampling and ignores an in-flight result after stop', async () => {
    const harness = makeEngineHarness();
    let resolveInference;

    await harness.engine.start();

    harness.runInference.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          resolveInference = resolve;
        }),
    );

    const pending = harness.engine.tick();

    await flush();

    harness.engine.stop();

    expect(harness.clearIntervalFn).toHaveBeenCalledWith('timer-1');

    resolveInference(makePrediction());
    await pending;

    expect(harness.onResult).not.toHaveBeenCalled();
  });

  test('prevents stale results from a previous session after restart', async () => {
    const harness = makeEngineHarness();
    let resolveOldInference;

    await harness.engine.start();

    harness.runInference.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          resolveOldInference = resolve;
        }),
    );

    const oldTick = harness.engine.tick();

    await flush();

    harness.engine.stop();
    await harness.engine.start();

    resolveOldInference(makePrediction());
    await oldTick;

    expect(harness.onResult).not.toHaveBeenCalled();

    await harness.getTick()();

    expect(harness.onResult).toHaveBeenCalledTimes(1);
    expect(harness.engine.getStats().processed).toBe(1);
  });

  test('recovers after invalid frames and inference errors', async () => {
    const harness = makeEngineHarness();

    await harness.engine.start();

    harness.preprocessFrame.mockRejectedValueOnce(
      new Error('invalid frame'),
    );

    await harness.getTick()();

    expect(harness.onStatus).toHaveBeenCalledWith('error');
    expect(harness.onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'invalid frame' }),
    );
    expect(harness.engine.running).toBe(true);

    harness.runInference.mockRejectedValueOnce(
      new Error('inference failed'),
    );

    await harness.getTick()();

    expect(harness.onError).toHaveBeenLastCalledWith(
      expect.objectContaining({ message: 'inference failed' }),
    );

    await harness.getTick()();

    expect(harness.onResult).toHaveBeenCalledTimes(1);
    expect(harness.onStatus).toHaveBeenLastCalledWith('ready');
  });

  test('reports a fatal model initialization error and stays stopped', async () => {
    const harness = makeEngineHarness({
      loadModelFn: jest.fn().mockRejectedValue(new Error('model failed')),
    });

    await harness.engine.start();

    expect(harness.onStatus).toHaveBeenLastCalledWith('error');
    expect(harness.onFatal).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'model failed' }),
    );
    expect(harness.engine.running).toBe(false);
    expect(harness.setIntervalFn).not.toHaveBeenCalled();
  });

  test('requires a snapshot provider', () => {
    const { LiveInferenceEngine } = require('../src/ml/liveInference');

    expect(() => new LiveInferenceEngine({})).toThrow(
      'takeSnapshot is required.',
    );
  });

  test('uses the documented sub-second sampling default', () => {
    const {
      LiveInferenceEngine,
      LIVE_INFERENCE_INTERVAL_MS,
      createEmptyStats,
    } = require('../src/ml/liveInference');
    const engine = new LiveInferenceEngine({
      takeSnapshot: jest.fn(),
    });

    expect(LIVE_INFERENCE_INTERVAL_MS).toBe(800);
    expect(engine.intervalMs).toBe(800);
    expect(typeof engine.now()).toBe('number');
    expect(engine.getStats()).toEqual(createEmptyStats());
  });

  test('shares a pending start and never samples after a stop during loading', async () => {
    const harness = makeEngineHarness();
    let resolveLoad;

    harness.loadModelFn.mockImplementation(
      () =>
        new Promise(resolve => {
          resolveLoad = resolve;
        }),
    );

    const first = harness.engine.start();
    const second = harness.engine.start();

    expect(harness.loadModelFn).toHaveBeenCalledTimes(1);

    harness.engine.stop();
    resolveLoad();
    await Promise.all([first, second]);

    expect(harness.onStatus).not.toHaveBeenCalledWith('ready');
    expect(harness.setIntervalFn).not.toHaveBeenCalled();
  });

  test('ignores a load failure that arrives after stop', async () => {
    const harness = makeEngineHarness();
    let rejectLoad;

    harness.loadModelFn.mockImplementation(
      () =>
        new Promise((resolve, reject) => {
          rejectLoad = reject;
        }),
    );

    const pending = harness.engine.start();

    harness.engine.stop();
    rejectLoad(new Error('late failure'));
    await pending;

    expect(harness.onFatal).not.toHaveBeenCalled();
    expect(harness.setIntervalFn).not.toHaveBeenCalled();
  });

  test('does nothing when tick is called while stopped', async () => {
    const harness = makeEngineHarness();

    await harness.engine.tick();

    expect(harness.takeSnapshot).not.toHaveBeenCalled();
    expect(harness.onStatus).not.toHaveBeenCalled();
  });

  test('discards a sample stopped during preprocessing', async () => {
    const harness = makeEngineHarness();
    let resolvePreprocess;

    await harness.engine.start();

    harness.preprocessFrame.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          resolvePreprocess = resolve;
        }),
    );

    const pending = harness.engine.tick();

    await flush();
    harness.engine.stop();
    resolvePreprocess({
      data: new Uint8ClampedArray(224 * 224 * 4),
      width: 224,
      height: 224,
    });
    await pending;

    expect(harness.runInference).not.toHaveBeenCalled();
    expect(harness.onResult).not.toHaveBeenCalled();
  });

  test('does not schedule a second timer when start is called twice', async () => {
    const harness = makeEngineHarness();

    await harness.engine.start();
    await harness.engine.start();

    expect(harness.setIntervalFn).toHaveBeenCalledTimes(1);

    harness.engine.stop();
    expect(harness.engine.running).toBe(false);
  });
});
