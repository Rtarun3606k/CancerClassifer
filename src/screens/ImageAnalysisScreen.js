import React, { useState } from 'react';

import {
  View,
  Text,
  Image,
  Pressable,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
} from 'react-native';

import { launchImageLibrary } from 'react-native-image-picker';

import { classifyImage } from '../ml/model';

import AppFooter from '../components/AppFooter';
import ProbabilityBar from '../components/ProbabilityBar';
import { useDiagnosis } from '../context/DiagnosisContext';
import { copyDiagnosisFile } from '../services/diagnosisStorage';
import { createDiagnosisId } from '../utils/diagnosisId';
import { getExtensionFromFile } from '../utils/getFileExtision';

export default function ImageAnalysisScreen({ colors, onAudio, onComplete }) {
  const [imageUri, setImageUri] = useState(null);

  const [result, setResult] = useState(null);

  const [loading, setLoading] = useState(false);

  const { diagnosis, setImageResult } = useDiagnosis();

  const pickImage = async () => {
    const response = await launchImageLibrary({
      mediaType: 'photo',
      selectionLimit: 1,
    });

    if (response.didCancel || !response.assets?.length) {
      return;
    }

    const file = response.assets[0];
    const uri = file.uri;

    if (!uri) {
      return;
    }

    setImageUri(uri);
    setResult(null);
    setLoading(true);

    try {
      // Classify the original selected image
      const prediction = await classifyImage(uri);

      // Get extension from the actual selected file
      const fileExt = getExtensionFromFile(file, 'jpg');

      if (!diagnosis?.id) {
        throw new Error('No active diagnosis ID.');
      }
      // Store a permanent copy inside this diagnosis
      const storedImage = await copyDiagnosisFile(
        uri,
        diagnosis.id,
        `image.${fileExt}`,
      );

      console.log('STORED IMAGE:', storedImage);

      setResult(prediction);

      // IMPORTANT:
      // Store the permanent path, not the temporary picker URI
      setImageResult({
        uri: storedImage,
        result: prediction,
      });
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
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      {/* Image */}
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
              source={{
                uri: imageUri,
              }}
              style={styles.image}
              resizeMode="cover"
            />

            {!loading && (
              <View style={styles.imageOverlay}>
                <View
                  style={[
                    styles.badge,
                    {
                      backgroundColor: colors.surface,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.badgeText,
                      {
                        color: colors.onSurface,
                      },
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
                style={[
                  styles.uploadIconText,
                  {
                    color: colors.primary,
                  },
                ]}
              >
                +
              </Text>
            </View>

            <Text
              style={[
                styles.placeholderTitle,
                {
                  color: colors.onSurface,
                },
              ]}
            >
              Select an oral image
            </Text>

            <Text
              style={[
                styles.placeholderText,
                {
                  color: colors.onSurfaceVariant,
                },
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
              style={[
                styles.mainButtonText,
                {
                  color: colors.onPrimary,
                },
              ]}
            >
              Analyzing...
            </Text>
          </>
        ) : (
          <Text
            style={[
              styles.mainButtonText,
              {
                color: colors.onPrimary,
              },
            ]}
          >
            {imageUri ? 'Analyze Another Image' : 'Choose Image'}
          </Text>
        )}
      </Pressable>

      {/* Loading */}
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
                {
                  color: colors.onPrimaryContainer,
                },
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
            style={[
              styles.heading,
              {
                color: colors.onSurface,
              },
            ]}
          >
            Model prediction
          </Text>

          <View style={styles.predictionRow}>
            <View>
              <Text
                style={[
                  styles.label,
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
                style={[
                  styles.confidenceValue,
                  {
                    color: colors.onSurface,
                  },
                ]}
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
          <Text
            style={[
              styles.errorTitle,
              {
                color: colors.error,
              },
            ]}
          >
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

      {/* Switch to audio */}
      <Pressable
        onPress={onComplete}
        style={[
          styles.secondaryButton,
          {
            borderColor: colors.outline,
          },
        ]}
      >
        <Text
          style={[
            styles.secondaryButtonText,
            {
              color: colors.primary,
            },
          ]}
        >
          Continue
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

  badge: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    opacity: 0.94,
  },

  badgeText: {
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

  predictionRow: {
    marginTop: 27,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },

  label: {
    fontSize: 12,
  },

  prediction: {
    marginTop: 4,
    fontSize: 30,
    fontWeight: '800',
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

  reportButton: {
    height: 54,
    marginTop: 8,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },

  reportButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },

  patientDialog: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 28,
    padding: 24,

    // Android elevation
    elevation: 8,

    // iOS shadow
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.18,
    shadowRadius: 12,
  },

  dialogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 28,
  },

  dialogIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },

  dialogIcon: {
    fontSize: 26,
    fontWeight: '500',
  },

  dialogHeaderText: {
    flex: 1,
  },

  dialogTitle: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '600',
    letterSpacing: 0,
  },

  dialogSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },

  fieldContainer: {
    marginBottom: 18,
  },

  dialogLabel: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    marginBottom: 8,
  },

  dialogInput: {
    height: 52,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
  },

  dateInput: {
    height: 52,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },

  dateInputContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  dateInputText: {
    fontSize: 16,
  },

  calendarIcon: {
    fontSize: 18,
  },

  calendarContainer: {
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: -4,
    marginBottom: 16,
  },

  dateHint: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: -8,
    marginBottom: 20,
  },

  dialogActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },

  cancelButton: {
    minHeight: 44,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
  },

  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },

  createButton: {
    minHeight: 44,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
  },

  createButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
