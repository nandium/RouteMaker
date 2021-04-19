/**
 * Given refs object of Vue Konva, awaits for v-stage to load
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
