<template>
  <ion-button :disabled="isLoading">
    <ion-spinner v-if="isLoading" name="dots" />
    <slot v-else />
  </ion-button>
</template>

<script lang="ts">
import { defineComponent, ref } from 'vue';
import { IonButton, IonSpinner } from '@ionic/vue';

export default defineComponent({
  name: 'LoadingButton',
  components: {
    IonButton,
    IonSpinner,
  },
  setup() {
    const isLoading = ref(false);
    const setIsLoading = (loading: boolean) => {
      isLoading.value = loading;
    };
    return {
      isLoading,
      setIsLoading,
    };
  },
});
</script>
