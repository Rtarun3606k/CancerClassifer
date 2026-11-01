import {
  loadModel,
  runInferenceOnImage,
} from './model';
import { preprocessSnapshot } from './liveFrame';

/**
 * Sampling interval for live inference.
 *
 * 800 ms leaves room for preprocessing and the ~130-220 ms on-device model
 * run while still targeting roughly 1-2 inferences per second. Change this
 * value here (keeping it between 500 and 1000 ms) to tune the pipeline.
 */
export const LIVE_INFERENCE_INTERVAL_MS = 800;

/**
 * Static information about the on-device image model. Attached to live
 * results so an explicitly saved history record can show which model produced
 * the prediction.
 */
export const LIVE_MODEL_INFO = {
  name: 'MobileNetV3',
  runtime: 'ONNX Runtime',
  inputSize: 224,
};

export const AI_STATUS = {
  OFF: 'off',
  LOADING: 'loading',
  READY: 'ready',
  ANALYZING: 'analyzing',
  PAUSED: 'paused',
  ERROR: 'error',
};

export function createEmptyStats() {
  return {
    processed: 0,
    dropped: 0,
    lastDurationMs: 0,
    averageDurationMs: 0,
    actualHz: 0,
    lastCompletedAt: null,
  };
}

const noop = () => {};

/**
 * Throttled, single-flight live inference pipeline.
 *
 * Camera frames are sampled by asking the preview for a snapshot at most once
 * per interval. While an inference is running, newly scheduled samples are
 * dropped rather than queued. Stopping the engine invalidates any in-flight
 * result so a prediction from an old camera session can never reach the UI.
 */
export class LiveInferenceEngine {
  constructor({
    takeSnapshot,
    loadModelFn = loadModel,
    runInference = runInferenceOnImage,
    preprocessFrame = preprocessSnapshot,
    intervalMs = LIVE_INFERENCE_INTERVAL_MS,
    now = () => Date.now(),
    setIntervalFn = setInterval,
    clearIntervalFn = clearInterval,
    onStatus = noop,
    onResult = noop,
    onStats = noop,
    onError = noop,
    onFatal = noop,
  }) {
    if (typeof takeSnapshot !== 'function') {
      throw new Error('takeSnapshot is required.');
    }

    this.takeSnapshot = takeSnapshot;
    this.loadModelFn = loadModelFn;
    this.runInference = runInference;
    this.preprocessFrame = preprocessFrame;
    this.intervalMs = intervalMs;
    this.now = now;
    this.setIntervalFn = setIntervalFn;
    this.clearIntervalFn = clearIntervalFn;
    this.onStatus = onStatus;
    this.onResult = onResult;
    this.onStats = onStats;
    this.onError = onError;
    this.onFatal = onFatal;

    this.running = false;
    this.sessionToken = 0;
    this.timer = null;
    this.inFlight = false;
    this.stats = createEmptyStats();
    this.activeSince = 0;
    this.totalDurationMs = 0;
  }

  getStats() {
    return { ...this.stats };
  }

  /**
   * Load the shared model once, then begin sampling.
   * Calling start() while already running is a no-op.
   */
  async start() {
    if (this.running) {
      return;
    }

    const token = this.sessionToken + 1;

    this.sessionToken = token;
    this.running = true;
    this.stats = createEmptyStats();
    this.activeSince = 0;
    this.totalDurationMs = 0;

    this.onStats(this.getStats());
    this.onStatus(AI_STATUS.LOADING);

    const promise = (async () => {
      try {
        await this.loadModelFn();
      } catch (error) {
        if (token !== this.sessionToken) {
          return;
        }

        this.running = false;
        this.onStatus(AI_STATUS.ERROR);
        this.onFatal(error);

        return;
      }

      if (!this.running || token !== this.sessionToken) {
        return;
      }

      this.onStatus(AI_STATUS.READY);
      this.activeSince = this.now();

      if (!this.timer) {
        this.timer = this.setIntervalFn(() => {
          return this.tick();
        }, this.intervalMs);
      }
    })();

    await promise;
  }

  /**
   * Stop sampling immediately. Any inference that is already executing is
   * allowed to finish, but its result is discarded.
   */
  stop() {
    this.running = false;
    this.sessionToken += 1;

    if (this.timer) {
      this.clearIntervalFn(this.timer);
      this.timer = null;
    }
  }

  async tick() {
    if (!this.running) {
      return;
    }

    if (this.inFlight) {
      this.stats.dropped += 1;
      this.onStats(this.getStats());

      return;
    }

    this.inFlight = true;

    const token = this.sessionToken;
    let snapshot = null;

    this.onStatus(AI_STATUS.ANALYZING);

    const captureStarted = this.now();

    try {
      snapshot = await this.takeSnapshot();

      const processed =
        await this.preprocessFrame(snapshot);
      const image = processed?.image ?? processed;
      const frameBuffer = processed?.frameBuffer;

      if (!this.running || token !== this.sessionToken) {
        return;
      }

      const modelStarted = this.now();

      const prediction =
        await this.runInference(image);

      const durationMs =
        Math.max(0, this.now() - modelStarted);

      if (!this.running || token !== this.sessionToken) {
        return;
      }

      this.stats.processed += 1;
      this.totalDurationMs += durationMs;
      this.stats.lastDurationMs = durationMs;
      this.stats.averageDurationMs =
        this.totalDurationMs / this.stats.processed;

      const completedAt = this.now();

      this.stats.lastCompletedAt = completedAt;

      const elapsedSeconds =
        (completedAt - this.activeSince) / 1000;

      this.stats.actualHz =
        elapsedSeconds > 0
          ? this.stats.processed / elapsedSeconds
          : 0;

      this.onResult({
        ...prediction,
        durationMs,
        captureMs: Math.max(
          0,
          modelStarted - captureStarted,
        ),
        timestamp: completedAt,
        frameBuffer,
        model: LIVE_MODEL_INFO,
      });
      this.onStats(this.getStats());
      this.onStatus(AI_STATUS.READY);
    } catch (error) {
      if (this.running && token === this.sessionToken) {
        this.onStatus(AI_STATUS.ERROR);
        this.onError(error);
      }
    } finally {
      snapshot?.dispose?.();
      this.inFlight = false;
    }
  }
}
