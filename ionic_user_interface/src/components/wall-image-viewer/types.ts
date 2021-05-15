import { SelectMode } from './enums';

// interface OptimizationParams {
//   perfectDrawEnabled: boolean;
//   transformsEnabled: string;
//   shadowForStrokeEnabled: boolean;
//   hitStrokeWidth: number;
// }

interface ConfigGroup {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface BoxDimensions {
  x: number;
  y: number;
  width: number;
  height: number;
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

interface BoundingBox {
  boxId: number;
  resizeBoundingBox: (factor: number) => void;
}

export { ConfigGroup, ModeChangedEvent, Box, BoundingBox, BoxDimensions };
