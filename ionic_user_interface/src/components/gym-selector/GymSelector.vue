<template>
  <div>
    <ion-grid>
      <ion-row class="ion-align-items-center ion-justify-content-center">
        <ion-col class="ion-align-self-center" size-lg="6" size-md="8" size-xs="12">
          <ErrorMessage ref="errorMsg" />
          <ion-list>
            <ion-item>
              <ion-label>Country</ion-label>
              <auto-complete
                :options="countryNameList"
                optionsKey="country"
                @matchedItem="onCountrySelect"
              />
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
                <ion-button expand="full" fill="clear" color="dark" @click="onClickSearchRoutes">
                  Search Routes
                </ion-button>
              </ion-col>
              <ion-col class="ion-align-self-center" size-xs="6">
                <ion-button expand="full" fill="clear" color="dark" @click="onClickCantFindGym">
                  Can't Find Gym?
                </ion-button>
              </ion-col>
            </ion-row>
          </ion-list>
        </ion-col>
      </ion-row>
    </ion-grid>

    <iframe
      v-if="userHasSelectedGym"
      :width="width + 'px'"
      :height="width + 'px'"
      style="border: 0"
      loading="lazy"
      allowfullscreen
      :src="embedMapSrcStart + embedMapPointerLocation"
    ></iframe>
  </div>
</template>

<script lang="ts">
import { ref, onMounted, defineComponent, computed, Ref } from 'vue';
import {
  IonGrid,
  IonList,
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption,
  IonRow,
  IonCol,
  IonButton,
} from '@ionic/vue';
import Lookup, { Country } from 'country-code-lookup';

import router from '@/router';
import ErrorMessage from '@/components/ErrorMessage.vue';
import getGyms, { GymLocation } from '@/common/api/route/getGyms';
import AutoComplete from './AutoComplete.vue';

export default defineComponent({
  name: 'GymSelector',
  components: {
    IonGrid,
    IonLabel,
    IonList,
    IonItem,
    IonSelect,
    IonSelectOption,
    IonRow,
    IonCol,
    IonButton,
    AutoComplete,
    ErrorMessage,
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
    const selectedCountryIso3 = ref('');
    const selectedGym = ref('');
    const errorMsg: Ref<typeof ErrorMessage | null> = ref(null);

    const userHasSelectedGym = computed(() => selectedGym.value !== '');
    const userHasSelectedCountry = computed(() => selectedCountryIso3.value !== '');

    onMounted(() => {
      countryNameList.value = [...Lookup.countries.sort()];
    });

    const reset = () => {
      selectedCountryIso3.value = '';
      gymLocationList.value = [];
      selectedGym.value = '';
    };

    const onCountrySelect = async (country: Country) => {
      if (country) {
        selectedCountryIso3.value = country.iso3;
        const countryGymLocations = await getGyms(country.iso3);
        gymLocationList.value = countryGymLocations;
      } else {
        reset();
      }
    };

    const onGymSelect = (gymLocation: string) => {
      errorMsg.value?.closeErrorMsg();
      selectedGym.value = gymLocation;
      embedMapPointerLocation.value = gymLocation;
    };

    const onClickSearchRoutes = () => {
      if (!userHasSelectedGym.value) {
        errorMsg.value?.showErrorMsg('Please select a gym');
      } else {
        // TODO: Display routes
      }
    };

    const onClickCantFindGym = () => {
      router.push('/gyms/request');
      return;
    };

    return {
      embedMapSrcStart,
      embedMapPointerLocation,
      countryNameList,
      onCountrySelect,
      selectedGym,
      onGymSelect,
      gymLocationList,
      userHasSelectedGym,
      userHasSelectedCountry,
      errorMsg,
      onClickSearchRoutes,
      onClickCantFindGym,
    };
  },
});
</script>
