<template>
  <ion-page>
    <ion-content :fullscreen="true">
      <ion-grid>
        <ion-row color="primary" class="ion-align-items-center ion-justify-content-center">
          <ion-col class="ion-align-self-center" size-md="6" size-lg="5" size-xs="12">
            <div class="ion-text-center">
              <h1>Reset Password</h1>
            </div>
            <div class="ion-padding ion-text-center">
              <MessageBox ref="msgBox" :color="msgBoxColor" class="global-rounded margin" />
              <form @submit="onSubmit">
                <ion-item class="global-rounded margin">
                  <ion-label position="stacked">Username</ion-label>
                  <ion-input v-model="usernameText" type="text" disabled />
                </ion-item>
                <ion-item class="global-rounded margin">
                  <ion-label position="stacked">Reset code</ion-label>
                  <ion-input
                    @keyup.enter="clickResetPasswordButton"
                    v-model="passwordResetCodeText"
                    name="passwordResetCode"
                    inputmode="numeric"
                    maxlength="6"
                    type="text"
                    autofocus
                    required
                  />
                </ion-item>
                <div class="margin-less">
                  <ion-item class="global-rounded">
                    <ion-label position="stacked">New password</ion-label>
                    <ion-input
                      @keyup.enter="clickResetPasswordButton"
                      v-model="passwordText"
                      name="password"
                      type="password"
                      required
                    />
                  </ion-item>
                  <ion-row>
                    <ion-col class="ion-align-self-start">
                      <password-meter @score="onPasswordScore" :password="passwordText" />
                    </ion-col>
                    <ion-col size="auto" class="password-strength">
                      {{ passwordStrength }}
                    </ion-col>
                  </ion-row>
                </div>
                <ion-item class="global-rounded margin">
                  <ion-label position="stacked">Retype new password</ion-label>
                  <ion-input
                    @keyup.enter="clickResetPasswordButton"
                    v-model="confirmPasswordText"
                    name="confirmpassword"
                    type="password"
                    required
                  />
                </ion-item>
                <ion-button
                  id="resetPasswordButton"
                  class="reset-password-button"
                  size="medium"
                  type="submit"
                  expand="block"
                >
                  Reset Password
                </ion-button>
                <ion-button
                  id="resendButton"
                  class="resend-button"
                  size="medium"
                  expand="block"
                  fill="clear"
                  @click="resendPasswordResetCode"
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
import { defineComponent, inject, ref, Ref, watch, onMounted } from 'vue';
import axios from 'axios';
import PasswordMeter from 'vue-simple-password-meter';
import MessageBox from '@/components/MessageBox.vue';
import { useRouter, useRoute } from 'vue-router';
import { throttle } from 'lodash';

export default defineComponent({
  name: 'ResetPassword',
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
    PasswordMeter,
  },
  setup() {
    const router = useRouter();
    const route = useRoute();
    const msgBox: Ref<typeof MessageBox | null> = ref(null);
    const msgBoxColor = ref('danger');
    const usernameText = ref('');
    const passwordResetCodeText = ref('');
    const passwordText = ref('');
    const confirmPasswordText = ref('');
    const passwordStrength = ref('');
    const getUsername: () => Ref<string> = inject('getUsername', () => ref(''));

    onIonViewDidLeave(() => {
      msgBox.value?.close();
    });

    onMounted(() => {
      usernameText.value = getUsername().value;
      msgBoxColor.value = 'medium';
      if (route.params.Destination) {
        msgBox.value?.showMsg(`A password reset code has been sent to ${route.params.Destination}`);
      }
    });

    const onPasswordScore = (payload: { score: number; strength: string }): void => {
      if (passwordText.value.length === 0) {
        passwordStrength.value = '';
      } else {
        passwordStrength.value =
          payload.strength.charAt(0).toUpperCase() + payload.strength.slice(1);
      }
    };

    watch(passwordText, () => {
      if (passwordText.value.length == 0) {
        passwordStrength.value = '';
      }
    });

    const isValidPasswordResetCode = (code: string): boolean => {
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

    const isValidPassword = (password: string): boolean => {
      return password.length >= 8;
    };

    const resendPasswordResetCode = throttle(async (): Promise<void> => {
      msgBox.value?.close();
      try {
        const response = await axios.post(
          process.env.VUE_APP_USER_ENDPOINT_URL + '/v1/user/forgotPassword',
          {
            name: usernameText.value,
          },
        );
        if (response.data.Message === 'Request password reset success') {
          msgBoxColor.value = 'medium';
          msgBox.value?.showMsg(
            `A password reset code has been sent to ${response.data.Destination}`,
          );
        } else {
          msgBox.value?.showMsg('Unable to verify: ' + response.data.Message);
        }
      } catch (error) {
        if (error.response) {
          msgBox.value?.showMsg('Error: ' + error.response.data.Message);
        } else if (error.request) {
          msgBox.value?.showMsg('Bad request');
        } else {
          msgBox.value?.showMsg('Error: ' + error.message);
        }
      }
    }, 1000);

    const onSubmit = throttle((event: Event): boolean => {
      event.preventDefault();
      msgBox.value?.close();
      msgBoxColor.value = 'danger';

      if (!isValidPasswordResetCode(passwordResetCodeText.value)) {
        msgBox.value?.showMsg('Password reset code must be 6 digits');
        return false;
      }
      if (!isValidPassword(passwordText.value)) {
        msgBox.value?.showMsg('Password has to be at least 8 characters');
        return false;
      }
      if (passwordText.value !== confirmPasswordText.value) {
        msgBox.value?.showMsg('Passwords do not match');
        return false;
      }

      axios
        .post(process.env.VUE_APP_USER_ENDPOINT_URL + '/v1/user/resetPassword', {
          name: usernameText.value,
          password: passwordText.value,
          code: passwordResetCodeText.value,
        })
        .then((response) => {
          if (response.data.Message === 'Password reset success') {
            toastController
              .create({
                header: 'Password reset success!',
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
            if (
              error.response.data.Message === 'ExpiredCodeException' ||
              error.response.data.Message === 'CodeMismatchException'
            ) {
              msgBox.value?.showMsg('Wrong password reset code');
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

    const clickResetPasswordButton = (): void => {
      document.getElementById('resetPasswordButton')?.click();
    };

    return {
      clickResetPasswordButton,
      resendPasswordResetCode,
      onSubmit,
      msgBox,
      msgBoxColor,
      usernameText,
      passwordResetCodeText,
      passwordText,
      confirmPasswordText,
      onPasswordScore,
      passwordStrength,
    };
  },
});
</script>

<style scoped lang="scss">
.margin {
  margin-bottom: 1.4em;
}

.reset-password-button {
  margin-top: 30px;
  margin-bottom: 10px;
}

.resend-button {
  margin-bottom: 40px;
}
</style>
