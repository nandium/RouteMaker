<template>
  <ion-header :translucent="true">
    <ion-toolbar>
      <ion-title>
        <ion-img class="logo" :src="logoImageSrc" router-link="/home" />
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
import { defineComponent, watch, Ref, ref, inject } from 'vue';

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
  setup() {
    const getPrefersDarkMode: () => Ref<boolean> = inject('getPrefersDarkMode', () => ref(false));
    const prefersDarkMode = getPrefersDarkMode();
    const logoImageSrc = ref(process.env.BASE_URL + 'assets/icons/favicon-lightmode-name.svg');
    watch(prefersDarkMode, () => {
      if (prefersDarkMode.value) {
        logoImageSrc.value = process.env.BASE_URL + 'assets/icons/favicon-darkmode-name.svg';
      } else {
        logoImageSrc.value = process.env.BASE_URL + 'assets/icons/favicon-lightmode-name.svg';
      }
    });
    return { logoImageSrc };
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
</style>
