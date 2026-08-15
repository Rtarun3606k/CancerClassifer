import { Buffer } from 'buffer';
import RNFS from 'react-native-fs';
import ImageResizer from 'react-native-image-resizer';
import jpeg from 'jpeg-js';

import { INPUT_SIZE } from './constants';

export async function prepareImage(imageUri) {
  console.log('Original image:', imageUri);

  const resized = await ImageResizer.createResizedImage(
    imageUri,
    INPUT_SIZE,
    INPUT_SIZE,
    'JPEG',
    100,
    0,
    undefined,
    false,
    {
      mode: 'stretch',
    },
  );

  console.log('Resized image:', resized.uri);

  let path = resized.uri;

  if (path.startsWith('file://')) {
    path = path.substring(7);
  }

  const base64 = await RNFS.readFile(path, 'base64');

  const imageBuffer = Buffer.from(base64, 'base64');

  const decoded = jpeg.decode(imageBuffer, {
    useTArray: true,
  });

  if (!decoded?.data) {
    throw new Error('Could not decode image');
  }

  if (decoded.width !== INPUT_SIZE || decoded.height !== INPUT_SIZE) {
    throw new Error(
      `Unexpected image size: ${decoded.width}x${decoded.height}`,
    );
  }

  return decoded;
}
