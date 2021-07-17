<template>
  <iframe
    class="google-embed-map"
    loading="lazy"
    allowfullscreen
    :src="embedMapSrcStart + gymLocation"
  ></iframe>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { map, mapOutline } from 'ionicons/icons';

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

    return {
      embedMapSrcStart,
      map,
      mapOutline,
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

.google-embed-map {
  width: min(100vw, 800px);
  height: min(100vw, 800px);
}
</style>
