<template>
  <ion-page>
    <Header />
    <ion-content :fullscreen="true">
      <ion-header collapse="condense"></ion-header>
      <div id="container">
        <strong>Route Maker</strong>
        <p>Find climbing routes by gym</p>
        <br />
        <gym-selector v-if="canvasWidth > 0" class="gymSelector" :width="canvasWidth" />
      </div>
    </ion-content>
  </ion-page>
</template>

<script lang="ts">
import { IonContent, IonHeader, IonPage } from '@ionic/vue';
import { defineComponent, onUnmounted } from 'vue';

import Header from '@/components/header/Header.vue';
import GymSelector from '@/components/gym-selector/GymSelector.vue';
import { useCanvasWidth } from '@/composables/useCanvasWidth';

export default defineComponent({
  name: 'Home',
  components: {
    IonContent,
    IonHeader,
    IonPage,
    Header,
    GymSelector,
  },
  setup() {
    const { canvasWidth, updateCanvasWidth } = useCanvasWidth();
    window.onload = updateCanvasWidth;
    window.addEventListener('resize', updateCanvasWidth);
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

.gymSelector {
  width: max-content;
  margin: 0 auto;
}
</style>
