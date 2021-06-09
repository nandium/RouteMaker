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
import { defineComponent, inject, ref, Ref, watch } from 'vue';
import Header from '@/components/header/Header.vue';
import jwt_decode from 'jwt-decode';

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
    const forceLogout: () => void = inject('forceLogout', () => undefined);
    const getUserEmail: () => Ref<string> = inject('getUserEmail', () => ref(''));
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

    watch(idToken, () => {
      usernameText.value = decodeIdToken();
    });

    const clickDeleteAccountButton = (): void => {
      console.log('delete');
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
