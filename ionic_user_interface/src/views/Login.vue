<template>
  <ion-page>
    <Header />
    <ion-content :fullscreen="true">
      <ion-grid>
        <ion-row color="primary" class="ion-align-items-center ion-justify-content-center">
          <ion-col class="ion-align-self-center" size-md="6" size-lg="5" size-xs="12">
            <div class="ion-text-center">
              <h1>Login</h1>
            </div>
            <div class="ion-padding ion-text-center">
              <ErrorMessage ref="errorMsg" />
              <form @submit="onSubmit">
                <ion-item class="rounded">
                  <ion-label position="stacked">Email</ion-label>
                  <ion-input
                    @keyup.enter="clickLoginButton"
                    v-model="emailText"
                    inputmode="email"
                    name="email"
                    type="text"
                    enterkeyhint="go"
                    autofocus
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
import { closeCircleOutline } from 'ionicons/icons';
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
import { defineComponent, inject, ref, Ref, onBeforeUpdate } from 'vue';
import axios from 'axios';
import Header from '@/components/Header.vue';
import ErrorMessage from '@/components/ErrorMessage.vue';
import router from '@/router';

export default defineComponent({
  name: 'About',
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
    // Email validation regex taken from https://stackoverflow.com/questions/46155/how-to-validate-an-email-address-in-javascript
    const emailPattern =
      /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    const isLoggedIn: Ref<boolean> | undefined = inject('isLoggedIn');
    const emailText = ref('');
    const passwordText = ref('');
    const errorMsg: Ref<typeof ErrorMessage | null> = ref(null);

    onBeforeUpdate(() => {
      // Redirect to home if already logged in
      if (isLoggedIn && isLoggedIn.value === true) {
        router.push('/home');
      }
    });

    const isValidEmail = (email: string): boolean => {
      return emailPattern.test(email.toLowerCase());
    };

    const isValidPassword = (password: string): boolean => {
      return password.length >= 8;
    };

    const onSubmit = (event: Event): boolean => {
      event.preventDefault();
      errorMsg.value?.closeErrorMsg();

      // Invalid credentials
      if (!isValidEmail(emailText.value)) {
        errorMsg.value?.showErrorMsg('Invalid email');
        return false;
      }
      if (!isValidPassword(passwordText.value)) {
        errorMsg.value?.showErrorMsg('Password has to be at least 8 characters');
        return false;
      }

      // Valid credentials
      axios
        .post(process.env.VUE_APP_USER_ENDPOINT_URL + '/user/signup', {
          email: emailText.value,
          password: passwordText.value,
        })
        .then((response) => {
          console.log(response);
          if (isLoggedIn) {
            isLoggedIn.value = true;
          }
        })
        .catch(() => {
          errorMsg.value?.showErrorMsg('Wrong email or password');
        });
      return true;
    };

    const clickLoginButton = (): void => {
      document.getElementById('loginButton')?.click();
    };

    return {
      onSubmit,
      clickLoginButton,
      emailText,
      passwordText,
      errorMsg,
      closeCircleOutline,
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
