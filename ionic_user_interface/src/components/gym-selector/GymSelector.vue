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
                <router-link style="text-decoration: none" to="/gyms/request">
                  <ion-button expand="full" fill="clear" color="dark">Can't Find Gym?</ion-button>
                </router-link>
              </ion-col>
            </ion-row>
          </ion-list>
          <RouteList v-show="viewRoutes" ref="routeList" />
        </ion-col>
      </ion-row>
    </ion-grid>

    <iframe
      v-if="userHasSelectedGym && !viewRoutes"
      :width="width + 'px'"
      :height="width + 'px'"
      class="google-embed-map"
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
import MessageBox from '@/components/MessageBox.vue';
import RouteList from '@/components/RouteList.vue';
import getGymsByCountry, { GymLocation } from '@/common/api/route/getGymsByCountry';
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
    MessageBox,
    RouteList,
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
    const errorMsg: Ref<typeof MessageBox | null> = ref(null);

    const userHasSelectedGym = computed(() => selectedGym.value !== '');
    const userHasSelectedCountry = computed(() => selectedCountryIso3.value !== '');

    const routeList = ref<typeof RouteList | null>(null);
    const viewRoutes = ref(false);

    onMounted(() => {
      countryNameList.value = [...Lookup.countries.sort()];
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
        viewRoutes.value = false;
      } else {
        reset();
      }
    };

    const onGymSelect = (gymLocation: string) => {
      // Do nothing if the selected gym has not changed
      if (selectedGym.value === gymLocation) {
        return;
      }
      errorMsg.value?.close();
      selectedGym.value = gymLocation;
      viewRoutes.value = false;
      embedMapPointerLocation.value = gymLocation;
    };

    const onClickSearchRoutes = () => {
      if (!userHasSelectedGym.value) {
        errorMsg.value?.showMsg('Please select a gym');
      } else {
        // TODO: Display routes
        viewRoutes.value = true;
        routeList.value?.setGymLocation(selectedGym.value);
      }
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
      viewRoutes,
      routeList,
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
