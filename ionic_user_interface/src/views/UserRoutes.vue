<template>
  <ion-page>
    <ion-content :fullscreen="true">
      <ion-grid>
        <ion-row class="ion-align-items-center ion-justify-content-center">
          <ion-col class="ion-align-self-center" size-lg="6" size-md="8" size-xs="12">
            <div class="page-title">
              <b>Routes By User</b>
            </div>
            <ion-item class="rounded">
              <ion-icon slot="start" :icon="personCircleOutline"></ion-icon>
              <ion-text>{{ profileUsername }}</ion-text>
              <ion-icon
                v-if="isLoggedIn && !isOwnself"
                class="report-icon"
                slot="end"
                color="danger"
                :icon="flagOutline"
                @click="reportUserHandler"
              ></ion-icon>
            </ion-item>
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
} from '@ionic/vue';
import { defineComponent, Ref, ref, inject } from 'vue';
import { personCircleOutline, flagOutline } from 'ionicons/icons';
import { useRoute } from 'vue-router';
import { throttle } from 'lodash';
import { getAlertController } from '@/common/reportUserAlert';
import UserRouteList from '@/components/UserRouteList.vue';

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
    UserRouteList,
    IonIcon,
  },
  setup() {
    const route = useRoute();
    const { username: profileUsername } = route.params;
    const getLoggedIn: () => Ref<boolean> = inject('getLoggedIn', () => ref(false));
    const getAccessToken: () => Ref<string> = inject('getAccessToken', () => ref(''));
    const getUsername: () => Ref<string> = inject('getUsername', () => ref(''));
    const isLoggedIn = getLoggedIn();
    const isOwnself = getUsername().value === profileUsername;

    const reportUserHandler = throttle(async () => {
      const alert = await getAlertController(profileUsername as string, getAccessToken().value);
      return alert.present();
    }, 1000);

    // TODO: disableUserHandler
    return {
      profileUsername,
      personCircleOutline,
      isLoggedIn,
      isOwnself,
      flagOutline,
      reportUserHandler,
    };
  },
});
</script>

<style scoped>
.report-icon:hover {
  cursor: pointer;
}

.page-title {
  text-align: center;
  font-size: clamp(2rem, 7vw, 2.5rem);
  margin: 10px 10px 30px 10px;
}
</style>
