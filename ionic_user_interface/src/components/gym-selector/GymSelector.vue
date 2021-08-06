<template>
  <div>
    <ion-row class="ion-align-items-center ion-justify-content-center">
      <ion-col class="ion-align-self-center" size-lg="6" size-md="8" size-xs="12">
        <message-box ref="errorMsg" color="danger" />
        <loading-button
          class="ion-no-margin"
          expand="full"
          color="tertiary"
          @click="handleLocateClick"
          ref="locateButton"
        >
          <ion-label>Locate Nearest Gym &nbsp;</ion-label>
          <ion-icon :icon="locateOutline"></ion-icon>
        </loading-button>
        <ion-list class="ion-list">
          <auto-complete
            ref="autoComplete"
            :options="countryNameList"
            optionsKey="country"
            @matchedItem="onCountrySelect"
            label="Country"
          />
          <ion-item v-if="userHasSelectedCountry">
            <ion-label>Gym</ion-label>
            <ion-select
              v-model="selectedGym"
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
            class="ion-align-items-center ion-justify-content-center ion-margin-top"
          >
            <ion-col class="ion-align-self-center ion-no-padding">
              <ion-button
                class="ion-no-margin"
                expand="full"
                fill="clear"
                color="dark"
                @click="onClickViewMap"
              >
                {{ viewMap ? 'Hide Map' : 'View Map' }}
                <ion-icon slot="end" :icon="viewMap ? map : mapOutline"></ion-icon>
              </ion-button>
            </ion-col>
            <ion-col class="ion-align-self-center ion-no-padding">
              <router-link style="text-decoration: none" to="/gyms/request">
                <ion-button class="ion-no-margin" expand="full" fill="clear" color="dark">
                  Can't Find Gym?
                  <ion-icon slot="end" :icon="warning"></ion-icon>
                </ion-button>
              </router-link>
            </ion-col>
          </ion-row>
        </ion-list>
      </ion-col>
    </ion-row>
    <div v-if="viewMap" class="margin-top center-inner">
      <gym-map :gymLocationList="gymLocationList" :initialLocation="selectedGym"></gym-map>
    </div>
  </div>
</template>

<script lang="ts">
import { ref, onMounted, defineComponent, computed, Ref, inject } from 'vue';
import {
  IonButton,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonSelect,
  IonSelectOption,
  IonRow,
  IonCol,
} from '@ionic/vue';
import Lookup, { Country } from 'country-code-lookup';
import { map, mapOutline, warning, locateOutline } from 'ionicons/icons';

import MessageBox from '@/components/MessageBox.vue';
import LoadingButton from '@/components/LoadingButton.vue';
import GymMap from '@/components/GymMap.vue';
import getGymsByCountry, { LatLong, GymLocation } from '@/common/api/route/getGymsByCountry';
import AutoComplete from './AutoComplete.vue';
import { Geolocation } from '@capacitor/geolocation';
import axios from 'axios';
import haversine from 'haversine';

export default defineComponent({
  name: 'GymSelector',
  components: {
    IonButton,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonSelect,
    IonSelectOption,
    IonRow,
    IonCol,
    AutoComplete,
    GymMap,
    LoadingButton,
    MessageBox,
  },
  setup(_, { emit }) {
    const countryNameList = ref<Array<Country>>([...Lookup.countries.sort()]);
    const gymLocationList = ref<Array<GymLocation>>([]);
    const selectedCountryIso3 = ref('');
    const selectedGym = ref('');
    const errorMsg: Ref<typeof MessageBox | null> = ref(null);

    const getUserCountry: () => Ref<Country | null> = inject('getUserCountry', () => ref(null));
    const setUserCountry: (country: Country) => void = inject('setUserCountry', () => undefined);
    const getUserGym: () => Ref<string> = inject('getUserGym', () => ref(''));
    const setUserGym: (gym: string) => void = inject('setUserGym', () => undefined);
    const userCountry = getUserCountry();
    const userGym = getUserGym();
    const autoComplete: Ref<typeof AutoComplete | null> = ref(null);
    const locateButton: Ref<typeof LoadingButton | null> = ref(null);

    const userHasSelectedGym = computed(() => selectedGym.value !== '');
    const userHasSelectedCountry = computed(() => selectedCountryIso3.value !== '');

    let userLatLong: LatLong | null = null;

    const viewMap = ref(false);

    onMounted(async () => {
      if (userCountry.value !== null) {
        // On set value, emits @matchedItem which triggers onCountrySelect
        autoComplete.value?.setValue(userCountry.value.country);

        // For new user, default is SGP and Zvertigo
        // After usage, the app remembers the new country and gym
        if (userGym.value !== '') {
          selectedGym.value = userGym.value;
        } else if (userCountry.value.iso3 === 'SGP') {
          selectedGym.value = '1.343014966025054, 103.77590653585952'; // Z-Vertigo's gym location
        } else {
          selectedGym.value = '';
        }
        // Simulate being selected in ion-select
        onGymSelect(selectedGym.value);
      } else {
        reset();
      }
    });

    const setNearestGym = () => {
      if (userLatLong) {
        let minDistance = Number.MAX_VALUE;
        let minDistanceGym = null;
        for (const gymLocation of gymLocationList.value) {
          const distanceToUserLocation = haversine(gymLocation.latLong, userLatLong);
          if (distanceToUserLocation < minDistance) {
            minDistance = distanceToUserLocation;
            minDistanceGym = gymLocation.gymLocation;
          }
        }
        if (minDistanceGym) {
          selectedGym.value = minDistanceGym;
        }
      }
    };

    const handleLocateClick = async () => {
      locateButton.value?.setIsLoading(true);
      try {
        const coordinates = await Geolocation.getCurrentPosition();
        userLatLong = {
          latitude: coordinates.coords.latitude,
          longitude: coordinates.coords.longitude,
        };
        const response = await axios.get(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${userLatLong.longitude},${userLatLong.latitude}.json?types=country&access_token=${process.env.VUE_APP_MAPBOX_ACCESS_KEY}`,
        );

        const countryName = response.data.features[0].place_name;
        autoComplete.value?.setValue(countryName);
        setNearestGym();
      } catch (error) {
        console.error(error);
      } finally {
        locateButton.value?.setIsLoading(false);
      }
    };

    const reset = () => {
      selectedCountryIso3.value = '';
      gymLocationList.value = [];
      selectedGym.value = '';
    };

    const onCountrySelect = async (country: Country) => {
      errorMsg.value?.close();
      if (country) {
        const countryGymLocations = await getGymsByCountry(country.iso3);
        gymLocationList.value = countryGymLocations;
        selectedCountryIso3.value = country.iso3;
        setUserCountry(country);
        setNearestGym();
      } else {
        reset();
        emit('onCountryReset', true);
      }
    };

    /**
     * Whenever a gym is selected, emit the location of selected gym
     */
    const onGymSelect = (gymLocation: string) => {
      errorMsg.value?.close();
      setUserGym(gymLocation);
      emit('onGymSelect', gymLocation);
    };

    const onClickViewMap = () => {
      viewMap.value = !viewMap.value;
    };

    return {
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
      locateOutline,
      handleLocateClick,
      locateButton,
    };
  },
});
</script>

<style scoped lang="scss">
.ion-list {
  padding-top: 3px;
  padding-bottom: 0;
}

.margin-top {
  margin-top: 3px;
}
</style>
