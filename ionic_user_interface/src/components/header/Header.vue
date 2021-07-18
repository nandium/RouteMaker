<template>
  <ion-header :translucent="true">
    <ion-toolbar>
      <ion-img class="logo" @click="handleLogoClick" :src="logoImageSrc" />
      <ion-buttons slot="end">
        <ion-button router-link="/explore">
          Explore
          <ion-icon slot="end" :icon="searchOutline"></ion-icon>
        </ion-button>
        <ion-button router-link="/new">
          New
          <ion-icon slot="end" :icon="cameraOutline"></ion-icon>
        </ion-button>
        <ion-button router-link="/help">
          Help
          <ion-icon slot="end" :icon="helpCircleOutline"></ion-icon>
        </ion-button>
        <LoginButton />
      </ion-buttons>
    </ion-toolbar>
  </ion-header>
</template>

<script lang="ts">
import { IonButton, IonButtons, IonHeader, IonIcon, IonImg, IonToolbar } from '@ionic/vue';
import {
  chevronBackCircleOutline,
  cameraOutline,
  searchOutline,
  helpCircleOutline,
} from 'ionicons/icons';
import LoginButton from './LoginButton.vue';
import { defineComponent, Ref, ref, inject, computed } from 'vue';
import { useRouter } from 'vue-router';

export default defineComponent({
  name: 'Header',
  components: {
    IonButton,
    IonButtons,
    IonHeader,
    IonIcon,
    IonImg,
    IonToolbar,
    LoginButton,
  },
  setup() {
    const router = useRouter();
    const getPrefersDarkMode: () => Ref<boolean> = inject('getPrefersDarkMode', () => ref(false));
    const prefersDarkMode = getPrefersDarkMode();
    const logoImageSrc = computed(() => {
      if (prefersDarkMode.value) {
        return process.env.BASE_URL + 'assets/icons/favicon-darkmode-name.svg';
      } else {
        return process.env.BASE_URL + 'assets/icons/favicon-lightmode-name.svg';
      }
    });

    const handleLogoClick = () => {
      router.push({ name: 'Explore' });
    };

    return {
      logoImageSrc,
      chevronBackCircleOutline,
      handleLogoClick,
      cameraOutline,
      searchOutline,
      helpCircleOutline,
    };
  },
});
</script>

<style scoped>
.logo {
  margin-left: min(17px, 4vw);
  width: 60px;
  height: 60px;
}

.logo:hover {
  cursor: pointer;
}

ion-buttons > ion-button {
  --border-radius: 5px !important;
  --padding-start: min(7px, 1.5vw);
  --padding-end: min(7px, 1.5vw);
}
</style>
