import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  AppState,
  BackHandler,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  Camera,
  useCameraDevice,
  useCameraPermission,
} from 'react-native-vision-camera';

import {
  AI_STATUS,
  LiveInferenceEngine,
  createEmptyStats,
} from '../ml/liveInference';

import { useDiagnosis } from '../context/DiagnosisContext';

import { saveLiveDiagnosisToHistory } from '../services/liveHistory';

import {
  createLiveSessionId,
  loadLiveSessions,
  MAX_POSITIVES_PER_SESSION,
  POSITIVE_SAVE_INTERVAL_MS,
  saveLivePositive,
  startLiveSession,
} from '../services/liveSessionStore';

export const CAMERA_STATUS = {
  IDLE: 'idle',
  REQUESTING: 'requesting',
  STARTING: 'starting',
  ACTIVE: 'active',
  STOPPED: 'stopped',
  ERROR: 'error',
  INTERRUPTED: 'interrupted',
  PERMISSION_DENIED: 'permissionDenied',
};

const CAMERA_READY_TIMEOUT_MS = 5000;

const DISCLAIMER =
  'Experimental AI-assisted screening. Results are generated for research and testing purposes only and are not a medical diagnosis. Do not use these predictions as a substitute for professional clinical examination.';

const OVERLAY = {
  panel: 'rgba(8, 11, 8, 0.91)',
  panelSoft: 'rgba(255, 255, 255, 0.09)',
  panelStrong: 'rgba(255, 255, 255, 0.16)',
  drawer: '#0C110C',
  text: '#FFFFFF',
  muted: '#C4CDC4',
  accent: '#8CE99A',
  accentStrong: '#5DD978',
  danger: '#FF9B90',
  warning: '#FFD27A',
  border: 'rgba(255, 255, 255, 0.22)',
  darkText: '#071408',
};

const STATUS_LABELS = {
  [CAMERA_STATUS.IDLE]: 'Camera off',
  [CAMERA_STATUS.REQUESTING]: 'Requesting camera',
  [CAMERA_STATUS.STARTING]: 'Starting camera',
  [CAMERA_STATUS.ACTIVE]: 'Camera live',
  [CAMERA_STATUS.STOPPED]: 'Camera off',
  [CAMERA_STATUS.ERROR]: 'Camera error',
  [CAMERA_STATUS.INTERRUPTED]: 'Camera interrupted',
  [CAMERA_STATUS.PERMISSION_DENIED]: 'Permission needed',
};

const AI_STATUS_LABELS = {
  [AI_STATUS.OFF]: 'AI off',
  [AI_STATUS.LOADING]: 'Loading model',
  [AI_STATUS.READY]: 'Model ready',
  [AI_STATUS.ANALYZING]: 'Analyzing',
  [AI_STATUS.PAUSED]: 'Paused',
  [AI_STATUS.ERROR]: 'Inference error',
};

function getErrorMessage(error) {
  if (typeof error === 'string') {
    return error;
  }

  return error?.message || 'Something went wrong.';
}

function formatPercent(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '--';
  }

  return `${(value * 100).toFixed(1)}%`;
}

function formatPrediction(prediction) {
  if (!prediction) {
    return 'Waiting for frames';
  }

  return prediction.className === 'CANCER'
    ? 'Potential finding: Cancer'
    : 'Potential finding: Non-cancer';
}

function formatTimestamp(timestamp) {
  if (!timestamp) {
    return 'No inference yet';
  }

  return new Date(timestamp).toLocaleTimeString();
}

function formatSessionTime(timestamp) {
  if (!timestamp) {
    return '';
  }

  const date = new Date(timestamp);

  return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
}

function statValue(value, suffix = '') {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '--';
  }

  return `${value}${suffix}`;
}

function getCameraStatusColor(status) {
  switch (status) {
    case CAMERA_STATUS.ACTIVE:
      return OVERLAY.accent;

    case CAMERA_STATUS.REQUESTING:
    case CAMERA_STATUS.STARTING:
    case CAMERA_STATUS.INTERRUPTED:
      return OVERLAY.warning;

    case CAMERA_STATUS.ERROR:
    case CAMERA_STATUS.PERMISSION_DENIED:
      return OVERLAY.danger;

    default:
      return OVERLAY.muted;
  }
}

function getAiStatusColor(status) {
  switch (status) {
    case AI_STATUS.READY:
      return OVERLAY.accent;

    case AI_STATUS.LOADING:
    case AI_STATUS.ANALYZING:
      return OVERLAY.warning;

    case AI_STATUS.ERROR:
      return OVERLAY.danger;

    default:
      return OVERLAY.muted;
  }
}

function AiStatusBadge({ status }) {
  const showSpinner =
    status === AI_STATUS.LOADING ||
    status === AI_STATUS.ANALYZING;

  return (
    <View style={styles.aiBadge}>
      {showSpinner ? (
        <ActivityIndicator
          color={OVERLAY.warning}
          size="small"
          style={styles.aiBadgeSpinner}
        />
      ) : (
        <View
          style={[
            styles.dot,
            {
              backgroundColor: getAiStatusColor(status),
            },
          ]}
        />
      )}

      <Text style={styles.aiBadgeText}>
        {AI_STATUS_LABELS[status] ?? 'AI off'}
      </Text>
    </View>
  );
}

