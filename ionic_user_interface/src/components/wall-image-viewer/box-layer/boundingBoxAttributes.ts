const DefaultBoundingBox = {
  strokeWidth: 2,
  opacity: 0.4,
  fill: 'white',
  stroke: 'black',
};

const ActiveBoundingBoxHandHold = {
  strokeWidth: 3,
  opacity: 0.4,
  fill: 'yellow',
  stroke: 'black',
};

const ActiveBoundingBoxFootHold = {
  strokeWidth: 3,
  opacity: 0.4,
  fill: 'blue',
  stroke: 'black',
};

const BoundingBoxNumbering = {
  fontSize: 20,
  fontFamily: 'Calibri',
  fontStyle: 'bold',
  stroke: 'white',
  fill: 'black',
};

const OPTIMIZATION_PARAMS = {
  perfectDrawEnabled: false,
  transformsEnabled: 'position',
  shadowForStrokeEnabled: false,
  hitStrokeWidth: 0,
};

export {
  DefaultBoundingBox,
  ActiveBoundingBoxHandHold,
  ActiveBoundingBoxFootHold,
  BoundingBoxNumbering,
  OPTIMIZATION_PARAMS,
};
