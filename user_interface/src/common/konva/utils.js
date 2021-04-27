export const OPTIMIZATION_PARAMS = {
  perfectDrawEnabled: false,
  transformsEnabled: 'position',
  shadowForStrokeEnabled: false,
  hitStrokeWidth: 0,
};

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

export const calculateDefaultKonvaWindowWidth = (width) => {
  return Math.min(800, Math.floor((width / 10) * 9));
};