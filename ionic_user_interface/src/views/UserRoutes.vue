<template>
  <ion-page>
    <ion-content :fullscreen="true">
      <ion-grid>
        <ion-row class="ion-align-items-center ion-justify-content-center">
          <ion-col class="ion-align-self-center" size-lg="6" size-md="8" size-xs="12">
            <ion-item class="rounded">
              <ion-icon slot="start" :icon="personCircleOutline"></ion-icon>
              <ion-text>{{ usernameText }}</ion-text>
              <ion-icon
                v-if="isLoggedIn"
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
    const usernameText = route.params.username;
    const getLoggedIn: () => Ref<boolean> = inject('getLoggedIn', () => ref(false));
    const isLoggedIn = getLoggedIn();

    // TODO: reportUserHandler

    // TODO: disableUserHandler
    return {
      usernameText,
      personCircleOutline,
      isLoggedIn,
      flagOutline,
    };
  },
});
</script>

<style scoped>
#container {
  text-align: center;
  position: absolute;
  left: 2%;
  right: 2%;
  z-index: -1;
  padding-top: 30px;
}

#container strong {
  font-size: 2em;
  line-height: 2em;
}

#container p {
  font-size: 1.3em;
  line-height: 1.5em;
}

#container a {
  text-decoration: none;
}

.report-icon:hover {
  cursor: pointer;
}
</style>
