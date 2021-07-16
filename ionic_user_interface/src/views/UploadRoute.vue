<template>
  <ion-page>
    <ion-content :fullscreen="true" ref="content">
      <ion-grid>
        <ion-row color="primary" class="ion-align-items-center ion-justify-content-center">
          <ion-col class="ion-align-self-center" size-md="6" size-lg="5" size-xs="12">
            <div class="ion-text-center">
              <h1>Upload Route</h1>
            </div>
            <div class="ion-padding ion-text-center">
              <MessageBox ref="msgBox" :color="msgBoxColor" class="rounded margin" />
              <form @submit="onSubmit">
                <ion-item class="rounded margin">
                  <ion-label position="floating">Route name</ion-label>
                  <ion-input
                    v-model="routeNameText"
                    inputmode="text"
                    type="text"
                    maxlength="30"
                    autofocus
                    required
                  />
                  <!-- Fix to prevent enter submit -->
                  <ion-input class="ion-hide"></ion-input>
                </ion-item>
                <ion-item class="rounded margin">
                  <ion-range v-model="gradeNumber" min="0" max="14" step="1" snaps>
                    <ion-label slot="start" class="grade-text">{{ gradeText }}</ion-label>
                  </ion-range>
                </ion-item>
                <ion-item class="rounded margin">
                  <ion-label class="absolute-position">Country</ion-label>
                  <auto-complete
                    :options="countryNameList"
                    optionsKey="country"
                    @matchedItem="onCountrySelect"
                  />
                </ion-item>
                <ion-list class="rounded margin" v-if="userHasSelectedCountry">
                  <ion-item>
                    <ion-label>Gym</ion-label>
                    <ion-select v-model="selectedGymLocation" interface="action-sheet">
                      <ion-select-option
                        v-for="(item, index) in gymLocationList"
                        :key="index"
                        :value="item.gymLocation"
                      >
                        {{ item.gymName }}
                      </ion-select-option>
                    </ion-select>
                  </ion-item>
                  <router-link style="text-decoration: none" to="/gyms/request">
                    <ion-button expand="block" fill="clear" color="dark">
                      Can't Find Gym?
                    </ion-button>
                  </router-link>
                </ion-list>
                <ion-item class="rounded margin">
                  <ion-label>Estimated Teardown Date</ion-label>
                  <ion-datetime
                    display-format="D MMM YYYY"
                    :min="minRouteExpiry"
                    :max="maxRouteExpiry"
                    v-model="expiryTime"
                  ></ion-datetime>
                </ion-item>
                <ion-img :src="routeImage" class="margin"></ion-img>
                <ion-button class="upload-button" size="medium" type="submit" expand="block">
                  Upload
                </ion-button>
              </form>
            </div>
          </ion-col>
        </ion-row>
      </ion-grid>
    </ion-content>
  </ion-page>
</template>

<script lang="ts">
import {
  IonButton,
  IonCol,
  IonContent,
  IonDatetime,
  IonGrid,
  IonImg,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonPage,
  IonRange,
  IonRow,
  IonSelect,
  IonSelectOption,
  onIonViewDidLeave,
  toastController,
} from '@ionic/vue';
import { computed, defineComponent, inject, onMounted, ref, Ref } from 'vue';
import axios from 'axios';
import Lookup, { Country } from 'country-code-lookup';
import MessageBox from '@/components/MessageBox.vue';
import getGymsByCountry, { GymLocation } from '@/common/api/route/getGymsByCountry';
import AutoComplete from '@/components/gym-selector/AutoComplete.vue';
import { useRouter } from 'vue-router';
import { throttle } from 'lodash';

