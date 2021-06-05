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
                    @keyup.enter="clickSignupButton"
                    v-model="emailText"
                    name="email"
                    type="text"
                    autofocus
                    required
                  />
                </ion-item>
                <ion-item class="rounded">
                  <ion-label position="stacked">Username</ion-label>
                  <ion-input
                    @keyup.enter="clickSignupButton"
                    v-model="usernameText"
                    name="username"
                    type="username"
                    required
                  />
                </ion-item>
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
                <ion-item class="rounded">
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
                  class="signup-button"
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
    const usernameText = ref('');
    const passwordText = ref('');
    const confirmPasswordText = ref('');
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
      return password.length >= 6;
    };

    const isValidUsername = (username: string): boolean => {
      return username.length >= 5;
    };

    const onSubmit = (event: Event): boolean => {
      event.preventDefault();
      // Invalid credentials
      if (!isValidEmail(emailText.value)) {
        errorMsg.value = 'Invalid email.';
        showErrorMsg.value = true;
        return false;
      }
      if (!isValidUsername(usernameText.value)) {
        errorMsg.value = 'Username has to be at least 5 characters.';
        showErrorMsg.value = true;
        return false;
      }
      if (!isValidPassword(passwordText.value)) {
        errorMsg.value = 'Password has to be at least 6 characters.';
        showErrorMsg.value = true;
        return false;
      }
      if (passwordText.value !== confirmPasswordText.value) {
        errorMsg.value = 'Passwords do not match.';
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

    const clickSignupButton = (): void => {
      document.getElementById('signupButton')?.click();
    };

    return {
      onSubmit,
      closeCircleOutline,
      clickCloseErrorMsg,
      clickSignupButton,
      emailText,
      usernameText,
      passwordText,
      confirmPasswordText,
      showErrorMsg,
      errorMsg,
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

.signup-button {
  margin-top: 30px;
  margin-bottom: 40px;
}
</style>
