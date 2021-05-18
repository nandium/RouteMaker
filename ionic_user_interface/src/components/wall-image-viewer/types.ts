import { SelectMode } from '@/components/wall-image-viewer/enums';

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
  resetBoundingBox: () => void;
}

export { ModeChangedEvent, Box, BoundingBox, BoxDimensions };
