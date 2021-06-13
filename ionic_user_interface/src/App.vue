<template>
  <ion-app>
    <Header />
    <ion-content>
      <ion-router-outlet />
    </ion-content>
  </ion-app>
</template>

<script lang="ts">
import { IonApp, IonContent, IonRouterOutlet } from '@ionic/vue';
import { defineComponent, inject, onMounted, ref, Ref, watch } from 'vue';
import Header from '@/components/header/Header.vue';
import { useRouter } from 'vue-router';

export default defineComponent({
  name: 'App',
  components: {
    Header,
    IonApp,
    IonContent,
    IonRouterOutlet,
  },
  setup() {
    const router = useRouter();
    const checkExpiry: () => Promise<void> = inject('checkExpiry', () => Promise.resolve());
    const getPrefersDarkMode: () => Ref<boolean> = inject('getPrefersDarkMode', () => ref(false));
    const prefersDarkMode = getPrefersDarkMode();

    watch(router.currentRoute, async () => {
      await checkExpiry();
    });

    onMounted(() => {
      document.body.classList.toggle('dark', prefersDarkMode.value);
    });

    watch(prefersDarkMode, () => {
      document.body.classList.toggle('dark', prefersDarkMode.value);
    });
  },
});
</script>
