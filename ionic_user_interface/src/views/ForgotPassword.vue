<template>
  <ion-page>
    <ion-content :fullscreen="true">
      <ion-grid>
        <ion-row color="primary" class="ion-align-items-center ion-justify-content-center">
          <ion-col class="ion-align-self-center" size-md="6" size-lg="5" size-xs="12">
            <div class="ion-text-center">
              <h1>Forgot Password</h1>
            </div>
            <div class="ion-padding ion-text-center">
              <MessageBox ref="msgBox" :color="msgBoxColor" class="rounded margin" />
              <form @submit="onSubmit">
                <ion-item class="rounded margin">
                  <ion-label position="stacked">Username</ion-label>
                  <ion-input
                    @keyup.enter="clickEmailButton"
                    v-model="usernameText"
                    inputmode="text"
                    name="username"
                    type="text"
                    autofocus="true"
                    required
                  />
                </ion-item>
                <ion-button
                  id="emailButton"
                  class="email-button"
                  size="medium"
                  type="submit"
                  expand="block"
                >
                  Email Reset Code
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
  IonGrid,
  IonInput,
  IonItem,
  IonLabel,
  IonPage,
  IonRow,
  onIonViewDidLeave,
  toastController,
} from '@ionic/vue';
import { defineComponent, ref, Ref } from 'vue';
import axios from 'axios';
import MessageBox from '@/components/MessageBox.vue';
import { useRouter } from 'vue-router';
import { throttle } from 'lodash';

export default defineComponent({
  name: 'ForgotPassword',
  components: {
    MessageBox,
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
    const router = useRouter();
    const msgBox: Ref<typeof MessageBox | null> = ref(null);
    const msgBoxColor = ref('danger');
    const usernameText = ref('');

    onIonViewDidLeave(() => {
      msgBox.value?.close();
    });

    const onSubmit = throttle((event: Event): boolean => {
      event.preventDefault();
      msgBox.value?.close();
      msgBoxColor.value = 'danger';

      axios
        .post(process.env.VUE_APP_USER_ENDPOINT_URL + '/user/forgotPassword', {
          name: usernameText.value,
        })
        .then((response) => {
          if (response.data.Message === 'Request password reset success') {
            toastController
              .create({
                header: 'If the user exists, the password reset code has been emailed',
                position: 'bottom',
                color: 'medium',
                duration: 5000,
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
            msgBox.value?.showMsg('Unable to verify: ' + response.data.Message);
          }
        })
        .catch((error) => {
          if (error.response) {
            if (error.response.data.Message === 'UserNotFoundException') {
              msgBox.value?.showMsg('Account not found, please sign up!');
            } else {
              msgBox.value?.showMsg('Error: ' + error.response.data.Message);
            }
          } else if (error.request) {
            msgBox.value?.showMsg('Bad request');
          } else {
            msgBox.value?.showMsg('Error: ' + error.message);
          }
        });

      return true;
    }, 1000);

    const clickEmailButton = (): void => {
      document.getElementById('emailButton')?.click();
    };

    return {
      clickEmailButton,
      onSubmit,
      msgBox,
      msgBoxColor,
      usernameText,
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

.email-button {
  margin-top: 30px;
  margin-bottom: 10px;
}
</style>
