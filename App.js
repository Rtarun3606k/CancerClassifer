import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  Pressable,
  Image,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  StatusBar,
  NativeModules,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';

import { classifyImage } from './src/ml/model';

const { AndroidTheme } = NativeModules;

function androidColorToHex(color) {
  const unsigned = color >>> 0;
  return `#${(unsigned & 0xffffff).toString(16).padStart(6, '0')}`;
}

export default function App() {
  const [theme, setTheme] = useState(null);
  const [imageUri, setImageUri] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    AndroidTheme.getTheme()
      .then(nativeTheme => {
        setTheme({
          primary: androidColorToHex(nativeTheme.primary),
          secondary: androidColorToHex(nativeTheme.secondary),
          tertiary: androidColorToHex(nativeTheme.tertiary),
          background: androidColorToHex(nativeTheme.background),
          onBackground: androidColorToHex(nativeTheme.onBackground),
          error: androidColorToHex(nativeTheme.error),
          isDark: nativeTheme.isDark,
        });
      })
      .catch(error => {
        console.error('Theme error:', error);
      });
  }, []);

  if (!theme) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const colors = createColors(theme);

  const pickImage = async () => {
    const response = await launchImageLibrary({
      mediaType: 'photo',
      selectionLimit: 1,
    });

    if (response.didCancel || !response.assets?.length) {
      return;
    }

    const uri = response.assets[0].uri;

    setImageUri(uri);
    setResult(null);
    setLoading(true);

    try {
      const prediction = await classifyImage(uri);
      setResult(prediction);
    } catch (error) {
      console.error('Classification error:', error);

      setResult({
        error: error.message || 'Unable to analyze image.',
      });
    } finally {
      setLoading(false);
    }
  };

  const cancerProbability = result?.probabilities?.CANCER ?? 0;

  const nonCancerProbability = result?.probabilities?.['NON CANCER'] ?? 0;

  const isCancer = result?.classIndex === 0;

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
    >
      <StatusBar
        barStyle={theme.isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <View style={styles.brandRow}>
              <View
                style={[
                  styles.brandIcon,
                  {
                    backgroundColor: colors.primaryContainer,
                  },
                ]}
              >
                <Text style={[styles.brandIconText, { color: colors.primary }]}>
                  O
                </Text>
              </View>

              <Text style={[styles.title, { color: colors.onBackground }]}>
                OralScan
              </Text>
            </View>

            <Text style={[styles.subtitle, { color: colors.onSurfaceVariant }]}>
              AI-powered oral image analysis
            </Text>
          </View>

          <View
            style={[
              styles.status,
              {
                backgroundColor: colors.primaryContainer,
              },
            ]}
          >
            <View
              style={[styles.statusDot, { backgroundColor: colors.primary }]}
            />

            <Text style={[styles.statusText, { color: colors.primary }]}>
              READY
            </Text>
          </View>
        </View>

        {/* Image area */}
        <View
          style={[
            styles.imageCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.outline,
            },
          ]}
        >
          {imageUri ? (
            <>
              <Image
                source={{ uri: imageUri }}
                style={styles.image}
                resizeMode="cover"
              />

              {!loading && (
                <View style={styles.imageOverlay}>
                  <View
                    style={[
                      styles.imageOverlayBadge,
                      {
                        backgroundColor: colors.surface,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.imageOverlayText,
                        { color: colors.onSurface },
                      ]}
                    >
                      Image selected
                    </Text>
                  </View>
                </View>
              )}
            </>
          ) : (
            <View style={styles.placeholder}>
              <View
                style={[
                  styles.uploadIcon,
                  {
                    backgroundColor: colors.primaryContainer,
                  },
                ]}
              >
                <Text
                  style={[styles.uploadIconText, { color: colors.primary }]}
                >
                  +
                </Text>
              </View>

              <Text
                style={[styles.placeholderTitle, { color: colors.onSurface }]}
              >
                Select an oral image
              </Text>

              <Text
                style={[
                  styles.placeholderText,
                  { color: colors.onSurfaceVariant },
                ]}
              >
                Choose a clear image from your gallery to begin analysis.
              </Text>
            </View>
          )}
        </View>

        {/* Main action */}
        <Pressable
          onPress={pickImage}
          disabled={loading}
          style={({ pressed }) => [
            styles.mainButton,
            {
              backgroundColor: colors.primary,
              opacity: pressed || loading ? 0.75 : 1,
            },
          ]}
        >
          {loading ? (
            <>
              <ActivityIndicator size="small" color={colors.onPrimary} />

              <Text
                style={[styles.mainButtonText, { color: colors.onPrimary }]}
              >
                Analyzing...
              </Text>
            </>
          ) : (
            <>
              <Text
                style={[styles.mainButtonIcon, { color: colors.onPrimary }]}
              >
                +
              </Text>

              <Text
                style={[styles.mainButtonText, { color: colors.onPrimary }]}
              >
                {imageUri ? 'Analyze Another Image' : 'Choose Image'}
              </Text>
            </>
          )}
        </Pressable>

        {/* Loading card */}
        {loading && (
          <View
            style={[
              styles.analysisCard,
              {
                backgroundColor: colors.primaryContainer,
              },
            ]}
          >
            <ActivityIndicator size="small" color={colors.primary} />

            <View style={styles.analysisText}>
              <Text
                style={[
                  styles.analysisTitle,
                  { color: colors.onPrimaryContainer },
                ]}
              >
                Analyzing image
              </Text>

              <Text
                style={[
                  styles.analysisSubtitle,
                  {
                    color: colors.onSurfaceVariant,
                  },
                ]}
              >
                Running MobileNetV3 locally on your device
              </Text>
            </View>
          </View>
        )}

        {/* Result */}
        {result && !result.error && !loading && (
          <View
            style={[
              styles.resultCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.outline,
              },
            ]}
          >
            <View style={styles.resultTitleRow}>
              <View>
                <Text
                  style={[
                    styles.eyebrow,
                    {
                      color: colors.onSurfaceVariant,
                    },
                  ]}
                >
                  ANALYSIS RESULT
                </Text>

                <Text
                  style={[styles.resultHeading, { color: colors.onSurface }]}
                >
                  Model prediction
                </Text>
              </View>

              <View
                style={[
                  styles.resultIcon,
                  {
                    backgroundColor: isCancer
                      ? colors.errorContainer
                      : colors.primaryContainer,
                  },
                ]}
              >
                <Text
                  style={{
                    color: isCancer ? colors.error : colors.primary,
                    fontSize: 18,
                    fontWeight: '800',
                  }}
                >
                  {isCancer ? '!' : '✓'}
                </Text>
              </View>
            </View>

            <View style={styles.predictionRow}>
              <View>
                <Text
                  style={[
                    styles.predictionLabel,
                    {
                      color: colors.onSurfaceVariant,
                    },
                  ]}
                >
                  Prediction
                </Text>

                <Text
                  style={[
                    styles.prediction,
                    {
                      color: isCancer ? colors.error : colors.primary,
                    },
                  ]}
                >
                  {result.className}
                </Text>
              </View>

              <View style={styles.confidence}>
                <Text
                  style={[styles.confidenceValue, { color: colors.onSurface }]}
                >
                  {(result.probability * 100).toFixed(1)}%
                </Text>

                <Text
                  style={[
                    styles.confidenceLabel,
                    {
                      color: colors.onSurfaceVariant,
                    },
                  ]}
                >
                  confidence
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            <ProbabilityBar
              label="CANCER"
              value={cancerProbability}
              colors={colors}
            />

            <ProbabilityBar
              label="NON CANCER"
              value={nonCancerProbability}
              colors={colors}
            />
          </View>
        )}

        {/* Error */}
        {result?.error && (
          <View
            style={[
              styles.errorCard,
              {
                backgroundColor: colors.errorContainer,
              },
            ]}
          >
            <Text style={[styles.errorTitle, { color: colors.error }]}>
              Analysis failed
            </Text>

            <Text
              style={[
                styles.errorText,
                {
                  color: colors.onErrorContainer,
                },
              ]}
            >
              {result.error}
            </Text>
          </View>
        )}

        {/* Disclaimer */}
        <View
          style={[
            styles.disclaimer,
            {
              backgroundColor: colors.surfaceContainer,
            },
          ]}
        >
          <Text style={[styles.disclaimerTitle, { color: colors.onSurface }]}>
            For research purposes
          </Text>

          <Text
            style={[
              styles.disclaimerText,
              {
                color: colors.onSurfaceVariant,
              },
            ]}
          >
            This application provides an AI model prediction and is not a
            medical diagnosis. Consult a qualified healthcare professional for
            clinical evaluation.
          </Text>
        </View>

        <Text style={[styles.footer, { color: colors.onSurfaceVariant }]}>
          MobileNetV3 • On-device inference
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function ProbabilityBar({ label, value, colors }) {
  const percentage = value * 100;

  return (
    <View style={styles.probabilityRow}>
      <View style={styles.probabilityTop}>
        <Text style={[styles.probabilityLabel, { color: colors.onSurface }]}>
          {label}
        </Text>

        <Text
          style={[
            styles.probabilityValue,
            {
              color: colors.onSurfaceVariant,
            },
          ]}
        >
          {percentage.toFixed(1)}%
        </Text>
      </View>

      <View
        style={[
          styles.barBackground,
          {
            backgroundColor: colors.surfaceContainer,
          },
        ]}
      >
        <View
          style={[
            styles.barFill,
            {
              width: `${percentage}%`,
              backgroundColor: colors.primary,
            },
          ]}
        />
      </View>
    </View>
  );
}

