import React, { useMemo, useState } from 'react';

import {
  View,
  Text,
  Image,
  Pressable,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TextInput,
} from 'react-native';

import { launchCamera, launchImageLibrary } from 'react-native-image-picker';

import { classifyImage } from '../ml/model';

import AppFooter from '../components/AppFooter';
import ProbabilityBar from '../components/ProbabilityBar';
import { IMAGE_STATUS, useDiagnosis } from '../context/DiagnosisContext';
import {
  copyDiagnosisFile,
  deleteDiagnosisFile,
} from '../services/diagnosisStorage';
import { getExtensionFromFile } from '../utils/getFileExtision';
import { imageDisplayUri, imageFileName } from '../utils/diagnosisImages';

const SUPPORTED_EXTENSIONS = [
  'jpg',
  'jpeg',
  'png',
  'webp',
  'heic',
  'heif',
  'bmp',
  'gif',
];

/**
 * Validates a picker / camera asset before it enters the diagnosis.
 * Returns an error message, or null when the asset is usable.
 */
export function validateImageAsset(asset) {
  if (!asset?.uri) {
    return 'The selected file could not be accessed.';
  }

  const type = asset.type || '';

  if (type && !type.startsWith('image/')) {
    return 'Only image files can be analyzed.';
  }

  const extension = getExtensionFromFile(asset, null);

  if (extension && !SUPPORTED_EXTENSIONS.includes(extension)) {
    return `Unsupported image format (.${extension}).`;
  }

  return null;
}

/**
 * Builds a de-duplication key for a selected asset.
 */
export function getImageDedupeKey(asset) {
  if (!asset) {
    return null;
  }

  return (asset.fileName || asset.uri || '').toLowerCase();
}

