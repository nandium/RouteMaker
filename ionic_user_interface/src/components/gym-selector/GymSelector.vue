<template>
  <div>
    <ion-row class="ion-align-items-center ion-justify-content-center">
      <ion-col class="ion-align-self-center" size-lg="6" size-md="8" size-xs="12">
        <MessageBox ref="errorMsg" color="danger" />
        <ion-list class="ion-list">
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
            class="ion-align-items-center ion-justify-content-center ion-no-margin"
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
    <div v-if="viewMap" class="margin-top center-inner">
      <gym-map :gymLocation="selectedGym"></gym-map>
    </div>
  </div>
</template>

<script lang="ts">
import { ref, onMounted, defineComponent, computed, Ref, inject } from 'vue';
import {
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonSelect,
  IonSelectOption,
  IonRow,
  IonCol,
  IonButton,
} from '@ionic/vue';
import Lookup, { Country } from 'country-code-lookup';
import { map, mapOutline, warning } from 'ionicons/icons';

import MessageBox from '@/components/MessageBox.vue';
import GymMap from '@/components/GymMap.vue';
import getGymsByCountry, { GymLocation } from '@/common/api/route/getGymsByCountry';
import AutoComplete from './AutoComplete.vue';

export default defineComponent({
  name: 'GymSelector',
  components: {
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonSelect,
    IonSelectOption,
    IonRow,
    IonCol,
    IonButton,
    AutoComplete,
    MessageBox,
    GymMap,
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

    const userHasSelectedGym = computed(() => selectedGym.value !== '');
    const userHasSelectedCountry = computed(() => selectedCountryIso3.value !== '');

    const viewMap = ref(false);

    onMounted(async () => {
      if (userCountry.value !== null) {
        selectedCountryIso3.value = userCountry.value.iso3;
        const countryGymLocations = await getGymsByCountry(userCountry.value.iso3);
        gymLocationList.value = countryGymLocations;
        if (userGym.value !== '') {
          selectedGym.value = userGym.value;
        } else {
          selectedGym.value = '1.343014966025054, 103.77590653585952'; // Z-Vertigo's gym location
        }
        // Simulate being selected in ion-select
        onGymSelect(selectedGym.value);
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
    };
  },
});
</script>

<style scoped>
.ion-list {
  padding-top: 3px;
  padding-bottom: 0;
}

.margin-top {
  margin-top: 3px;
}
</style>
