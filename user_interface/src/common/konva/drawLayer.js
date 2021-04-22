import { throttle } from 'lodash';
import Konva from 'konva';
import BoxClass from '@/common/enumBoxClass';
import { DefaultBoundingBox } from '@/common/boundingBoxAttributes';

/**
 * Add a temporary DrawLayer that has listener to draw new Rects
 * The new Rects reside inside the layer until the layer is destroyed
 * https://stackoverflow.com/questions/49758261/draw-rectangle-with-mouse-and-fill-with-color-on-mouseup
 * @param {node} stageNode
 */
export const addKonvaDrawLayer = (stageNode) => {
  const { width: imageWidth, height: imageHeight } = stageNode.size();

  const drawLayer = new Konva.Layer({ name: 'drawLayer', draggable: false });
  stageNode.add(drawLayer);

  // Draw a background Rect to catch events.
  const backgroundRect = new Konva.Rect({
    name: 'backgroundRect',
    x: 0,
    y: 0,
    width: imageWidth,
    height: imageHeight,
    fill: null,
  });
  drawLayer.add(backgroundRect);

  // Draw a rectangle to be used as the rubber area
  const drawRect = new Konva.Rect({
    name: 'drawRect',
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

  let posStart;
  let posNow;
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

  const onFingerStart = (e) => {
    if (e.evt.touches && e.evt.touches.length !== 1) return;

    mode = 'drawing';
    const { x, y } = stageNode.getPointerPosition();
    startDrag({
      x: (x - stageNode.x()) / stageNode.scaleX(),
      y: (y - stageNode.y()) / stageNode.scaleY(),
    });
  };

  const onFingerMove = (e) => {
    if (e.evt.touches && e.evt.touches.length !== 1) return;

    if (mode === 'drawing') {
      const { x, y } = stageNode.getPointerPosition();
      updateDrag({
        x: (x - stageNode.x()) / stageNode.scaleX(),
        y: (y - stageNode.y()) / stageNode.scaleY(),
      });
    }
  };

  const onFingerUp = () => {
    if (mode !== 'drawing') return;

    mode = '';
    drawRect.visible(false);
    var newRect = new Konva.Rect({
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
    drawRect.setAttrs({ width: 0, height: 0 });

    stageNode.batchDraw();
  };

  const startDrag = ({ x, y }) => {
    posStart = { x, y };
    posNow = { x, y };
  };

  // Update rubber rect position
  const updateDrag = ({ x, y }) => {
    posNow = { x, y };
    var posRect = reverse(posStart, posNow);
    drawRect.x(posRect.x1);
    drawRect.y(posRect.y1);
    drawRect.width(posRect.x2 - posRect.x1);
    drawRect.height(posRect.y2 - posRect.y1);
    drawRect.visible(true);

    stageNode.batchDraw();
  };

  // Reverse co-ords if user drags left / up
  const reverse = (r1, r2) => {
    var r1x = r1.x,
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
export const getKonvaDrawLayerBoundingBoxes = (stageNode) => {
  const drawLayer = stageNode.getChildren((layer) => layer.attrs.name === 'drawLayer')[0];
  const shapes = drawLayer.getChildren(
    (shape) => !['drawRect', 'backgroundRect'].includes(shape.attrs.name),
  );
  return shapes.map((shape) => {
    const { x, y, width: w, height: h } = shape.attrs;
    return { x, y, w, h, class: BoxClass.DRAWN };
  });
};

export const removeKonvaDrawLayer = (stageNode) => {
  const drawLayer = stageNode.getChildren((layer) => layer.attrs.name === 'drawLayer')[0];
  drawLayer.destroy();
};
