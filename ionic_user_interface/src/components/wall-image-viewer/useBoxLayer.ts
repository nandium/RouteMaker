import Konva from 'konva';
import { Ref, ref } from 'vue';

import { NumberMode, SelectMode, TapeMode } from '@/components/wall-image-viewer/enums';
import { BoundingBox, Box } from '@/components/wall-image-viewer/types';
import { useBoundingBox } from '@/components/wall-image-viewer/useBoundingBox';

export function useBoxLayer(
  selectedMode: Ref<SelectMode>,
  tapeMode: Ref<TapeMode>,
  numberMode: Ref<NumberMode>,
): UseBoxLayer {
  const boxLayer = new Konva.Layer();
  let boundingBoxes: BoundingBox[] = [];
  const handholdPositionArr = ref<Array<number>>([]);

  const clearBoxLayer = () => {
    boxLayer.clear();
    boxLayer.destroyChildren();
    boxLayer.batchDraw();
  };

  const addBoxLayerBoundingBoxes = (boxes: Box[]) => {
    boundingBoxes = boxes.map((box, idx) => {
      const { x, y, w, h } = box;
      const { registerBoundingBox, resizeBoundingBox, resetBoundingBox } = useBoundingBox(
        boxLayer,
        selectedMode,
        tapeMode,
        numberMode,
        handholdPositionArr,
      );
      registerBoundingBox(idx, {
        x,
        y,
        width: w,
        height: h,
      });
      return { boxId: idx, resizeBoundingBox, resetBoundingBox };
    });
    boxLayer.batchDraw();
  };

  const resizeBoxLayer = (factor: number) => {
    for (const bbox of boundingBoxes) {
      const { resizeBoundingBox } = bbox;
      resizeBoundingBox(factor);
    }
    boxLayer.batchDraw();
  };

  const resetBoxLayerToUnSelected = () => {
    for (const bbox of boundingBoxes) {
      const { resetBoundingBox } = bbox;
      resetBoundingBox();
    }
    boxLayer.batchDraw();
  };

  return {
    boxLayer,
    resizeBoxLayer,
    addBoxLayerBoundingBoxes,
    clearBoxLayer,
    resetBoxLayerToUnSelected,
  };
}

interface UseBoxLayer {
  boxLayer: Konva.Layer;
  resizeBoxLayer: (f: number) => void;
  addBoxLayerBoundingBoxes: (b: Box[]) => void;
  clearBoxLayer: () => void;
  resetBoxLayerToUnSelected: () => void;
}
