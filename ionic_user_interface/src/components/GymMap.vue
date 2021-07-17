<template>
  <iframe
    class="google-embed-map"
    :width="canvasWidth + 'px'"
    :height="canvasWidth + 'px'"
    loading="lazy"
    allowfullscreen
    :src="embedMapSrcStart + gymLocation"
  ></iframe>
</template>

<script lang="ts">
import { defineComponent, onUnmounted, onMounted } from 'vue';
import { map, mapOutline, warning } from 'ionicons/icons';
import { useCanvasWidth } from '@/composables/useCanvasWidth';

export default defineComponent({
  name: 'GymMap',
  props: {
    gymLocation: {
      type: String,
      required: true,
    },
  },
  setup() {
    const embedMapSrcStart = `https://www.google.com/maps/embed/v1/place?key=${process.env.VUE_APP_MAP_EMBED_API}&q=`;
    const { canvasWidth, updateCanvasWidth } = useCanvasWidth();
    window.addEventListener('resize', updateCanvasWidth);

    onMounted(() => {
      updateCanvasWidth();
    });

    onUnmounted(() => {
      window.removeEventListener('resize', updateCanvasWidth);
    });

    return {
      embedMapSrcStart,
      map,
      mapOutline,
      warning,
      canvasWidth,
    };
  },
});
</script>

<style scoped>
body.dark .google-embed-map {
  border: 0;
  filter: invert(90%);
}

body .google-embed-map {
  border: 0;
}
</style>
