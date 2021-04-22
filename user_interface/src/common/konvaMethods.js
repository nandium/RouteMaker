import { throttle } from 'lodash';
import Konva from 'konva';

/**
 * Given refs object of Vue Konva, awaits for v-stageNode to load
 * @param {refs} vueKonvaRefs
 * @param {number} intervalDuration
 */
export const waitForKonvaStageLoad = async (refs, intervalDuration) => {
  return await new Promise((resolve) => {
    const interval = setInterval(() => {
      if (refs.stage !== undefined) {
        resolve('ready');
        clearInterval(interval);
      }
    }, intervalDuration);
  });
};

export const removeKonvaListeners = (stageNode) => {
  stageNode.off('touchmove touchend');
};

/**
 * https://konvajs.org/docs/sandbox/Multi-touch_Scale_Stage.html
 * @param {node} stageNode
 */
export const addKonvaListenerPinchZoom = (stageNode) => {
  let lastCenter = null;
  let lastDist = 0;
  const { width: imageWidth, height: imageHeight } = stageNode.size();

  stageNode.on(
    'touchmove',
    throttle((e) => {
      e.evt.preventDefault();
      const touch1 = e.evt.touches[0];
      const touch2 = e.evt.touches[1];

      if (touch1 && touch2) {
        if (stageNode.isDragging()) {
          stageNode.stopDrag();
        }

        const p1 = {
          x: touch1.clientX,
          y: touch1.clientY,
        };
        const p2 = {
          x: touch2.clientX,
          y: touch2.clientY,
        };

        if (!lastCenter) {
          lastCenter = getCenter(p1, p2);
          return;
        }
        const newCenter = getCenter(p1, p2);

        const dist = getDistance(p1, p2);

        if (!lastDist) {
          lastDist = dist;
        }

        var pointTo = {
          x: (newCenter.x - stageNode.x()) / stageNode.scaleX(),
          y: (newCenter.y - stageNode.y()) / stageNode.scaleX(),
        };

        const scale = stageNode.scaleX() * (dist / lastDist);

        // calculate new position of the stageNode
        const dx = newCenter.x - lastCenter.x;
        const dy = newCenter.y - lastCenter.y;

        const newPos = {
          x: newCenter.x - pointTo.x * scale + dx,
          y: newCenter.y - pointTo.y * scale + dy,
        };

        // calculate position of the bottom right corner
        const bottomRightPos = {
          x: newPos.x + scale * imageWidth,
          y: newPos.y + scale * imageHeight,
        };

        // ensure the user cannot zoom out indefinitely
        if (newPos.x > 0) {
          newPos.x = 0;
        }
        if (newPos.y > 0) {
          newPos.y = 0;
        }

        if (scale < 1) return;

        // if bottom right corner is out of bound, move the top left corner accordingly
        if (bottomRightPos.x < imageWidth) {
          if (newPos.x === 0) return;
          newPos.x += imageWidth - bottomRightPos.x;
        }
        if (bottomRightPos.y < imageHeight) {
          if (newPos.y === 0) return;
          newPos.y += imageHeight - bottomRightPos.y;
        }

        stageNode.scaleX(scale);
        stageNode.scaleY(scale);
        stageNode.position(newPos);
        stageNode.batchDraw();

        lastDist = dist;
        lastCenter = newCenter;
      } else if (touch1) {
        const p1 = {
          x: touch1.clientX,
          y: touch1.clientY,
        };

        if (!lastCenter) {
          lastCenter = { ...p1 };
          return;
        }
        const dx = p1.x - lastCenter.x;
        const dy = p1.y - lastCenter.y;
        const newPos = {
          x: stageNode.x() + dx,
          y: stageNode.y() + dy,
        };

        // calculate position of the bottom right corner
        const bottomRightPos = {
          x: newPos.x + imageWidth * stageNode.scaleX(),
          y: newPos.y + imageHeight * stageNode.scaleY(),
        };

        // ensure the user cannot drag out of the bound
        if (newPos.x > 0 || bottomRightPos.x < imageWidth) {
          newPos.x = stageNode.x();
        }
        if (newPos.y > 0 || bottomRightPos.y < imageHeight) {
          newPos.y = stageNode.y();
        }

        stageNode.position(newPos);
        stageNode.batchDraw();

        lastCenter = { ...p1 };
      }
    }, 5),
  );

  stageNode.on('touchend', () => {
    lastDist = 0;
    lastCenter = null;
  });
};

const getDistance = (p1, p2) => {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
};

const getCenter = (p1, p2) => {
  return {
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2,
  };
};

/**
 * https://stackoverflow.com/questions/49758261/draw-rectangle-with-mouse-and-fill-with-color-on-mouseup
 * @param {node} stageNode
 */
export const addKonvaListenerDraw = (stageNode) => {
  const { width: imageWidth, height: imageHeight } = stageNode.size();

  // Set up the canvas and shapes
  const drawLayer = new Konva.Layer({ draggable: false });
  stageNode.add(drawLayer);

  // draw a background rect to catch events.
  const backgroundRect = new Konva.Rect({
    x: 0,
    y: 0,
    width: imageWidth,
    height: imageHeight,
    fill: null,
  });
  drawLayer.add(backgroundRect);

  // draw a rectangle to be used as the rubber area
  const drawRect = new Konva.Rect({ x: 0, y: 0, width: 0, height: 0, stroke: 'red', dash: [2, 2] });
  drawRect.listening(false);
  drawLayer.add(drawRect);

  stageNode.batchDraw();

  let posStart;
  let posNow;
  let mode = '';

  // start the rubber drawing on mouse down.
  backgroundRect.on(
    'mousedown',
    throttle((e) => {
      mode = 'drawing';
      startDrag({ x: e.evt.layerX, y: e.evt.layerY });
    }, 5),
  );

  // update the rubber rect on mouse move - note use of 'mode' var to avoid drawing after mouse released.
  backgroundRect.on(
    'mousemove',
    throttle((e) => {
      if (mode === 'drawing') {
        updateDrag({ x: e.evt.layerX, y: e.evt.layerY });
      }
    }, 5),
  );

  // here we create the new rect using the location and dimensions of the drawing rect.
  backgroundRect.on(
    'mouseup',
    throttle(() => {
      mode = '';
      drawRect.visible(false);
      var newRect = new Konva.Rect({
        x: drawRect.x(),
        y: drawRect.y(),
        width: drawRect.width(),
        height: drawRect.height(),
        strokeWidth: 2,
        opacity: 0.2,
        fill: 'yellow',
        stroke: 'black',
        listening: false,
      });
      drawLayer.add(newRect);

      stageNode.batchDraw();
    }, 5),
  );

  const startDrag = (posIn) => {
    posStart = { x: posIn.x, y: posIn.y };
    posNow = { x: posIn.x, y: posIn.y };
  };

  const updateDrag = (posIn) => {
    // update rubber rect position
    posNow = { x: posIn.x, y: posIn.y };
    var posRect = reverse(posStart, posNow);
    drawRect.x(posRect.x1);
    drawRect.y(posRect.y1);
    drawRect.width(posRect.x2 - posRect.x1);
    drawRect.height(posRect.y2 - posRect.y1);
    drawRect.visible(true);

    stageNode.batchDraw(); // redraw any changes.
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

export const OPTIMIZATION_PARAMS = {
  perfectDrawEnabled: false,
  transformsEnabled: 'position',
  shadowForStrokeEnabled: false,
  hitStrokeWidth: 0,
};
