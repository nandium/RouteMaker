import Konva from 'konva';
import { throttle } from 'lodash';
import { Vector2d } from 'konva/lib/types';

import { BoxClass } from '@/components/wall-image-viewer/types';
import { DefaultBoundingBox } from './boundingBoxAttributes';
import { Box } from '../getBoundingBoxes';

const BACKGROUND_RECT_NAME = 'backgroundRect';
const DRAW_RECT_NAME = 'drawRect';
const DRAW_LAYER_NAME = 'drawLayer';

/**
 * Add a temporary DrawLayer that has listener to draw new Rects
 * The new Rects reside inside the layer until the layer is destroyed
 * https://stackoverflow.com/questions/49758261/draw-rectangle-with-mouse-and-fill-with-color-on-mouseup
 * @param {node} stageNode
 */
const addKonvaDrawLayer = (stageNode: Konva.Stage): void => {
  const { width: imageWidth, height: imageHeight } = stageNode.size();

  const drawLayer = new Konva.Layer({ name: DRAW_LAYER_NAME, draggable: false });
  stageNode.add(drawLayer);

  // Draw a background Rect to catch events.
  const backgroundRect = new Konva.Rect({
    name: BACKGROUND_RECT_NAME,
    x: 0,
    y: 0,
    width: imageWidth,
    height: imageHeight,
  });
  drawLayer.add(backgroundRect);

  // Draw a rectangle to be used as the rubber area
  const drawRect = new Konva.Rect({
    name: DRAW_RECT_NAME,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    stroke: 'red',
    dash: [2, 2],
  });
  drawRect.listening(false);
  drawLayer.add(drawRect);

  stageNode.batchDraw();

  let posStart: Point;
  let posNow: Point;
  let mode = '';

  // Start the rubber drawing on mouse down.
  backgroundRect.on(
    'mousedown touchstart',
    throttle((e) => onFingerStart(e), 5),
  );

  // Update the rubber Rect on mouse move - note use of 'mode' to avoid drawing after mouse released
  backgroundRect.on(
    'mousemove touchmove',
    throttle((e) => onFingerMove(e), 5),
  );

  // Create the new Rect using the location and dimensions of the rubber Rect
  backgroundRect.on(
    'mouseup touchend',
    throttle(() => onFingerUp(), 5),
  );

  const onFingerStart = (e: GenericObject): void => {
    if (e.evt.touches && e.evt.touches.length !== 1) return;

    mode = 'drawing';
    const { x, y } = stageNode.getPointerPosition() as Vector2d;
    startDrag({
      x: (x - stageNode.x()) / stageNode.scaleX(),
      y: (y - stageNode.y()) / stageNode.scaleY(),
    });
  };

  const onFingerMove = (e: GenericObject): void => {
    if (e.evt.touches && e.evt.touches.length !== 1) return;

    if (mode === 'drawing') {
      const { x, y } = stageNode.getPointerPosition() as Vector2d;
      updateDrag({
        x: (x - stageNode.x()) / stageNode.scaleX(),
        y: (y - stageNode.y()) / stageNode.scaleY(),
      });
    }
  };

  const onFingerUp = (): void => {
    if (mode !== 'drawing') return;

    mode = '';
    drawRect.visible(false);

    // Do not add if the DrawRect is too small (Less than 3 pixels)
    if (drawRect.width() > 3 && drawRect.height() > 3) {
      const newRect = new Konva.Rect({
        x: drawRect.x(),
        y: drawRect.y(),
        width: drawRect.width(),
        height: drawRect.height(),
        strokeWidth: DefaultBoundingBox.strokeWidth,
        opacity: DefaultBoundingBox.opacity,
        fill: DefaultBoundingBox.fill,
        stroke: DefaultBoundingBox.stroke,
        listening: false,
      });
      drawLayer.add(newRect);
    }
    drawRect.setAttrs({ width: 0, height: 0 });

    stageNode.batchDraw();
  };

  const startDrag = ({ x, y }: Point): void => {
    posStart = { x, y };
    posNow = { x, y };
  };

  // Update rubber rect position
  const updateDrag = ({ x, y }: Point): void => {
    posNow = { x, y };
    const posRect = reverse(posStart, posNow);
    drawRect.x(posRect.x1);
    drawRect.y(posRect.y1);
    drawRect.width(posRect.x2 - posRect.x1);
    drawRect.height(posRect.y2 - posRect.y1);
    drawRect.visible(true);

    stageNode.batchDraw();
  };

  // Reverse co-ords if user drags left / up
  const reverse = (r1: Point, r2: Point): ReversedCoordinates => {
    let r1x = r1.x,
      r1y = r1.y,
      r2x = r2.x,
      r2y = r2.y,
      d;
    if (r1x > r2x) {
      d = Math.abs(r1x - r2x);
      r1x = r2x;
      r2x = r1x + d;
    }
    if (r1y > r2y) {
      d = Math.abs(r1y - r2y);
      r1y = r2y;
      r2y = r1y + d;
    }
    return { x1: r1x, y1: r1y, x2: r2x, y2: r2y };
  };
};

