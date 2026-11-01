import React, { useEffect, useState } from 'react';

import {
  ActivityIndicator,
  Image,
  Modal,
  NativeModules,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { getDiagnosisWithImages } from '../services/database';
import {
  diagnosisSourceFromRow,
  DIAGNOSIS_SOURCE,
  getDiagnosisSourceLabel,
} from '../utils/diagnosisSource';

const { SharePdf } = NativeModules;

function imageUri(path) {
  if (!path) {
    return null;
  }

  return path.startsWith('file://') ? path : `file://${path}`;
}

function imageName(row, index) {
  if (row.image_file_name) {
    return row.image_file_name;
  }

  if (row.image_path) {
    return row.image_path.split('/').pop();
  }

  return `image-${String(index + 1).padStart(2, '0')}`;
}

function formatDateTime(value) {
  if (!value) {
    return '—';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return `${date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })} ${date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

function modelLabel(row) {
  return [row.model_name, row.model_version]
    .filter(Boolean)
    .join(' · ');
}

export default function DiagnosisDetailsScreen({
  colors,
  diagnosisId,
  onBack,
}) {
  const [diagnosis, setDiagnosis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [previewImageId, setPreviewImageId] = useState(null);

  useEffect(() => {
    loadDiagnosis();
  }, [diagnosisId]);

  const loadDiagnosis = async () => {
    try {
      setLoading(true);

      console.log('LOADING DIAGNOSIS:', diagnosisId);

      const data = await getDiagnosisWithImages(diagnosisId);

      console.log('DIAGNOSIS DETAILS:', data);

      setDiagnosis(data);
    } catch (error) {
      console.error('LOAD DIAGNOSIS ERROR:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenReport = async () => {
    if (!diagnosis?.report_path) {
      return;
    }

    try {
      console.log('OPENING REPORT:', diagnosis.report_path);

      await SharePdf.open(diagnosis.report_path);
    } catch (error) {
      console.error('OPEN REPORT ERROR:', error);
    }
  };

  const handleShareReport = async () => {
    if (!diagnosis?.report_path) {
      return;
    }

    try {
      console.log('SHARING REPORT:', diagnosis.report_path);

      await SharePdf.share(diagnosis.report_path);
    } catch (error) {
      console.error('SHARE REPORT ERROR:', error);
    }
  };

  const handleOpenAudio = async () => {
    if (!diagnosis?.audio_path) {
      return;
    }

    try {
      console.log('OPENING AUDIO:', diagnosis.audio_path);

      await SharePdf.openAudio(diagnosis.audio_path);
    } catch (error) {
      console.error('OPEN AUDIO ERROR:', error);
    }
  };

  const formatDate = value => {
    if (!value) {
      return '—';
    }

    try {
      return new Date(value).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });
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
        <ActivityIndicator size="large" color={colors.primary} />
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

  const images = diagnosis.images ?? [];

  const hasImage = images.length > 0;

  const hasAudio = diagnosis.audio_selected === 1 && !!diagnosis.audio_path;

  const source = diagnosisSourceFromRow(diagnosis);
  const sourceLabel = getDiagnosisSourceLabel(source);
  const isLive = source === DIAGNOSIS_SOURCE.LIVE;

  const audioIsPathology = diagnosis.audio_prediction === 'Vocal Pathology';

  const previewImage = images.find(item => item.id === previewImageId);

  const previewUri = previewImage
    ? imageUri(previewImage.image_path)
    : null;

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

      <Pressable onPress={onBack} style={styles.backButton}>
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

      <View
        style={[
          styles.sourceBadge,
          {
            backgroundColor: colors.primaryContainer,
          },
        ]}
      >
        <Text
          style={[
            styles.sourceBadgeText,
            {
              color: colors.onPrimaryContainer,
            },
          ]}
        >
          {sourceLabel}
        </Text>
      </View>

      {isLive && (
        <Text
          style={[
            styles.aiNotice,
            {
              color: colors.onSurfaceVariant,
            },
          ]}
        >
          AI-generated live video prediction. Review by a qualified clinician is
          required.
        </Text>
      )}

      {/* PATIENT */}

      <SectionTitle title="PATIENT" colors={colors} />

      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.surface,
            borderColor: colors.outlineVariant,
          },
        ]}
      >
        <InfoRow label="Name" value={diagnosis.patient_name} colors={colors} />

        <InfoRow
          label="Date of birth"
          value={diagnosis.date_of_birth}
          colors={colors}
        />

        <InfoRow label="Gender" value={diagnosis.gender} colors={colors} />

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

      {/* DOctor and hospital */}

      <SectionTitle title="DOCTOR & HOSPITAL DETAILS" colors={colors} />

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
          label="Doctor Name"
          value={diagnosis.doctor_name}
          colors={colors}
        />
        <InfoRow
          label="Hospital / Clinic"
          value={
            diagnosis.hospital_name != null
              ? `${diagnosis.hospital_name}`
              : '—'
          }
          colors={colors}
          last
        />
      </View>

      {/* IMAGES */}

      <SectionTitle
        title={`IMAGES (${images.length})`}
        colors={colors}
      />

      {!hasImage ? (
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.outlineVariant,
            },
          ]}
        >
          <NotPerformed colors={colors} />
        </View>
      ) : (
        images.map((image, index) => (
          <ImageResultCard
            key={image.id || `${index}`}
            image={image}
            index={index}
            colors={colors}
            onOpen={() => setPreviewImageId(image.id)}
          />
        ))
      )}

      {/* AUDIO */}

      <SectionTitle title="VOICE ANALYSIS" colors={colors} />

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
              value={diagnosis.audio_prediction || 'Completed'}
              danger={audioIsPathology}
              colors={colors}
            />
            <InfoRow
              label="Confidence"
              value={
                diagnosis.audio_confidence != null
                  ? `${(diagnosis.audio_confidence * 100).toFixed(1)}%`
                  : '—'
              }
              colors={colors}
            />
            <InfoRow
              label="Normal probability"
              value={
                diagnosis.audio_normal_probability != null
                  ? `${(diagnosis.audio_normal_probability * 100).toFixed(1)}%`
                  : '—'
              }
              colors={colors}
            />
            <InfoRow
              label="Pathology probability"
              value={
                diagnosis.audio_pathology_probability != null
                  ? `${(diagnosis.audio_pathology_probability * 100).toFixed(
                      1,
                    )}%`
                  : '—'
              }
              colors={colors}
              last
            />
            <InfoRow
              label="Doctor Assigned Assessment"
              value={
                diagnosis.audio_doctor_assessment != null
                  ? `${diagnosis.audio_doctor_assessment}`
                  : '—'
              }
              colors={colors}
              last
            />
            <InfoRow
              label="Doctor Remarks"
              value={
                diagnosis.audio_doctor_remarks != null
                  ? `${diagnosis.audio_doctor_remarks}`
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
          <SectionTitle title="RECORDED AUDIO" colors={colors} />

          <View
            style={[
              styles.audioCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.outlineVariant,
              },
            ]}
          >
            <View style={styles.audioHeader}>
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

              <View style={styles.audioInfo}>
                <Text
                  style={[
                    styles.audioTitle,
                    {
                      color: colors.onSurface,
                    },
                  ]}
                >
                  Voice recording
                </Text>

                <Text
                  style={[
                    styles.audioSubtitle,
                    {
                      color: colors.onSurfaceVariant,
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
                  backgroundColor: colors.primary,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.audioButtonText,
                  {
                    color: colors.onPrimary,
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
          <SectionTitle title="REPORT" colors={colors} />

          <View
            style={[
              styles.reportCard,
              {
                backgroundColor: colors.primaryContainer,
              },
            ]}
          >
            <Text
              style={[
                styles.reportTitle,
                {
                  color: colors.onPrimaryContainer,
                },
              ]}
            >
              Diagnosis report ready
            </Text>

            <Text
              style={[
                styles.reportSubtitle,
                {
                  color: colors.onPrimaryContainer,
                },
              ]}
            >
              The complete diagnosis report is stored on this device.
            </Text>

            <View style={styles.reportButtons}>
              <Pressable
                onPress={handleOpenReport}
                style={({ pressed }) => [
                  styles.primaryButton,
                  {
                    backgroundColor: colors.primary,
                    opacity: pressed ? 0.8 : 1,
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
                  Open PDF
                </Text>
              </Pressable>

              <Pressable
                onPress={handleShareReport}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  {
                    borderColor: colors.primary,
                    opacity: pressed ? 0.8 : 1,
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
                  Share PDF
                </Text>
              </Pressable>
            </View>
          </View>
        </>
      )}

      {/* STORAGE INFO */}

      <SectionTitle title="STORAGE" colors={colors} />

      <View
        style={[
          styles.storageCard,
          {
            backgroundColor: colors.surface,
            borderColor: colors.outlineVariant,
          },
        ]}
      >
        <InfoRow label="Diagnosis ID" value={diagnosis.id} colors={colors} />

        <InfoRow
          label="Images stored"
          value={hasImage ? `${images.length}` : 'No'}
          colors={colors}
        />

        <InfoRow
          label="Audio stored"
          value={hasAudio ? 'Yes' : 'No'}
          colors={colors}
        />

        <InfoRow
          label="Report stored"
          value={diagnosis.report_path ? 'Yes' : 'No'}
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
        For research and screening purposes only. AI results are not a medical
        diagnosis and should be reviewed by a qualified healthcare professional.
      </Text>

      {/* FULL SCREEN IMAGE PREVIEW */}

      {previewUri && (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setPreviewImageId(null)}
        >
          <Pressable
            style={styles.previewOverlay}
            onPress={() => setPreviewImageId(null)}
          >
            <Image
              source={{ uri: previewUri }}
              style={styles.previewImage}
              resizeMode="contain"
            />

            <Text style={styles.previewHint}>Tap to close</Text>
          </Pressable>
        </Modal>
      )}
    </ScrollView>
  );
}

/* ---------------- COMPONENTS ---------------- */

function SectionTitle({ title, colors }) {
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

function InfoRow({ label, value, colors, last = false }) {
  return (
    <View
      style={[
        styles.infoRow,
        !last && styles.infoBorder,
        !last && {
          borderBottomColor: colors.outlineVariant,
        },
      ]}
    >
      <Text
        style={[
          styles.infoLabel,
          {
            color: colors.onSurfaceVariant,
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

function StatusRow({ label, value, danger, colors }) {
  return (
    <View style={styles.statusRow}>
      <Text
        style={[
          styles.infoLabel,
          {
            color: colors.onSurfaceVariant,
          },
        ]}
      >
        {label}
      </Text>

      <Text
        style={[
          styles.statusValue,
          {
            color: danger ? colors.error : colors.primary,
          },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

function ImageResultCard({ image, index, colors, onOpen }) {
  const isFailed = image.inference_status === 'failed';

  const isCancer = image.image_prediction === 'CANCER';

  const uri = imageUri(image.image_path);

  return (
    <View
      style={[
        styles.card,
        styles.imageResultCard,
        {
          backgroundColor: colors.surface,
          borderColor: colors.outlineVariant,
        },
      ]}
    >
      <View style={styles.imageResultHeader}>
        <Text
          style={[styles.imageResultTitle, { color: colors.onSurface }]}
        >
          Image {index + 1}
        </Text>

        <Text
          style={[styles.imageResultFile, { color: colors.onSurfaceVariant }]}
          numberOfLines={1}
        >
          {imageName(image, index)}
        </Text>
      </View>

      {uri ? (
        <Pressable onPress={onOpen}>
          <Image
            source={{ uri }}
            style={styles.diagnosisImage}
            resizeMode="contain"
          />

          <Text
            style={[styles.imageOpenHint, { color: colors.primary }]}
          >
            Tap to view full image
          </Text>
        </Pressable>
      ) : (
        <Text
          style={[styles.imageMissing, { color: colors.onSurfaceVariant }]}
        >
          Stored image file is unavailable.
        </Text>
      )}

      {isFailed ? (
        <View
          style={[
            styles.failureBanner,
            { backgroundColor: colors.errorContainer },
          ]}
        >
          <Text style={[styles.failureTitle, { color: colors.error }]}>
            Inference failed
          </Text>

          <Text
            style={[styles.failureText, { color: colors.onErrorContainer }]}
          >
            {image.error_message || 'No prediction was produced.'}
          </Text>
        </View>
      ) : (
        <>
          <StatusRow
            label="AI prediction"
            value={image.image_prediction || 'Completed'}
            danger={isCancer}
            colors={colors}
          />

          <InfoRow
            label="Confidence"
            value={
              image.image_confidence != null
                ? `${(image.image_confidence * 100).toFixed(1)}%`
                : '—'
            }
            colors={colors}
          />

          <InfoRow
            label="Cancer probability"
            value={
              image.image_cancer_probability != null
                ? `${(image.image_cancer_probability * 100).toFixed(1)}%`
                : '—'
            }
            colors={colors}
          />

          <InfoRow
            label="Non-cancer probability"
            value={
              image.image_non_cancer_probability != null
                ? `${(image.image_non_cancer_probability * 100).toFixed(1)}%`
                : '—'
            }
            colors={colors}
          />

          {!!image.inference_timestamp && (
            <InfoRow
              label="Inference time"
              value={formatDateTime(image.inference_timestamp)}
              colors={colors}
            />
          )}

          {!!modelLabel(image) && (
            <InfoRow
              label="Model"
              value={modelLabel(image)}
              colors={colors}
            />
          )}
        </>
      )}

      <InfoRow
        label="Doctor assessment"
        value={image.doctor_assessment}
        colors={colors}
      />

      <InfoRow
        label="Doctor remarks"
        value={image.doctor_remarks}
        colors={colors}
        last
      />
    </View>
  );
}

function NotPerformed({ colors }) {
  return (
    <Text
      style={[
        styles.notPerformed,
        {
          color: colors.onSurfaceVariant,
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

  sourceBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },

  sourceBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },

  aiNotice: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 18,
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

  imageResultCard: {
    marginBottom: 14,
    paddingTop: 14,
    paddingBottom: 4,
  },

  imageResultHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },

  imageResultTitle: {
    fontSize: 15,
    fontWeight: '700',
  },

  imageResultFile: {
    flex: 1,
    textAlign: 'right',
    fontSize: 11,
  },

  imageOpenHint: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },

  imageMissing: {
    marginVertical: 14,
    fontSize: 12,
  },

  failureBanner: {
    marginTop: 14,
    marginBottom: 8,
    padding: 14,
    borderRadius: 14,
  },

  failureTitle: {
    fontSize: 13,
    fontWeight: '700',
  },

  failureText: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 17,
  },

  imageCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 10,
    overflow: 'hidden',
  },

  diagnosisImage: {
    width: '100%',
    height: 260,
    borderRadius: 12,
    backgroundColor: '#00000008',
  },

  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },

  previewImage: {
    width: '100%',
    height: '80%',
  },

  previewHint: {
    marginTop: 16,
    color: '#FFFFFF',
    fontSize: 12,
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
