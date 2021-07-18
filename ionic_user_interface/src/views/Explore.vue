<template>
  <ion-page>
    <ion-content :fullscreen="true">
      <div id="container">
        <ion-row class="ion-align-items-center ion-justify-content-center margin-bottom">
          <ion-col class="ion-align-self-center" size-lg="6" size-md="8" size-xs="12">
            <div v-if="showGymSelector">
              <strong>Route Maker</strong>
              <p>Find climbing routes by gym</p>
            </div>
            <div class="gym-name" v-else>
              <b>-- {{ gymName }} --</b>
            </div>
          </ion-col>
        </ion-row>

        <!-- Show Gym Selector if browsing gyms, show only gym-map if individual gym -->
        <gym-selector
          v-if="showGymSelector"
          @onGymSelect="handleOnGymSelect"
          @onCountryReset="handleOnCountryReset"
        />
        <ion-row v-else class="ion-align-items-center ion-justify-content-center">
          <ion-col class="ion-align-self-center" size-lg="6" size-md="8" size-xs="12">
            <ion-button
              class="ion-align-self-center ion-no-margin"
              expand="full"
              fill="clear"
              color="dark"
              @click="onClickViewMap"
            >
              {{ viewMap ? 'Hide Map' : 'View Map' }}
              <ion-icon slot="end" :icon="viewMap ? map : mapOutline"></ion-icon>
            </ion-button>
          </ion-col>
          <ion-col class="ion-align-self-center ion-no-padding" size-xs="12">
            <gym-map v-if="viewMap" :gymLocation="gymLocation" class="margin-top"></gym-map>
          </ion-col>
        </ion-row>

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
import { IonContent, IonPage, IonRow, IonCol, IonButton, IonIcon } from '@ionic/vue';
import { defineComponent, onMounted, ref, computed } from 'vue';
import { useRoute } from 'vue-router';
import { map, mapOutline } from 'ionicons/icons';

import GymSelector from '@/components/gym-selector/GymSelector.vue';
import GymMap from '@/components/GymMap.vue';
import GymRouteList from '@/components/GymRouteList.vue';

export default defineComponent({
  name: 'Explore',
  components: {
    IonContent,
    IonPage,
    IonRow,
    IonCol,
    IonButton,
    IonIcon,
    GymSelector,
    GymRouteList,
    GymMap,
  },
  setup() {
    /**
     * `/explore` and `/gym/:gymLocation/:gymName` points to this component
     * If gymLocation exists in path parameters, use a different page layout
     */
    const route = useRoute();
    const gymRouteList = ref<typeof GymRouteList | null>(null);
    const showGymRouteList = ref(false);
    const gymLocation = computed(() => route.params.gymLocation as string);
    const gymName = computed(() => route.params.gymName as string);
    const showGymSelector = computed(
      () => gymLocation.value === undefined && gymName.value === undefined,
    );
    const viewMap = ref(false);

    const handleOnGymSelect = (gymLocation: string) => {
      showGymRouteList.value = true;
      gymRouteList.value?.setGymLocation(gymLocation);
    };

    const handleOnCountryReset = () => {
      showGymRouteList.value = false;
    };

    onMounted(() => {
      if (gymLocation.value && gymName.value) {
        handleOnGymSelect(gymLocation.value as string);
      }
    });

    const onClickViewMap = () => {
      viewMap.value = !viewMap.value;
    };

    return {
      gymRouteList,
      showGymRouteList,
      handleOnGymSelect,
      handleOnCountryReset,
      showGymSelector,
      gymLocation,
      onClickViewMap,
      viewMap,
      map,
      mapOutline,
      gymName,
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

.margin-top {
  margin-top: 3px;
}

.margin-bottom {
  margin-bottom: 25px;
}
</style>
