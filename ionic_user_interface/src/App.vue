<template>
  <ion-app>
    <Header />
    <ion-content>
      <ion-router-outlet />
    </ion-content>
    <ion-tab-bar>
      <ion-tab-button @click="() => router.push({ name: 'Explore' })">
        Explore
        <ion-icon :icon="searchOutline"></ion-icon>
      </ion-tab-button>
      <ion-tab-button @click="() => router.push({ name: 'New' })">
        New
        <ion-icon :icon="cameraOutline"></ion-icon>
      </ion-tab-button>
      <ion-tab-button @click="() => router.push({ name: 'Help' })">
        Help
        <ion-icon :icon="helpCircleOutline"></ion-icon>
      </ion-tab-button>
    </ion-tab-bar>
  </ion-app>
</template>

<script lang="ts">
import { IonApp, IonContent, IonRouterOutlet, IonIcon, IonTabBar, IonTabButton } from '@ionic/vue';
import { defineComponent, inject, onMounted, ref, Ref, watch } from 'vue';
import { cameraOutline, searchOutline, helpCircleOutline } from 'ionicons/icons';
import Header from '@/components/header/Header.vue';
import { useRouter } from 'vue-router';

export default defineComponent({
  name: 'App',
  components: {
    Header,
    IonApp,
    IonContent,
    IonRouterOutlet,
    IonIcon,
    IonTabBar,
    IonTabButton,
  },
  setup() {
    const router = useRouter();
    const checkExpiry: () => Promise<void> = inject('checkExpiry', () => Promise.resolve());
    const getPrefersDarkMode: () => Ref<boolean> = inject('getPrefersDarkMode', () => ref(false));
    const prefersDarkMode = getPrefersDarkMode();

    watch(router.currentRoute, async () => {
      await checkExpiry();
    });

    onMounted(async () => {
      document.body.classList.toggle('dark', prefersDarkMode.value);
      document.documentElement.style.setProperty(
        'color-scheme',
        prefersDarkMode.value ? 'dark' : 'light',
      );
      await checkExpiry();
    });

    watch(prefersDarkMode, () => {
      document.body.classList.toggle('dark', prefersDarkMode.value);
      document.documentElement.style.setProperty(
        'color-scheme',
        prefersDarkMode.value ? 'dark' : 'light',
      );
    });
    return {
      cameraOutline,
      searchOutline,
      helpCircleOutline,
      router,
    };
  },
});
</script>

<style scoped lang="scss">
ion-tab-bar {
  height: 50px;
  display: flex;
  align-items: center;
}

ion-icon {
  height: 20px;
  width: 20px;
}
</style>
