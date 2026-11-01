import jpeg from 'jpeg-js';

import { INPUT_SIZE } from './constants';

/**
 * Convert a VisionCamera preview snapshot into the exact RGBA image object
 * consumed by imageToTensor().
 *
 * The existing image-analysis path does:
 *   ImageResizer (224x224, JPEG 100, stretch) -> JPEG decode -> RGBA
 *
 * We keep the same resize target, JPEG quality, decode options and RGBA
 * output, but encode/decode the snapshot in memory instead of writing a
 * temporary file and reading it back as Base64.
 */
export async function preprocessSnapshot(snapshot) {
  if (
    !snapshot ||
    typeof snapshot.resizeAsync !== 'function'
  ) {
    throw new Error(
      'Invalid camera frame.',
    );
  }

  let resized = null;

  try {
    resized =
      await snapshot.resizeAsync(
        INPUT_SIZE,
        INPUT_SIZE,
      );

    if (
      !resized ||
      typeof resized.toEncodedImageDataAsync !== 'function'
    ) {
      throw new Error(
        'Camera frame could not be resized.',
      );
    }

    const encoded =
      await resized.toEncodedImageDataAsync(
        'jpg',
        100,
      );

    if (!encoded?.buffer) {
      throw new Error(
        'Camera frame could not be encoded.',
      );
    }

    const decoded = jpeg.decode(
      new Uint8Array(encoded.buffer),
      {
        useTArray: true,
      },
    );

    if (!decoded?.data) {
      throw new Error(
        'Could not decode camera frame',
      );
    }

    if (
      decoded.width !== INPUT_SIZE ||
      decoded.height !== INPUT_SIZE
    ) {
      throw new Error(
        `Unexpected camera frame size: ${decoded.width}x${decoded.height}`,
      );
    }

    return {
      image: decoded,
      frameBuffer: encoded.buffer,
    };
  } finally {
    if (resized && resized !== snapshot) {
      resized.dispose?.();
    }
  }
}
