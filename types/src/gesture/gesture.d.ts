/**
 * Gesture detection module
 */
import { Gesture } from '../result';
/**
 * @typedef FaceGesture
 */
export declare type FaceGesture = `facing ${'left' | 'center' | 'right'}` | `blink ${'left' | 'right'} eye` | `mouth ${number}% open` | `head ${'up' | 'down'}`;
/**
 * @typedef IrisGesture
 */
export declare type IrisGesture = 'facing center' | `looking ${'left' | 'right' | 'up' | 'down'}` | 'looking center';
/**
 * @typedef BodyGesture
 */
export declare type BodyGesture = `leaning ${'left' | 'right'}` | `raise ${'left' | 'right'} hand` | 'i give up';
/**
 * @typedef BodyGesture
 */
export declare type HandGesture = `${'thumb' | 'index' | 'middle' | 'ring' | 'pinky'} forward` | `${'thumb' | 'index' | 'middle' | 'ring' | 'pinky'} up` | 'victory' | 'thumbs up';
export declare const body: (res: any) => Gesture[];
export declare const face: (res: any) => Gesture[];
export declare const iris: (res: any) => Gesture[];
export declare const hand: (res: any) => Gesture[];
