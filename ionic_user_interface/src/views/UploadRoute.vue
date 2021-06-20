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
                <ion-list class="rounded margin">
                  <ion-item>
                    <ion-label>Grade</ion-label>
                  </ion-item>
                  <ion-item>
                    <ion-range v-model="gradeNumber" min="0" max="20" step="1" snaps>
                      <ion-label slot="start" class="grade-text">{{ gradeText }}</ion-label>
                    </ion-range>
                  </ion-item>
                </ion-list>
                <ion-item class="rounded margin">
                  <ion-label>Route expiry date</ion-label>
                  <ion-datetime
                    display-format="D MMM YYYY"
                    :min="minRouteExpiry"
                    :max="maxRouteExpiry"
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
  onIonViewDidLeave,
  toastController,
} from '@ionic/vue';
import { computed, defineComponent, inject, ref, Ref, watch } from 'vue';
import axios from 'axios';
import MessageBox from '@/components/MessageBox.vue';
import { useRouter } from 'vue-router';

export default defineComponent({
  name: 'UploadRoute',
  components: {
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
  },
  setup() {
    const router = useRouter();
    const content: Ref<typeof IonContent | null> = ref(null);
    const msgBox: Ref<typeof MessageBox | null> = ref(null);
    const msgBoxColor = ref('danger');
    const routeNameText = ref('');
    const gradeNumber = ref(0);
    const gradeText = ref('V0');
    const getRouteImageUri: () => Ref<string> = inject('getRouteImageUri', () => ref(''));
    const routeImage = getRouteImageUri();

    const transformDaysAwayToYYYYMMDD = (daysAway: number): string => {
      const date = new Date(new Date().getTime() + daysAway * 24 * 60 * 60 * 1000);
      const mm = date.getMonth() + 1;
      const dd = date.getDate();
      // Format to yyyy-mm-dd;
      return [date.getFullYear(), (mm > 9 ? '' : '0') + mm, (dd > 9 ? '' : '0') + dd].join('-');
    };
    const minRouteExpiry = computed(() => transformDaysAwayToYYYYMMDD(1));
    const maxRouteExpiry = computed(() => transformDaysAwayToYYYYMMDD(90));

    onIonViewDidLeave(() => {
      msgBox.value?.close();
    });

    watch(gradeNumber, () => {
      gradeText.value = 'V' + gradeNumber.value;
    });

    const isValidRouteName = (routeName: string): boolean => {
      return routeName.length > 0 && routeName.length <= 30;
    };

    const showErrorMsg = (errorMsg: string): void => {
      msgBoxColor.value = 'danger';
      msgBox.value?.showMsg(errorMsg);
      content.value?.$el.scrollToTop(400);
    };

    const onSubmit = (event: Event): boolean => {
      event.preventDefault();
      msgBox.value?.close();

      if (!isValidRouteName(routeNameText.value)) {
        showErrorMsg('Route name is invalid');
        return false;
      }

      axios
        .post(process.env.VUE_APP_ROUTE_ENDPOINT_URL + '/route/new', {})
        .then((response) => {
          if (response.data.Message === 'Confirmation success') {
            toastController
              .create({
                header: 'Confirmation successful, please log in',
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

            router.push('/login');
          } else {
            showErrorMsg('Unable to verify: ' + response.data.Message);
          }
        })
        .catch((error) => {
          if (error.response) {
            if (error.response.data.Message === 'CodeMismatchException') {
              showErrorMsg('Wrong confirmation code');
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
    };
    return {
      content,
      onSubmit,
      msgBox,
      msgBoxColor,
      minRouteExpiry,
      maxRouteExpiry,
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
  font-size: 1.5em;
  margin-right: 1.5em;
}
</style>
