<template>
  <ion-item class="message" :color="color" v-if="msgText.length !== 0">
    <ion-label class="ion-text-wrap">
      {{ msgText }}
    </ion-label>
    <ion-button fill="clear" color="light" shape="round" @click="close">
      <ion-icon :icon="closeCircleOutline" class="global-light-color"></ion-icon>
    </ion-button>
  </ion-item>
</template>

<script lang="ts">
import { closeCircleOutline } from 'ionicons/icons';
import { IonButton, IonIcon, IonItem, IonLabel } from '@ionic/vue';
import { defineComponent, ref } from 'vue';

export default defineComponent({
  name: 'MessageBox',
  components: {
    IonButton,
    IonIcon,
    IonItem,
    IonLabel,
  },
  props: {
    color: {
      type: String,
      required: true,
    },
  },
  setup() {
    const msgText = ref('');

    const showMsg = (message: string): void => {
      close();
      msgText.value = message;
    };

    const close = (): void => {
      msgText.value = '';
    };

    return {
      msgText,
      showMsg,
      close,
      closeCircleOutline,
    };
  },
});
</script>

<style scoped lang="scss">
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

.message {
  animation: popIn 0.2s both ease-in;
}
</style>
