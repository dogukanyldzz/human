import * as tf from '../../dist/tfjs.esm.js';
import * as box from './box';
import * as anchors from './anchors';
import { Tensor, GraphModel } from '../tfjs/types';

export class HandDetector {
  model: GraphModel;
  anchors: number[][];
  anchorsTensor: Tensor;
  inputSize: number;
  inputSizeTensor: Tensor;
  doubleInputSizeTensor: Tensor;

  constructor(model) {
    this.model = model;
    this.anchors = anchors.anchors.map((anchor) => [anchor.x, anchor.y]);
    this.anchorsTensor = tf.tensor2d(this.anchors);
    this.inputSize = (this.model && this.model.inputs && this.model.inputs[0].shape) ? this.model.inputs[0].shape[2] : 0;
    this.inputSizeTensor = tf.tensor1d([this.inputSize, this.inputSize]);
    this.doubleInputSizeTensor = tf.tensor1d([this.inputSize * 2, this.inputSize * 2]);
  }

  normalizeBoxes(boxes) {
    return tf.tidy(() => {
      const boxOffsets = tf.slice(boxes, [0, 0], [-1, 2]);
      const boxSizes = tf.slice(boxes, [0, 2], [-1, 2]);
      const boxCenterPoints = tf.add(tf.div(boxOffsets, this.inputSizeTensor), this.anchorsTensor);
      const halfBoxSizes = tf.div(boxSizes, this.doubleInputSizeTensor);
      const startPoints = tf.mul(tf.sub(boxCenterPoints, halfBoxSizes), this.inputSizeTensor);
      const endPoints = tf.mul(tf.add(boxCenterPoints, halfBoxSizes), this.inputSizeTensor);
      return tf.concat2d([startPoints, endPoints], 1);
    });
  }

  normalizeLandmarks(rawPalmLandmarks, index) {
    return tf.tidy(() => {
      const landmarks = tf.add(tf.div(tf.reshape(rawPalmLandmarks, [-1, 7, 2]), this.inputSizeTensor), this.anchors[index]);
      return tf.mul(landmarks, this.inputSizeTensor);
    });
  }

  async getBoxes(input, config) {
    const batched = this.model.predict(input) as Tensor;
    const predictions = tf.squeeze(batched);
    tf.dispose(batched);
    const scoresT = tf.tidy(() => tf.squeeze(tf.sigmoid(tf.slice(predictions, [0, 0], [-1, 1]))));
    const scores = await scoresT.data();
    const rawBoxes = tf.slice(predictions, [0, 1], [-1, 4]);
    const boxes = this.normalizeBoxes(rawBoxes);
    tf.dispose(rawBoxes);
    const filteredT = await tf.image.nonMaxSuppressionAsync(boxes, scores, config.hand.maxDetected, config.hand.iouThreshold, config.hand.minConfidence);
    const filtered = await filteredT.array();

    tf.dispose(scoresT);
    tf.dispose(filteredT);
    const hands: Array<{ box: Tensor, palmLandmarks: Tensor, confidence: number }> = [];
    for (const index of filtered) {
      if (scores[index] >= config.hand.minConfidence) {
        const matchingBox = tf.slice(boxes, [index, 0], [1, -1]);
        const rawPalmLandmarks = tf.slice(predictions, [index, 5], [1, 14]);
        const palmLandmarks = tf.tidy(() => tf.reshape(this.normalizeLandmarks(rawPalmLandmarks, index), [-1, 2]));
        tf.dispose(rawPalmLandmarks);
        hands.push({ box: matchingBox, palmLandmarks, confidence: scores[index] });
      }
    }
    tf.dispose(predictions);
    tf.dispose(boxes);
    return hands;
  }

  async estimateHandBounds(input, config): Promise<{ startPoint: number[]; endPoint: number[]; palmLandmarks: number[]; confidence: number }[]> {
    const inputHeight = input.shape[1];
    const inputWidth = input.shape[2];
    const image = tf.tidy(() => tf.sub(tf.div(tf.image.resizeBilinear(input, [this.inputSize, this.inputSize]), 127.5), 1));
    const predictions = await this.getBoxes(image, config);
    tf.dispose(image);
    const hands: Array<{ startPoint: number[]; endPoint: number[]; palmLandmarks: number[]; confidence: number }> = [];
    if (!predictions || predictions.length === 0) return hands;
    for (const prediction of predictions) {
      const boxes = await prediction.box.data();
      const startPoint = boxes.slice(0, 2);
      const endPoint = boxes.slice(2, 4);
      const palmLandmarks = await prediction.palmLandmarks.array();
      tf.dispose(prediction.box);
      tf.dispose(prediction.palmLandmarks);
      hands.push(box.scaleBoxCoordinates({ startPoint, endPoint, palmLandmarks, confidence: prediction.confidence }, [inputWidth / this.inputSize, inputHeight / this.inputSize]));
    }
    return hands;
  }
}
