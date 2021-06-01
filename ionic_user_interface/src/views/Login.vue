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
            <form @submit="onSubmit" class="ion-padding ion-text-center">
              <div>
                <ion-item class="rounded">
                  <ion-input
                    @keyup.enter="clickLoginButton"
                    v-model="emailText"
                    name="email"
                    type="email"
                    placeholder="example@email.com"
                    required
                  />
                </ion-item>
                <ion-item class="rounded">
                  <ion-input
                    @keyup.enter="clickLoginButton"
                    v-model="passwordText"
                    name="password"
                    type="password"
                    placeholder="Password"
                    minlength="6"
                    required
                  />
                </ion-item>
              </div>
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
                <a href="#">Sign up</a>
                now!
              </h5>
            </form>
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
    IonInput,
    IonItem,
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

    const onSubmit = (event: Event): boolean => {
      event.preventDefault();
      // Valid credentials
      if (isValidEmail(emailText.value) && isValidPassword(passwordText.value)) {
        return true;
      }
      // Invalid credentials
      return false;
    };

    const clickLoginButton = (): void => {
      document.getElementById('loginButton')?.click();
    };

    return {
      onSubmit,
      clickLoginButton,
      emailText,
      passwordText,
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
