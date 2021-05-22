import Konva from 'konva';
import { Box } from '@/components/wall-image-viewer/getBoundingBoxes';

interface BoxDimensions {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface UseBoundingBox {
  registerBoundingBox: (id: number, b: BoxDimensions) => void;
  resizeBoundingBox: (f: number) => void;
  resetBoundingBox: () => void;
}

interface UseBoxLayer {
  boxLayer: Konva.Layer;
  resizeBoxLayer: (f: number) => void;
  addBoxLayerBoundingBoxes: (b: Box[]) => void;
  clearBoxLayer: () => void;
  resetBoxLayerToUnSelected: () => void;
}

interface BoundingBox {
  boxId: number;
  resizeBoundingBox: (f: number) => void;
  resetBoundingBox: () => void;
}

export { BoxDimensions, UseBoundingBox, UseBoxLayer, BoundingBox };
