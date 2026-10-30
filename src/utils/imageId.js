let imageCounter = 0;

/**
 * Creates a stable, unique identifier for a single oral image.
 *
 * The identifier is used as the primary key of the diagnosis_images table,
 * so it must stay stable for the whole lifetime of the diagnosis.
 */
export function createImageId() {
  imageCounter += 1;

  const timestamp = Date.now().toString(36);

  const random = Math.random().toString(36).substring(2, 8);

  return `img_${timestamp}_${imageCounter}_${random}`;
}

export function resetImageIdCounter() {
  imageCounter = 0;
}
