<template>
  <ion-page>
    <ion-content :fullscreen="true">
      <ion-grid>
        <ion-row color="primary" class="ion-align-items-center ion-justify-content-center">
          <ion-col class="ion-align-self-center" size-md="6" size-lg="5" size-xs="12">
            <div class="ion-text-center page-title">
              <strong>Profile</strong>
            </div>
            <div class="ion-padding ion-text-center">
              <ion-item class="global-rounded margin">
                <ion-label position="stacked">Email</ion-label>
                <ion-input v-model="emailText" type="text" disabled />
              </ion-item>
              <ion-item class="global-rounded margin">
                <ion-label position="stacked">Username</ion-label>
                <ion-input v-model="usernameText" type="text" disabled />
              </ion-item>
              <ion-item class="global-rounded margin" lines="full">
                <ion-icon v-if="prefersDarkMode" slot="start" :icon="moon"></ion-icon>
                <ion-icon v-if="!prefersDarkMode" slot="start" :icon="sunny"></ion-icon>
                <ion-label>Toggle Dark Theme</ion-label>
                <ion-toggle
                  @ionChange="toggleTheme"
                  :checked="prefersDarkMode"
                  slot="end"
                ></ion-toggle>
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
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonPage,
  IonRow,
  IonToggle,
  toastController,
} from '@ionic/vue';
import { ToggleChangeEventDetail } from '@ionic/core/dist/types/interface';
import { sunny, moon } from 'ionicons/icons';
import { computed, defineComponent, inject, ref, Ref } from 'vue';
import { useRouter } from 'vue-router';
import jwt_decode from 'jwt-decode';
import axios from 'axios';
import { throttle } from 'lodash';

export default defineComponent({
  name: 'Profile',
  components: {
    IonButton,
    IonCol,
    IonContent,
    IonGrid,
    IonIcon,
    IonInput,
    IonItem,
    IonLabel,
    IonPage,
    IonRow,
    IonToggle,
  },
  setup() {
    const router = useRouter();
    const forceLogout: () => Promise<void> = inject('forceLogout', () => Promise.resolve());
    const getUsername: () => Ref<string> = inject('getUsername', () => ref(''));
    const getAccessToken: () => Ref<string> = inject('getAccessToken', () => ref(''));
    const getIdToken: () => Ref<string> = inject('getIdToken', () => ref(''));
    const usernameText = getUsername();
    const idToken = getIdToken();
    const emailText = computed(() => {
      if (idToken.value === '') {
        return '';
      }
      try {
        const idObject: {
          email: string;
        } = jwt_decode(idToken.value);
        return idObject.email;
      } catch (error) {
        console.error(error);
        forceLogout();
      }
      return '';
    });

    const setPrefersDarkMode: (darkMode: boolean) => void = inject(
      'setPrefersDarkMode',
      () => undefined,
    );
    const getPrefersDarkMode: () => Ref<boolean> = inject('getPrefersDarkMode', () => ref(false));
    const prefersDarkMode = getPrefersDarkMode();

    const toggleTheme = (event: CustomEvent<ToggleChangeEventDetail>) => {
      setPrefersDarkMode(event.detail.checked);
    };

    const showFailedToDeleteAccountToast = (): void => {
      toastController
        .create({
          header: 'Failed to delete account. Please login and try again',
          position: 'bottom',
          color: 'danger',
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
    };

    const clickDeleteAccountButton = async (): Promise<void> => {
      const alert = await alertController.create({
        header: 'Are you sure?',
        message:
          'This action cannot be undone. <br/><br/> Once your account is deleted, you will be unable to access and modify your uploaded routes.',
        buttons: [
          {
            text: 'Cancel',
            role: 'cancel',
          },
          {
            text: 'Delete',
            cssClass: 'global-danger-text',
            handler: throttle(async () => {
              await axios
                .delete(process.env.VUE_APP_USER_ENDPOINT_URL + '/user/delete', {
                  headers: {
                    Authorization: `Bearer ${getAccessToken().value}`,
                  },
                })
                .then(async (response) => {
                  if (response.status === 204) {
                    await forceLogout();

                    toastController
                      .create({
                        header: 'Account deleted successfully',
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

                    router.push({ name: 'Explore' });
                  } else {
                    showFailedToDeleteAccountToast();
                  }
                })
                .catch((error) => {
                  if (error.response) {
                    // The request was made and the server responded with a status code
                    // that falls out of the range of 2xx
                    console.error(error.response.data);
                  } else if (error.request) {
                    // The request was made but no response was received
                    // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
                    // http.ClientRequest in node.js
                    console.error(error.request);
                  } else {
                    // Something happened in setting up the request that triggered an Error
                    console.error('Error', error.message);
                  }
                  showFailedToDeleteAccountToast();
                });
            }, 1000),
          },
        ],
      });
      return alert.present();
    };

    return {
      sunny,
      moon,
      prefersDarkMode,
      emailText,
      usernameText,
      toggleTheme,
      clickDeleteAccountButton,
    };
  },
});
</script>

<style scoped lang="scss">
.margin {
  margin-bottom: 1.2em;
}

.login-button {
  margin-top: 30px;
  margin-bottom: 40px;
}

.page-title {
  font-size: clamp(2rem, 7vw, 2.5rem);
  line-height: 2em;
}
</style>
