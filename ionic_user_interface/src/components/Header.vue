<template>
  <ion-header :translucent="true">
    <ion-toolbar>
      <ion-title>
        <ion-img class="logo" :src="`${publicPath}assets/icons/favicon.ico`" router-link="/home" />
      </ion-title>
      <ion-buttons slot="end">
        <ion-button router-link="/home">Home</ion-button>
        <ion-button router-link="/about">About</ion-button>
      </ion-buttons>
    </ion-toolbar>
  </ion-header>
</template>

<script lang="ts">
import { IonButton, IonButtons, IonHeader, IonImg, IonTitle, IonToolbar } from '@ionic/vue';
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
  },
  setup() {
    const publicPath = process.env.BASE_URL;
    return {
      publicPath,
    };
  },
});
</script>

<style scoped>
.logo {
  width: 40px;
  height: 40px;
}
.logo:hover {
  cursor: pointer;
}
</style>
