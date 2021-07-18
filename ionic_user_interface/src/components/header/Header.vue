<template>
  <ion-header :translucent="true">
    <ion-toolbar>
      <ion-back-button style="display: none" ref="backButton"></ion-back-button>
      <div class="logo-wrapper" @click="handleLogoClick" title="Back">
        <ion-icon class="back-arrow" :icon="chevronBackCircleOutline" />
        <ion-img class="logo" :src="logoImageSrc" />
      </div>
      <ion-buttons slot="end">
        <ion-button router-link="/home">Home</ion-button>
        <ion-button router-link="/gyms">Gyms</ion-button>
        <ion-button router-link="/about">About</ion-button>
        <LoginButton />
      </ion-buttons>
    </ion-toolbar>
  </ion-header>
</template>

<script lang="ts">
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonHeader,
  IonIcon,
  IonImg,
  IonToolbar,
} from '@ionic/vue';
import { chevronBackCircleOutline } from 'ionicons/icons';
import LoginButton from './LoginButton.vue';
import { defineComponent, Ref, ref, inject, computed } from 'vue';

export default defineComponent({
  name: 'Header',
  components: {
    IonBackButton,
    IonButton,
    IonButtons,
    IonHeader,
    IonIcon,
    IonImg,
    IonToolbar,
    LoginButton,
  },
  setup() {
    const getPrefersDarkMode: () => Ref<boolean> = inject('getPrefersDarkMode', () => ref(false));
    const prefersDarkMode = getPrefersDarkMode();
    const logoImageSrc = computed(() => {
      if (prefersDarkMode.value) {
        return process.env.BASE_URL + 'assets/icons/favicon-darkmode-name.svg';
      } else {
        return process.env.BASE_URL + 'assets/icons/favicon-lightmode-name.svg';
      }
    });

    const backButton: Ref<typeof IonBackButton | null> = ref(null);

    const handleLogoClick = () => {
      backButton.value?.$el.click();
    };

    return {
      logoImageSrc,
      chevronBackCircleOutline,
      backButton,
      handleLogoClick,
    };
  },
});
</script>

<style scoped>
.logo {
  width: 60px;
  height: 60px;
}

.logo-wrapper {
  display: inline-flex;
  justify-items: center;
  align-items: center;
  margin-left: 10px;
}

.logo-wrapper:hover {
  cursor: pointer;
}

.logo-wrapper:hover > .back-arrow {
  color: white;
}

.back-arrow {
  width: 25px;
  height: 25px;
  margin-right: 5px;
  margin-top: 1px; /* For fixing alignment, may need to adjust when logo changes */
  color: #999999;
  --background-hover: transparent;
  --background-focused: transparent;
}
</style>