function createColors(theme) {
  const dark = theme.isDark;

  return {
    primary: theme.primary,
    secondary: theme.secondary,
    tertiary: theme.tertiary,

    background: theme.background,

    surface: dark ? '#202124' : '#FFFFFF',

    surfaceContainer: dark ? '#292A2D' : '#F1F3F4',

    onSurface: theme.onBackground,

    onSurfaceVariant: dark ? '#C4C7C5' : '#5F6368',

    outline: dark ? '#444746' : '#DADCE0',

    primaryContainer: dark ? '#304B3A' : '#D9F2E2',

    onPrimaryContainer: dark ? '#B8F0C8' : '#12351E',

    onPrimary: '#FFFFFF',

    error: theme.error,

    errorContainer: dark ? '#5C2B2B' : '#F9DEDC',

    onErrorContainer: dark ? '#F9DEDC' : '#410E0B',
  };
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  safeArea: {
    flex: 1,
  },

  container: {
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 36,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 22,
  },

  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  brandIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },

  brandIconText: {
    fontSize: 21,
    fontWeight: '800',
  },

  title: {
    fontSize: 27,
    fontWeight: '800',
    letterSpacing: -0.7,
  },

  subtitle: {
    marginTop: 5,
    marginLeft: 48,
    fontSize: 13,
  },

  status: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 20,
  },

  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 6,
  },

  statusText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  imageCard: {
    height: 350,
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
  },

  image: {
    width: '100%',
    height: '100%',
  },

  imageOverlay: {
    position: 'absolute',
    bottom: 14,
    left: 14,
  },

  imageOverlayBadge: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    opacity: 0.94,
  },

  imageOverlayText: {
    fontSize: 12,
    fontWeight: '600',
  },

  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 35,
  },

  uploadIcon: {
    width: 68,
    height: 68,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },

  uploadIconText: {
    fontSize: 34,
    fontWeight: '300',
  },

  placeholderTitle: {
    fontSize: 19,
    fontWeight: '700',
  },

  placeholderText: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },

  mainButton: {
    height: 58,
    borderRadius: 18,
    marginTop: 16,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 9,
  },

  mainButtonIcon: {
    fontSize: 23,
    fontWeight: '300',
  },

  mainButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },

  analysisCard: {
    marginTop: 16,
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

  resultTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  eyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },

  resultHeading: {
    marginTop: 4,
    fontSize: 18,
    fontWeight: '700',
  },

  resultIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },

  predictionRow: {
    marginTop: 27,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },

  predictionLabel: {
    fontSize: 12,
  },

  prediction: {
    marginTop: 4,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.7,
  },

  confidence: {
    alignItems: 'flex-end',
  },

  confidenceValue: {
    fontSize: 25,
    fontWeight: '800',
  },

  confidenceLabel: {
    marginTop: 2,
    fontSize: 11,
  },

  divider: {
    height: 1,
    backgroundColor: '#00000015',
    marginVertical: 23,
  },

  probabilityRow: {
    marginBottom: 17,
  },

  probabilityTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },

  probabilityLabel: {
    fontSize: 12,
    fontWeight: '700',
  },

  probabilityValue: {
    fontSize: 12,
    fontWeight: '600',
  },

  barBackground: {
    height: 8,
    borderRadius: 8,
    overflow: 'hidden',
  },

  barFill: {
    height: '100%',
    borderRadius: 8,
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

  disclaimer: {
    marginTop: 20,
    padding: 17,
    borderRadius: 19,
  },

  disclaimerTitle: {
    fontSize: 13,
    fontWeight: '700',
  },

  disclaimerText: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
  },

  footer: {
    textAlign: 'center',
    marginTop: 20,
    fontSize: 11,
  },
});
