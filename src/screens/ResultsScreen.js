import React, { useState } from 'react';

import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useDiagnosis } from '../context/DiagnosisContext';

import { createDiagnosisReport } from '../services/reportService';

import { NativeModules } from 'react-native';

const { SharePdf } = NativeModules;

import {
  saveDiagnosis,
  updateDiagnosisReportPath,
  getAllDiagnoses,
} from '../services/database';

import { copyDiagnosisFile } from '../services/diagnosisStorage';





export default function ResultsScreen({ colors, onHome }) {
  const { diagnosis ,setReportPath } = useDiagnosis();

  const [generatingReport, setGeneratingReport] = useState(false);

const reportPath = diagnosis?.reportPath ?? null;
  const imageResult = diagnosis?.image?.result;

  const audioResult = diagnosis?.audio?.result;

  const hasImage = !!imageResult;

  const hasAudio = !!audioResult;

 const handleGenerateReport = async () => {
  try {
    setGeneratingReport(true);

    const filePath =
      await createDiagnosisReport(diagnosis);

    console.log('GENERATED PDF:', filePath);

    if (!diagnosis?.id) {
      throw new Error(
        'No diagnosis ID available for report storage.',
      );
    }

    const storedReport =
      await copyDiagnosisFile(
        filePath,
        diagnosis.id,
        'report.pdf',
      );

    console.log(
      'STORED REPORT:',
      storedReport,
    );

       // Save the complete diagnosis to SQLite.
    const diagnosisForDatabase = {
      ...diagnosis,
      reportPath: storedReport,
    };

    await saveDiagnosis(
      diagnosisForDatabase,
    );


      const rows = await getAllDiagnoses();

console.log(
  'ALL DIAGNOSES:',
  rows,
);

    setReportPath(storedReport);

        console.log(
      'DIAGNOSIS SAVED TO SQLITE:',
      diagnosis.id,
    );


  } catch (error) {
    console.error(
      'REPORT GENERATION ERROR:',
      error,
    );
  } finally {
    setGeneratingReport(false);
  }
};  

  const handleOpenReport = async () => {
    if (!reportPath) {
      return;
    }

    try {
      console.log('OPENING PDF:', reportPath);

      await SharePdf.open(reportPath);
    } catch (error) {
      console.error('OPEN PDF ERROR:', error);
    }
  };

  const handleShareReport = async () => {
    if (!reportPath) {
      return;
    }

    try {
      console.log('SHARING PDF:', reportPath);

      await SharePdf.share(reportPath);
    } catch (error) {
      console.error('SHARE PDF ERROR:', error);
    }
  };

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
      {/* Header */}
      <Text
        style={[
          styles.eyebrow,
          {
            color: colors.onSurfaceVariant,
          },
        ]}
      >
        ORALSCAN
      </Text>
      <Text
        style={[
          styles.title,
          {
            color: colors.onBackground,
          },
        ]}
      >
        Diagnosis Results
      </Text>
      <Text
        style={[
          styles.subtitle,
          {
            color: colors.onSurfaceVariant,
          },
        ]}
      >
        Review the available screening results for this diagnosis.
      </Text>
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
        <Text
          style={[
            styles.sectionLabel,
            {
              color: colors.onSurfaceVariant,
            },
          ]}
        >
          PATIENT
        </Text>

        <Text
          style={[
            styles.patientName,
            {
              color: colors.onSurface,
            },
          ]}
        >
          {diagnosis?.patient?.name || 'Unknown patient'}
        </Text>

        <Text
          style={[
            styles.patientDetails,
            {
              color: colors.onSurfaceVariant,
            },
          ]}
        >
          {diagnosis?.patient?.dateOfBirth || 'Date of birth not provided'}
          {diagnosis?.patient?.gender ? ` • ${diagnosis.patient.gender}` : ''}
        </Text>
      </View>
      {/* Image Result */}
      <ResultCard title="Image Analysis" available={hasImage} colors={colors}>
        {hasImage ? (
          <>
            <Text
              style={[
                styles.prediction,
                {
                  color:
                    imageResult.classIndex === 0
                      ? colors.error
                      : colors.primary,
                },
              ]}
            >
              {imageResult.className || 'Result available'}
            </Text>

            {imageResult.probability != null && (
              <Text
                style={[
                  styles.confidence,
                  {
                    color: colors.onSurfaceVariant,
                  },
                ]}
              >
                Confidence: {(imageResult.probability * 100).toFixed(1)}%
              </Text>
            )}

            {imageResult.probabilities && (
              <View style={styles.probabilities}>
                <ProbabilityRow
                  label="Cancer"
                  value={imageResult.probabilities.CANCER}
                  colors={colors}
                />

                <ProbabilityRow
                  label="Non Cancer"
                  value={imageResult.probabilities['NON CANCER']}
                  colors={colors}
                />
              </View>
            )}
          </>
        ) : (
          <Text
            style={[
              styles.notPerformed,
              {
                color: colors.onSurfaceVariant,
              },
            ]}
          >
            Image analysis was not performed.
          </Text>
        )}
      </ResultCard>
      {/* Audio Result */}
      <ResultCard title="Voice Analysis" available={hasAudio} colors={colors}>
        {hasAudio ? (
          <>
            <Text
              style={[
                styles.prediction,
                {
                  color:
                    audioResult.prediction === 'Vocal Pathology'
                      ? colors.error
                      : colors.primary,
                },
              ]}
            >
              {audioResult.prediction}
            </Text>

            <Text
              style={[
                styles.confidence,
                {
                  color: colors.onSurfaceVariant,
                },
              ]}
            >
              Confidence: {audioResult.confidencePercentage.toFixed(1)}%
            </Text>

            <View style={styles.probabilities}>
              <ProbabilityRow
                label="Normal"
                value={audioResult.normalProbability}
                colors={colors}
              />

              <ProbabilityRow
                label="Vocal Pathology"
                value={audioResult.pathologyProbability}
                colors={colors}
              />
            </View>
          </>
        ) : (
          <Text
            style={[
              styles.notPerformed,
              {
                color: colors.onSurfaceVariant,
              },
            ]}
          >
            Voice analysis was not performed.
          </Text>
        )}
      </ResultCard>
      {/* Report */}
      <Pressable
        disabled={(!hasImage && !hasAudio) || generatingReport}
        onPress={handleGenerateReport}
        style={({ pressed }) => [
          styles.reportButton,
          {
            backgroundColor:
              hasImage || hasAudio
                ? colors.primary
                : colors.surfaceContainerHighest,

            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        {generatingReport ? (
          <ActivityIndicator color={colors.onPrimary} />
        ) : (
          <Text
            style={[
              styles.reportButtonText,
              {
                color:
                  hasImage || hasAudio
                    ? colors.onPrimary
                    : colors.onSurfaceVariant,
              },
            ]}
          >
            {reportPath ? 'Report Generated and Data saved' : 'Generate Combined Report and Save Data'}
          </Text>
        )}
      </Pressable>
      {/* Report actions */}
      {reportPath && (
        <View style={styles.reportActions}>
          {/* Share */}

          <Pressable
            onPress={handleShareReport}
            style={({ pressed }) => [
              styles.reportActionButton,
              {
                backgroundColor: colors.primary,
                opacity: pressed ? 0.75 : 1,
              },
            ]}
          >
            <Text
              style={[
                styles.reportActionText,
                {
                  color: colors.onPrimary,
                },
              ]}
            >
              Share PDF
            </Text>
          </Pressable>

          {/* Open */}

          <Pressable
            onPress={handleOpenReport}
            style={({ pressed }) => [
              styles.reportActionButton,
              {
                backgroundColor: colors.surfaceContainerHighest,
                borderColor: colors.outline,
                borderWidth: 1,
                opacity: pressed ? 0.75 : 1,
              },
            ]}
          >
            <Text
              style={[
                styles.reportActionText,
                {
                  color: colors.onSurface,
                },
              ]}
            >
              Open PDF
            </Text>
          </Pressable>
        </View>
      )}

      {/* Home */}
      <Pressable
        onPress={onHome}
        style={[
          styles.homeButton,
          {
            borderColor: colors.outline,
          },
        ]}
      >
        <Text
          style={[
            styles.homeButtonText,
            {
              color: colors.primary,
            },
          ]}
        >
          Back to Home
        </Text>
      </Pressable>
      {/* Disclaimer */}
      <Text
        style={[
          styles.disclaimer,
          {
            color: colors.onSurfaceVariant,
          },
        ]}
      >
        For research and screening purposes only. This result is not a medical
        diagnosis and should be reviewed by a qualified healthcare professional.
      </Text>
    </ScrollView>
  );
}

function ResultCard({ title, available, colors, children }) {
  return (
    <View
      style={[
        styles.resultCard,
        {
          backgroundColor: colors.surface,
          borderColor: colors.outlineVariant,
        },
      ]}
    >
      <View style={styles.cardHeader}>
        <Text
          style={[
            styles.cardTitle,
            {
              color: colors.onSurface,
            },
          ]}
        >
          {title}
        </Text>

        <Text
          style={[
            styles.status,
            {
              color: available ? colors.primary : colors.onSurfaceVariant,
            },
          ]}
        >
          {available ? 'Completed' : 'Not performed'}
        </Text>
      </View>

      {children}
    </View>
  );
}

function ProbabilityRow({ label, value, colors }) {
  const percentage = (value ?? 0) * 100;

  return (
    <View style={styles.probabilityRow}>
      <View style={styles.probabilityHeader}>
        <Text
          style={[
            styles.probabilityLabel,
            {
              color: colors.onSurfaceVariant,
            },
          ]}
        >
          {label}
        </Text>

        <Text
          style={[
            styles.probabilityValue,
            {
              color: colors.onSurface,
            },
          ]}
        >
          {percentage.toFixed(1)}%
        </Text>
      </View>

      <View
        style={[
          styles.progressBackground,
          {
            backgroundColor: colors.surfaceContainerHighest,
          },
        ]}
      >
        <View
          style={[
            styles.progress,
            {
              width: `${Math.min(100, Math.max(0, percentage))}%`,
              backgroundColor: colors.primary,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  openReportButton: {
    height: 48,
    borderWidth: 1,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },

  openReportButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },

  content: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 40,
  },

  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },

  title: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '600',
    marginTop: 4,
  },

  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
    marginBottom: 24,
  },

  patientCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
  },

  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },

  patientName: {
    fontSize: 19,
    fontWeight: '600',
    marginTop: 5,
  },

  patientDetails: {
    fontSize: 12,
    marginTop: 3,
  },

  resultCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
  },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },

  cardTitle: {
    fontSize: 17,
    fontWeight: '600',
  },

  status: {
    fontSize: 11,
    fontWeight: '600',
  },

  prediction: {
    fontSize: 23,
    fontWeight: '600',
  },

  confidence: {
    fontSize: 13,
    marginTop: 4,
  },

  probabilities: {
    marginTop: 18,
    gap: 12,
  },

  probabilityRow: {
    width: '100%',
  },

  probabilityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },

  probabilityLabel: {
    fontSize: 12,
  },

  probabilityValue: {
    fontSize: 12,
    fontWeight: '600',
  },

  progressBackground: {
    height: 7,
    borderRadius: 4,
    overflow: 'hidden',
  },

  progress: {
    height: '100%',
    borderRadius: 4,
  },

  notPerformed: {
    fontSize: 13,
    lineHeight: 19,
  },

  reportButton: {
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },

  reportButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },

  homeButton: {
    height: 48,
    borderWidth: 1,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },

  homeButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },

  disclaimer: {
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 18,
  },

  reportActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },

  reportActionButton: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },

  reportActionText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