export default function ImageAnalysisScreen({ colors, onComplete, onBack }) {
  const [busy, setBusy] = useState(false);

  const [progress, setProgress] = useState({ done: 0, total: 0 });

  const [notice, setNotice] = useState(null);

  const {
    diagnosis,
    addImages,
    removeImage,
    updateImage,
    setImageAssessment,
  } = useDiagnosis();

  const images = diagnosis?.image?.images ?? [];

  const pendingImages = useMemo(
    () =>
      images.filter(
        image =>
          image.status === IMAGE_STATUS.PENDING ||
          image.status === IMAGE_STATUS.FAILED ||
          image.status === IMAGE_STATUS.PROCESSING ||
          !image.result,
      ),
    [images],
  );

  const completedImages = useMemo(
    () => images.filter(image => !!image.result),
    [images],
  );

  const addAssets = (assets = []) => {
    const existingKeys = new Set(
      images
        .map(image => getImageDedupeKey({ fileName: image.fileName, uri: image.originalUri }))
        .filter(Boolean),
    );

    const accepted = [];

    const skipped = [];

    assets.forEach(asset => {
      if (!asset) {
        return;
      }

      const key = getImageDedupeKey(asset);

      if (key && existingKeys.has(key)) {
        skipped.push(`${asset.fileName || 'Selected image'} (duplicate)`);
        return;
      }

      const validationError = validateImageAsset(asset);

      if (validationError) {
        skipped.push(`${asset.fileName || 'Selected image'} (${validationError})`);
        return;
      }

      if (key) {
        existingKeys.add(key);
      }

      accepted.push({
        originalUri: asset.uri,
        uri: asset.uri,
        mimeType: asset.type || null,
        fileName:
          asset.fileName ||
          asset.uri.split('/').pop() ||
          `image-${images.length + accepted.length + 1}`,
      });
    });

    if (accepted.length) {
      addImages(accepted);

      setNotice(
        accepted.length === 1
          ? '1 image added.'
          : `${accepted.length} images added.`,
      );
    }

    if (skipped.length) {
      setNotice(`Skipped ${skipped.length}: ${skipped.join(', ')}`);
    }
  };

  const pickImages = async () => {
    try {
      const response = await launchImageLibrary({
        mediaType: 'photo',
        selectionLimit: 0,
        quality: 1,
      });

      if (response.didCancel || !response.assets?.length) {
        return;
      }

      addAssets(response.assets);
    } catch (error) {
      console.error('IMAGE PICKER ERROR:', error);

      setNotice(error?.message || 'Unable to open the image gallery.');
    }
  };

  const captureImage = async () => {
    try {
      const response = await launchCamera({
        mediaType: 'photo',
        quality: 1,
        saveToPhotos: false,
      });

      if (response.didCancel || !response.assets?.length) {
        return;
      }

      addAssets(response.assets);
    } catch (error) {
      console.error('CAMERA ERROR:', error);

      setNotice(error?.message || 'Unable to open the camera.');
    }
  };

  const handleRemove = async image => {
    if (!image?.id || busy) {
      return;
    }

    try {
      await deleteDiagnosisFile(image.path);
    } catch (error) {
      console.warn('Could not delete stored image:', error?.message);
    }

    removeImage(image.id);

    setNotice('Image removed.');
  };

  const runInference = async targets => {
    if (busy || !targets.length) {
      return;
    }

    if (!diagnosis?.id) {
      setNotice('No active diagnosis ID. Please start a new diagnosis.');
      return;
    }

    setBusy(true);
    setNotice(null);

    setProgress({ done: 0, total: targets.length });

    for (let index = 0; index < targets.length; index += 1) {
      const image = targets[index];

      const position =
        images.findIndex(item => item.id === image.id) >= 0
          ? images.findIndex(item => item.id === image.id)
          : index;

      updateImage(image.id, {
        status: IMAGE_STATUS.PROCESSING,
        error: null,
      });

      setProgress({ done: index, total: targets.length });

      const sourceUri = image.originalUri || image.uri;

      let prediction = null;

      try {
        // Each image is classified independently through the existing
        // preprocessing + ONNX pipeline.
        prediction = await classifyImage(sourceUri);
      } catch (error) {
        console.error('CLASSIFICATION ERROR:', image.fileName, error);

        updateImage(image.id, {
          status: IMAGE_STATUS.FAILED,
          error: error?.message || 'Unable to analyze image.',
        });

        setProgress({ done: index + 1, total: targets.length });

        continue;
      }

      let storedPath = null;

      try {
        const extension = getExtensionFromFile(
          { name: image.fileName, type: image.mimeType },
          'jpg',
        );

        storedPath = await copyDiagnosisFile(
          sourceUri,
          diagnosis.id,
          `images/image-${String(position + 1).padStart(2, '0')}.${extension}`,
        );
      } catch (error) {
        console.warn(
          'Could not store image in the diagnosis folder:',
          error?.message,
        );
      }

      updateImage(image.id, {
        result: prediction,
        path: storedPath,
        uri: storedPath || image.uri,
        status: IMAGE_STATUS.COMPLETED,
        error: storedPath
          ? null
          : 'Image could not be copied to the diagnosis folder.',
      });

      setProgress({ done: index + 1, total: targets.length });
    }

    setBusy(false);
  };

  const handleAnalyze = () => {
    // Re-analyze everything when all images already have a result, otherwise
    // only process the pending / failed ones.
    const targets = pendingImages.length ? pendingImages : images;

    runInference(targets);
  };

  const handleContinue = () => {
    if (busy || !completedImages.length) {
      return;
    }

    onComplete();
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <Pressable
        onPress={onBack}
        disabled={busy}
        style={[
          styles.backButton,
          {
            marginTop: -30,
            marginBottom: 10,
          },
        ]}
      >
        <Text style={[styles.backText, { color: colors.primary }]}>‹ Back</Text>
      </Pressable>

      <Text style={[styles.title, { color: colors.onBackground }]}>
        Oral images
      </Text>

      <Text style={[styles.subtitle, { color: colors.onSurfaceVariant }]}>
        Add one or more oral images. Every image is analyzed separately by the
        on-device model.
      </Text>

      {/* Selected images */}
      <View
        style={[
          styles.imagesCard,
          {
            backgroundColor: colors.surface,
            borderColor: colors.outline,
          },
        ]}
      >
        <View style={styles.imagesHeader}>
          <Text style={[styles.eyebrow, { color: colors.onSurfaceVariant }]}>
            SELECTED IMAGES
          </Text>

          <Text style={[styles.count, { color: colors.onSurfaceVariant }]}>
            {images.length}
          </Text>
        </View>

        {images.length === 0 ? (
          <View style={styles.placeholder}>
            <View
              style={[
                styles.uploadIcon,
                { backgroundColor: colors.primaryContainer },
              ]}
            >
              <Text style={[styles.uploadIconText, { color: colors.primary }]}>
                +
              </Text>
            </View>

            <Text
              style={[styles.placeholderTitle, { color: colors.onSurface }]}
            >
              No images selected yet
            </Text>

            <Text
              style={[
                styles.placeholderText,
                { color: colors.onSurfaceVariant },
              ]}
            >
              Choose clear oral images from the gallery or capture them with the
              camera.
            </Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {images.map((image, index) => (
              <ImageThumbnail
                key={image.id}
                image={image}
                index={index}
                colors={colors}
                disabled={busy}
                onRemove={() => handleRemove(image)}
              />
            ))}
          </View>
        )}
      </View>

      {/* Add images */}
      <View style={styles.addRow}>
        <Pressable
          onPress={pickImages}
          disabled={busy}
          style={({ pressed }) => [
            styles.addButton,
            {
              backgroundColor: colors.surfaceContainerHighest,
              borderColor: colors.outlineVariant,
              opacity: pressed || busy ? 0.7 : 1,
            },
          ]}
        >
          <Text style={[styles.addButtonText, { color: colors.onSurface }]}>
            Add Images
          </Text>
        </Pressable>

        <Pressable
          onPress={captureImage}
          disabled={busy}
          style={({ pressed }) => [
            styles.addButton,
            {
              backgroundColor: colors.surfaceContainerHighest,
              borderColor: colors.outlineVariant,
              opacity: pressed || busy ? 0.7 : 1,
            },
          ]}
        >
          <Text style={[styles.addButtonText, { color: colors.onSurface }]}>
            Take Photo
          </Text>
        </Pressable>
      </View>

      {/* Analyze */}
      <Pressable
        onPress={handleAnalyze}
        disabled={busy || images.length === 0}
        style={({ pressed }) => [
          styles.mainButton,
          {
            backgroundColor:
              images.length === 0
                ? colors.surfaceContainerHighest
                : colors.primary,
            opacity: pressed || busy ? 0.75 : 1,
          },
        ]}
      >
        {busy ? (
          <>
            <ActivityIndicator size="small" color={colors.onPrimary} />

            <Text
              style={[
                styles.mainButtonText,
                { color: colors.onPrimary, marginLeft: 10 },
              ]}
            >
              Analyzing {progress.done + 1 <= progress.total ? progress.done + 1 : progress.total} of{' '}
              {progress.total}
            </Text>
          </>
        ) : (
          <Text
            style={[
              styles.mainButtonText,
              {
                color:
                  images.length === 0
                    ? colors.onSurfaceVariant
                    : colors.onPrimary,
              },
            ]}
          >
            {images.length === 0
              ? 'Select images to analyze'
              : pendingImages.length
              ? `Analyze ${pendingImages.length} ${
                  pendingImages.length === 1 ? 'Image' : 'Images'
                }`
              : 'Re-analyze All Images'}
          </Text>
        )}
      </Pressable>

      {/* Notice */}
      {notice && (
        <View
          style={[
            styles.noticeCard,
            { backgroundColor: colors.surfaceContainerLow },
          ]}
        >
          <Text style={[styles.noticeText, { color: colors.onSurfaceVariant }]}>
            {notice}
          </Text>
        </View>
      )}

      {/* Progress */}
      {busy && (
        <View
          style={[
            styles.analysisCard,
            { backgroundColor: colors.primaryContainer },
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
              Processing images
            </Text>

            <Text
              style={[
                styles.analysisSubtitle,
                { color: colors.onSurfaceVariant },
              ]}
            >
              {progress.done} of {progress.total} complete · MobileNetV3 running
              locally
            </Text>
          </View>
        </View>
      )}

      {/* Per image results */}
      {images.length > 0 && (
        <Text
          style={[
            styles.sectionTitle,
            { color: colors.onSurfaceVariant, marginTop: 26 },
          ]}
        >
          INDIVIDUAL RESULTS
        </Text>
      )}

      {images.map((image, index) => (
        <ImageResultCard
          key={image.id}
          image={image}
          index={index}
          colors={colors}
          busy={busy}
          onAssessment={assessment =>
            setImageAssessment(image.id, { doctorAssessment: assessment })
          }
          onRemarks={remarks =>
            setImageAssessment(image.id, { doctorRemarks: remarks })
          }
        />
      ))}

      {/* Continue */}
      <Pressable
        onPress={handleContinue}
        disabled={busy || !completedImages.length}
        style={[
          styles.secondaryButton,
          {
            borderColor: colors.outline,
            opacity: busy || !completedImages.length ? 0.5 : 1,
          },
        ]}
      >
        <Text
          style={[styles.secondaryButtonText, { color: colors.primary }]}
        >
          Continue
        </Text>
      </Pressable>

      <AppFooter colors={colors} />
    </ScrollView>
  );
}

function ImageThumbnail({ image, index, colors, onRemove, disabled }) {
  const uri = imageDisplayUri(image);

  const statusLabel =
    image.status === IMAGE_STATUS.COMPLETED
      ? 'Analyzed'
      : image.status === IMAGE_STATUS.PROCESSING
      ? 'Analyzing…'
      : image.status === IMAGE_STATUS.FAILED
      ? 'Failed'
      : 'Not analyzed';

  const statusColor =
    image.status === IMAGE_STATUS.COMPLETED
      ? colors.primary
      : image.status === IMAGE_STATUS.FAILED
      ? colors.error
      : colors.onSurfaceVariant;

  return (
    <View
      style={[
        styles.thumbnailCard,
        {
          backgroundColor: colors.surfaceContainerLow,
          borderColor: colors.outlineVariant,
        },
      ]}
    >
      <View style={styles.thumbnailImageWrapper}>
        {uri ? (
          <Image
            source={{ uri }}
            style={styles.thumbnailImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.thumbnailPlaceholder}>
            <Text
              style={{
                color: colors.onSurfaceVariant,
                fontSize: 22,
              }}
            >
              ◎
            </Text>
          </View>
        )}

        <View
          style={[
            styles.thumbnailBadge,
            { backgroundColor: colors.surface },
          ]}
        >
          <Text style={[styles.thumbnailBadgeText, { color: colors.onSurface }]}>
            {index + 1}
          </Text>
        </View>

        {!disabled && (
          <Pressable
            onPress={onRemove}
            hitSlop={8}
            style={[
              styles.removeButton,
              { backgroundColor: colors.errorContainer },
            ]}
          >
            <Text style={[styles.removeButtonText, { color: colors.error }]}>
              ✕
            </Text>
          </Pressable>
        )}
      </View>

      <Text
        style={[styles.thumbnailName, { color: colors.onSurface }]}
        numberOfLines={1}
      >
        {imageFileName(image, index)}
      </Text>

      <Text style={[styles.thumbnailStatus, { color: statusColor }]}>
        {statusLabel}
      </Text>
    </View>
  );
}

function ImageResultCard({
  image,
  index,
  colors,
  busy,
  onAssessment,
  onRemarks,
}) {
  const result = image.result;

  const hasResult = !!result;

  const isFailed = image.status === IMAGE_STATUS.FAILED;

  if (!hasResult && !isFailed && image.status !== IMAGE_STATUS.PROCESSING) {
    return null;
  }

  const cancerProbability = result?.probabilities?.CANCER ?? 0;

  const nonCancerProbability = result?.probabilities?.['NON CANCER'] ?? 0;

  const isCancer = result?.classIndex === 0;

  return (
    <View
      style={[
        styles.resultCard,
        {
          backgroundColor: colors.surface,
          borderColor: isFailed ? colors.error : colors.outline,
        },
      ]}
    >
      <View style={styles.resultHeader}>
        <Text style={[styles.resultTitle, { color: colors.onSurface }]}>
          Image {index + 1}
        </Text>

        <Text
          style={[styles.resultFilename, { color: colors.onSurfaceVariant }]}
          numberOfLines={1}
        >
          {imageFileName(image, index)}
        </Text>
      </View>

      {image.status === IMAGE_STATUS.PROCESSING && (
        <View style={styles.processingRow}>
          <ActivityIndicator size="small" color={colors.primary} />

          <Text
            style={[styles.processingText, { color: colors.onSurfaceVariant }]}
          >
            Running on-device inference…
          </Text>
        </View>
      )}

      {hasResult && (
        <>
          <View style={styles.predictionRow}>
            <View style={styles.predictionBlock}>
              <Text
                style={[styles.label, { color: colors.onSurfaceVariant }]}
              >
                Prediction
              </Text>

              <Text
                style={[
                  styles.prediction,
                  { color: isCancer ? colors.error : colors.primary },
                ]}
              >
                {result.className}
              </Text>
            </View>

            <View style={styles.confidence}>
              <Text
                style={[styles.confidenceValue, { color: colors.onSurface }]}
              >
                {((result.probability ?? 0) * 100).toFixed(1)}%
              </Text>

              <Text
                style={[
                  styles.confidenceLabel,
                  { color: colors.onSurfaceVariant },
                ]}
              >
                confidence
              </Text>
            </View>
          </View>

          <View style={styles.probabilities}>
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
        </>
      )}

      {isFailed && (
        <View
          style={[
            styles.errorCard,
            { backgroundColor: colors.errorContainer },
          ]}
        >
          <Text style={[styles.errorTitle, { color: colors.error }]}>
            Analysis failed
          </Text>

          <Text
            style={[styles.errorText, { color: colors.onErrorContainer }]}
          >
            {image.error || 'Unable to analyze this image.'}
          </Text>
        </View>
      )}

      {(hasResult || isFailed) && (
        <View
          style={[
            styles.doctorSection,
            { borderTopColor: colors.outlineVariant },
          ]}
        >
          <Text
            style={[styles.doctorSectionTitle, { color: colors.onSurface }]}
          >
            DOCTOR ASSESSMENT
          </Text>

          <Text
            style={[styles.doctorLabel, { color: colors.onSurfaceVariant }]}
          >
            Assessment
          </Text>

          <View style={styles.assessmentRow}>
            {['Cancer', 'Non Cancer'].map(option => {
              const active = image.doctorAssessment === option;

              return (
                <Pressable
                  key={option}
                  disabled={busy}
                  onPress={() => onAssessment(active ? '' : option)}
                  style={[
                    styles.assessmentButton,
                    {
                      backgroundColor: active
                        ? colors.primary
                        : colors.surfaceContainerHighest,
                      borderColor: active
                        ? colors.primary
                        : colors.outlineVariant,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: active ? colors.onPrimary : colors.onSurface,
                      fontWeight: '600',
                    }}
                  >
                    {option}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text
            style={[styles.doctorLabel, { color: colors.onSurfaceVariant }]}
          >
            Remarks
          </Text>

          <TextInput
            value={image.doctorRemarks}
            onChangeText={onRemarks}
            editable={!busy}
            placeholder="Optional remarks"
            placeholderTextColor={colors.onSurfaceVariant}
            multiline
            textAlignVertical="top"
            style={[
              styles.doctorRemarks,
              {
                color: colors.onSurface,
                backgroundColor: colors.surfaceContainerLow,
                borderColor: colors.outlineVariant,
              },
            ]}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 36,
  },

  backButton: {
    minHeight: 32,
  },

  backText: {
    fontSize: 15,
    fontWeight: '600',
  },

  title: {
    fontSize: 26,
    fontWeight: '700',
    marginTop: 8,
  },

  subtitle: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
  },

  imagesCard: {
    marginTop: 18,
    borderRadius: 24,
    borderWidth: 1,
    padding: 16,
  },

  imagesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },

  eyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },

  count: {
    fontSize: 12,
    fontWeight: '700',
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },

  thumbnailCard: {
    width: '48%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 8,
  },

  thumbnailImageWrapper: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#00000010',
  },

  thumbnailImage: {
    width: '100%',
    height: '100%',
  },

  thumbnailPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },

  thumbnailBadge: {
    position: 'absolute',
    left: 6,
    top: 6,
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },

  thumbnailBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },

  removeButton: {
    position: 'absolute',
    right: 6,
    top: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },

  removeButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },

  thumbnailName: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '600',
  },

  thumbnailStatus: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '600',
  },

  placeholder: {
    paddingVertical: 22,
    alignItems: 'center',
    paddingHorizontal: 12,
  },

  uploadIcon: {
    width: 64,
    height: 64,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },

  uploadIconText: {
    fontSize: 32,
    fontWeight: '300',
  },

  placeholderTitle: {
    fontSize: 17,
    fontWeight: '700',
  },

  placeholderText: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },

  addRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },

  addButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },

  mainButton: {
    height: 56,
    borderRadius: 18,
    marginTop: 12,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },

  mainButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },

  noticeCard: {
    marginTop: 12,
    padding: 14,
    borderRadius: 14,
  },

  noticeText: {
    fontSize: 12,
    lineHeight: 18,
  },

  analysisCard: {
    marginTop: 14,
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

  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 10,
  },

  resultCard: {
    marginTop: 14,
    padding: 18,
    borderRadius: 22,
    borderWidth: 1,
  },

  resultHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 10,
  },

  resultTitle: {
    fontSize: 17,
    fontWeight: '700',
  },

  resultFilename: {
    flex: 1,
    textAlign: 'right',
    fontSize: 11,
  },

  processingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
  },

  processingText: {
    marginLeft: 10,
    fontSize: 12,
  },

  predictionRow: {
    marginTop: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },

  predictionBlock: {
    flex: 1,
  },

  label: {
    fontSize: 12,
  },

  prediction: {
    marginTop: 4,
    fontSize: 26,
    fontWeight: '800',
  },

  confidence: {
    alignItems: 'flex-end',
  },

  confidenceValue: {
    fontSize: 22,
    fontWeight: '800',
  },

  confidenceLabel: {
    marginTop: 2,
    fontSize: 11,
  },

  probabilities: {
    marginTop: 16,
    gap: 10,
  },

  errorCard: {
    marginTop: 16,
    padding: 16,
    borderRadius: 18,
  },

  errorTitle: {
    fontSize: 14,
    fontWeight: '700',
  },

  errorText: {
    marginTop: 5,
    fontSize: 12,
    lineHeight: 18,
  },

  doctorSection: {
    marginTop: 20,
    paddingTop: 18,
    borderTopWidth: 1,
  },

  doctorSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 14,
  },

  doctorLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },

  assessmentRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },

  assessmentButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  doctorRemarks: {
    minHeight: 80,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 13,
  },

  secondaryButton: {
    height: 52,
    marginTop: 18,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
