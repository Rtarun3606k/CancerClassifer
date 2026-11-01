jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(key =>
      Promise.resolve(globalThis.__liveStore.get(key) ?? null),
    ),
    setItem: jest.fn((key, value) => {
      globalThis.__liveStore.set(key, value);
      return Promise.resolve();
    }),
  },
}));

jest.mock('react-native-fs', () => ({
  __esModule: true,
  default: {
    DocumentDirectoryPath: '/documents',
    exists: jest.fn(path => Promise.resolve(globalThis.__liveFiles.has(path))),
    mkdir: jest.fn(path => {
      globalThis.__liveFiles.add(path);
      return Promise.resolve();
    }),
    unlink: jest.fn(path => {
      globalThis.__liveFiles.delete(path);
      return Promise.resolve();
    }),
    writeFile: jest.fn((path, data, encoding) => {
      globalThis.__liveFiles.add(path);
      globalThis.__liveWrites.push({ path, data, encoding });
      return Promise.resolve();
    }),
  },
}));

const AsyncStorage =
  require('@react-native-async-storage/async-storage').default;
const RNFS = require('react-native-fs').default;

const {
  createLiveSessionId,
  LIVE_SESSION_STORAGE_KEY,
  loadLiveSessions,
  MAX_LIVE_SESSIONS,
  MAX_POSITIVES_PER_SESSION,
  saveLivePositive,
  startLiveSession,
} = require('../src/services/liveSessionStore');

const prediction = {
  className: 'CANCER',
  probability: 0.82,
  probabilities: {
    CANCER: 0.82,
    'NON CANCER': 0.18,
  },
};

