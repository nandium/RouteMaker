<template>
  <ion-page>
    <ion-content :fullscreen="true">
      <ion-grid>
        <ion-row color="primary" class="ion-align-items-center ion-justify-content-center">
          <ion-col class="ion-align-self-center" size-md="6" size-lg="5" size-xs="12">
            <div class="ion-text-center">
              <h1>Login</h1>
            </div>
            <div class="ion-padding ion-text-center">
              <MessageBox ref="errorMsg" color="danger" class="rounded" />
              <form @submit="onSubmit">
                <ion-item class="rounded">
                  <ion-label position="stacked">Username</ion-label>
                  <ion-input
                    @keyup.enter="clickLoginButton"
                    v-model="usernameText"
                    inputmode="email"
                    name="email"
                    type="text"
                    enterkeyhint="go"
                    autofocus="true"
                    required
                  />
                </ion-item>
                <ion-item class="rounded">
                  <ion-label position="stacked">Password</ion-label>
                  <ion-input
                    @keyup.enter="clickLoginButton"
                    v-model="passwordText"
                    name="password"
                    type="password"
                    enterkeyhint="go"
                    required
                  />
                </ion-item>
                <ion-button
                  id="loginButton"
                  class="login-button"
                  size="medium"
                  type="submit"
                  expand="block"
                >
                  Login
                </ion-button>
                <h5>
                  Don't have an account?
                  <router-link to="/signup">Sign up</router-link>
                  now!
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
  onIonViewDidLeave,
  toastController,
} from '@ionic/vue';
import { defineComponent, inject, ref, Ref } from 'vue';
import axios from 'axios';
import MessageBox from '@/components/MessageBox.vue';
import { useRouter } from 'vue-router';

export default defineComponent({
  name: 'Login',
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
    // Email validation regex taken from https://stackoverflow.com/questions/46155/how-to-validate-an-email-address-in-javascript
    const usernamePattern = /^[a-zA-Z0-9 ]*$/;
    const setLoggedIn: (loggedIn: boolean) => void = inject('setLoggedIn', () => undefined);
    const setUserEmail: (email: string) => void = inject('setUserEmail', () => undefined);
    const setUsername: (name: string) => void = inject('setUsername', () => undefined);
    const setAccessToken: (accessToken: string) => void = inject('setAccessToken', () => undefined);
    const setRefreshToken: (refreshToken: string) => void = inject(
      'setRefreshToken',
      () => undefined,
    );
    const setIdToken: (idToken: string) => void = inject('setIdToken', () => undefined);
    const setConfirmationNeeded: (confirmationNeeded: boolean) => void = inject(
      'setConfirmationNeeded',
      () => undefined,
    );
    const usernameText = ref('');
    const passwordText = ref('');
    const errorMsg: Ref<typeof MessageBox | null> = ref(null);

    onIonViewDidLeave(() => {
      errorMsg.value?.close();
    });

    const isValidUsername = (username: string): boolean => {
      return username.length >= 5 && username.length <= 20 && usernamePattern.test(username);
    };

    const isValidPassword = (password: string): boolean => {
      return password.length >= 8;
    };

    const onSubmit = (event: Event): boolean => {
      event.preventDefault();
      errorMsg.value?.close();

      usernameText.value = usernameText.value.trim();

      // Invalid credentials
      if (!isValidUsername(usernameText.value)) {
        errorMsg.value?.showMsg(
          'Username has to be between 5 to 20 characters and contains only letters, numbers, and spaces',
        );
        return false;
      }
      if (!isValidPassword(passwordText.value)) {
        errorMsg.value?.showMsg('Password has to be at least 8 characters');
        return false;
      }

      // Valid credentials
      setUsername(usernameText.value);
      axios
        .post(process.env.VUE_APP_USER_ENDPOINT_URL + '/user/login', {
          name: usernameText.value,
          password: passwordText.value,
        })
        .then((response) => {
          // const { AccessToken, ExpiresIn, IdToken, Message, RefreshToken } = response.data;
          setIdToken(response.data.IdToken);
          setAccessToken(response.data.AccessToken);
          setRefreshToken(response.data.RefreshToken);
          setLoggedIn(true);

          toastController
            .create({
              header: 'Logged in successfully',
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

          router.push('/home');
        })
        .catch((error) => {
          if (error.response) {
            // The request was made and the server responded with a status code
            // that falls out of the range of 2xx
            if (error.response.data.Message === 'UserNotFoundException') {
              errorMsg.value?.showMsg('Account not found, please sign up!');
            } else if (error.response.data.Message === 'NotAuthorizedException') {
              errorMsg.value?.showMsg('Wrong email or password');
            } else if (error.response.data.Message === 'UserNotConfirmedException') {
              setConfirmationNeeded(true);
              setUserEmail(error.response.data.Email);
              router.push('/confirm');
            } else {
              console.error(error.response.data);
            }
          } else if (error.request) {
            errorMsg.value?.showMsg('Invalid credentials');
          } else {
            errorMsg.value?.showMsg('Error: ' + error.message);
          }
        });
      return true;
    };

    const clickLoginButton = (): void => {
      document.getElementById('loginButton')?.click();
    };

    return {
      onSubmit,
      clickLoginButton,
      usernameText,
      passwordText,
      errorMsg,
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
