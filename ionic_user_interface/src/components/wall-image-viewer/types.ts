import { SelectMode, BoxState } from './enums';

interface OptimizationParams {
  perfectDrawEnabled: boolean;
  transformsEnabled: string;
  shadowForStrokeEnabled: boolean;
  hitStrokeWidth: number;
}

interface BoxDims {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface ConfigStage {
  width: number;
  height: number;
}

interface ConfigImage {
  image: HTMLImageElement;
  width: number;
  height: number;
}

interface ConfigGroup {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ConfigText extends OptimizationParams {
  x?: number;
  y?: number;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fontStyle?: string;
  stroke?: string;
  fill?: string;
  fillAfterStrokeEnabled?: boolean;
  opacity: number;
}

interface ConfigTape extends OptimizationParams {
  points?: Array<number>;
  stroke?: string;
  strokeWidth?: number;
  opacity: number;
}

interface ConfigRect extends OptimizationParams {
  width: number;
  height: number;
  fill?: string;
  stroke?: string;
  opacity: number;
  strokeWidth: number;
}

interface ModeChangedEvent {
  detail: {
    value: SelectMode;
  };
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
  class: string;
}

interface BoundingBoxConfig {
  boxId: number;
  boxState: BoxState;
  numberText: number;
  boxDims: BoxDims;
}

export {
  BoxDims,
  ConfigStage,
  ConfigImage,
  ConfigGroup,
  ConfigText,
  ConfigTape,
  ConfigRect,
  ModeChangedEvent,
  Box,
  BoundingBoxConfig,
};
