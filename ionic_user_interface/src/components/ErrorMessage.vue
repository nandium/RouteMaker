<template>
  <ion-item class="rounded error-message" color="danger" v-if="errorMsg.length !== 0">
    <ion-label class="ion-text-wrap">
      {{ errorMsg }}
    </ion-label>
    <ion-button fill="clear" color="dark" shape="round" @click="closeErrorMsg">
      <ion-icon :icon="closeCircleOutline"></ion-icon>
    </ion-button>
  </ion-item>
</template>

<script lang="ts">
import { IonButton, IonIcon, IonItem, IonLabel } from '@ionic/vue';
import { defineComponent, ref } from 'vue';

export default defineComponent({
  name: 'About',
  components: {
    IonButton,
    IonIcon,
    IonItem,
    IonLabel,
  },
  setup() {
    const errorMsg = ref('');

    const showErrorMsg = (message: string): void => {
      errorMsg.value = message;
    };

    const closeErrorMsg = (): void => {
      errorMsg.value = '';
    };

    return {
      errorMsg,
      showErrorMsg,
      closeErrorMsg,
    };
  },
});
</script>

<style scoped>
@keyframes popIn {
  0% {
    opacity: 0;
    transform: scale(1, 0.1) translateY(-8px);
  }
  100% {
    opacity: 1;
    transform: none;
  }
}

.error-message {
  animation: popIn 0.2s both ease-in;
}
</style>
