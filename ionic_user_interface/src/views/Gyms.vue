<template>
  <ion-page>
    <ion-content :fullscreen="true">
      <div id="container">
        <div v-if="gymNameString === ''">
          <strong>Route Maker</strong>
          <p>Find climbing routes by gym</p>
        </div>
        <div v-else class="gym-name">
          <b>-- {{ gymNameString }} --</b>
        </div>
        <br />
        <gym-selector
          v-if="showGymSelector"
          :width="canvasWidth"
          @onGymSelect="handleOnGymSelect"
        />
        <ion-row class="ion-align-items-center ion-justify-content-center">
          <ion-col class="ion-align-self-center" size-lg="6" size-md="8" size-xs="12">
            <gym-route-list v-show="showGymRouteList" ref="gymRouteList" />
          </ion-col>
        </ion-row>
      </div>
    </ion-content>
  </ion-page>
</template>

<script lang="ts">
import { IonContent, IonPage, IonRow, IonCol } from '@ionic/vue';
import { defineComponent, onMounted, onUnmounted, ref, computed } from 'vue';
import { useRoute } from 'vue-router';

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

    /**
     * `/gyms` and `/gym/:gymLocation/:gymName` points to this component
     * If gymLocation exists in path parameters, use a different page layout
     */
    const route = useRoute();
    const gymRouteList = ref<typeof GymRouteList | null>(null);
    const showGymRouteList = ref(false);
    const { gymLocation, gymName } = route.params;
    const showGymSelector = computed(
      () => canvasWidth.value > 0 && gymLocation === undefined && gymName === undefined,
    );
    const gymNameString = ref('');

    const handleOnGymSelect = (gymLocation: string) => {
      showGymRouteList.value = true;
      gymRouteList.value?.setGymLocation(gymLocation);
    };
    onMounted(() => {
      if (gymLocation && gymName) {
        handleOnGymSelect(gymLocation as string);
        gymNameString.value = gymName as string;
      }
    });

    return {
      canvasWidth,
      gymRouteList,
      showGymRouteList,
      handleOnGymSelect,
      showGymSelector,
      gymNameString,
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

.gym-name {
  font-size: clamp(2rem, 7vw, 2.5rem);
  margin: 20px;
}
</style>
