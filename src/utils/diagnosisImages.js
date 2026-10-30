/**
 * Helpers for working with the multi-image diagnosis structure.
 *
 * The canonical shape is:
 *
 *   diagnosis.image = {
 *     images: [
 *       {
 *         id,
 *         uri,          // display uri (stored path once copied)
 *         originalUri,  // uri returned by the picker / camera
 *         path,         // permanent path inside the diagnosis folder
 *         fileName,
 *         result,
 *         doctorAssessment,
 *         doctorRemarks,
 *         status,
 *         error,
 *       },
 *     ],
 *   }
 *
 * Older single-image diagnoses used `image: { uri, result, ... }`. The helper
 * below normalises both shapes so database / report / export code keeps
 * working while old records are still around.
 */
export function getDiagnosisImages(image) {
  if (!image) {
    return [];
  }

  if (Array.isArray(image.images)) {
    return image.images.filter(Boolean);
  }

  // Legacy single-image shape.
  if (image.result || image.path || image.uri) {
    return [image];
  }

  return [];
}

export function getAnalyzedImages(image) {
  return getDiagnosisImages(image).filter(item => !!item.result);
}

export function hasDiagnosisImages(image) {
  return getDiagnosisImages(image).length > 0;
}

export function imageDisplayUri(image) {
  if (!image) {
    return null;
  }

  const uri = image.path || image.uri || image.originalUri || null;

  if (!uri) {
    return null;
  }

  return uri.startsWith('file://') ? uri : `file://${uri}`;
}

export function imageFileName(image, index = 0) {
  if (image?.fileName) {
    return image.fileName;
  }

  if (image?.path) {
    const name = image.path.split('/').pop();

    if (name) {
      return name;
    }
  }

  return `image-${String(index + 1).padStart(2, '0')}`;
}

/**
 * Aggregated, display-only summary across all images of a diagnosis.
 * Individual predictions remain the source of truth.
 */
export function summarizeImageResults(image) {
  const images = getDiagnosisImages(image);

  const completed = images.filter(item => item.status === 'completed' && item.result);

  const failed = images.filter(item => item.status === 'failed');

  const pending = images.filter(
    item => item.status !== 'completed' && item.status !== 'failed',
  );

  const cancerCount = completed.filter(
    item => item.result?.className === 'CANCER',
  ).length;

  return {
    total: images.length,
    completed: completed.length,
    failed: failed.length,
    pending: pending.length,
    cancerCount,
    nonCancerCount: completed.length - cancerCount,
    anyCancer: cancerCount > 0,
  };
}
