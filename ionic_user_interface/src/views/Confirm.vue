<template>
  <ion-page>
    <ion-content :fullscreen="true">
      <ion-grid>
        <ion-row color="primary" class="ion-align-items-center ion-justify-content-center">
          <ion-col class="ion-align-self-center" size-md="6" size-lg="5" size-xs="12">
            <div class="ion-text-center">
              <h1>Confirm Signup</h1>
            </div>
            <div class="ion-padding ion-text-center">
              <MessageBox ref="msgBox" :color="msgBoxColor" class="global-rounded margin" />
              <form @submit="onSubmit">
                <ion-item class="global-rounded margin">
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
                  id="confirmButton"
                  class="confirm-button"
                  size="medium"
                  type="submit"
                  expand="block"
                >
                  Confirm
                </ion-button>
                <ion-button
                  id="resendButton"
                  class="resend-button"
                  size="medium"
                  expand="block"
                  fill="clear"
                  @click="resendConfirmationCode(false)"
                >
                  Resend Code
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
import { defineComponent, inject, onMounted, ref, Ref } from 'vue';
import axios from 'axios';
import MessageBox from '@/components/MessageBox.vue';
import { useRouter } from 'vue-router';
import { throttle } from 'lodash';

export default defineComponent({
  name: 'Confirm',
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
    const confirmationCodeText = ref('');
    const getUsername: () => Ref<string> = inject('getUsername', () => ref(''));
    const getUserEmail: () => Ref<string> = inject('getUserEmail', () => ref(''));
    const setConfirmationNeeded: (confirmationNeeded: boolean) => void = inject(
      'setConfirmationNeeded',
      () => undefined,
    );

    onIonViewDidLeave(() => {
      msgBox.value?.close();
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

    onMounted(() => {
      msgBoxColor.value = 'medium';
      msgBox.value?.showMsg(`A confirmation code has been sent to ${getUserEmail().value}`);
    });

    const resendConfirmationCode = throttle(async (isExpired: boolean): Promise<void> => {
      msgBox.value?.close();
      try {
        const {
          data: { Message },
        } = await axios.post(process.env.VUE_APP_USER_ENDPOINT_URL + '/v1/user/resendCode', {
          name: getUsername().value,
        });
        if (Message === 'Resend code success') {
          if (isExpired) {
            msgBox.value?.showMsg(
              `Confirmation code has expired. It has been resent to ${getUserEmail().value}`,
            );
          } else {
            msgBox.value?.showMsg(`A confirmation code has been sent to ${getUserEmail().value}`);
          }
        }
      } catch (error) {
        // This should never occur because only successful signup and unconfirmed login will route to this page
        if (error.response.data.Message === 'UserNotFoundException') {
          msgBox.value?.showMsg(`Account not found, please sign up!`);
        } else {
          msgBox.value?.showMsg('Error: ' + error.response.data.Message);
        }
      }
    }, 1000);

    const onSubmit = throttle((event: Event): boolean => {
      event.preventDefault();
      msgBox.value?.close();
      msgBoxColor.value = 'danger';

      confirmationCodeText.value = confirmationCodeText.value.trim();

      if (!isValidConfirmationCode(confirmationCodeText.value)) {
        msgBox.value?.showMsg('Confirmation code must be 6 digits');
        return false;
      }

      axios
        .post(process.env.VUE_APP_USER_ENDPOINT_URL + '/v1/user/confirm', {
          name: getUsername().value,
          code: confirmationCodeText.value,
        })
        .then((response) => {
          if (response.data.Message === 'Confirmation success') {
            setConfirmationNeeded(false);

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

            router.push({ name: 'Login' });
          } else {
            msgBox.value?.showMsg('Unable to verify: ' + response.data.Message);
          }
        })
        .catch((error) => {
          if (error.response) {
            if (error.response.data.Message === 'CodeMismatchException') {
              msgBox.value?.showMsg('Wrong confirmation code');
            } else if (error.response.data.Message === 'ExpiredCodeException') {
              resendConfirmationCode(true);
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

    return {
      onSubmit,
      msgBox,
      msgBoxColor,
      confirmationCodeText,
      resendConfirmationCode,
    };
  },
});
</script>

<style scoped lang="scss">
.margin {
  margin-bottom: 1.4em;
}

.confirm-button {
  margin-top: 30px;
  margin-bottom: 10px;
}

.resend-button {
  margin-bottom: 40px;
}
</style>
