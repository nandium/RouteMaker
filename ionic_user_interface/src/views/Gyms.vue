<template>
  <ion-page>
    <ion-content :fullscreen="true">
      <div id="container">
        <strong>Route Maker</strong>
        <p>Find climbing routes by gym</p>
        <br />
        <gym-selector
          v-if="canvasWidth > 0"
          :width="canvasWidth"
          @onGymSelect="handleOnGymSelect"
        />
        <ion-row class="ion-align-items-center ion-justify-content-center">
          <ion-col class="ion-align-self-center" size-lg="6" size-md="8" size-xs="12">
            <gym-route-list v-show="userHasSelectedGym" ref="gymRouteList" />
          </ion-col>
        </ion-row>
      </div>
    </ion-content>
  </ion-page>
</template>

<script lang="ts">
import { IonContent, IonPage, IonRow, IonCol } from '@ionic/vue';
import { defineComponent, onMounted, onUnmounted, ref } from 'vue';

import GymSelector from '@/components/gym-selector/GymSelector.vue';
import GymRouteList from '@/components/GymRouteList.vue';
import { useCanvasWidth } from '@/composables/useCanvasWidth';

export default defineComponent({
  name: 'Gyms',
  components: {
    IonContent,
    IonPage,
    IonRow,
    IonCol,
    GymSelector,
    GymRouteList,
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

    const gymRouteList = ref<typeof GymRouteList | null>(null);
    const userHasSelectedGym = ref(false);

    const handleOnGymSelect = (gymLocation: string) => {
      userHasSelectedGym.value = true;
      gymRouteList.value?.setGymLocation(gymLocation);
    };

    return {
      canvasWidth,
      gymRouteList,
      userHasSelectedGym,
      handleOnGymSelect,
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
