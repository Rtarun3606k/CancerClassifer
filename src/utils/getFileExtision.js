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
