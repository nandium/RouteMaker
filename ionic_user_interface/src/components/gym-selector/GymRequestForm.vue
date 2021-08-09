<template>
  <ion-grid>
    <ion-row class="ion-align-items-center ion-justify-content-center">
      <ion-col class="ion-align-self-center" size-lg="6" size-md="8" size-xs="12">
        <message-box ref="errorMsg" color="danger" />
        <form @submit.prevent="onSubmit">
          <ion-list class="ion-no-padding">
            <auto-complete
              :options="countryNameList"
              optionsKey="country"
              @matchedItem="onCountrySelect"
              label="Country"
            />
            <ion-item>
              <ion-label class="global-absolute-position">Gym Name</ion-label>
              <ion-input class="ion-text-end" v-model="gymNameInput" />
            </ion-item>
            <ion-item>
              <ion-label class="global-absolute-position">Postal</ion-label>
              <ion-input class="ion-text-end" v-model="postalInput" />
            </ion-item>
          </ion-list>
          <ion-button expand="full" type="submit">Submit Request</ion-button>
        </form>
      </ion-col>
    </ion-row>
  </ion-grid>
</template>

<script lang="ts">
import { ref, onMounted, defineComponent, Ref } from 'vue';
import {
  alertController,
  IonGrid,
  IonList,
  IonItem,
  IonLabel,
  IonRow,
  IonCol,
  IonInput,
  IonButton,
} from '@ionic/vue';
import Lookup, { Country } from 'country-code-lookup';
import { useRouter } from 'vue-router';
import { throttle } from 'lodash';

import MessageBox from '@/components/MessageBox.vue';
import AutoComplete from './AutoComplete.vue';
import requestGym from '@/common/api/route/requestGym';

export default defineComponent({
  name: 'GymRequestForm',
  components: {
    IonGrid,
    IonLabel,
    IonList,
    IonItem,
    IonRow,
    IonCol,
    IonInput,
    IonButton,
    AutoComplete,
    MessageBox,
  },
  setup() {
    const router = useRouter();
    const errorMsg: Ref<typeof MessageBox | null> = ref(null);
    const countryNameList = ref<Array<Country>>([]);
    const selectedCountryIso3 = ref('');
    const gymNameInput: Ref<string> = ref('');
    const postalInput: Ref<string> = ref('');

    const asciiPattern = /^[ -~]+$/;

    onMounted(() => {
      countryNameList.value = [...Lookup.countries.sort()];
    });

    const onCountrySelect = async (country: Country) => {
      if (country) {
        selectedCountryIso3.value = country.iso3;
      } else {
        selectedCountryIso3.value = '';
      }
    };

    const isValidGymName = (gymName: string): boolean => {
      return asciiPattern.test(gymName) && gymName.length > 0 && gymName.length <= 30;
    };

    const isValidPostal = (postal: string): boolean => {
      return asciiPattern.test(postal) && postal.length > 0 && postal.length <= 12;
    };

    const alertSubmissionSuccess = async () => {
      const alert = await alertController.create({
        header: 'Request Submitted',
        subHeader: 'Thank you! A response email will be sent in 2 to 10 hours',
        buttons: [
          {
            text: 'Okay',
            handler: () => {
              router.push({ name: 'Explore' });
            },
          },
        ],
      });
      return alert.present();
    };

    const onSubmit = throttle(async (): Promise<boolean> => {
      errorMsg.value?.close();

      // Invalid credentials
      if (!selectedCountryIso3.value) {
        errorMsg.value?.showMsg('Invalid country');
        return false;
      }
      if (!isValidGymName(gymNameInput.value)) {
        errorMsg.value?.showMsg('Gym name has to be 1 to 30 English chars');
        return false;
      }
      if (!isValidPostal(postalInput.value)) {
        errorMsg.value?.showMsg('Postal has to be 1 to 12 English chars');
        return false;
      }

      try {
        await requestGym(selectedCountryIso3.value, postalInput.value, gymNameInput.value);
      } catch (error) {
        errorMsg.value?.showMsg('Error submitting form');
        return false;
      }
      alertSubmissionSuccess();
      return true;
    }, 1000);

    return {
      countryNameList,
      onCountrySelect,
      errorMsg,
      gymNameInput,
      postalInput,
      onSubmit,
    };
  },
});
</script>
