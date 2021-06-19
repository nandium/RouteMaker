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
              <MessageBox ref="errorMsg" color="danger" class="rounded margin" />
              <form @submit.prevent="onSubmit">
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
} from '@ionic/vue';
import { defineComponent, inject, ref, Ref } from 'vue';
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
    const usernamePattern = /^[a-zA-Z0-9 ]*$/;
    const errorMsg: Ref<typeof MessageBox | null> = ref(null);
    const usernameText = ref('');
    const setUsername: (name: string) => void = inject('setUsername', () => undefined);

    onIonViewDidLeave(() => {
      errorMsg.value?.close();
    });

    const isValidUsername = (username: string): boolean => {
      return username.length >= 5 && username.length <= 20 && usernamePattern.test(username);
    };

    const onSubmit = throttle((event: Event): boolean => {
      event.preventDefault();
      errorMsg.value?.close();

      if (!isValidUsername(usernameText.value)) {
        errorMsg.value?.showMsg(
          'Username has to be between 5 to 20 characters and contains only letters, numbers, and spaces',
        );
        return false;
      }

      axios
        .post(process.env.VUE_APP_USER_ENDPOINT_URL + '/user/forgotPassword', {
          name: usernameText.value,
        })
        .then((response) => {
          if (response.data.Message === 'Request password reset success') {
            setUsername(usernameText.value);
            router.push({
              name: 'ResetPassword',
              params: { Destination: response.data.Destination },
            });
          } else {
            errorMsg.value?.showMsg('Unable to verify: ' + response.data.Message);
          }
        })
        .catch((error) => {
          if (error.response) {
            if (error.response.data.Message === 'UserNotFoundException') {
              errorMsg.value?.showMsg('Account not found, please sign up!');
            } else if (error.response.data.Message === 'LimitExceededException') {
              errorMsg.value?.showMsg('Too many attempts');
            } else {
              errorMsg.value?.showMsg('Error: ' + error.response.data.Message);
            }
          } else if (error.request) {
            // Error when user presses enter instead of click, but does not seem to cause an issue
            console.error(error.request);
          } else {
            errorMsg.value?.showMsg('Error: ' + error.message);
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
      errorMsg,
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
