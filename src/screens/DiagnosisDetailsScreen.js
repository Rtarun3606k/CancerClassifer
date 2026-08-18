import React, { useEffect, useState } from 'react';

import {
  ActivityIndicator,
  Image,
  NativeModules,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { getDiagnosisById } from '../services/database';

const { SharePdf } = NativeModules;

export default function DiagnosisDetailsScreen({
  colors,
  diagnosisId,
  onBack,
}) {
  const [diagnosis, setDiagnosis] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDiagnosis();
  }, [diagnosisId]);

  const loadDiagnosis = async () => {
    try {
      setLoading(true);

      console.log(
        'LOADING DIAGNOSIS:',
        diagnosisId,
      );

      const data = await getDiagnosisById(
        diagnosisId,
      );

      console.log(
        'DIAGNOSIS DETAILS:',
        data,
      );

      setDiagnosis(data);
    } catch (error) {
      console.error(
        'LOAD DIAGNOSIS ERROR:',
        error,
      );
    } finally {
      setLoading(false);
    }
  };

  const handleOpenReport = async () => {
    if (!diagnosis?.report_path) {
      return;
    }

    try {
      console.log(
        'OPENING REPORT:',
        diagnosis.report_path,
      );

      await SharePdf.open(
        diagnosis.report_path,
      );
    } catch (error) {
      console.error(
        'OPEN REPORT ERROR:',
        error,
      );
    }
  };

  const handleShareReport = async () => {
    if (!diagnosis?.report_path) {
      return;
    }

    try {
      console.log(
        'SHARING REPORT:',
        diagnosis.report_path,
      );

      await SharePdf.share(
        diagnosis.report_path,
      );
    } catch (error) {
      console.error(
        'SHARE REPORT ERROR:',
        error,
      );
    }
  };

  const handleOpenAudio = async () => {
    if (!diagnosis?.audio_path) {
      return;
    }

    try {
      console.log(
        'OPENING AUDIO:',
        diagnosis.audio_path,
      );

      await SharePdf.openAudio(
        diagnosis.audio_path,
      );
    } catch (error) {
      console.error(
        'OPEN AUDIO ERROR:',
        error,
      );
    }
  };

  const formatDate = value => {
    if (!value) {
      return '—';
    }

    try {
      return new Date(value).toLocaleDateString(
        'en-IN',
        {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        },
      );
    } catch {
      return value;
    }
  };

  if (loading) {
    return (
      <View
        style={[
          styles.loading,
          {
            backgroundColor: colors.background,
          },
        ]}
      >
        <ActivityIndicator
          size="large"
          color={colors.primary}
        />
      </View>
    );
  }

  if (!diagnosis) {
    return (
      <View
        style={[
          styles.loading,
          {
            backgroundColor: colors.background,
          },
        ]}
      >
        <Text
          style={{
            color: colors.onSurfaceVariant,
          }}
        >
          Diagnosis could not be found.
        </Text>

        <Pressable
          onPress={onBack}
          style={[
            styles.backButtonBottom,
            {
              borderColor: colors.outline,
            },
          ]}
        >
          <Text
            style={{
              color: colors.primary,
              fontWeight: '600',
            }}
          >
            Back to History
          </Text>
        </Pressable>
      </View>
    );
  }

  const hasImage =
    diagnosis.image_selected === 1 &&
    !!diagnosis.image_path;

  const hasAudio =
    diagnosis.audio_selected === 1 &&
    !!diagnosis.audio_path;

  const imageIsCancer =
    diagnosis.image_prediction === 'CANCER';

  const audioIsPathology =
    diagnosis.audio_prediction ===
    'Vocal Pathology';

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
      {/* BACK */}

      <Pressable
        onPress={onBack}
        style={styles.backButton}
      >
        <Text
          style={[
            styles.backArrow,
            {
              color: colors.primary,
            },
          ]}
        >
          ‹
        </Text>

        <Text
          style={[
            styles.backText,
            {
              color: colors.primary,
            },
          ]}
        >
          History
        </Text>
      </Pressable>

      {/* HEADER */}

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
        Diagnosis Details
      </Text>

      <Text
        style={[
          styles.date,
          {
            color: colors.onSurfaceVariant,
          },
        ]}
      >
        {formatDate(diagnosis.created_at)}
      </Text>

      {/* PATIENT */}

      <SectionTitle
        title="PATIENT"
        colors={colors}
      />

      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.surface,
            borderColor: colors.outlineVariant,
          },
        ]}
      >
        <InfoRow
          label="Name"
          value={diagnosis.patient_name}
          colors={colors}
        />

        <InfoRow
          label="Date of birth"
          value={diagnosis.date_of_birth}
          colors={colors}
        />

        <InfoRow
          label="Gender"
          value={diagnosis.gender}
          colors={colors}
        />

        <InfoRow
          label="Age"
          value={
            diagnosis.age_at_diagnosis != null
              ? `${diagnosis.age_at_diagnosis} years`
              : '—'
          }
          colors={colors}
          last
        />
      </View>

      {/* ORIGINAL IMAGE */}

      {hasImage && (
        <>
          <SectionTitle
            title="ORIGINAL IMAGE"
            colors={colors}
          />

          <View
            style={[
              styles.imageCard,
              {
                backgroundColor: colors.surface,
                borderColor:
                  colors.outlineVariant,
              },
            ]}
          >
            <Image
              source={{
                uri: `file://${diagnosis.image_path}`,
              }}
              style={styles.diagnosisImage}
              resizeMode="contain"
            />
          </View>
        </>
      )}

      {/* IMAGE ANALYSIS */}

      <SectionTitle
        title="IMAGE ANALYSIS"
        colors={colors}
      />

      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.surface,
            borderColor: colors.outlineVariant,
          },
        ]}
      >
        {!hasImage ? (
          <NotPerformed colors={colors} />
        ) : (
          <>
            <StatusRow
              label="Prediction"
              value={
                diagnosis.image_prediction ||
                'Completed'
              }
              danger={imageIsCancer}
              colors={colors}
            />

            <InfoRow
              label="Confidence"
              value={
                diagnosis.image_confidence != null
                  ? `${(
                      diagnosis.image_confidence *
                      100
                    ).toFixed(1)}%`
                  : '—'
              }
              colors={colors}
            />

            <InfoRow
              label="Cancer probability"
              value={
                diagnosis.image_cancer_probability !=
                null
                  ? `${(
                      diagnosis.image_cancer_probability *
                      100
                    ).toFixed(1)}%`
                  : '—'
              }
              colors={colors}
            />

            <InfoRow
              label="Non-cancer probability"
              value={
                diagnosis.image_non_cancer_probability !=
                null
                  ? `${(
                      diagnosis.image_non_cancer_probability *
                      100
                    ).toFixed(1)}%`
                  : '—'
              }
              colors={colors}
              last
            />
          </>
        )}
      </View>

      {/* AUDIO */}

      <SectionTitle
        title="VOICE ANALYSIS"
        colors={colors}
      />

      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.surface,
            borderColor: colors.outlineVariant,
          },
        ]}
      >
        {!hasAudio ? (
          <NotPerformed colors={colors} />
        ) : (
          <>
            <StatusRow
              label="Prediction"
              value={
                diagnosis.audio_prediction ||
                'Completed'
              }
              danger={audioIsPathology}
              colors={colors}
            />

            <InfoRow
              label="Confidence"
              value={
                diagnosis.audio_confidence != null
                  ? `${(
                      diagnosis.audio_confidence *
                      100
                    ).toFixed(1)}%`
                  : '—'
              }
              colors={colors}
            />

            <InfoRow
              label="Normal probability"
              value={
                diagnosis.audio_normal_probability !=
                null
                  ? `${(
                      diagnosis.audio_normal_probability *
                      100
                    ).toFixed(1)}%`
                  : '—'
              }
              colors={colors}
            />

            <InfoRow
              label="Pathology probability"
              value={
                diagnosis.audio_pathology_probability !=
                null
                  ? `${(
                      diagnosis.audio_pathology_probability *
                      100
                    ).toFixed(1)}%`
                  : '—'
              }
              colors={colors}
              last
            />
          </>
        )}
      </View>

      {/* STORED AUDIO */}

      {hasAudio && (
        <>
          <SectionTitle
            title="RECORDED AUDIO"
            colors={colors}
          />

          <View
            style={[
              styles.audioCard,
              {
                backgroundColor: colors.surface,
                borderColor:
                  colors.outlineVariant,
              },
            ]}
          >
            <View
              style={styles.audioHeader}
            >
              <View style={styles.audioIcon}>
                <Text
                  style={{
                    color: colors.primary,
                    fontSize: 20,
                  }}
                >
                  ♪
                </Text>
              </View>

              <View
                style={styles.audioInfo}
              >
                <Text
                  style={[
                    styles.audioTitle,
                    {
                      color:
                        colors.onSurface,
                    },
                  ]}
                >
                  Voice recording
                </Text>

                <Text
                  style={[
                    styles.audioSubtitle,
                    {
                      color:
                        colors.onSurfaceVariant,
                    },
                  ]}
                >
                  WAV audio
                </Text>
              </View>
            </View>

            <Pressable
              onPress={handleOpenAudio}
              style={({ pressed }) => [
                styles.audioButton,
                {
                  backgroundColor:
                    colors.primary,
                  opacity: pressed
                    ? 0.8
                    : 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.audioButtonText,
                  {
                    color:
                      colors.onPrimary,
                  },
                ]}
              >
                Open Recording
              </Text>
            </Pressable>
          </View>
        </>
      )}

      {/* REPORT */}

      {diagnosis.report_path && (
        <>
          <SectionTitle
            title="REPORT"
            colors={colors}
          />

          <View
            style={[
              styles.reportCard,
              {
                backgroundColor:
                  colors.primaryContainer,
              },
            ]}
          >
            <Text
              style={[
                styles.reportTitle,
                {
                  color:
                    colors.onPrimaryContainer,
                },
              ]}
            >
              Diagnosis report ready
            </Text>

            <Text
              style={[
                styles.reportSubtitle,
                {
                  color:
                    colors.onPrimaryContainer,
                },
              ]}
            >
              The complete diagnosis report is
              stored on this device.
            </Text>

            <View
              style={styles.reportButtons}
            >
              <Pressable
                onPress={handleOpenReport}
                style={({ pressed }) => [
                  styles.primaryButton,
                  {
                    backgroundColor:
                      colors.primary,
                    opacity: pressed
                      ? 0.8
                      : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.primaryButtonText,
                    {
                      color:
                        colors.onPrimary,
                    },
                  ]}
                >
                  Open PDF
                </Text>
              </Pressable>

              <Pressable
                onPress={handleShareReport}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  {
                    borderColor:
                      colors.primary,
                    opacity: pressed
                      ? 0.8
                      : 1,
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
                  Share PDF
                </Text>
              </Pressable>
            </View>
          </View>
        </>
      )}

      {/* STORAGE INFO */}

      <SectionTitle
        title="STORAGE"
        colors={colors}
      />

      <View
        style={[
          styles.storageCard,
          {
            backgroundColor: colors.surface,
            borderColor: colors.outlineVariant,
          },
        ]}
      >
        <InfoRow
          label="Diagnosis ID"
          value={diagnosis.id}
          colors={colors}
        />

        <InfoRow
          label="Image stored"
          value={hasImage ? 'Yes' : 'No'}
          colors={colors}
        />

        <InfoRow
          label="Audio stored"
          value={hasAudio ? 'Yes' : 'No'}
          colors={colors}
        />

        <InfoRow
          label="Report stored"
          value={
            diagnosis.report_path
              ? 'Yes'
              : 'No'
          }
          colors={colors}
          last
        />
      </View>

      {/* DISCLAIMER */}

      <Text
        style={[
          styles.disclaimer,
          {
            color: colors.onSurfaceVariant,
          },
        ]}
      >
        For research and screening purposes only.
        AI results are not a medical diagnosis and
        should be reviewed by a qualified healthcare
        professional.
      </Text>
    </ScrollView>
  );
}

/* ---------------- COMPONENTS ---------------- */

function SectionTitle({
  title,
  colors,
}) {
  return (
    <Text
      style={[
        styles.sectionTitle,
        {
          color: colors.onSurfaceVariant,
        },
      ]}
    >
      {title}
    </Text>
  );
}

function InfoRow({
  label,
  value,
  colors,
  last = false,
}) {
  return (
    <View
      style={[
        styles.infoRow,
        !last && styles.infoBorder,
        !last && {
          borderBottomColor:
            colors.outlineVariant,
        },
      ]}
    >
      <Text
        style={[
          styles.infoLabel,
          {
            color:
              colors.onSurfaceVariant,
          },
        ]}
      >
        {label}
      </Text>

      <Text
        style={[
          styles.infoValue,
          {
            color: colors.onSurface,
          },
        ]}
        numberOfLines={2}
      >
        {value || '—'}
      </Text>
    </View>
  );
}

function StatusRow({
  label,
  value,
  danger,
  colors,
}) {
  return (
    <View style={styles.statusRow}>
      <Text
        style={[
          styles.infoLabel,
          {
            color:
              colors.onSurfaceVariant,
          },
        ]}
      >
        {label}
      </Text>

      <Text
        style={[
          styles.statusValue,
          {
            color: danger
              ? colors.error
              : colors.primary,
          },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

function NotPerformed({ colors }) {
  return (
    <Text
      style={[
        styles.notPerformed,
        {
          color:
            colors.onSurfaceVariant,
        },
      ]}
    >
      This analysis was not performed.
    </Text>
  );
}

/* ---------------- STYLES ---------------- */

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  content: {
    padding: 20,
    paddingBottom: 50,
  },

  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 42,
    marginBottom: 12,
  },

  backArrow: {
    fontSize: 34,
    fontWeight: '300',
    lineHeight: 36,
  },

  backText: {
    marginLeft: 5,
    fontSize: 14,
    fontWeight: '600',
  },

  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },

  title: {
    marginTop: 5,
    fontSize: 30,
    fontWeight: '700',
  },

  date: {
    marginTop: 5,
    fontSize: 13,
  },

  sectionTitle: {
    marginTop: 28,
    marginBottom: 10,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },

  card: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 17,
  },

  infoRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 20,
  },

  infoBorder: {
    borderBottomWidth: 1,
  },

  infoLabel: {
    fontSize: 13,
  },

  infoValue: {
    flex: 1,
    textAlign: 'right',
    fontSize: 14,
    fontWeight: '500',
  },

  statusRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  statusValue: {
    fontSize: 16,
    fontWeight: '700',
  },

  notPerformed: {
    paddingVertical: 20,
    fontSize: 13,
  },

  /* IMAGE */

  imageCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 10,
    overflow: 'hidden',
  },

  diagnosisImage: {
    width: '100%',
    height: 300,
    borderRadius: 12,
  },

  /* AUDIO */

  audioCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 17,
  },

  audioHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  audioIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF0FF',
  },

  audioInfo: {
    marginLeft: 13,
  },

  audioTitle: {
    fontSize: 15,
    fontWeight: '600',
  },

  audioSubtitle: {
    marginTop: 3,
    fontSize: 12,
  },

  audioButton: {
    marginTop: 16,
    height: 46,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },

  audioButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },

  /* REPORT */

  reportCard: {
    borderRadius: 18,
    padding: 18,
  },

  reportTitle: {
    fontSize: 17,
    fontWeight: '700',
  },

  reportSubtitle: {
    marginTop: 5,
    fontSize: 13,
    lineHeight: 19,
  },

  reportButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },

  primaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  primaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },

  secondaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },

  /* STORAGE */

  storageCard: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 17,
  },

  /* OTHER */

  backButtonBottom: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderWidth: 1,
    borderRadius: 12,
  },

  disclaimer: {
    marginTop: 28,
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
  },
});
