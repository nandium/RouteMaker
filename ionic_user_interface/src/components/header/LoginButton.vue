<template>
  <ion-button v-if="!isLoggedIn" router-link="/login" color="secondary">Login</ion-button>
  <ion-button v-if="isLoggedIn" fill="clear" shape="round" @click="setPopoverOpen(true, $event)">
    <ion-icon :icon="personCircleOutline" size="large"></ion-icon>
  </ion-button>
  <ion-popover
    :is-open="isPopoverOpen"
    :translucent="true"
    :event="popoverEvent"
    @didDismiss="setPopoverOpen(false)"
  >
    <ion-list class="no-padding no-margin">
      <ion-item button @click="clickProfileButton">Profile</ion-item>
      <ion-item button color="danger" @click="clickLogoutButton">Logout</ion-item>
    </ion-list>
  </ion-popover>
</template>

<script lang="ts">
import { personCircleOutline } from 'ionicons/icons';
import { IonButton, IonIcon, IonItem, IonList, IonPopover, toastController } from '@ionic/vue';
import { defineComponent, inject, ref, Ref } from 'vue';
import { useRouter } from 'vue-router';

export default defineComponent({
  name: 'LoginButton',
  components: {
    IonButton,
    IonIcon,
    IonItem,
    IonList,
    IonPopover,
  },
  setup() {
    const router = useRouter();
    const forceLogout: () => Promise<void> = inject('forceLogout', () => Promise.resolve());
    const getLoggedIn: () => Ref<boolean> = inject('getLoggedIn', () => ref(false));
    const isLoggedIn = getLoggedIn();

    const popoverEvent = ref();
    const isPopoverOpen = ref(false);

    const setPopoverOpen = (state: boolean, event?: Event) => {
      popoverEvent.value = event;
      isPopoverOpen.value = state;
    };

    const clickLogoutButton = async () => {
      setPopoverOpen(false);
      await forceLogout();

      toastController
        .create({
          header: 'Logged out successfully',
          position: 'bottom',
          color: 'success',
          duration: 3000,
          buttons: [
            {
              text: 'Close',
              role: 'cancel',
            },
          ],
        })
        .then((toast) => {
          toast.present();
        });
    };

    const clickProfileButton = () => {
      setPopoverOpen(false);
      router.push('/profile');
    };

    return {
      isLoggedIn,
      personCircleOutline,
      popoverEvent,
      isPopoverOpen,
      setPopoverOpen,
      clickLogoutButton,
      clickProfileButton,
    };
  },
});
</script>

<style scoped>
ion-list {
  margin: 0;
  padding: 0;
}
ion-item {
  margin: 0;
  padding: 0;
}

ion-item > ion-button {
  margin: 0;
  width: 100%;
}
</style>
