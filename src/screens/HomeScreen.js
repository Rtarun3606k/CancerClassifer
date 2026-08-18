import React from 'react';

import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useDiagnosis } from '../context/DiagnosisContext';
import AppHeader from '../components/AppHeader';

export default function HomeScreen({
  colors,
  onImage,
  onAudio,
  onStartDiagnosis,
  onHistory,
}) {
  const { diagnosis, startNewDiagnosis } = useDiagnosis();

  const patient = diagnosis.patient;

  const imageResult = diagnosis.image?.result;

  const audioResult = diagnosis.audio?.result;

  const hasImage = !!imageResult;
  const hasAudio = !!audioResult;

  const hasPatient = !!patient.name && !!patient.dateOfBirth;

  const handleStartDiagnosis = () => {
    const id = startNewDiagnosis();

    console.log('NEW DIAGNOSIS ID:', id);

    onStartDiagnosis();
  };

  const getAge = dateOfBirth => {
    if (!dateOfBirth) {
      return null;
    }

    const dob = new Date(dateOfBirth);
    const today = new Date();

    let age = today.getFullYear() - dob.getFullYear();

    const monthDifference = today.getMonth() - dob.getMonth();

    if (
      monthDifference < 0 ||
      (monthDifference === 0 && today.getDate() < dob.getDate())
    ) {
      age--;
    }

    return age;
  };

  const age = getAge(patient.dateOfBirth);

  return (
    <ScrollView
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
        },
      ]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {!hasPatient ? (
        <View
          style={[
            styles.welcomeCard,
            {
              backgroundColor: colors.primaryContainer,
            },
          ]}
        >
          <Text
            style={[
              styles.welcomeTitle,
              {
                color: colors.onPrimaryContainer,
              },
            ]}
          >
            Start a new diagnosis
          </Text>

          <Text
            style={[
              styles.welcomeText,
              {
                color: colors.onPrimaryContainer,
              },
            ]}
          >
            Enter patient information and perform image and voice analysis from
            one diagnosis session.
          </Text>

          <Pressable
            onPress={handleStartDiagnosis}
            style={({ pressed }) => [
              styles.primaryButton,
              {
                backgroundColor: colors.primary,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Text
              style={[
                styles.primaryButtonText,
                {
                  color: colors.onPrimary,
                },
              ]}
            >
              Start New Diagnosis
            </Text>
          </Pressable>
        </View>
      ) : (
        <>
          {/* Patient */}

          <View
            style={[
              styles.patientCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.outlineVariant,
              },
            ]}
          >
            <View style={styles.patientHeader}>
              <View
                style={[
                  styles.patientAvatar,
                  {
                    backgroundColor: colors.primaryContainer,
                  },
                ]}
              >
                <Text
                  style={{
                    color: colors.onPrimaryContainer,
                    fontSize: 20,
                    fontWeight: '600',
                  }}
                >
                  {patient.name.charAt(0).toUpperCase()}
                </Text>
              </View>

              <View style={styles.patientHeaderText}>
                <Text
                  style={[
                    styles.cardLabel,
                    {
                      color: colors.onSurfaceVariant,
                    },
                  ]}
                >
                  CURRENT PATIENT
                </Text>

                <Text
                  style={[
                    styles.patientName,
                    {
                      color: colors.onSurface,
                    },
                  ]}
                >
                  {patient.name}
                </Text>

                <Text
                  style={[
                    styles.patientMeta,
                    {
                      color: colors.onSurfaceVariant,
                    },
                  ]}
                >
                  {age !== null ? `${age} years` : ''}
                  {patient.gender ? ` • ${patient.gender}` : ''}
                </Text>
              </View>
            </View>

            {(patient.city || patient.state || patient.country) && (
              <Text
                style={[
                  styles.location,
                  {
                    color: colors.onSurfaceVariant,
                  },
                ]}
              >
                {[patient.city, patient.state, patient.country]
                  .filter(Boolean)
                  .join(', ')}
              </Text>
            )}
          </View>

          {/* Analysis */}

          <Text
            style={[
              styles.sectionTitle,
              {
                color: colors.onBackground,
              },
            ]}
          >
            Analysis
          </Text>

          <Text
            style={[
              styles.sectionSubtitle,
              {
                color: colors.onSurfaceVariant,
              },
            ]}
          >
            Choose an analysis method to continue this diagnosis.
          </Text>

          {/* Image */}

          <Pressable
            onPress={onImage}
            style={({ pressed }) => [
              styles.analysisCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.outlineVariant,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <View
              style={[
                styles.analysisIcon,
                {
                  backgroundColor: colors.primaryContainer,
                },
              ]}
            >
              <Text
                style={[
                  styles.analysisIconText,
                  {
                    color: colors.onPrimaryContainer,
                  },
                ]}
              >
                ◎
              </Text>
            </View>

            <View style={styles.analysisContent}>
              <Text
                style={[
                  styles.analysisTitle,
                  {
                    color: colors.onSurface,
                  },
                ]}
              >
                Image Analysis
              </Text>

              <Text
                style={[
                  styles.analysisDescription,
                  {
                    color: colors.onSurfaceVariant,
                  },
                ]}
              >
                Analyze an oral image using the on-device ML model.
              </Text>

              <View style={styles.statusRow}>
                <View
                  style={[
                    styles.statusDot,
                    {
                      backgroundColor: hasImage
                        ? colors.primary
                        : colors.outline,
                    },
                  ]}
                />

                <Text
                  style={[
                    styles.statusText,
                    {
                      color: hasImage
                        ? colors.primary
                        : colors.onSurfaceVariant,
                    },
                  ]}
                >
                  {hasImage ? 'Analysis completed' : 'Not performed'}
                </Text>
              </View>

              {hasImage && (
                <Text
                  style={[
                    styles.resultText,
                    {
                      color: colors.onSurface,
                    },
                  ]}
                >
                  {imageResult.className ||
                    imageResult.prediction ||
                    'Result available'}
                  {imageResult.probability != null &&
                    ` • ${(imageResult.probability * 100).toFixed(1)}%`}
                </Text>
              )}
            </View>

            <Text
              style={[
                styles.arrow,
                {
                  color: colors.primary,
                },
              ]}
            >
              ›
            </Text>
          </Pressable>

          {/* Audio */}

          <Pressable
            onPress={onAudio}
            style={({ pressed }) => [
              styles.analysisCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.outlineVariant,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <View
              style={[
                styles.analysisIcon,
                {
                  backgroundColor: colors.primaryContainer,
                },
              ]}
            >
              <Text
                style={[
                  styles.analysisIconText,
                  {
                    color: colors.onPrimaryContainer,
                  },
                ]}
              >
                ♫
              </Text>
            </View>

            <View style={styles.analysisContent}>
              <Text
                style={[
                  styles.analysisTitle,
                  {
                    color: colors.onSurface,
                  },
                ]}
              >
                Voice Analysis
              </Text>

              <Text
                style={[
                  styles.analysisDescription,
                  {
                    color: colors.onSurfaceVariant,
                  },
                ]}
              >
                Analyze a voice recording for vocal pathology.
              </Text>

              <View style={styles.statusRow}>
                <View
                  style={[
                    styles.statusDot,
                    {
                      backgroundColor: hasAudio
                        ? colors.primary
                        : colors.outline,
                    },
                  ]}
                />

                <Text
                  style={[
                    styles.statusText,
                    {
                      color: hasAudio
                        ? colors.primary
                        : colors.onSurfaceVariant,
                    },
                  ]}
                >
                  {hasAudio ? 'Analysis completed' : 'Not performed'}
                </Text>
              </View>

              {hasAudio && (
                <Text
                  style={[
                    styles.resultText,
                    {
                      color: colors.onSurface,
                    },
                  ]}
                >
                  {audioResult.prediction || 'Result available'}
                  {audioResult.confidencePercentage != null &&
                    ` • ${audioResult.confidencePercentage.toFixed(1)}%`}
                </Text>
              )}
            </View>

            <Text
              style={[
                styles.arrow,
                {
                  color: colors.primary,
                },
              ]}
            >
              ›
            </Text>
          </Pressable>

          {/* Report */}

          <Pressable
            disabled={!hasImage && !hasAudio}
            style={[
              styles.reportButton,
              {
                backgroundColor:
                  hasImage || hasAudio
                    ? colors.primary
                    : colors.surfaceContainerHighest,
              },
            ]}
          >
            <Text
              style={{
                color:
                  hasImage || hasAudio
                    ? colors.onPrimary
                    : colors.onSurfaceVariant,
                fontSize: 15,
                fontWeight: '600',
              }}
            >
              Generate Combined Report
            </Text>
          </Pressable>

          {/* New diagnosis */}

          <Pressable
            onPress={handleStartDiagnosis}
            style={styles.newDiagnosisButton}
          >
            <Text
              style={{
                color: colors.primary,
                fontSize: 14,
                fontWeight: '600',
              }}
            >
              Start New Diagnosis
            </Text>
          </Pressable>
        </>
      )}

      <Pressable
        onPress={onHistory}
        style={({ pressed }) => [
          styles.historyButton,
          {
            borderColor: colors.outline,
            backgroundColor: colors.surface,
            opacity: pressed ? 0.8 : 1,
          },
        ]}
      >
        <Text
          style={[
            styles.historyButtonText,
            {
              color: colors.primary,
            },
          ]}
        >
          View History
        </Text>
      </Pressable>

      {/* Disclaimer */}

      <View
        style={[
          styles.disclaimer,
          {
            backgroundColor: colors.surfaceContainerLow,
          },
        ]}
      >
        <Text
          style={[
            styles.disclaimerTitle,
            {
              color: colors.onSurface,
            },
          ]}
        >
          Research / screening use only
        </Text>

        <Text
          style={[
            styles.disclaimerText,
            {
              color: colors.onSurfaceVariant,
            },
          ]}
        >
          OralScan does not provide a medical diagnosis. Results should be
          reviewed by a qualified healthcare professional.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  content: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 40,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 28,
  },

  logo: {
    fontSize: 38,
    lineHeight: 42,
    fontWeight: '700',
  },

  headerText: {
    marginLeft: 10,
  },

  appName: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '600',
  },

  tagline: {
    fontSize: 13,
    marginTop: 1,
  },

  welcomeCard: {
    borderRadius: 24,
    padding: 24,
    marginBottom: 28,
  },

  welcomeTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '600',
  },

  welcomeText: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    marginBottom: 20,
  },

  primaryButton: {
    height: 48,
    paddingHorizontal: 20,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },

  primaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },

  patientCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 20,
    marginBottom: 28,
  },

  patientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  patientAvatar: {
    width: 52,
    height: 52,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },

  patientHeaderText: {
    flex: 1,
    marginLeft: 14,
  },

  cardLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },

  patientName: {
    fontSize: 19,
    lineHeight: 25,
    fontWeight: '600',
    marginTop: 2,
  },

  patientMeta: {
    fontSize: 13,
    marginTop: 2,
  },

  location: {
    fontSize: 12,
    marginTop: 14,
  },

  sectionTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '600',
  },

  sectionSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
    marginBottom: 16,
  },

  analysisCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 22,
    padding: 18,
    marginBottom: 12,
  },

  analysisIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },

  analysisIconText: {
    fontSize: 24,
    fontWeight: '500',
  },

  analysisContent: {
    flex: 1,
    marginLeft: 14,
    marginRight: 8,
  },

  analysisTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600',
  },

  analysisDescription: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },

  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 9,
  },

  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 7,
  },

  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },

  resultText: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },

  arrow: {
    fontSize: 30,
    fontWeight: '300',
  },

  reportButton: {
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },

  newDiagnosisButton: {
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },

  disclaimer: {
    borderRadius: 16,
    padding: 16,
    marginTop: 20,
  },

  disclaimerTitle: {
    fontSize: 12,
    fontWeight: '600',
  },

  disclaimerText: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },

  historyButton: {
  height: 52,
  borderRadius: 16,
  borderWidth: 1,
  alignItems: 'center',
  justifyContent: 'center',
  marginTop: 12,
},

historyButtonText: {
  fontSize: 15,
  fontWeight: '600',
},
});
