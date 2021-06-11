<template>
  <ion-page>
    <Header />
    <ion-content :fullscreen="true">
      <ion-grid>
        <ion-row color="primary" class="ion-align-items-center ion-justify-content-center">
          <ion-col class="ion-align-self-center" size-md="6" size-lg="5" size-xs="12">
            <div class="ion-text-center">
              <h1>Confirm Signup</h1>
            </div>
            <div class="ion-padding ion-text-center">
              <ErrorMessage ref="errorMsg" class="margin" />
              <form @submit="onSubmit">
                <ion-item class="rounded margin">
                  <ion-label position="stacked">Confirmation code</ion-label>
                  <ion-input
                    v-model="confirmationCodeText"
                    name="code"
                    inputmode="numeric"
                    maxlength="6"
                    type="text"
                    autofocus
                    required
                  />
                </ion-item>
                <ion-button
                  id="sendButton"
                  class="send-button"
                  size="medium"
                  type="submit"
                  expand="block"
                >
                  Send
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
} from '@ionic/vue';
import { defineComponent, inject, ref, Ref } from 'vue';
import axios from 'axios';
import Header from '@/components/header/Header.vue';
import ErrorMessage from '@/components/ErrorMessage.vue';
import router from '@/router';
import { onBeforeRouteLeave } from 'vue-router';

export default defineComponent({
  name: 'Confirm',
  components: {
    ErrorMessage,
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
    const errorMsg: Ref<typeof ErrorMessage | null> = ref(null);
    const confirmationCodeText = ref('');
    const getUserEmail: () => Ref<string> = inject('getUserEmail', () => ref(''));
    const setConfirmationNeeded: (confirmationNeeded: boolean) => void = inject(
      'setConfirmationNeeded',
      () => undefined,
    );

    onBeforeRouteLeave(() => {
      errorMsg.value?.closeErrorMsg();
      confirmationCodeText.value = '';
      setConfirmationNeeded(false);
    });

    const isValidConfirmationCode = (code: string): boolean => {
      if (code.length !== 6) {
        return false;
      }
      // Checks if every character is a digit
      for (let i = 0; i < code.length; i++) {
        if (code.charAt(i) < '0' || code.charAt(i) > '9') {
          return false;
        }
      }
      return true;
    };

    const onSubmit = (event: Event): boolean => {
      event.preventDefault();
      errorMsg.value?.closeErrorMsg();

      confirmationCodeText.value = confirmationCodeText.value.trim();

      if (!isValidConfirmationCode(confirmationCodeText.value)) {
        errorMsg.value?.showErrorMsg('Confirmation code must be 6 digits');
        return false;
      }

      axios
        .post(process.env.VUE_APP_USER_ENDPOINT_URL + '/user/confirm', {
          email: getUserEmail().value,
          code: confirmationCodeText.value,
        })
        .then((response) => {
          if (response.data.Message === 'Confirmation success') {
            setConfirmationNeeded(false);
            router.push('/login');
          } else {
            errorMsg.value?.showErrorMsg('Unable to verify: ' + response.data.Message);
          }
        })
        .catch((error) => {
          if (error.response) {
            if (error.response.data.Message === 'CodeMismatchException') {
              errorMsg.value?.showErrorMsg('Wrong confirmation code');
            } else {
              errorMsg.value?.showErrorMsg('Error: ' + error.response.data.Message);
            }
          } else if (error.request) {
            errorMsg.value?.showErrorMsg('Bad request');
          } else {
            errorMsg.value?.showErrorMsg('Error: ' + error.message);
          }
        });

      return true;
    };
    return {
      onSubmit,
      errorMsg,
      confirmationCodeText,
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

.send-button {
  margin-top: 30px;
  margin-bottom: 40px;
}
</style>