function MetricItem({ label, value }) {
  return (
    <View style={styles.metricItem}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function ProbabilityCard({ label, value, color }) {
  const width =
    typeof value === 'number' && Number.isFinite(value)
      ? `${Math.max(0, Math.min(1, value)) * 100}%`
      : '0%';

  return (
    <View style={styles.probabilityCard}>
      <Text style={styles.probabilityLabel}>{label}</Text>
      <Text style={[styles.probabilityValue, { color }]}>
        {formatPercent(value)}
      </Text>
      <View style={styles.probabilityTrack}>
        <View
          style={[
            styles.probabilityFill,
            {
              width,
              backgroundColor: color,
            },
          ]}
        />
      </View>
    </View>
  );
}

function PositiveCaseRow({ item }) {
  const uri = item.imagePath.startsWith('file://')
    ? item.imagePath
    : `file://${item.imagePath}`;

  return (
    <View style={styles.caseRow}>
      <Image
        accessibilityLabel="Positive case thumbnail"
        source={{ uri }}
        style={styles.caseImage}
      />

      <View style={styles.caseCopy}>
        <Text style={styles.caseTitle}>
          {item.className === 'CANCER'
            ? 'Cancer'
            : 'Non-cancer'}{' '}
          {formatPercent(item.confidence)}
        </Text>
        <Text style={styles.caseMeta}>
          {formatSessionTime(item.capturedAt)}
        </Text>
      </View>
    </View>
  );
}

function PositiveDrawer({
  visible,
  onClose,
  sessions,
  activeSessionId,
}) {
  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <View style={styles.drawerRoot}>
        <Pressable
          accessibilityLabel="Dismiss positive cases"
          onPress={onClose}
          style={styles.drawerBackdrop}
        />

        <View style={styles.drawerPanel}>
          <View style={styles.drawerHeader}>
            <View style={styles.drawerHeaderCopy}>
              <Text style={styles.drawerTitle}>Positive cases</Text>
              <Text style={styles.drawerSubtitle}>
                Saved locally for this experimental live session.
              </Text>
            </View>

            <Pressable
              accessibilityLabel="Close positive cases"
              accessibilityRole="button"
              onPress={onClose}
              style={styles.drawerClose}
            >
              <Text style={styles.drawerCloseText}>×</Text>
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.drawerContent}
            showsVerticalScrollIndicator={false}
          >
            {sessions.length === 0 ? (
              <View style={styles.drawerEmpty}>
                <Text style={styles.drawerEmptyTitle}>
                  No positive cases yet
                </Text>
                <Text style={styles.drawerEmptyText}>
                  CANCER predictions are saved automatically at most once
                  every 3 seconds while inference is running.
                </Text>
              </View>
            ) : (
              sessions.map(session => (
                <View key={session.id} style={styles.sessionBlock}>
                  <View style={styles.sessionHeader}>
                    <Text style={styles.sessionTitle}>
                      {session.id === activeSessionId
                        ? 'Current session'
                        : 'Past session'}
                    </Text>
                    <Text style={styles.sessionCount}>
                      {session.positives.length}{' '}
                      {session.positives.length === 1
                        ? 'case'
                        : 'cases'}
                    </Text>
                  </View>

                  <Text style={styles.sessionId}>{session.id}</Text>
                  <Text style={styles.sessionMeta}>
                    Started {formatSessionTime(session.startedAt)}
                  </Text>

                  {session.positives.length === 0 ? (
                    <Text style={styles.sessionEmpty}>
                      No positive cases in this session.
                    </Text>
                  ) : (
                    session.positives.map(item => (
                      <PositiveCaseRow item={item} key={item.id} />
                    ))
                  )}
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default function LiveVideoScreen({
  onBack,
  isFocused = true,
}) {
  const { diagnosis: activeDiagnosis } = useDiagnosis() ?? {};

  const {
    hasPermission,
    canRequestPermission,
    requestPermission,
  } = useCameraPermission();

  const device = useCameraDevice('back');

  const [status, setStatus] = useState(CAMERA_STATUS.IDLE);
  const [message, setMessage] = useState('');
  const [wantActive, setWantActive] = useState(false);
  const [appActive, setAppActive] = useState(
    AppState.currentState === 'active',
  );

  const [inferenceEnabled, setInferenceEnabled] = useState(false);
  const [aiStatus, setAiStatus] = useState(AI_STATUS.OFF);
  const [prediction, setPrediction] = useState(null);
  const [aiError, setAiError] = useState('');
  const [aiStats, setAiStats] = useState(createEmptyStats);
  const [statsVisible, setStatsVisible] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);

  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [positiveSaveError, setPositiveSaveError] = useState('');
  const [historySaving, setHistorySaving] = useState(false);
  const [historyMessage, setHistoryMessage] = useState('');
  const [savedPredictionTimestamp, setSavedPredictionTimestamp] =
    useState(null);

  const cameraRef = useRef(null);
  const mountedRef = useRef(true);
  const appActiveRef = useRef(AppState.currentState === 'active');
  const activeIntentRef = useRef(false);
  const requestInFlightRef = useRef(false);
  const requestTokenRef = useRef(0);
  const engineRef = useRef(null);
  const autoStartRef = useRef(false);

  const predictionFrameRef = useRef(null);

  const activeSessionIdRef = useRef(null);
  const lastPositiveSaveAtRef = useRef(0);
  const positiveSaveInFlightRef = useRef(false);
  const positiveLimitReachedRef = useRef(false);

  const refreshSessions = useCallback(async () => {
    const next = await loadLiveSessions();

    if (mountedRef.current) {
      setSessions(next);
    }
  }, []);

  const savePositive = useCallback(
    (result, frameBuffer) => {
      const sessionId = activeSessionIdRef.current;
      const capturedAt =
        typeof result.timestamp === 'number'
          ? result.timestamp
          : Date.now();

      if (!sessionId || !frameBuffer) {
        return;
      }

      if (positiveLimitReachedRef.current) {
        return;
      }

      if (
        capturedAt - lastPositiveSaveAtRef.current <
        POSITIVE_SAVE_INTERVAL_MS
      ) {
        return;
      }

      if (positiveSaveInFlightRef.current) {
        return;
      }

      lastPositiveSaveAtRef.current = capturedAt;
      positiveSaveInFlightRef.current = true;

      saveLivePositive({
        sessionId,
        frameBuffer,
        prediction: result,
        capturedAt,
      })
        .then(saved => {
          if (!mountedRef.current) {
            return;
          }

          if (saved) {
            setPositiveSaveError('');
            refreshSessions();
            return;
          }

          positiveLimitReachedRef.current = true;
          setPositiveSaveError(
            `Positive case limit reached (${MAX_POSITIVES_PER_SESSION} per session).`,
          );
        })
        .catch(error => {
          if (mountedRef.current) {
            setPositiveSaveError(getErrorMessage(error));
          }
        })
        .finally(() => {
          positiveSaveInFlightRef.current = false;
        });
    },
    [refreshSessions],
  );

  const handleEngineResult = useCallback(
    result => {
      if (!mountedRef.current) {
        return;
      }

      const { frameBuffer, ...visiblePrediction } = result;

      predictionFrameRef.current = frameBuffer
        ? {
            timestamp: visiblePrediction.timestamp,
            frameBuffer,
          }
        : null;

      setPrediction(visiblePrediction);
      setAiError('');

      if (
        visiblePrediction.className === 'CANCER' &&
        frameBuffer
      ) {
        savePositive(visiblePrediction, frameBuffer);
      }
    },
    [savePositive],
  );

  if (!engineRef.current) {
    engineRef.current = new LiveInferenceEngine({
      takeSnapshot: () => {
        const camera = cameraRef.current;

        if (
          !camera ||
          typeof camera.takeSnapshot !== 'function'
        ) {
          throw new Error(
            'Camera preview is not ready.',
          );
        }

        return camera.takeSnapshot();
      },
      onStatus: nextStatus => {
        if (mountedRef.current) {
          setAiStatus(nextStatus);
        }
      },
      onResult: handleEngineResult,
      onStats: stats => {
        if (mountedRef.current) {
          setAiStats(stats);
        }
      },
      onError: error => {
        if (mountedRef.current) {
          setAiError(getErrorMessage(error));
        }
      },
      onFatal: error => {
        if (mountedRef.current) {
          setInferenceEnabled(false);
          setAiStatus(AI_STATUS.ERROR);
          setAiError(getErrorMessage(error));
        }
      },
    });
  }

  const handleSaveToHistory = useCallback(async () => {
    const currentPrediction = prediction;
    const frameEntry = predictionFrameRef.current;
    const frameBuffer =
      frameEntry?.timestamp === currentPrediction?.timestamp
        ? frameEntry.frameBuffer
        : null;

    if (!currentPrediction || !frameBuffer || historySaving) {
      return;
    }

    if (savedPredictionTimestamp === currentPrediction.timestamp) {
      return;
    }

    setHistorySaving(true);
    setHistoryMessage('');

    try {
      const { diagnosisId } = await saveLiveDiagnosisToHistory({
        prediction: currentPrediction,
        frameBuffer,
        capturedAt:
          typeof currentPrediction.timestamp === 'number'
            ? currentPrediction.timestamp
            : Date.now(),
        patient: activeDiagnosis?.patient,
        hospitalDetails: activeDiagnosis?.hospitalDetails,
        modelName: currentPrediction.model?.name,
        modelVersion: currentPrediction.model?.version,
      });

      if (!mountedRef.current) {
        return;
      }

      setSavedPredictionTimestamp(currentPrediction.timestamp);
      setHistoryMessage(`Saved to history (${diagnosisId}).`);
    } catch (error) {
      if (mountedRef.current) {
        setHistoryMessage(getErrorMessage(error));
      }
    } finally {
      if (mountedRef.current) {
        setHistorySaving(false);
      }
    }
  }, [
    activeDiagnosis?.hospitalDetails,
    activeDiagnosis?.patient,
    historySaving,
    prediction,
    savedPredictionTimestamp,
  ]);

  const resetAiState = useCallback(() => {
    engineRef.current?.stop();

    if (!mountedRef.current) {
      return;
    }

    setInferenceEnabled(false);
    setAiStatus(AI_STATUS.OFF);
    setPrediction(null);
    setAiStats(createEmptyStats());
    setAiError('');
    predictionFrameRef.current = null;
    setHistoryMessage('');
    setSavedPredictionTimestamp(null);
  }, []);

  const stopCamera = useCallback(
    (nextStatus, nextMessage = '') => {
      // Invalidate any in-flight permission request so it cannot start the
      // camera after the user has stopped it or left the screen.
      requestTokenRef.current += 1;
      requestInFlightRef.current = false;
      activeIntentRef.current = false;

      resetAiState();

      if (!mountedRef.current) {
        return;
      }

      setWantActive(false);
      setStatus(nextStatus);
      setMessage(nextMessage);
    },
    [resetAiState],
  );

  // Track mount state so async permission/camera callbacks never update an
  // unmounted screen. Unmounting the screen is also what releases the camera
  // in this app because screens are swapped by the root navigator.
  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      activeIntentRef.current = false;
      requestInFlightRef.current = false;
      requestTokenRef.current += 1;
      engineRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    refreshSessions();
  }, [refreshSessions]);

  // Never keep streaming or inferring while OralScan is in the background.
  // Returning to the foreground intentionally does not restart either one;
  // the user must tap Start camera again.
  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      nextState => {
        const isAppActive = nextState === 'active';

        appActiveRef.current = isAppActive;
        setAppActive(isAppActive);

        if (!isAppActive && activeIntentRef.current) {
          stopCamera(
            CAMERA_STATUS.STOPPED,
            'Camera stopped because the app moved to the background.',
          );
        }
      },
    );

    return () => subscription.remove();
  }, [stopCamera]);

  // This project uses a state-based screen switcher rather than a navigation
  // library, so the screen unmounts when the user navigates away. The
  // isFocused prop is still honoured for callers that keep it mounted.
  useEffect(() => {
    if (!isFocused && activeIntentRef.current) {
      stopCamera(CAMERA_STATUS.STOPPED);
    }
  }, [isFocused, stopCamera]);

  // If camera access is revoked while streaming, release the camera at once.
  useEffect(() => {
    if (!hasPermission && activeIntentRef.current) {
      stopCamera(
        CAMERA_STATUS.PERMISSION_DENIED,
        'Camera permission was revoked. Enable it in Android App Settings and try again.',
      );
    }
  }, [hasPermission, stopCamera]);

  // useCameraPermission re-checks the permission when the app returns from
  // Android Settings. Clear the stale blocked/denied UI once it is granted.
  useEffect(() => {
    if (!hasPermission || activeIntentRef.current) {
      return;
    }

    setStatus(current =>
      current === CAMERA_STATUS.PERMISSION_DENIED
        ? CAMERA_STATUS.IDLE
        : current,
    );

    setMessage(current =>
      current.startsWith('Camera permission') ||
      current.startsWith('Camera access is blocked')
        ? ''
        : current,
    );
  }, [hasPermission]);

  // Surface a clear error if a rear camera never becomes available.
  useEffect(() => {
    if (!wantActive || device) {
      return undefined;
    }

    const timer = setTimeout(() => {
      if (mountedRef.current && activeIntentRef.current) {
        stopCamera(
          CAMERA_STATUS.ERROR,
          'No rear camera is available on this device.',
        );
      }
    }, CAMERA_READY_TIMEOUT_MS);

    return () => clearTimeout(timer);
  }, [device, stopCamera, wantActive]);

  const handleStart = useCallback(async () => {
    if (
      !isFocused ||
      activeIntentRef.current ||
      requestInFlightRef.current
    ) {
      return;
    }

    if (!appActiveRef.current) {
      setStatus(CAMERA_STATUS.STOPPED);
      setMessage(
        'Return to OralScan and tap Start camera to try again.',
      );
      return;
    }

    setMessage('');

    let granted = hasPermission;

    if (!granted) {
      if (!canRequestPermission) {
        setStatus(CAMERA_STATUS.PERMISSION_DENIED);
        setMessage(
          'Camera access is blocked. Enable camera permission for OralScan in Android App Settings.',
        );
        return;
      }

      const token = requestTokenRef.current + 1;

      requestTokenRef.current = token;
      requestInFlightRef.current = true;
      setStatus(CAMERA_STATUS.REQUESTING);

      try {
        granted = await requestPermission();
      } catch (error) {
        if (
          mountedRef.current &&
          token === requestTokenRef.current
        ) {
          requestInFlightRef.current = false;
          setStatus(CAMERA_STATUS.ERROR);
          setMessage(
            'Unable to request camera permission. Please try again.',
          );
        }

        return;
      }

      if (!mountedRef.current || token !== requestTokenRef.current) {
        return;
      }

      requestInFlightRef.current = false;

      if (!granted) {
        setStatus(CAMERA_STATUS.PERMISSION_DENIED);
        setMessage(
          'Camera permission was denied. Try again or enable it in Android App Settings.',
        );
        return;
      }
    }

    if (!appActiveRef.current) {
      setStatus(CAMERA_STATUS.STOPPED);
      setMessage(
        'Return to OralScan and tap Start camera to try again.',
      );
      return;
    }

    resetAiState();
    activeIntentRef.current = true;
    setWantActive(true);
    setStatus(CAMERA_STATUS.STARTING);
  }, [
    canRequestPermission,
    hasPermission,
    isFocused,
    requestPermission,
    resetAiState,
  ]);

  // Open the camera automatically once per visit. It is intentionally not
  // restarted after a background/interruption; the user must resume it.
  useEffect(() => {
    if (
      autoStartRef.current ||
      !isFocused ||
      !appActive ||
      status !== CAMERA_STATUS.IDLE
    ) {
      return;
    }

    autoStartRef.current = true;
    handleStart();
  }, [appActive, handleStart, isFocused, status]);

  const handleBack = useCallback(() => {
    // Release the camera before the root navigator swaps this screen out.
    if (activeIntentRef.current || requestInFlightRef.current) {
      stopCamera(CAMERA_STATUS.STOPPED);
    } else {
      engineRef.current?.stop();
    }

    onBack?.();
  }, [onBack, stopCamera]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (drawerVisible) {
          setDrawerVisible(false);
          return true;
        }

        handleBack();
        return true;
      },
    );

    return () => subscription.remove();
  }, [drawerVisible, handleBack]);

  const handleOpenSettings = useCallback(async () => {
    try {
      await Linking.openSettings();
    } catch {
      if (mountedRef.current) {
        setMessage(
          'Unable to open Android Settings. Open Settings > Apps > OralScan > Permissions manually.',
        );
      }
    }
  }, []);

  const handlePreviewStarted = useCallback(() => {
    if (mountedRef.current && activeIntentRef.current) {
      setStatus(CAMERA_STATUS.ACTIVE);
    }
  }, []);

  const handlePreviewStopped = useCallback(() => {
    if (mountedRef.current && activeIntentRef.current) {
      stopCamera(
        CAMERA_STATUS.STOPPED,
        'Camera preview stopped. Tap Start camera to try again.',
      );
    }
  }, [stopCamera]);

  const handleCameraError = useCallback(
    error => {
      if (mountedRef.current && activeIntentRef.current) {
        stopCamera(
          CAMERA_STATUS.ERROR,
          getErrorMessage(error) ||
            'The camera could not be started.',
        );
      }
    },
    [stopCamera],
  );

  const handleInterruption = useCallback(() => {
    if (mountedRef.current && activeIntentRef.current) {
      stopCamera(
        CAMERA_STATUS.INTERRUPTED,
        'The camera was interrupted. Tap Start camera to try again.',
      );
    }
  }, [stopCamera]);

  const handleToggleInference = useCallback(async () => {
    if (inferenceEnabled) {
      engineRef.current?.stop();
      setInferenceEnabled(false);
      setAiStatus(AI_STATUS.PAUSED);
      setAiError('');

      return;
    }

    if (
      status !== CAMERA_STATUS.ACTIVE ||
      !isFocused ||
      !appActiveRef.current
    ) {
      setAiError(
        'Start the camera before enabling live inference.',
      );

      return;
    }

    const sessionId = createLiveSessionId();

    activeSessionIdRef.current = sessionId;
    setActiveSessionId(sessionId);
    lastPositiveSaveAtRef.current = 0;
    positiveLimitReachedRef.current = false;
    setPositiveSaveError('');
    setAiError('');
    setPrediction(null);
    setAiStats(createEmptyStats());
    setInferenceEnabled(true);
    setAiStatus(AI_STATUS.LOADING);

    try {
      await startLiveSession(sessionId);
      await refreshSessions();
    } catch (error) {
      if (mountedRef.current) {
        setPositiveSaveError(getErrorMessage(error));
      }
    }

    try {
      await engineRef.current.start();
    } catch (error) {
      if (mountedRef.current) {
        setInferenceEnabled(false);
        setAiStatus(AI_STATUS.ERROR);
        setAiError(getErrorMessage(error));
      }
    }
  }, [
    inferenceEnabled,
    isFocused,
    refreshSessions,
    status,
  ]);

  const permissionBlocked = !hasPermission && !canRequestPermission;

  const displayStatus =
    !hasPermission && status !== CAMERA_STATUS.REQUESTING
      ? CAMERA_STATUS.PERMISSION_DENIED
      : status;

  const statusLabel = STATUS_LABELS[displayStatus] ?? 'Camera off';
  const statusColor = getCameraStatusColor(displayStatus);

  const defaultMessage = permissionBlocked
    ? 'Camera access is blocked. Enable camera permission for OralScan in Android App Settings.'
    : !hasPermission
    ? 'Camera permission is required to show the live preview.'
    : '';

  const displayMessage = message || defaultMessage;

  const showCamera = hasPermission && wantActive && !!device;
  const isStartingCamera =
    wantActive && hasPermission && !device && !displayMessage;

  const aiButtonLabel = inferenceEnabled
    ? 'Stop inference'
    : aiStatus === AI_STATUS.ERROR
    ? 'Retry inference'
    : 'Start inference';

  const aiButtonDisabled =
    !inferenceEnabled && status !== CAMERA_STATUS.ACTIVE;

  const predictionLabel = formatPrediction(prediction);
  const cancerProbability = prediction?.probabilities?.CANCER;
  const nonCancerProbability =
    prediction?.probabilities?.['NON CANCER'];

  const alreadySaved =
    !!prediction &&
    savedPredictionTimestamp === prediction.timestamp;

  const matchingFrame =
    !!prediction &&
    predictionFrameRef.current?.timestamp === prediction.timestamp
      ? predictionFrameRef.current.frameBuffer
      : null;

  const canSaveHistory =
    !!prediction &&
    !!matchingFrame &&
    !historySaving &&
    !alreadySaved;

  const currentSession = sessions.find(
    session => session.id === activeSessionId,
  );
  const positiveCount = currentSession?.positives.length ?? 0;

  let cameraActionLabel = 'Start camera';

  if (!hasPermission) {
    cameraActionLabel = permissionBlocked
      ? 'Open Settings'
      : 'Grant camera permission';
  }

  const handleCameraAction = () => {
    if (permissionBlocked) {
      handleOpenSettings();
      return;
    }

    handleStart();
  };

  let placeholderTitle = 'Camera is off';
  let placeholderText =
    'Tap Start camera to open the full-screen preview.';

  if (!hasPermission) {
    placeholderTitle = permissionBlocked
      ? 'Camera access blocked'
      : 'Camera permission needed';
    placeholderText =
      displayMessage ||
      defaultMessage ||
      'Allow camera access to see the live rear-camera preview.';
  } else if (isStartingCamera) {
    placeholderTitle = 'Starting camera…';
    placeholderText =
      'Waiting for the rear camera to become ready.';
  } else if (displayStatus === CAMERA_STATUS.ERROR) {
    placeholderTitle = 'Camera error';
    placeholderText =
      displayMessage || 'The camera could not be started.';
  } else if (displayStatus === CAMERA_STATUS.INTERRUPTED) {
    placeholderTitle = 'Camera interrupted';
    placeholderText =
      displayMessage ||
      'The camera was interrupted. Tap Start camera to try again.';
  } else if (displayStatus === CAMERA_STATUS.STOPPED) {
    placeholderTitle = 'Camera off';
    placeholderText =
      displayMessage ||
      'Tap Start camera to resume the full-screen preview.';
  } else if (displayStatus === CAMERA_STATUS.STARTING) {
    placeholderTitle = 'Starting camera…';
    placeholderText =
      'Waiting for the rear camera to become ready.';
  }

  const showPlaceholderAction =
    !showCamera &&
    displayStatus !== CAMERA_STATUS.REQUESTING &&
    displayStatus !== CAMERA_STATUS.STARTING;

  return (
    <View style={styles.container}>
      <View style={styles.cameraStage}>
        {showCamera ? (
          <Camera
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            device={device}
            isActive
            resizeMode="cover"
            onPreviewStarted={handlePreviewStarted}
            onPreviewStopped={handlePreviewStopped}
            onError={handleCameraError}
            onInterruptionStarted={handleInterruption}
          />
        ) : (
          <View style={styles.placeholder}>
            {displayStatus === CAMERA_STATUS.REQUESTING ||
            displayStatus === CAMERA_STATUS.STARTING ||
            isStartingCamera ? (
              <ActivityIndicator
                color={OVERLAY.accent}
                size="large"
              />
            ) : (
              <Text style={styles.placeholderIcon}>▣</Text>
            )}

            <Text style={styles.placeholderTitle}>
              {placeholderTitle}
            </Text>

            <Text style={styles.placeholderText}>
              {placeholderText}
            </Text>

            {showPlaceholderAction && (
              <Pressable
                accessibilityLabel={cameraActionLabel}
                accessibilityRole="button"
                onPress={handleCameraAction}
                style={({ pressed }) => [
                  styles.placeholderButton,
                  {
                    opacity: pressed ? 0.82 : 1,
                  },
                ]}
              >
                <Text style={styles.placeholderButtonText}>
                  {cameraActionLabel}
                </Text>
              </Pressable>
            )}

            {permissionBlocked && (
              <Pressable
                accessibilityLabel="Try camera permission again"
                accessibilityRole="button"
                onPress={handleStart}
                style={styles.placeholderSecondary}
              >
                <Text style={styles.placeholderSecondaryText}>
                  Try again
                </Text>
              </Pressable>
            )}
          </View>
        )}
      </View>

      <View style={styles.topBar}>
        <Pressable
          accessibilityLabel="Go back"
          accessibilityRole="button"
          onPress={handleBack}
          style={({ pressed }) => [
            styles.roundButton,
            {
              opacity: pressed ? 0.78 : 1,
            },
          ]}
        >
          <Text style={styles.backText}>‹</Text>
        </Pressable>

        <View pointerEvents="none" style={styles.topCenter}>
          <Text style={styles.topTitle}>Live detection</Text>

          <View style={styles.statusLine}>
            <View
              style={[
                styles.dot,
                {
                  backgroundColor: statusColor,
                },
              ]}
            />
            <Text style={styles.statusLineText}>{statusLabel}</Text>
          </View>
        </View>

        <Pressable
          accessibilityLabel="Open positive cases"
          accessibilityRole="button"
          onPress={() => setDrawerVisible(true)}
          style={({ pressed }) => [
            styles.casesButton,
            {
              opacity: pressed ? 0.78 : 1,
            },
          ]}
        >
          <Text style={styles.casesButtonLabel}>Cases</Text>
          <Text style={styles.casesButtonCount}>
            {positiveCount}
          </Text>
        </Pressable>
      </View>

      <View style={styles.bottomPanel}>
        <View style={styles.predictionHeader}>
          <Text style={styles.predictionLabel}>
            Model prediction
          </Text>

          <AiStatusBadge status={aiStatus} />
        </View>

        <Text
          style={[
            styles.predictionText,
            {
              color:
                prediction?.className === 'CANCER'
                  ? OVERLAY.danger
                  : OVERLAY.text,
            },
          ]}
        >
          {predictionLabel}
        </Text>

        <Text style={styles.predictionMeta}>
          Confidence {formatPercent(prediction?.probability)}
          {'  ·  '}
          {formatTimestamp(prediction?.timestamp)}
        </Text>

        <View style={styles.probabilityRow}>
          <ProbabilityCard
            color={OVERLAY.danger}
            label="Cancer"
            value={cancerProbability}
          />
          <ProbabilityCard
            color={OVERLAY.accent}
            label="Non-cancer"
            value={nonCancerProbability}
          />
        </View>

        <Pressable
          accessibilityLabel="Save to History"
          accessibilityRole="button"
          disabled={!canSaveHistory}
          onPress={handleSaveToHistory}
          style={({ pressed }) => [
            styles.historyButton,
            {
              borderColor: alreadySaved
                ? OVERLAY.accent
                : OVERLAY.border,
              opacity: canSaveHistory
                ? pressed
                  ? 0.82
                  : 1
                : 0.48,
            },
          ]}
        >
          {historySaving ? (
            <ActivityIndicator
              color={OVERLAY.accent}
              size="small"
            />
          ) : (
            <Text style={styles.historyButtonText}>
              {alreadySaved ? 'Saved to History' : 'Save to History'}
            </Text>
          )}
        </Pressable>

        {!!historyMessage && (
          <Text style={styles.historyMessage}>
            {historyMessage}
          </Text>
        )}

        {statsVisible && (
          <View style={styles.statsPanel}>
            <View style={styles.statsGrid}>
              <MetricItem
                label="Rate"
                value={statValue(
                  aiStats.processed > 0
                    ? Number(aiStats.actualHz.toFixed(2))
                    : null,
                  '/s',
                )}
              />
              <MetricItem
                label="Processed"
                value={statValue(
                  aiStats.processed > 0
                    ? aiStats.processed
                    : null,
                )}
              />
              <MetricItem
                label="Dropped"
                value={statValue(aiStats.dropped)}
              />
              <MetricItem
                label="Latency"
                value={statValue(
                  prediction
                    ? Math.round(prediction.durationMs)
                    : null,
                  ' ms',
                )}
              />
            </View>

            <Text style={styles.sessionLine}>
              Session {activeSessionId ?? 'not started'}
            </Text>
          </View>
        )}

        {!!aiError && (
          <Text style={styles.errorText}>{aiError}</Text>
        )}

        {!!positiveSaveError && (
          <Text style={styles.warningText}>
            {positiveSaveError}
          </Text>
        )}

        <View style={styles.controlsRow}>
          <View style={styles.controlSide}>
            <Pressable
              accessibilityLabel={
                statsVisible
                  ? 'Hide inference stats'
                  : 'Show inference stats'
              }
              accessibilityRole="button"
              onPress={() =>
                setStatsVisible(current => !current)
              }
              style={({ pressed }) => [
                styles.smallButton,
                {
                  opacity: pressed ? 0.78 : 1,
                },
              ]}
            >
              <Text style={styles.smallButtonText}>
                {statsVisible ? 'Hide stats' : 'Stats'}
              </Text>
            </Pressable>
          </View>

          <Pressable
            accessibilityLabel={aiButtonLabel}
            accessibilityRole="button"
            disabled={aiButtonDisabled}
            onPress={handleToggleInference}
            style={({ pressed }) => [
              styles.inferenceButton,
              {
                backgroundColor: inferenceEnabled
                  ? OVERLAY.danger
                  : OVERLAY.accent,
                opacity: aiButtonDisabled
                  ? 0.42
                  : pressed
                  ? 0.82
                  : 1,
              },
            ]}
          >
            {inferenceEnabled &&
            (aiStatus === AI_STATUS.LOADING ||
              aiStatus === AI_STATUS.ANALYZING) ? (
              <ActivityIndicator
                color={OVERLAY.darkText}
                size="small"
                style={styles.inferenceSpinner}
              />
            ) : (
              <Text style={styles.inferenceButtonIcon}>
                {inferenceEnabled ? '■' : '▶'}
              </Text>
            )}

            <Text style={styles.inferenceButtonText}>
              {aiButtonLabel}
            </Text>
          </Pressable>

          <View style={styles.controlSide} />
        </View>

        <Text style={styles.disclaimer}>{DISCLAIMER}</Text>
        <Text style={styles.storageNote}>
          Positive frames are kept in this experimental session only. Use Save
          to History to store the latest prediction and frame as a patient
          record.
        </Text>
      </View>

      <PositiveDrawer
        activeSessionId={activeSessionId}
        onClose={() => setDrawerVisible(false)}
        sessions={sessions}
        visible={drawerVisible}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050705',
  },

  cameraStage: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: '#050705',
  },

  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 34,
    paddingBottom: 220,
  },

  placeholderIcon: {
    color: '#7E8B7E',
    fontSize: 62,
    marginBottom: 14,
  },

  placeholderTitle: {
    color: OVERLAY.text,
    fontSize: 21,
    fontWeight: '700',
    textAlign: 'center',
  },

  placeholderText: {
    color: OVERLAY.muted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 9,
    maxWidth: 320,
    textAlign: 'center',
  },

  placeholderButton: {
    backgroundColor: OVERLAY.accent,
    borderRadius: 999,
    marginTop: 22,
    paddingHorizontal: 24,
    paddingVertical: 13,
  },

  placeholderButtonText: {
    color: OVERLAY.darkText,
    fontSize: 15,
    fontWeight: '700',
  },

  placeholderSecondary: {
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },

  placeholderSecondaryText: {
    color: OVERLAY.accent,
    fontSize: 13,
    fontWeight: '600',
  },

  topBar: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 46,
  },

  roundButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderColor: OVERLAY.border,
    borderWidth: 1,
  },

  backText: {
    color: OVERLAY.text,
    fontSize: 34,
    fontWeight: '300',
    lineHeight: 36,
    marginTop: -3,
  },

  topCenter: {
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: 8,
    paddingTop: 2,
  },

  topTitle: {
    color: OVERLAY.text,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.2,
    textShadowColor: 'rgba(0, 0, 0, 0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  statusLine: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(0, 0, 0, 0.48)',
  },

  statusLineText: {
    color: OVERLAY.muted,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.2,
    marginLeft: 5,
  },

  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },

  casesButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 64,
    height: 44,
    borderRadius: 22,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderColor: OVERLAY.border,
    borderWidth: 1,
  },

  casesButtonLabel: {
    color: OVERLAY.muted,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },

  casesButtonCount: {
    color: OVERLAY.accent,
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 17,
  },

  bottomPanel: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: OVERLAY.panel,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 20,
  },

  predictionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  predictionLabel: {
    color: OVERLAY.muted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },

  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: OVERLAY.panelSoft,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },

  aiBadgeSpinner: {
    marginRight: 5,
  },

  aiBadgeText: {
    color: OVERLAY.muted,
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 5,
  },

  predictionText: {
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 27,
    marginTop: 4,
  },

  predictionMeta: {
    color: OVERLAY.muted,
    fontSize: 11,
    marginTop: 2,
  },

  probabilityRow: {
    flexDirection: 'row',
    marginTop: 11,
    marginHorizontal: -5,
  },

  probabilityCard: {
    flex: 1,
    backgroundColor: OVERLAY.panelSoft,
    borderRadius: 14,
    marginHorizontal: 5,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },

  probabilityLabel: {
    color: OVERLAY.muted,
    fontSize: 10,
    fontWeight: '600',
  },

  probabilityValue: {
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 29,
    marginTop: 1,
  },

  probabilityTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    marginTop: 6,
    overflow: 'hidden',
  },

  probabilityFill: {
    height: 3,
    borderRadius: 2,
  },

  historyButton: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 10,
    paddingVertical: 11,
  },

  historyButtonText: {
    color: OVERLAY.accent,
    fontSize: 13,
    fontWeight: '700',
  },

  historyMessage: {
    color: OVERLAY.muted,
    fontSize: 10,
    lineHeight: 14,
    marginTop: 6,
  },

  statsPanel: {
    backgroundColor: OVERLAY.panelSoft,
    borderRadius: 14,
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },

  statsGrid: {
    flexDirection: 'row',
  },

  metricItem: {
    flex: 1,
    alignItems: 'center',
  },

  metricValue: {
    color: OVERLAY.text,
    fontSize: 15,
    fontWeight: '800',
  },

  metricLabel: {
    color: OVERLAY.muted,
    fontSize: 9,
    fontWeight: '600',
    marginTop: 1,
  },

  sessionLine: {
    color: OVERLAY.muted,
    fontSize: 9,
    marginTop: 6,
    textAlign: 'center',
  },

  errorText: {
    color: OVERLAY.danger,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 8,
  },

  warningText: {
    color: OVERLAY.warning,
    fontSize: 10,
    lineHeight: 14,
    marginTop: 6,
  },

  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 11,
  },

  controlSide: {
    flex: 1,
    alignItems: 'flex-start',
  },

  smallButton: {
    borderColor: OVERLAY.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  smallButtonText: {
    color: OVERLAY.text,
    fontSize: 11,
    fontWeight: '700',
  },

  inferenceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 176,
    borderRadius: 999,
    paddingHorizontal: 17,
    paddingVertical: 12,
  },

  inferenceSpinner: {
    marginRight: 7,
  },

  inferenceButtonIcon: {
    color: OVERLAY.darkText,
    fontSize: 13,
    marginRight: 7,
  },

  inferenceButtonText: {
    color: OVERLAY.darkText,
    fontSize: 14,
    fontWeight: '800',
  },

  disclaimer: {
    color: OVERLAY.muted,
    fontSize: 8,
    lineHeight: 11,
    marginTop: 10,
    textAlign: 'center',
  },

  storageNote: {
    color: 'rgba(196, 205, 196, 0.72)',
    fontSize: 8,
    lineHeight: 11,
    marginTop: 3,
    textAlign: 'center',
  },

  drawerRoot: {
    flex: 1,
    alignItems: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.48)',
  },

  drawerBackdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },

  drawerPanel: {
    width: '88%',
    height: '100%',
    backgroundColor: OVERLAY.drawer,
    borderLeftColor: OVERLAY.border,
    borderLeftWidth: 1,
  },

  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 44,
    paddingBottom: 13,
    borderBottomColor: OVERLAY.border,
    borderBottomWidth: 1,
  },

  drawerHeaderCopy: {
    flex: 1,
    paddingRight: 12,
  },

  drawerTitle: {
    color: OVERLAY.text,
    fontSize: 22,
    fontWeight: '800',
  },

  drawerSubtitle: {
    color: OVERLAY.muted,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 4,
  },

  drawerClose: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: OVERLAY.panelSoft,
  },

  drawerCloseText: {
    color: OVERLAY.text,
    fontSize: 22,
    lineHeight: 24,
  },

  drawerContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 40,
  },

  drawerEmpty: {
    backgroundColor: OVERLAY.panelSoft,
    borderRadius: 16,
    padding: 18,
  },

  drawerEmptyTitle: {
    color: OVERLAY.text,
    fontSize: 16,
    fontWeight: '700',
  },

  drawerEmptyText: {
    color: OVERLAY.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
  },

  sessionBlock: {
    backgroundColor: OVERLAY.panelSoft,
    borderRadius: 16,
    marginBottom: 12,
    padding: 12,
  },

  sessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  sessionTitle: {
    color: OVERLAY.text,
    fontSize: 14,
    fontWeight: '700',
  },

  sessionCount: {
    color: OVERLAY.muted,
    fontSize: 11,
    fontWeight: '600',
  },

  sessionId: {
    color: OVERLAY.accent,
    fontSize: 10,
    marginTop: 4,
  },

  sessionMeta: {
    color: OVERLAY.muted,
    fontSize: 10,
    marginTop: 2,
  },

  sessionEmpty: {
    color: OVERLAY.muted,
    fontSize: 11,
    marginTop: 9,
  },

  caseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 12,
    marginTop: 8,
    padding: 7,
  },

  caseImage: {
    width: 58,
    height: 58,
    borderRadius: 9,
    backgroundColor: '#1B231B',
  },

  caseCopy: {
    flex: 1,
    paddingLeft: 10,
  },

  caseTitle: {
    color: OVERLAY.text,
    fontSize: 13,
    fontWeight: '700',
  },

  caseMeta: {
    color: OVERLAY.muted,
    fontSize: 10,
    marginTop: 3,
  },
});
