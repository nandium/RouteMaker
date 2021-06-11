<template>
  <ion-page>
    <Header />
    <ion-content :fullscreen="true">
      <ion-grid>
        <ion-row color="primary" class="ion-align-items-center ion-justify-content-center">
          <ion-col class="ion-align-self-center" size-md="6" size-lg="5" size-xs="12">
            <div class="ion-text-center">
              <h1>Sign up</h1>
            </div>
            <div class="ion-padding ion-text-center">
              <ErrorMessage ref="errorMsg" class="margin" />
              <form @submit="onSubmit">
                <ion-item class="rounded margin">
                  <ion-label position="stacked">Email</ion-label>
                  <ion-input
                    @keyup.enter="clickSignupButton"
                    v-model="emailText"
                    name="email"
                    type="text"
                    autofocus
                    required
                  />
                </ion-item>
                <ion-item class="rounded margin">
                  <ion-label position="stacked">Username</ion-label>
                  <ion-input
                    @keyup.enter="clickSignupButton"
                    v-model="usernameText"
                    name="username"
                    type="username"
                    required
                  />
                </ion-item>
                <div class="margin-less">
                  <ion-item class="rounded">
                    <ion-label position="stacked">Password</ion-label>
                    <ion-input
                      @keyup.enter="clickSignupButton"
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
                <ion-item class="rounded margin">
                  <ion-label position="stacked">Retype password</ion-label>
                  <ion-input
                    @keyup.enter="clickSignupButton"
                    v-model="confirmPasswordText"
                    name="confirmpassword"
                    type="password"
                    required
                  />
                </ion-item>
                <ion-button
                  id="signupButton"
                  class="form-button"
                  size="medium"
                  type="submit"
                  expand="block"
                >
                  Sign up
                </ion-button>
                <h5>
                  Already have an account?
                  <router-link to="/login">Login</router-link>
                  here!
                </h5>
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
import { defineComponent, inject, ref, Ref, watch } from 'vue';
import axios from 'axios';
import PasswordMeter from 'vue-simple-password-meter';
import Header from '@/components/header/Header.vue';
import ErrorMessage from '@/components/ErrorMessage.vue';
import router from '@/router';

export default defineComponent({
  name: 'Signup',
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
    PasswordMeter,
  },
  setup() {
    // Email validation regex taken from https://stackoverflow.com/questions/46155/how-to-validate-an-email-address-in-javascript
    const emailPattern =
      /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    const usernamePattern = /^[a-zA-Z0-9 ]*$/;
    const getUserEmail: () => Ref<string> = inject('getUserEmail', () => ref(''));
    const setUserEmail: (email: string) => void = inject('setUserEmail', () => undefined);
    const setConfirmationNeeded: (confirmationNeeded: boolean) => void = inject(
      'setConfirmationNeeded',
      () => undefined,
    );
    const emailText = ref('');
    const usernameText = ref('');
    const passwordText = ref('');
    const passwordStrength = ref('');
    const confirmPasswordText = ref('');
    const errorMsg: Ref<typeof ErrorMessage | null> = ref(null);

    const isValidEmail = (email: string): boolean => {
      return emailPattern.test(email.toLowerCase());
    };

    const isValidPassword = (password: string): boolean => {
      return password.length >= 8;
    };

    const isValidUsername = (username: string): boolean => {
      return username.length >= 5 && usernamePattern.test(username);
    };

    const onSubmit = (event: Event): boolean => {
      event.preventDefault();
      errorMsg.value?.closeErrorMsg();

      emailText.value = emailText.value.trim();
      usernameText.value = usernameText.value.trim();

      // Invalid credentials
      if (!isValidEmail(emailText.value)) {
        errorMsg.value?.showErrorMsg('Invalid email');
        return false;
      }
      if (!isValidUsername(usernameText.value)) {
        errorMsg.value?.showErrorMsg(
          'Username has to be at least 5 characters and contain only letters, numbers, and spaces',
        );
        return false;
      }
      if (!isValidPassword(passwordText.value)) {
        errorMsg.value?.showErrorMsg('Password has to be at least 8 characters');
        return false;
      }
      if (passwordText.value !== confirmPasswordText.value) {
        errorMsg.value?.showErrorMsg('Passwords do not match');
        return false;
      }

      // Valid credentials
      setUserEmail(emailText.value);
      axios
        .post(process.env.VUE_APP_USER_ENDPOINT_URL + '/user/signup', {
          name: usernameText.value,
          email: getUserEmail().value,
          password: passwordText.value,
        })
        .then((response) => {
          if (response.data.Message === 'Sign up success') {
            errorMsg.value?.closeErrorMsg();
            setConfirmationNeeded(true);
            router.push('/confirm');
          } else {
            errorMsg.value?.showErrorMsg('Unable to sign up: ' + response.data.Message);
          }
        })
        .catch((error) => {
          if (error.response) {
            // The request was made and the server responded with a status code
            // that falls out of the range of 2xx
            if (error.response.data.Message === 'UsernameExistsException') {
              errorMsg.value?.showErrorMsg('Account already exists, please login!');
            } else {
              console.log(error.response.data);
            }
          } else if (error.request) {
            errorMsg.value?.showErrorMsg('Unknown error occured');
            console.log(error.request);
          } else {
            // Something happened in setting up the request that triggered an Error
            errorMsg.value?.showErrorMsg('Error: ' + error.message);
          }
        });

      return true;
    };

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

    const clickSignupButton = (): void => {
      document.getElementById('signupButton')?.click();
    };

    const clickSendButton = (): void => {
      document.getElementById('sendButton')?.click();
    };

    return {
      onSubmit,
      clickSignupButton,
      clickSendButton,
      emailText,
      usernameText,
      passwordText,
      confirmPasswordText,
      onPasswordScore,
      passwordStrength,
      errorMsg,
    };
  },
});
</script>

<style scoped>
.password-strength {
  font-size: 0.9em;
}

.rounded {
  border-radius: 5px;
}

.margin {
  margin-bottom: 1.4em;
}

.margin-less {
  margin-bottom: 0.2em;
}

.signup-button {
  margin-top: 30px;
  margin-bottom: 40px;
}
</style>
