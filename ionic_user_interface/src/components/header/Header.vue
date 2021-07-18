<template>
  <ion-header :translucent="true">
    <ion-toolbar class="smaller-height">
      <ion-img class="logo" @click="handleLogoClick" :src="logoImageSrc" />
      <ion-buttons slot="end">
        <LoginButton />
      </ion-buttons>
    </ion-toolbar>
  </ion-header>
</template>

<script lang="ts">
import { IonButtons, IonHeader, IonImg, IonToolbar } from '@ionic/vue';
import { chevronBackCircleOutline } from 'ionicons/icons';
import LoginButton from './LoginButton.vue';
import { defineComponent, Ref, ref, inject, computed } from 'vue';
import { useRouter } from 'vue-router';

export default defineComponent({
  name: 'Header',
  components: {
    IonButtons,
    IonHeader,
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
    };
  },
});
</script>

<style scoped>
.logo {
  margin-left: min(17px, 4vw);
  width: 50px;
  height: 50px;
}

.logo:hover {
  cursor: pointer;
}

.smaller-height {
  height: 50px;
  display: flex;
  align-items: center;
}

ion-buttons > ion-button {
  --border-radius: 5px !important;
  --padding-start: min(7px, 1.5vw);
  --padding-end: min(7px, 1.5vw);
}
</style>
