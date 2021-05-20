import Konva from 'konva';
import { Ref, ref, watch } from 'vue';

import { BoxState, NumberMode, SelectMode, TapeMode } from '@/components/wall-image-viewer/enums';
import {
  ActiveBoundingBoxFootHold,
  ActiveBoundingBoxHandHold,
  BoundingBoxNumbering,
  DefaultBoundingBox,
  OPTIMIZATION_PARAMS,
} from '@/components/wall-image-viewer/boundingBoxAttributes';
import { BoxDimensions } from '@/components/wall-image-viewer/types';

export function useBoundingBox(
  boxLayer: Konva.Layer,
  selectedMode: Ref<SelectMode>,
  tapeMode: Ref<TapeMode>,
  numberMode: Ref<NumberMode>,
  handholdPositionArr: Ref<Array<number>>,
): UseBoundingBox {
  const boxState = ref<BoxState>(BoxState.UNSELECTED);
  const numberText = ref<number>(0);
  const konvaRect: Konva.Rect = new Konva.Rect();
  const konvaGroup: Konva.Group = new Konva.Group();
  const konvaText: Konva.Text = new Konva.Text();
  const konvaTape1: Konva.Line = new Konva.Line();
  const konvaTape2: Konva.Line = new Konva.Line();
  let boxId = -1;

  const updateRectBoxView = () => {
    let boundingBoxAttributes = null;
    switch (+boxState.value) {
      case BoxState.HIDDEN:
        boundingBoxAttributes = { opacity: 0, strokeWidth: 0 };
        break;
      case BoxState.UNSELECTED:
        boundingBoxAttributes = DefaultBoundingBox;
        break;
      case BoxState.NORMAL_HANDHOLD:
      case BoxState.SINGLE_START_HANDHOLD:
      case BoxState.DUAL_START_HANDHOLD:
      case BoxState.END_HANDHOLD:
        boundingBoxAttributes = ActiveBoundingBoxHandHold;
        break;
      case BoxState.FOOTHOLD:
        boundingBoxAttributes = ActiveBoundingBoxFootHold;
        break;
      default:
        boundingBoxAttributes = DefaultBoundingBox;
    }
    konvaRect.setAttrs({
      ...boundingBoxAttributes,
      ...OPTIMIZATION_PARAMS,
    });
  };

  const updateTextView = () => {
    if (numberText.value !== 0 && numberMode.value === NumberMode.ON) {
      konvaText.setAttrs({
        x: 0,
        y: konvaGroup.height() + 2,
        text: numberText.value.toString(),
        fillAfterStrokeEnabled: true,
        opacity: 1,
        ...BoundingBoxNumbering,
        ...OPTIMIZATION_PARAMS,
      });
    } else {
      konvaText.setAttrs({ opacity: 0, ...OPTIMIZATION_PARAMS });
    }
  };

  const updateTapesView = () => {
    const corner = Math.min(konvaRect.width() / 5, -10);
    switch (+boxState.value) {
      case BoxState.SINGLE_START_HANDHOLD:
      case BoxState.END_HANDHOLD:
        konvaTape2.setAttrs({
          points: [10, 0, corner + 10, corner],
          stroke: 'red',
          strokeWidth: konvaRect.strokeWidth() * 1.5,
          opacity: 1,
          ...OPTIMIZATION_PARAMS,
        });
        konvaTape1.setAttrs({
          points: [0, 0, corner, corner],
          stroke: 'red',
          strokeWidth: konvaRect.strokeWidth() * 1.5,
          opacity: 1,
          ...OPTIMIZATION_PARAMS,
        });
        break;
      case BoxState.DUAL_START_HANDHOLD:
        konvaTape2.setAttrs({
          opacity: 0,
          ...OPTIMIZATION_PARAMS,
        });
        konvaTape1.setAttrs({
          points: [0, 0, corner, corner],
          stroke: 'red',
          strokeWidth: konvaRect.strokeWidth() * 1.5,
          opacity: 1,
          ...OPTIMIZATION_PARAMS,
        });
        break;
      default:
        konvaTape1.setAttrs({
          opacity: 0,
          ...OPTIMIZATION_PARAMS,
        });
        konvaTape2.setAttrs({
          opacity: 0,
          ...OPTIMIZATION_PARAMS,
        });
    }
  };

  // const updateBoxState = (newBoxState: BoxState) => {
  //   boxState.value = newBoxState;
  // }

  const resizeBoundingBox = (factor: number) => {
    konvaGroup.x(konvaGroup.x() * factor);
    konvaGroup.y(konvaGroup.y() * factor);
    konvaGroup.width(konvaGroup.width() * factor);
    konvaGroup.height(konvaGroup.height() * factor);
    konvaRect.width(konvaRect.width() * factor);
    konvaRect.height(konvaRect.height() * factor);
    updateTextView();
  };

  const registerBoundingBox = (id: number, boxDimensions: BoxDimensions) => {
    boxId = id;
    const { x, y, width, height } = boxDimensions;
    konvaGroup.setAttrs({ x, y, width, height });
    konvaRect.width(width);
    konvaRect.height(height);

    konvaRect.on('mouseover', () => {
      if (
        +selectedMode.value !== SelectMode.DRAWBOX &&
        +selectedMode.value !== SelectMode.MARKDONE
      ) {
        konvaRect.strokeWidth(5);
      }
      boxLayer.batchDraw();
    });
    konvaRect.on('mouseout', () => {
      if (
        +selectedMode.value !== SelectMode.DRAWBOX &&
        +selectedMode.value !== SelectMode.MARKDONE
      ) {
        updateRectBoxView();
      }
      boxLayer.batchDraw();
    });
    konvaRect.on('click', onClickRect);
    konvaRect.on('tap', onClickRect);

    konvaGroup.add(konvaRect);
    konvaGroup.add(konvaText);
    konvaGroup.add(konvaTape1);
    konvaGroup.add(konvaTape2);
    boxLayer.add(konvaGroup);
    updateBoundingBoxView();
  };

  const updateBoundingBoxView = () => {
    updateRectBoxView();
    updateTextView();
    updateTapesView();
  };

  const handleSelectHandhold = () => {
    boxState.value = BoxState.NORMAL_HANDHOLD;
    handholdPositionArr.value = [...handholdPositionArr.value, boxId];
  };

  const handleUnselectHandhold = () => {
    boxState.value = BoxState.UNSELECTED;
    numberText.value = 0;
    handholdPositionArr.value = handholdPositionArr.value.filter((id) => id !== boxId);
  };

  const resetBoundingBox = () => {
    switch (+boxState.value) {
      case BoxState.NORMAL_HANDHOLD:
      case BoxState.SINGLE_START_HANDHOLD:
      case BoxState.DUAL_START_HANDHOLD:
      case BoxState.END_HANDHOLD: {
        handleUnselectHandhold();
        break;
      }
      default:
        boxState.value = BoxState.UNSELECTED;
    }
    updateBoundingBoxView();
  };

  /**
   * This callback is executed in all box instances
   * Updates the types of handholds based on index in positionArray
   * Batchdraw is called each time but should not be a problem since this only affects HANDHOLD instances
   */
  watch([handholdPositionArr, tapeMode], () => {
    switch (+boxState.value) {
      case BoxState.NORMAL_HANDHOLD:
      case BoxState.SINGLE_START_HANDHOLD:
      case BoxState.DUAL_START_HANDHOLD:
      case BoxState.END_HANDHOLD: {
        const position = handholdPositionArr.value.indexOf(boxId);
        numberText.value = position + 1;
        if (+tapeMode.value === TapeMode.NONE) {
          boxState.value = BoxState.NORMAL_HANDHOLD;
        } else if (position === 0) {
          if (+tapeMode.value === TapeMode.DUAL_START) {
            boxState.value = BoxState.DUAL_START_HANDHOLD;
          } else if (+tapeMode.value === TapeMode.SINGLE_START) {
            boxState.value = BoxState.SINGLE_START_HANDHOLD;
          }
        } else if (position === handholdPositionArr.value.length - 1) {
          boxState.value = BoxState.END_HANDHOLD;
        } else if (position === 1) {
          if (+tapeMode.value === TapeMode.DUAL_START) {
            boxState.value = BoxState.DUAL_START_HANDHOLD;
          }
        } else {
          boxState.value = BoxState.NORMAL_HANDHOLD;
        }
        updateBoundingBoxView();
        boxLayer.batchDraw();
        break;
      }
    }
  });

  /**
   * This callback is executed in all box instances, reduce as much as possible
   */
  watch(numberMode, () => {
    switch (+boxState.value) {
      case BoxState.NORMAL_HANDHOLD:
      case BoxState.SINGLE_START_HANDHOLD:
      case BoxState.DUAL_START_HANDHOLD:
      case BoxState.END_HANDHOLD: {
        updateTextView();
        boxLayer.batchDraw();
        break;
      }
    }
  });

  /**
   * This callback is executed in all box instances, reduce as much as possible
   */
  watch(selectedMode, () => {
    if (boxState.value === BoxState.UNSELECTED || boxState.value === BoxState.HIDDEN) {
      if (+selectedMode.value === SelectMode.MARKDONE && boxState.value === BoxState.UNSELECTED) {
        boxState.value = BoxState.HIDDEN;
      } else if (
        +selectedMode.value !== SelectMode.MARKDONE &&
        boxState.value === BoxState.HIDDEN
      ) {
        boxState.value = BoxState.UNSELECTED;
      }
      updateBoundingBoxView();
      boxLayer.batchDraw();
    }
  });

  const onClickRect = () => {
    if (+selectedMode.value === SelectMode.DRAWBOX || +selectedMode.value === SelectMode.MARKDONE) {
      return;
    }
    switch (+selectedMode.value) {
      case SelectMode.FOOTHOLD:
        switch (+boxState.value) {
          case BoxState.UNSELECTED:
            boxState.value = BoxState.FOOTHOLD;
            break;
          case BoxState.NORMAL_HANDHOLD:
          case BoxState.SINGLE_START_HANDHOLD:
          case BoxState.DUAL_START_HANDHOLD:
          case BoxState.END_HANDHOLD:
            handleUnselectHandhold();
            break;
          case BoxState.FOOTHOLD:
            boxState.value = BoxState.UNSELECTED;
            break;
        }
        break;
      case SelectMode.HANDHOLD:
        switch (+boxState.value) {
          case BoxState.UNSELECTED:
            handleSelectHandhold();
            break;
          case BoxState.NORMAL_HANDHOLD:
          case BoxState.SINGLE_START_HANDHOLD:
          case BoxState.DUAL_START_HANDHOLD:
          case BoxState.END_HANDHOLD:
            handleUnselectHandhold();
            break;
          case BoxState.FOOTHOLD:
            boxState.value = BoxState.UNSELECTED;
            break;
        }
        break;
    }
    updateBoundingBoxView();
    boxLayer.batchDraw();
  };

  return {
    registerBoundingBox,
    resizeBoundingBox,
    resetBoundingBox,
  };
}

interface UseBoundingBox {
  registerBoundingBox: (id: number, b: BoxDimensions) => void;
  resizeBoundingBox: (f: number) => void;
  resetBoundingBox: () => void;
}