export default defineComponent({
  name: 'UploadRoute',
  components: {
    AutoComplete,
    MessageBox,
    IonButton,
    IonCol,
    IonContent,
    IonDatetime,
    IonGrid,
    IonImg,
    IonInput,
    IonItem,
    IonLabel,
    IonList,
    IonPage,
    IonRange,
    IonRow,
    IonSelect,
    IonSelectOption,
  },
  setup() {
    const router = useRouter();
    const content: Ref<typeof IonContent | null> = ref(null);
    const msgBox: Ref<typeof MessageBox | null> = ref(null);
    const getAccessToken: () => Ref<string> = inject('getAccessToken', () => ref(''));
    const getUsername: () => Ref<string> = inject('getUsername', () => ref(''));
    const msgBoxColor = ref('danger');
    const routeNameText = ref('');
    const gradeNumber = ref(0);
    const gradeText = computed(() => 'V' + gradeNumber.value);
    const getRouteImageUri: () => Ref<string> = inject('getRouteImageUri', () => ref(''));
    const routeImage = getRouteImageUri();
    const countryNameList = ref<Array<Country>>([]);
    const gymLocationList = ref<Array<GymLocation>>([]);
    const selectedCountryIso3 = ref('');
    const selectedGymLocation = ref('');
    const userHasSelectedCountry = computed(() => selectedCountryIso3.value !== '');

    const asciiPattern = /^[ -~]+$/;

    const transformDaysAwayToYYYYMMDD = (daysAway: number): string => {
      const date = new Date(new Date().getTime() + daysAway * 24 * 60 * 60 * 1000);
      const mm = date.getMonth() + 1;
      const dd = date.getDate();
      // Format to yyyy-mm-dd;
      return [date.getFullYear(), (mm > 9 ? '' : '0') + mm, (dd > 9 ? '' : '0') + dd].join('-');
    };
    const minRouteExpiry = computed(() => transformDaysAwayToYYYYMMDD(1));
    const maxRouteExpiry = computed(() => transformDaysAwayToYYYYMMDD(90));
    const expiryTime = ref('');

    onIonViewDidLeave(() => {
      msgBox.value?.close();
    });

    onMounted(() => {
      countryNameList.value = [...Lookup.countries.sort()];
    });

    const reset = () => {
      gymLocationList.value = [];
      selectedCountryIso3.value = '';
      selectedGymLocation.value = '';
    };

    const onCountrySelect = async (country: Country) => {
      if (country) {
        selectedCountryIso3.value = country.iso3;
        gymLocationList.value = await getGymsByCountry(country.iso3);
      } else {
        reset();
      }
    };

    const isValidRouteName = (routeName: string): boolean => {
      return routeName.length > 0 && routeName.length <= 30 && asciiPattern.test(routeName);
    };

    const showErrorMsg = (errorMsg: string): void => {
      msgBoxColor.value = 'danger';
      msgBox.value?.showMsg(errorMsg);
      content.value?.$el.scrollToTop(400);
    };

    const onSubmit = throttle(async (event: Event): Promise<boolean> => {
      event.preventDefault();
      msgBox.value?.close();

      if (!isValidRouteName(routeNameText.value)) {
        showErrorMsg('Route name has to be 0-30 ASCII characters');
        return false;
      }

      if (!userHasSelectedCountry.value || selectedGymLocation.value === '') {
        showErrorMsg('Please select a country and gym');
        return false;
      }

      if (expiryTime.value === '') {
        showErrorMsg('Please select an expiry date');
        return false;
      }

      let expiryTimeISO = '';
      try {
        expiryTimeISO = new Date(expiryTime.value).toISOString();
      } catch (error) {
        showErrorMsg('Invalid teardown date');
        return false;
      }

      const routeImageBlob = await fetch(routeImage.value).then((res) => res.blob());
      const formData = new FormData();
      formData.append('countryCode', selectedCountryIso3.value);
      formData.append('expiredTime', expiryTimeISO);
      formData.append('gymLocation', selectedGymLocation.value);
      formData.append('ownerGrade', gradeNumber.value.toString());
      formData.append('routePhoto', routeImageBlob);
      formData.append('routeName', routeNameText.value);

      axios
        .post(process.env.VUE_APP_ROUTE_ENDPOINT_URL + '/route/new', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
            Authorization: `Bearer ${getAccessToken().value}`,
          },
        })
        .then((response) => {
          if (response.data.Message === 'Create route success') {
            toastController
              .create({
                header: 'Route has been uploaded successfully',
                position: 'bottom',
                color: 'success',
                duration: 3000,
                buttons: [
                  {
                    text: 'Close',
                    role: 'cancel',
                  },
                ],
              })
              .then((toast) => {
                toast.present();
              });

            router.push('/userRoutes/' + getUsername().value);
          } else {
            showErrorMsg('Unable to create route, please try again');
          }
        })
        .catch((error) => {
          if (error.response) {
            if (error.response.data.Message === 'Unregistered gym') {
              showErrorMsg(
                'Unregistered gym, please go to https://routemaker.rocks/gyms/request to register',
              );
            } else if (error.response.data.Message === 'Upload Limit Reached') {
              showErrorMsg(
                'Daily upload limit of ' +
                  error.response.data.Limit +
                  ' reached, please wait till tomorrow or delete some routes from today',
              );
            } else {
              showErrorMsg('Error: ' + error.response.data.Message);
            }
          } else if (error.request) {
            showErrorMsg('Bad request');
          } else {
            showErrorMsg('Error: ' + error.message);
          }
        });

      return true;
    }, 1000);
    return {
      content,
      countryNameList,
      onCountrySelect,
      selectedGymLocation,
      userHasSelectedCountry,
      gymLocationList,
      onSubmit,
      msgBox,
      msgBoxColor,
      minRouteExpiry,
      maxRouteExpiry,
      expiryTime,
      routeImage,
      routeNameText,
      gradeNumber,
      gradeText,
    };
  },
});
</script>

<style scoped>
.rounded {
  border-radius: 5px;
}

.margin {
  margin-bottom: 1.4em;
}

.upload-button {
  margin-top: 30px;
  margin-bottom: 40px;
}

.grade-text {
  font-size: 1.4em;
  margin-right: 1.5em;
}
</style>
