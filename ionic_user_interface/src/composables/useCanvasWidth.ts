import { Ref, ref } from 'vue';
import { debounce } from 'lodash';

export function useCanvasWidth(): {
  canvasWidth: Ref<number>;
  updateCanvasWidth: () => void;
} {
  const canvasWidth = ref(0);
  /**
   * Get width of the device as platform-independent as possible
   * https://stackoverflow.com/questions/6942785/window-innerwidth-vs-document-documentelement-clientwidth
   */
  const updateCanvasWidth = debounce(() => {
    const windowWidth =
      window.innerWidth && document.documentElement.clientWidth
        ? Math.min(window.innerWidth, document.documentElement.clientWidth)
        : window.innerWidth ||
          document.documentElement.clientWidth ||
          document.getElementsByTagName('body')[0].clientWidth;

    canvasWidth.value = Math.min(windowWidth, 800);
  }, 100);
  return {
    canvasWidth,
    updateCanvasWidth,
  };
}