/**
 * Get the properties of hand drawn bounding boxes
 * @param {node} stageNode
 * @returns List of new bounding box dimensions [{x, y, w, h, class}, ...]
 */
const getKonvaDrawLayerBoundingBoxes = (stageNode: Konva.Stage): Box[] => {
  const drawLayer = getDrawLayer(stageNode);
  const shapes = drawLayer.getChildren(
    (shape) => ![DRAW_RECT_NAME, BACKGROUND_RECT_NAME].includes(shape.attrs.name),
  );
  // @ts-expect-error Konva types not working properly
  return shapes.map((shape) => {
    const { x, y, width: w, height: h } = shape.attrs;
    return { x, y, w, h, class: BoxClass.DRAWN };
  });
};

const removeKonvaDrawLayer = (stageNode: Konva.Stage): void => {
  const drawLayer = getDrawLayer(stageNode);
  drawLayer.destroy();
};

const removeKonvaLastDrawnRect = (stageNode: Konva.Stage): void => {
  const drawLayer = getDrawLayer(stageNode);
  const shapes = drawLayer.getChildren(
    (shape) => ![DRAW_RECT_NAME, BACKGROUND_RECT_NAME].includes(shape.attrs.name),
  );
  // @ts-expect-error Konva types not working properly
  if (shapes.length > 0) shapes.toArray().pop().destroy();
  stageNode.batchDraw();
};

const resizeDrawLayer = (stageNode: Konva.Stage, factor: number): void => {
  const drawLayer = getDrawLayer(stageNode);
  const shapes = drawLayer.getChildren(
    (shape) => ![DRAW_RECT_NAME, BACKGROUND_RECT_NAME].includes(shape.attrs.name),
  );
  shapes.forEach((shape) => {
    shape.x(shape.x() * factor);
    shape.y(shape.y() * factor);
    shape.width(shape.width() * factor);
    shape.height(shape.height() * factor);
  });
  stageNode.batchDraw();
};

const getDrawLayer = (stageNode: Konva.Stage): Konva.Layer => {
  return stageNode.getChildren((layer) => layer.attrs.name === DRAW_LAYER_NAME)[0] as Konva.Layer;
};

const isDrawLayerAdded = (stageNode: Konva.Stage): boolean => {
  return stageNode.getChildren((layer) => layer.attrs.name === DRAW_LAYER_NAME).length === 1;
};

interface Point {
  x: number;
  y: number;
}

interface ReversedCoordinates {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
}

interface GenericObject {
  [key: string]: any;
}

export default {
  addKonvaDrawLayer,
  getKonvaDrawLayerBoundingBoxes,
  removeKonvaDrawLayer,
  removeKonvaLastDrawnRect,
  isDrawLayerAdded,
  resizeDrawLayer,
};
