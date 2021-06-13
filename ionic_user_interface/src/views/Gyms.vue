<template>
  <ion-page>
    <ion-content :fullscreen="true">
      <div id="container">
        <strong>Route Maker</strong>
        <p>Find climbing routes by gym</p>
        <br />
        <gym-selector v-if="canvasWidth > 0" :width="canvasWidth" />
      </div>
    </ion-content>
  </ion-page>
</template>

<script lang="ts">
import { IonContent, IonPage } from '@ionic/vue';
import { defineComponent, onMounted, onUnmounted } from 'vue';

import GymSelector from '@/components/gym-selector/GymSelector.vue';
import { useCanvasWidth } from '@/composables/useCanvasWidth';

export default defineComponent({
  name: 'Gyms',
  components: {
    IonContent,
    IonPage,
    GymSelector,
  },
  setup() {
    const { canvasWidth, updateCanvasWidth } = useCanvasWidth();
    window.addEventListener('resize', updateCanvasWidth);
    onMounted(() => {
      updateCanvasWidth();
    });
    onUnmounted(() => {
      window.removeEventListener('resize', updateCanvasWidth);
    });
    return {
      canvasWidth,
    };
  },
});
</script>

<style scoped>
#container {
  text-align: center;
  position: absolute;
  left: 0;
  right: 0;
}

#container strong {
  font-size: 3em;
  line-height: 2em;
}

#container p {
  font-size: 1.6em;
  line-height: 1em;
  color: #8c8c8c;
  margin: 0;
}

#container a {
  text-decoration: none;
}
</style>
