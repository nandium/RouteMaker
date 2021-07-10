<template>
  <ion-header :translucent="true">
    <ion-toolbar>
      <ion-title>
        <ion-img class="logo" router-link="/home" />
      </ion-title>
      <ion-buttons slot="end">
        <ion-button router-link="/home">Home</ion-button>
        <ion-button router-link="/about">About</ion-button>
        <ion-button router-link="/gyms">Gyms</ion-button>
        <LoginButton />
      </ion-buttons>
    </ion-toolbar>
  </ion-header>
</template>

<script lang="ts">
import { IonButton, IonButtons, IonHeader, IonImg, IonTitle, IonToolbar } from '@ionic/vue';
import LoginButton from './LoginButton.vue';
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'Header',
  components: {
    IonButton,
    IonButtons,
    IonHeader,
    IonImg,
    IonTitle,
    IonToolbar,
    LoginButton,
  },
});
</script>

<style scoped>
.logo {
  width: 60px;
  height: 60px;
}
.logo:hover {
  cursor: pointer;
}

/* 
TODO: Accomodate for various BASE_URL '/' vs '/RouteMaker/' etc
https://stackoverflow.com/questions/66127664/why-does-the-browser-try-to-use-an-otherwise-invalid-property-declaration-when-i
*/
body.dark .logo {
  content: url('/assets/icons/favicon-darkmode-name.svg');
}

body .logo {
  content: url('/assets/icons/favicon-lightmode-name.svg');
}
</style>
