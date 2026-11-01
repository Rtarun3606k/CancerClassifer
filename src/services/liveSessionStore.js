import AsyncStorage from '@react-native-async-storage/async-storage';
import { Buffer } from 'buffer';
import RNFS from 'react-native-fs';

export const LIVE_SESSION_STORAGE_KEY = '@oralscan/live_sessions_v1';
export const MAX_LIVE_SESSIONS = 20;
export const MAX_POSITIVES_PER_SESSION = 30;
export const POSITIVE_SAVE_INTERVAL_MS = 3000;

const LIVE_DIRECTORY = `${RNFS.DocumentDirectoryPath}/live_sessions`;

// Live sessions are deliberately kept out of the diagnosis database and
// patient history. All mutations are serialized so rapid positive captures
// cannot overwrite each other in AsyncStorage.
let mutationQueue = Promise.resolve();

function runExclusive(task) {
  const next = mutationQueue.then(task, task);

  mutationQueue = next.then(
    () => undefined,
    () => undefined,
  );

  return next;
}

function isSafeId(value) {
  return typeof value === 'string' && /^[a-z0-9-]+$/i.test(value);
}

function normalizeSession(session) {
  if (!session || !isSafeId(session.id)) {
    return null;
  }

  return {
    id: session.id,
    startedAt: Number(session.startedAt) || 0,
    updatedAt: Number(session.updatedAt) || 0,
    positives: Array.isArray(session.positives)
      ? session.positives
          .filter(
            item =>
              item &&
              isSafeId(item.id) &&
              typeof item.imagePath === 'string',
          )
          .map(item => ({
            id: item.id,
            capturedAt: Number(item.capturedAt) || 0,
            className:
              item.className === 'CANCER'
                ? 'CANCER'
                : 'NON CANCER',
            confidence: Number(item.confidence) || 0,
            probabilities:
              item.probabilities &&
              typeof item.probabilities === 'object'
                ? { ...item.probabilities }
                : {},
            imagePath: item.imagePath,
          }))
      : [],
  };
}

function normalizeSessions(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(normalizeSession)
    .filter(Boolean)
    .sort((a, b) => b.startedAt - a.startedAt)
    .slice(0, MAX_LIVE_SESSIONS);
}

async function persistSessions(sessions) {
  await AsyncStorage.setItem(
    LIVE_SESSION_STORAGE_KEY,
    JSON.stringify(sessions),
  );
}

async function removeSessionDirectory(sessionId) {
  if (!isSafeId(sessionId)) {
    return;
  }

  try {
    const directory = `${LIVE_DIRECTORY}/${sessionId}`;

    if (await RNFS.exists(directory)) {
      await RNFS.unlink(directory);
    }
  } catch {
    // Orphaned files are harmless. Metadata is still pruned below.
  }
}

async function ensureDirectory(path) {
  if (!(await RNFS.exists(path))) {
    await RNFS.mkdir(path);
  }
}

export function createLiveSessionId(
  now = Date.now(),
  random = Math.random,
) {
  const suffix = random()
    .toString(36)
    .slice(2, 8)
    .padEnd(6, '0');

  return `live-${now}-${suffix}`;
}

export async function loadLiveSessions() {
  try {
    const raw = await AsyncStorage.getItem(
      LIVE_SESSION_STORAGE_KEY,
    );

    if (!raw) {
      return [];
    }

    return normalizeSessions(JSON.parse(raw));
  } catch {
    return [];
  }
}

/**
 * Create a new live session (or return the existing session with that ID).
 * Older sessions beyond the cap are removed together with their images.
 */
export async function startLiveSession(
  sessionId,
  startedAt = Date.now(),
) {
  if (!isSafeId(sessionId)) {
    throw new Error('Invalid live session ID.');
  }

  return runExclusive(async () => {
    const sessions = await loadLiveSessions();
    const existing = sessions.find(
      session => session.id === sessionId,
    );

    if (existing) {
      return existing;
    }

    const session = {
      id: sessionId,
      startedAt,
      updatedAt: startedAt,
      positives: [],
    };

    const next = [session, ...sessions];
    const kept = next.slice(0, MAX_LIVE_SESSIONS);
    const removed = next.slice(MAX_LIVE_SESSIONS);

    await Promise.all(
      removed.map(item => removeSessionDirectory(item.id)),
    );
    await persistSessions(kept);

    return session;
  });
}

/**
 * Save one CANCER frame as a small JPEG plus metadata. Returns null when the
 * per-session cap is reached.
 */
export async function saveLivePositive({
  sessionId,
  frameBuffer,
  prediction,
  capturedAt = Date.now(),
}) {
  if (!isSafeId(sessionId)) {
    throw new Error('Invalid live session ID.');
  }

  if (!frameBuffer) {
    throw new Error('A frame is required to save a positive case.');
  }

  if (!prediction?.className) {
    throw new Error('A prediction is required to save a positive case.');
  }

  return runExclusive(async () => {
    const sessions = await loadLiveSessions();
    const sessionIndex = sessions.findIndex(
      session => session.id === sessionId,
    );

    if (sessionIndex < 0) {
      throw new Error('Live session not found.');
    }

    const session = sessions[sessionIndex];

    if (
      session.positives.length >= MAX_POSITIVES_PER_SESSION
    ) {
      return null;
    }

    const caseId = `case-${capturedAt}-${Math.random()
      .toString(36)
      .slice(2, 8)
      .padEnd(6, '0')}`;
    const directory = `${LIVE_DIRECTORY}/${sessionId}`;

    await ensureDirectory(LIVE_DIRECTORY);
    await ensureDirectory(directory);

    const imagePath = `${directory}/${caseId}.jpg`;

    await RNFS.writeFile(
      imagePath,
      Buffer.from(frameBuffer).toString('base64'),
      'base64',
    );

    const positive = {
      id: caseId,
      capturedAt,
      className: prediction.className,
      confidence: prediction.probability,
      probabilities: {
        ...prediction.probabilities,
      },
      imagePath,
    };

    session.positives = [positive, ...session.positives];
    session.updatedAt = capturedAt;
    sessions[sessionIndex] = session;

    await persistSessions(sessions);

    return positive;
  });
}
