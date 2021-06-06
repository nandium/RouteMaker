<template>
  <div :style="{ width: width + 'px' }">
    <ion-list>
      <ion-item>
        <ion-label>Country</ion-label>
        <ion-select
          :value="selectedCountry"
          @ionChange="onCountrySelect($event.detail.value)"
          interface="action-sheet"
        >
          <ion-select-option
            v-for="(item, index) in countryNameList"
            :key="index"
            :value="item.iso3"
          >
            {{ item.country }}
          </ion-select-option>
        </ion-select>
      </ion-item>
      <ion-item v-if="userHasSelectedCountry">
        <ion-label>Gym</ion-label>
        <ion-select
          :value="selectedGym"
          @ionChange="onGymSelect($event.detail.value)"
          interface="action-sheet"
        >
          <ion-select-option
            v-for="(item, index) in gymLocationList"
            :key="index"
            :value="item.gymLocation"
          >
            {{ item.gymName }}
          </ion-select-option>
        </ion-select>
      </ion-item>
      <ion-row
        v-if="userHasSelectedCountry"
        class="ion-align-items-center ion-justify-content-center"
      >
        <ion-col class="ion-align-self-center" size-xs="6">
          <ion-button expand="full" fill="clear" color="dark">Search Routes</ion-button>
        </ion-col>
        <ion-col class="ion-align-self-center" size-xs="6">
          <ion-button expand="full" fill="clear" color="dark">Can't Find Gym?</ion-button>
        </ion-col>
      </ion-row>
      <ion-item class="rounded error-message" color="danger" v-if="showErrorMsg">
        <ion-label>
          {{ errorMsg }}
        </ion-label>
        <ion-button fill="clear" color="dark" shape="round" @click="clickCloseErrorMsg">
          <ion-icon :icon="closeCircleOutline"></ion-icon>
        </ion-button>
      </ion-item>
    </ion-list>

    <iframe
      v-if="userHasSelectedGym"
      width="100%"
      :height="width + 'px'"
      style="border: 0"
      loading="lazy"
      allowfullscreen
      :src="embedMapSrcStart + embedMapPointerLocation"
    ></iframe>
  </div>
</template>

<script lang="ts">
import { ref, onMounted, defineComponent, computed } from 'vue';
import { IonList, IonItem, IonLabel, IonSelect, IonSelectOption, IonRow, IonCol } from '@ionic/vue';
import { closeCircleOutline } from 'ionicons/icons';
import Lookup, { Country } from 'country-code-lookup';

import getGyms, { GymLocation } from '@/common/api/route/getGyms';

export default defineComponent({
  name: 'GymSelector',
  components: {
    IonLabel,
    IonList,
    IonItem,
    IonSelect,
    IonSelectOption,
    IonRow,
    IonCol,
  },
  props: {
    width: {
      type: Number,
      required: true,
    },
  },
  setup() {
    const embedMapSrcStart = `https://www.google.com/maps/embed/v1/place?key=${process.env.VUE_APP_MAP_EMBED_API}&q=`;
    const embedMapPointerLocation = ref('');
    const countryNameList = ref<Array<Country>>([]);
    const gymLocationList = ref<Array<GymLocation>>([]);
    const selectedCountry = ref('');
    const selectedGym = ref('');
    const errorMsg = ref('');
    const showErrorMsg = ref(false);

    const userHasSelectedGym = computed(() => selectedGym.value !== '');
    const userHasSelectedCountry = computed(() => selectedCountry.value !== '');

    onMounted(async () => {
      countryNameList.value = [...Lookup.countries.sort()];
    });

    const onCountrySelect = async (iso3Code: string) => {
      selectedCountry.value = iso3Code;
      const countryGymLocations = await getGyms(iso3Code);
      gymLocationList.value = countryGymLocations;
    };

    const onGymSelect = async (gymLocation: string) => {
      selectedGym.value = gymLocation;
      embedMapPointerLocation.value = gymLocation;
    };

    const clickCloseErrorMsg = () => {
      showErrorMsg.value = false;
    };

    return {
      embedMapSrcStart,
      embedMapPointerLocation,
      countryNameList,
      selectedCountry,
      onCountrySelect,
      selectedGym,
      onGymSelect,
      gymLocationList,
      userHasSelectedGym,
      userHasSelectedCountry,
      errorMsg,
      showErrorMsg,
      clickCloseErrorMsg,
      closeCircleOutline,
    };
  },
});
</script>

<style></style>
