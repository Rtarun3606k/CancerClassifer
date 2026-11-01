export function getExtensionFromFile(file, fallback = 'bin') {
  if (file?.name) {
    const match = file.name.match(/\.([a-zA-Z0-9]+)$/);

    if (match) {
      return match[1].toLowerCase();
    }
  }

  if (file?.type) {
    const mimeMap = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/heic': 'heic',
      'image/heif': 'heif',
      'audio/wav': 'wav',
      'audio/x-wav': 'wav',
      'audio/mpeg': 'mp3',
      'audio/mp4': 'm4a',
      'audio/aac': 'aac',
      'audio/ogg': 'ogg',
    };

    return mimeMap[file.type] || fallback;
  }

  return fallback;
}

/**
 * Extracts a lower-case extension from a file path / name.
 * Returns null when no extension is present.
 */
export function getExtensionFromPath(path) {
  if (!path || typeof path !== 'string') {
    return null;
  }

  const clean = path.split('?')[0].split('#')[0];

  const match = clean.match(/\.([a-zA-Z0-9]+)$/);

  if (!match) {
    return null;
  }

  return match[1].toLowerCase();
}
