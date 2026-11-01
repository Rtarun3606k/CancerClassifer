import { NativeModules } from 'react-native';
import * as ort from 'onnxruntime-react-native';

import { prepareImage } from './imageProcessor';
import { imageToTensor } from './tensor';
import { softmax } from './softmax';
import { CLASS_NAMES } from './constants';

let session = null;
let sessionPromise = null;

const {
  ONNXModel,
} = NativeModules;

export async function loadModel() {
  if (session) {
    return session;
  }

  if (sessionPromise) {
    return sessionPromise;
  }

  sessionPromise = (async () => {
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
  })();

  try {
    return await sessionPromise;
  } catch (error) {
    // A failed initialization must be retryable.
    sessionPromise = null;

    throw error;
  }
}

/**
 * Convert raw model logits into the prediction shape used by both the
 * image-analysis flow and the live-screen flow.
 */
export function buildPrediction(logits) {
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

  return {
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
}

async function runModel(
  model,
  image,
) {
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

  const result =
    buildPrediction(logits);

  console.log(
    'CLASSIFICATION RESULT:',
    result,
  );

  return result;
}

/**
 * Run the shared ONNX session on an already-decoded RGBA image.
 *
 * This is used by the live pipeline after its camera frame has been
 * preprocessed into the same 224x224 RGBA shape as prepareImage().
 */
export async function runInferenceOnImage(image) {
  const model =
    await loadModel();

  return runModel(model, image);
}

export async function classifyImage(
  imageUri,
) {
  // Keep the existing image-analysis order and output shape unchanged.
  const model =
    await loadModel();

  const image =
    await prepareImage(
      imageUri,
    );

  return runModel(model, image);
}
