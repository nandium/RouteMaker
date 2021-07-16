<template>
  <div>
    <ion-grid>
      <ion-row class="ion-align-items-center ion-justify-content-center">
        <ion-col class="ion-align-self-center" size-lg="6" size-md="8" size-xs="12">
          <MessageBox ref="errorMsg" color="danger" />
          <ion-list>
            <ion-item>
              <ion-label class="absolute-position">Country</ion-label>
              <auto-complete
                ref="autoComplete"
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
              v-if="userHasSelectedGym"
              class="ion-align-items-center ion-justify-content-center"
            >
              <ion-col class="ion-align-self-center">
                <ion-button expand="full" fill="clear" color="dark" @click="onClickViewMap">
                  {{ viewMap ? 'Hide Map' : 'View Map' }}
                  <ion-icon slot="end" :icon="viewMap ? map : mapOutline"></ion-icon>
                </ion-button>
              </ion-col>
              <ion-col class="ion-align-self-center">
                <router-link style="text-decoration: none" to="/gyms/request">
                  <ion-button expand="full" fill="clear" color="dark">
                    Can't Find Gym?
                    <ion-icon slot="end" :icon="warning"></ion-icon>
                  </ion-button>
                </router-link>
              </ion-col>
            </ion-row>
          </ion-list>
        </ion-col>
      </ion-row>
      <iframe
        v-if="viewMap"
        :width="width + 'px'"
        :height="width + 'px'"
        class="google-embed-map"
        loading="lazy"
        allowfullscreen
        :src="embedMapSrcStart + embedMapPointerLocation"
      ></iframe>
    </ion-grid>
  </div>
</template>

<script lang="ts">
import { ref, onMounted, defineComponent, computed, Ref, inject } from 'vue';
import {
  IonGrid,
  IonList,
  IonIcon,
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption,
  IonRow,
  IonCol,
  IonButton,
} from '@ionic/vue';
import Lookup, { Country } from 'country-code-lookup';
import { map, mapOutline, warning } from 'ionicons/icons';

import MessageBox from '@/components/MessageBox.vue';
import getGymsByCountry, { GymLocation } from '@/common/api/route/getGymsByCountry';
import AutoComplete from './AutoComplete.vue';

export default defineComponent({
  name: 'GymSelector',
  components: {
    IonGrid,
    IonLabel,
    IonList,
    IonIcon,
    IonItem,
    IonSelect,
    IonSelectOption,
    IonRow,
    IonCol,
    IonButton,
    AutoComplete,
    MessageBox,
  },
  props: {
    width: {
      type: Number,
      required: true,
    },
  },
  setup(_, { emit }) {
    const embedMapSrcStart = `https://www.google.com/maps/embed/v1/place?key=${process.env.VUE_APP_MAP_EMBED_API}&q=`;
    const embedMapPointerLocation = ref('');
    const countryNameList = ref<Array<Country>>([]);
    const gymLocationList = ref<Array<GymLocation>>([]);
    const selectedCountryIso3 = ref('');
    const selectedGym = ref('');
    const errorMsg: Ref<typeof MessageBox | null> = ref(null);

    const getUserCountry: () => Ref<Country | null> = inject('getUserCountry', () => ref(null));
    const setUserCountry: (country: Country) => void = inject('setUserCountry', () => undefined);
    const userCountry = getUserCountry();
    const autoComplete: Ref<typeof AutoComplete | null> = ref(null);

    const userHasSelectedGym = computed(() => selectedGym.value !== '');
    const userHasSelectedCountry = computed(() => selectedCountryIso3.value !== '');

    const viewMap = ref(false);

    onMounted(async () => {
      countryNameList.value = [...Lookup.countries.sort()];
      if (userCountry.value !== null) {
        selectedCountryIso3.value = userCountry.value.iso3;
        const countryGymLocations = await getGymsByCountry(userCountry.value.iso3);
        gymLocationList.value = countryGymLocations;
        autoComplete.value?.setValue(userCountry.value.country);
      } else {
        reset();
      }
    });

    const reset = () => {
      selectedCountryIso3.value = '';
      gymLocationList.value = [];
      selectedGym.value = '';
    };

    const onCountrySelect = async (country: Country) => {
      errorMsg.value?.close();
      if (country) {
        selectedCountryIso3.value = country.iso3;
        const countryGymLocations = await getGymsByCountry(country.iso3);
        gymLocationList.value = countryGymLocations;
        setUserCountry(country);
      } else {
        reset();
      }
    };

    /**
     * Whenever a gym is selected, emit the location of selected gym
     */
    const onGymSelect = (gymLocation: string) => {
      errorMsg.value?.close();
      selectedGym.value = gymLocation;
      emit('onGymSelect', gymLocation);
    };

    const onClickViewMap = () => {
      embedMapPointerLocation.value = selectedGym.value;
      viewMap.value = !viewMap.value;
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
      viewMap,
      onClickViewMap,
      map,
      mapOutline,
      warning,
      autoComplete,
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
