<template>
  <ion-page>
    <ion-content :fullscreen="true">
      <ion-grid>
        <ion-row class="ion-align-items-center ion-justify-content-center">
          <ion-col class="ion-align-self-center" size-lg="6" size-md="8" size-xs="12">
            <div class="page-title">
              <strong>Routes By User</strong>
            </div>
            <ion-item class="rounded">
              <ion-icon
                slot="start"
                class="ion-no-margin global-margin-right"
                :icon="personCircleOutline"
              ></ion-icon>
              <ion-text class="username">{{ profileUsername }}</ion-text>
              <ion-button
                v-if="isLoggedIn && !isOwnself && isAdmin"
                slot="end"
                class="global-margin-left"
                color="danger"
                @click="disableUserHandler"
              >
                <ion-label>Disable&nbsp;</ion-label>
              </ion-button>
            </ion-item>
          </ion-col>
        </ion-row>
        <ion-row class="ion-align-items-center ion-justify-content-center">
          <ion-col class="ion-align-self-center" size-lg="6" size-md="8" size-xs="12">
            <ion-row class="ion-justify-content-center">
              <ion-col class="ion-no-padding">
                <ion-button
                  class="ion-align-self-center ion-no-margin"
                  expand="full"
                  fill="clear"
                  color="dark"
                  @click="sharePostHandler"
                >
                  Share User
                  <ion-icon slot="end" :icon="shareSocialOutline"></ion-icon>
                </ion-button>
              </ion-col>
              <ion-col v-if="isLoggedIn && !isOwnself" class="ion-no-padding">
                <ion-button
                  class="ion-align-self-center ion-no-margin"
                  expand="full"
                  fill="clear"
                  color="dark"
                  @click="reportUserHandler"
                >
                  Report User
                  <ion-icon slot="end" :icon="flagOutline"></ion-icon>
                </ion-button>
              </ion-col>
            </ion-row>
          </ion-col>
        </ion-row>
        <ion-row class="ion-align-items-center ion-justify-content-center">
          <ion-col class="ion-align-self-center" size-lg="6" size-md="8" size-xs="12">
            <user-route-list />
          </ion-col>
        </ion-row>
      </ion-grid>
    </ion-content>
  </ion-page>
</template>

<script lang="ts">
import {
  IonContent,
  IonPage,
  IonGrid,
  IonRow,
  IonCol,
  IonItem,
  IonText,
  IonIcon,
  IonLabel,
  IonButton,
  alertController,
  toastController,
} from '@ionic/vue';
import axios from 'axios';
import { defineComponent, Ref, ref, inject, computed, ComputedRef } from 'vue';
import { personCircleOutline, flagOutline, shareSocialOutline } from 'ionicons/icons';
import { useRoute } from 'vue-router';
import { throttle } from 'lodash';
import { getAlertController } from '@/common/reportUserAlert';
import UserRouteList from '@/components/UserRouteList.vue';
import { shareSocial } from '@/common/shareSocial';

export default defineComponent({
  name: 'UserRoutes',
  components: {
    IonContent,
    IonPage,
    IonGrid,
    IonRow,
    IonCol,
    IonItem,
    IonText,
    IonIcon,
    IonLabel,
    IonButton,
    UserRouteList,
  },
  setup() {
    const route = useRoute();
    const getLoggedIn: () => Ref<boolean> = inject('getLoggedIn', () => ref(false));
    const getAccessToken: () => Ref<string> = inject('getAccessToken', () => ref(''));
    const getUserRole: () => ComputedRef<string> = inject('getUserRole', () => computed(() => ''));
    // Note: Difference between profileUsername and username
    const getUsername: () => Ref<string> = inject('getUsername', () => ref(''));
    const isLoggedIn = getLoggedIn();
    const profileUsername = computed(() => route.params.username as string);
    const isOwnself = computed(() => getUsername().value === profileUsername.value);
    const isAdmin = getUserRole().value === 'admin';

    const reportUserHandler = throttle(async () => {
      const alert = await getAlertController(profileUsername.value, getAccessToken().value);
      return alert.present();
    }, 1000);

    /**
     * Only admins can see this
     */
    const disableUserHandler = throttle(async () => {
      const alert = await alertController.create({
        cssClass: 'wide',
        header: `Disable this user?`,
        message: 'Are you sure?',
        buttons: [
          {
            text: 'Cancel',
            role: 'cancel',
            cssClass: 'secondary',
          },
          {
            text: 'Yes',
            handler: () => {
              axios
                .post(
                  process.env.VUE_APP_USER_ENDPOINT_URL + '/user/disable',
                  {
                    name: profileUsername.value,
                  },
                  {
                    headers: {
                      Authorization: `Bearer ${getAccessToken().value}`,
                    },
                  },
                )
                .then(() => {
                  toastController
                    .create({
                      header: 'User has been successfully disabled',
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
                })
                .catch((error) => {
                  console.error(error);
                  toastController
                    .create({
                      header: 'Failed to disable user, please try again',
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
                });
            },
          },
        ],
      });
      return alert.present();
    }, 1000);

    const sharePostHandler = async () => {
      await shareSocial(route, `Route by ${profileUsername.value}`);
    };

    return {
      profileUsername,
      personCircleOutline,
      isLoggedIn,
      isOwnself,
      flagOutline,
      shareSocialOutline,
      reportUserHandler,
      disableUserHandler,
      isAdmin,
      sharePostHandler,
    };
  },
});
</script>

<style scoped lang="scss">
.page-title {
  text-align: center;
  font-size: clamp(2rem, 7vw, 2.5rem);
  margin: 10px 10px 30px 10px;
}

.username {
  color: var(--ion-color-medium);
}
</style>