describe('liveSessionStore', () => {
  beforeEach(() => {
    globalThis.__liveStore = new Map();
    globalThis.__liveFiles = new Set();
    globalThis.__liveWrites = [];
    jest.clearAllMocks();
  });

  test('creates unique, filesystem-safe live session IDs', () => {
    const first = createLiveSessionId(1000, () => 0.5);
    const second = createLiveSessionId(1000, () => 0.25);

    expect(first).toMatch(/^live-1000-[a-z0-9]+$/);
    expect(second).toMatch(/^live-1000-[a-z0-9]+$/);
    expect(first).not.toBe(second);
  });

  test('loads an empty list when storage is missing, corrupt, or invalid', async () => {
    await expect(loadLiveSessions()).resolves.toEqual([]);

    globalThis.__liveStore.set(LIVE_SESSION_STORAGE_KEY, '{bad json');
    await expect(loadLiveSessions()).resolves.toEqual([]);

    globalThis.__liveStore.set(
      LIVE_SESSION_STORAGE_KEY,
      JSON.stringify({ not: 'an array' }),
    );
    await expect(loadLiveSessions()).resolves.toEqual([]);

    AsyncStorage.getItem.mockRejectedValueOnce(new Error('storage down'));
    await expect(loadLiveSessions()).resolves.toEqual([]);
  });

  test('normalizes, filters, and sorts stored sessions', async () => {
    globalThis.__liveStore.set(
      LIVE_SESSION_STORAGE_KEY,
      JSON.stringify([
        {
          id: 'live-old',
          startedAt: 100,
          updatedAt: 200,
          positives: [
            {
              id: 'case-1',
              capturedAt: 200,
              imagePath: '/documents/live_sessions/live-old/case-1.jpg',
            },
            { id: 'bad case', imagePath: '/tmp/bad.jpg' },
          ],
        },
        { id: 'not safe/id', startedAt: 300, positives: [] },
        {
          id: 'live-new',
          startedAt: 500,
          positives: 'invalid',
        },
      ]),
    );

    const sessions = await loadLiveSessions();

    expect(sessions.map(session => session.id)).toEqual([
      'live-new',
      'live-old',
    ]);
    expect(sessions[0].positives).toEqual([]);
    expect(sessions[1].positives).toHaveLength(1);
    expect(sessions[1].positives[0].id).toBe('case-1');
  });

  test('creates a session, persists it, and does not duplicate an existing ID', async () => {
    const session = await startLiveSession('live-100', 1234);

    expect(session).toEqual({
      id: 'live-100',
      startedAt: 1234,
      updatedAt: 1234,
      positives: [],
    });

    await startLiveSession('live-100', 9999);

    const sessions = await loadLiveSessions();

    expect(sessions).toHaveLength(1);
    expect(sessions[0].startedAt).toBe(1234);
    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
  });

  test('rejects unsafe session IDs', async () => {
    await expect(
      startLiveSession('../../escape'),
    ).rejects.toThrow('Invalid live session ID.');
  });

  test('prunes sessions beyond the cap and removes their image folders', async () => {
    for (let index = 0; index < MAX_LIVE_SESSIONS; index += 1) {
      await startLiveSession(`live-${index}`, index + 1);
    }

    globalThis.__liveFiles.add('/documents/live_sessions/live-0');

    await startLiveSession('live-newest', 999);

    const sessions = await loadLiveSessions();

    expect(sessions).toHaveLength(MAX_LIVE_SESSIONS);
    expect(sessions[0].id).toBe('live-newest');
    expect(sessions.some(session => session.id === 'live-0')).toBe(false);
    expect(RNFS.unlink).toHaveBeenCalledWith(
      '/documents/live_sessions/live-0',
    );
  });

  test('saves a JPEG and metadata for a positive case', async () => {
    await startLiveSession('live-1', 1000);

    const frameBuffer = new Uint8Array([1, 2, 3]).buffer;
    const saved = await saveLivePositive({
      sessionId: 'live-1',
      frameBuffer,
      prediction,
      capturedAt: 2000,
    });

    expect(saved).toEqual(
      expect.objectContaining({
        id: expect.stringMatching(/^case-2000-/),
        capturedAt: 2000,
        className: 'CANCER',
        confidence: 0.82,
        probabilities: prediction.probabilities,
        imagePath: expect.stringMatching(
          /^\/documents\/live_sessions\/live-1\/case-2000-.*\.jpg$/,
        ),
      }),
    );
    expect(RNFS.mkdir).toHaveBeenCalledWith('/documents/live_sessions');
    expect(RNFS.mkdir).toHaveBeenCalledWith(
      '/documents/live_sessions/live-1',
    );
    expect(RNFS.writeFile).toHaveBeenCalledWith(
      saved.imagePath,
      Buffer.from([1, 2, 3]).toString('base64'),
      'base64',
    );

    const sessions = await loadLiveSessions();

    expect(sessions[0].updatedAt).toBe(2000);
    expect(sessions[0].positives).toEqual([saved]);
  });

  test('returns null and does not write once the session cap is reached', async () => {
    const positives = Array.from(
      { length: MAX_POSITIVES_PER_SESSION },
      (_, index) => ({
        id: `case-${index}`,
        capturedAt: index,
        imagePath: `/documents/live_sessions/live-full/case-${index}.jpg`,
      }),
    );

    globalThis.__liveStore.set(
      LIVE_SESSION_STORAGE_KEY,
      JSON.stringify([
        {
          id: 'live-full',
          startedAt: 1,
          positives,
        },
      ]),
    );

    const result = await saveLivePositive({
      sessionId: 'live-full',
      frameBuffer: new ArrayBuffer(1),
      prediction,
      capturedAt: 5000,
    });

    expect(result).toBeNull();
    expect(RNFS.writeFile).not.toHaveBeenCalled();
  });

  test('rejects missing sessions, frames, and predictions', async () => {
    await expect(
      saveLivePositive({
        sessionId: 'live-missing',
        frameBuffer: new ArrayBuffer(1),
        prediction,
      }),
    ).rejects.toThrow('Live session not found.');

    await expect(
      saveLivePositive({
        sessionId: 'live-1',
        prediction,
      }),
    ).rejects.toThrow('A frame is required');

    await expect(
      saveLivePositive({
        sessionId: 'live-1',
        frameBuffer: new ArrayBuffer(1),
        prediction: null,
      }),
    ).rejects.toThrow('A prediction is required');
  });

  test('keeps metadata pruning working when a folder cannot be removed', async () => {
    RNFS.exists.mockRejectedValueOnce(new Error('filesystem down'));

    for (let index = 0; index < MAX_LIVE_SESSIONS; index += 1) {
      await startLiveSession(`live-${index}`, index + 1);
    }

    await startLiveSession('live-newest', 999);

    const sessions = await loadLiveSessions();

    expect(sessions).toHaveLength(MAX_LIVE_SESSIONS);
    expect(sessions[0].id).toBe('live-newest');
  });
});
