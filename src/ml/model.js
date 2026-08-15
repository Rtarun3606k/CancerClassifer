import { NativeModules } from 'react-native';
import * as ort from 'onnxruntime-react-native';

import { prepareImage } from './imageProcessor';
import { imageToTensor } from './tensor';
import { softmax } from './softmax';
import { CLASS_NAMES } from './constants';

let session = null;

const {
  ONNXModel,
} = NativeModules;

export async function loadModel() {
  if (session) {
    return session;
  }

  console.log(
    'Getting ONNX model path...',
  );

  const modelPath =
    await ONNXModel.getModelPath();

  console.log(
    'Model path:',
    modelPath,
  );

  session =
    await ort.InferenceSession.create(
      modelPath,
    );

  console.log('MODEL LOADED');

  console.log(
    'Inputs:',
    session.inputNames,
  );

  console.log(
    'Outputs:',
    session.outputNames,
  );

  return session;
}

export async function classifyImage(
  imageUri,
) {
  const model =
    await loadModel();

  const image =
    await prepareImage(
      imageUri,
    );

  const tensor =
    imageToTensor(image);

  console.log(
    'Tensor shape:',
    tensor.dims,
  );

  const inputName =
    model.inputNames[0];

  const outputName =
    model.outputNames[0];

  const outputs =
    await model.run({
      [inputName]: tensor,
    });

  const output =
    outputs[outputName];

  if (!output) {
    throw new Error(
      `Output "${outputName}" not found`,
    );
  }

  const logits =
    Array.from(output.data);

  console.log(
    'Logits:',
    logits,
  );

  if (logits.length !== 2) {
    throw new Error(
      `Expected 2 outputs, got ${logits.length}`,
    );
  }

  const probabilities =
    softmax(logits);

  const classIndex =
    probabilities[0] >
    probabilities[1]
      ? 0
      : 1;

  const result = {
    classIndex,

    className:
      CLASS_NAMES[classIndex],

    probability:
      probabilities[classIndex],

    probabilities: {
      CANCER:
        probabilities[0],

      'NON CANCER':
        probabilities[1],
    },

    logits,
  };

  console.log(
    'CLASSIFICATION RESULT:',
    result,
  );

  return result;
}
