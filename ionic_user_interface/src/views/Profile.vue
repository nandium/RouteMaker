<template>
  <ion-page>
    <Header />
    <ion-content :fullscreen="true">
      <ion-grid>
        <ion-row color="primary" class="ion-align-items-center ion-justify-content-center">
          <ion-col class="ion-align-self-center" size-md="6" size-lg="5" size-xs="12">
            <div class="ion-text-center">
              <h1>Profile</h1>
            </div>
            <div class="ion-padding ion-text-center">
              <ion-item class="rounded">
                <ion-label position="stacked">Email</ion-label>
                <ion-input v-model="emailText" type="text" disabled />
              </ion-item>
              <ion-item class="rounded">
                <ion-label position="stacked">Username</ion-label>
                <ion-input v-model="usernameText" type="text" disabled />
              </ion-item>
              <ion-button
                class="delete-account-button"
                size="medium"
                expand="block"
                color="danger"
                @click="clickDeleteAccountButton"
              >
                Delete Account
              </ion-button>
            </div>
          </ion-col>
        </ion-row>
      </ion-grid>
    </ion-content>
  </ion-page>
</template>

<script lang="ts">
import {
  alertController,
  IonButton,
  IonCol,
  IonContent,
  IonGrid,
  IonInput,
  IonItem,
  IonLabel,
  IonPage,
  IonRow,
} from '@ionic/vue';
import { defineComponent, inject, ref, Ref } from 'vue';
import Header from '@/components/header/Header.vue';
import router from '@/router';
import jwt_decode from 'jwt-decode';
import axios from 'axios';

export default defineComponent({
  name: 'Profile',
  components: {
    Header,
    IonButton,
    IonCol,
    IonContent,
    IonGrid,
    IonInput,
    IonItem,
    IonLabel,
    IonPage,
    IonRow,
  },
  setup() {
    const forceLogout: () => Promise<void> = inject('forceLogout', () => Promise.resolve());
    const getUserEmail: () => Ref<string> = inject('getUserEmail', () => ref(''));
    const getAccessToken: () => Ref<string> = inject('getAccessToken', () => ref(''));
    const getIdToken: () => Ref<string> = inject('getIdToken', () => ref(''));
    const emailText = getUserEmail();
    const idToken = getIdToken();
    const decodeIdToken = (): string => {
      try {
        const idObject: {
          name: string;
          email: string;
        } = jwt_decode(idToken.value);
        return idObject.name;
      } catch (error) {
        console.error(error);
        forceLogout();
      }
      return '';
    };
    const usernameText = ref(decodeIdToken());

    const clickDeleteAccountButton = async (): Promise<void> => {
      const alert = await alertController.create({
        header: 'Delete account?',
        subHeader: 'This action cannot be undone.',
        message: 'Are you sure?',
        buttons: [
          {
            text: 'Cancel',
            role: 'cancel',
          },
          {
            text: 'Delete',
            cssClass: 'ion-color-danger',
            handler: async () => {
              await axios
                .delete(process.env.VUE_APP_USER_ENDPOINT_URL + '/user/delete', {
                  headers: {
                    Authorization: `Bearer ${getAccessToken().value}`,
                  },
                })
                .then(async (response) => {
                  if (response.status === 204) {
                    await forceLogout();
                    router.push('/home');
                  }
                })
                .catch((error) => {
                  if (error.response) {
                    // The request was made and the server responded with a status code
                    // that falls out of the range of 2xx
                    console.log(error.response.data);
                    console.log(error.response.status);
                    console.log(error.response.headers);
                  } else if (error.request) {
                    // The request was made but no response was received
                    // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
                    // http.ClientRequest in node.js
                    console.log(error.request);
                  } else {
                    // Something happened in setting up the request that triggered an Error
                    console.log('Error', error.message);
                  }
                  console.log(error.config);
                });
            },
          },
        ],
      });
      return alert.present();
    };

    return {
      emailText,
      usernameText,
      clickDeleteAccountButton,
    };
  },
});
</script>

<style scoped>
.rounded {
  margin-bottom: 1.2em;
  border-radius: 5px;
}

.login-button {
  margin-top: 30px;
  margin-bottom: 40px;
}
</style>
