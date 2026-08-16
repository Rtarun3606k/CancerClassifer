import React, { useState } from 'react';

import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  PermissionsAndroid,
  Platform,
} from 'react-native';

import {
  startRecording,
  stopRecording,
} from '../ml/audio/audioRecorder';

import {
  classifyAudio,
} from '../ml/audio/audioModel';

import AppHeader from '../components/AppHeader';
import AppFooter from '../components/AppFooter';
import ProbabilityBar from '../components/ProbabilityBar';

export default function AudioAnalysisScreen({
  colors,
  onImage,
}) {
  const [isRecording, setIsRecording] =
    useState(false);

  const [analyzing, setAnalyzing] =
    useState(false);

  const [audioResult, setAudioResult] =
    useState(null);

  const [audioError, setAudioError] =
    useState(null);

  const requestMicrophonePermission =
    async () => {
      if (Platform.OS !== 'android') {
        return true;
      }

      const granted =
        await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS
            .RECORD_AUDIO,
          {
            title:
              'Microphone Permission',

            message:
              'OralScan needs microphone access to analyze your voice.',

            buttonPositive:
              'Allow',

            buttonNegative:
              'Deny',
          },
        );

      return (
        granted ===
        PermissionsAndroid.RESULTS
          .GRANTED
      );
    };

  const handleStartRecording =
    async () => {
      try {
        setAudioError(null);
        setAudioResult(null);

        const allowed =
          await requestMicrophonePermission();

        if (!allowed) {
          setAudioError(
            'Microphone permission was denied.',
          );
          return;
        }

        startRecording();

        setIsRecording(true);
      } catch (error) {
        console.error(
          'Recording start error:',
          error,
        );

        setAudioError(
          error.message ||
            'Unable to start recording.',
        );
      }
    };

  const handleStopRecording =
    async () => {
      try {
        setIsRecording(false);
        setAnalyzing(true);
        setAudioError(null);

        const path =
          await stopRecording();

        console.log(
          'AUDIO FILE:',
          path,
        );

        const result =
          await classifyAudio(path);

        console.log(
          'FINAL AUDIO RESULT:',
          result,
        );

        setAudioResult(result);
      } catch (error) {
        console.error(
          'AUDIO ANALYSIS ERROR:',
          error,
        );

        setAudioError(
          error.message ||
            'Unable to analyze audio.',
        );
      } finally {
        setAnalyzing(false);
      }
    };

  const pathology =
    audioResult
      ?.pathologyProbability ?? 0;

  const normal =
    audioResult
      ?.normalProbability ?? 0;

  const isPathology =
    audioResult?.prediction ===
    'Vocal Pathology';

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <AppHeader
        colors={colors}
        title="OralScan"
        subtitle="AI-powered voice analysis"
        status={
          isRecording
            ? 'RECORDING'
            : analyzing
              ? 'ANALYZING'
              : 'READY'
        }
      />

      <View
        style={[
          styles.recordCard,
          {
            backgroundColor:
              colors.surface,
            borderColor:
              colors.outline,
          },
        ]}
      >
        <View
          style={[
            styles.microphone,
            {
              backgroundColor:
                isRecording
                  ? colors.errorContainer
                  : colors.primaryContainer,
            },
          ]}
        >
          <Text
            style={[
              styles.microphoneText,
              {
                color:
                  isRecording
                    ? colors.error
                    : colors.primary,
              },
            ]}
          >
            {isRecording ? '■' : '●'}
          </Text>
        </View>

        <Text
          style={[
            styles.recordTitle,
            {
              color:
                colors.onSurface,
            },
          ]}
        >
          {isRecording
            ? 'Recording your voice'
            : 'Voice analysis'}
        </Text>

        <Text
          style={[
            styles.recordDescription,
            {
              color:
                colors.onSurfaceVariant,
            },
          ]}
        >
          Record a short voice sample for
          on-device AI analysis.
        </Text>

        <Pressable
          onPress={
            isRecording
              ? handleStopRecording
              : handleStartRecording
          }
          disabled={analyzing}
          style={[
            styles.recordButton,
            {
              backgroundColor:
                isRecording
                  ? colors.error
                  : colors.primary,
              opacity:
                analyzing ? 0.6 : 1,
            },
          ]}
        >
          <Text
            style={
              styles.recordButtonText
            }
          >
            {isRecording
              ? 'Stop Recording'
              : 'Record Voice'}
          </Text>
        </Pressable>
      </View>

      {analyzing && (
        <View
          style={[
            styles.analysisCard,
            {
              backgroundColor:
                colors.primaryContainer,
            },
          ]}
        >
          <ActivityIndicator
            color={colors.primary}
          />

          <View
            style={
              styles.analysisText
            }
          >
            <Text
              style={[
                styles.analysisTitle,
                {
                  color:
                    colors.onPrimaryContainer,
                },
              ]}
            >
              Analyzing voice
            </Text>

            <Text
              style={[
                styles.analysisSubtitle,
                {
                  color:
                    colors.onSurfaceVariant,
                },
              ]}
            >
              Running the vocal pathology
              model locally on your device.
            </Text>
          </View>
        </View>
      )}

      {audioResult && !analyzing && (
        <View
          style={[
            styles.resultCard,
            {
              backgroundColor:
                colors.surface,
              borderColor:
                colors.outline,
            },
          ]}
        >
          <Text
            style={[
              styles.eyebrow,
              {
                color:
                  colors.onSurfaceVariant,
              },
            ]}
          >
            AUDIO ANALYSIS
          </Text>

          <Text
            style={[
              styles.heading,
              {
                color:
                  colors.onSurface,
              },
            ]}
          >
            Model prediction
          </Text>

          <Text
            style={[
              styles.prediction,
              {
                color:
                  isPathology
                    ? colors.error
                    : colors.primary,
              },
            ]}
          >
            {audioResult.prediction}
          </Text>

          <View
            style={styles.confidence}
          >
            <Text
              style={[
                styles.confidenceValue,
                {
                  color:
                    colors.onSurface,
                },
              ]}
            >
              {audioResult
                .confidencePercentage
                .toFixed(1)}
              %
            </Text>

            <Text
              style={[
                styles.confidenceLabel,
                {
                  color:
                    colors.onSurfaceVariant,
                },
              ]}
            >
              confidence
            </Text>
          </View>

          <View
            style={styles.divider}
          />

          <ProbabilityBar
            label="NORMAL"
            value={normal}
            colors={colors}
          />

          <ProbabilityBar
            label="VOCAL PATHOLOGY"
            value={pathology}
            colors={colors}
          />

          <Pressable
            onPress={() => {
              setAudioResult(null);
            }}
            style={[
              styles.secondaryButton,
              {
                borderColor:
                  colors.outline,
              },
            ]}
          >
            <Text
              style={[
                styles.secondaryButtonText,
                {
                  color:
                    colors.primary,
                },
              ]}
            >
              Analyze Again
            </Text>
          </Pressable>
        </View>
      )}

      {audioError && (
        <View
          style={[
            styles.errorCard,
            {
              backgroundColor:
                colors.errorContainer,
            },
          ]}
        >
          <Text
            style={[
              styles.errorTitle,
              {
                color:
                  colors.error,
              },
            ]}
          >
            Audio analysis failed
          </Text>

          <Text
            style={[
              styles.errorText,
              {
                color:
                  colors.onErrorContainer,
              },
            ]}
          >
            {audioError}
          </Text>
        </View>
      )}

      <Pressable
        onPress={onImage}
        style={[
          styles.secondaryButton,
          {
            borderColor:
              colors.outline,
          },
        ]}
      >
        <Text
          style={[
            styles.secondaryButtonText,
            {
              color:
                colors.primary,
            },
          ]}
        >
          Analyze Oral Image Instead
        </Text>
      </Pressable>

      <AppFooter colors={colors} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 36,
  },

  recordCard: {
    borderRadius: 25,
    borderWidth: 1,
    padding: 25,
    alignItems: 'center',
  },

  microphone: {
    width: 90,
    height: 90,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },

  microphoneText: {
    fontSize: 32,
    fontWeight: '800',
  },

  recordTitle: {
    marginTop: 20,
    fontSize: 22,
    fontWeight: '800',
  },

  recordDescription: {
    marginTop: 8,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 21,
    maxWidth: 300,
  },

  recordButton: {
    height: 56,
    width: '100%',
    marginTop: 24,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },

  recordButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  analysisCard: {
    marginTop: 18,
    padding: 18,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },

  analysisText: {
    marginLeft: 14,
    flex: 1,
  },

  analysisTitle: {
    fontSize: 15,
    fontWeight: '700',
  },

  analysisSubtitle: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 17,
  },

  resultCard: {
    marginTop: 22,
    padding: 21,
    borderRadius: 25,
    borderWidth: 1,
  },

  eyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },

  heading: {
    marginTop: 4,
    fontSize: 18,
    fontWeight: '700',
  },

  prediction: {
    marginTop: 20,
    fontSize: 30,
    fontWeight: '800',
  },

  confidence: {
    marginTop: 5,
    alignItems: 'flex-start',
  },

  confidenceValue: {
    fontSize: 25,
    fontWeight: '800',
  },

  confidenceLabel: {
    fontSize: 11,
  },

  divider: {
    height: 1,
    backgroundColor: '#00000015',
    marginVertical: 23,
  },

  secondaryButton: {
    height: 52,
    marginTop: 16,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },

  errorCard: {
    marginTop: 20,
    padding: 18,
    borderRadius: 20,
  },

  errorTitle: {
    fontSize: 15,
    fontWeight: '700',
  },

  errorText: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
  },
});
