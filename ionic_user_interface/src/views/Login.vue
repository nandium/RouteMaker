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
              <ion-item class="rounded error-message" color="danger" v-if="showErrorMsg">
                <ion-label>
                  {{ errorMsg }}
                </ion-label>
                <ion-button fill="clear" color="dark" shape="round" @click="clickCloseErrorMsg">
                  <ion-icon :icon="closeCircleOutline"></ion-icon>
                </ion-button>
              </ion-item>
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
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonPage,
  IonRow,
} from '@ionic/vue';
import { defineComponent, inject, ref, Ref, onBeforeUpdate } from 'vue';
import Header from '../components/Header.vue';
import router from '@/router';

export default defineComponent({
  name: 'About',
  components: {
    IonButton,
    IonCol,
    IonContent,
    IonGrid,
    IonIcon,
    IonInput,
    IonItem,
    IonLabel,
    IonPage,
    IonRow,
    Header,
  },
  setup() {
    // Email validation regex taken from https://stackoverflow.com/questions/46155/how-to-validate-an-email-address-in-javascript
    const emailPattern =
      /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    const isLoggedIn: Ref<boolean> | undefined = inject('isLoggedIn');
    const emailText = ref('');
    const passwordText = ref('');
    const showErrorMsg = ref(false);
    const errorMsg = ref('');

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
      // Check credentials
      if (!isValidEmail(emailText.value)) {
        errorMsg.value = 'Invalid email.';
        showErrorMsg.value = true;
        return false;
      }
      if (!isValidPassword(passwordText.value)) {
        errorMsg.value = 'Password has to be at least 8 characters.';
        showErrorMsg.value = true;
        return false;
      }
      // Valid credentials
      if (isLoggedIn) {
        isLoggedIn.value = true;
      }
      return true;
    };

    const clickCloseErrorMsg = (): void => {
      showErrorMsg.value = false;
    };

    const clickLoginButton = (): void => {
      document.getElementById('loginButton')?.click();
    };

    return {
      onSubmit,
      clickLoginButton,
      clickCloseErrorMsg,
      emailText,
      passwordText,
      showErrorMsg,
      errorMsg,
      closeCircleOutline,
    };
  },
});
</script>

<style scoped>
@keyframes popIn {
  0% {
    opacity: 0;
    transform: scale(1, 0.1) translateY(-8px);
  }
  100% {
    opacity: 1;
    transform: none;
  }
}

.error-message {
  animation: popIn 0.2s both ease-in;
}

.rounded {
  margin-bottom: 1.2em;
  border-radius: 5px;
}

.login-button {
  margin-top: 30px;
  margin-bottom: 40px;
}
</style>
