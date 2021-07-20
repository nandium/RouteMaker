<template>
  <ion-page>
    <ion-content :fullscreen="true">
      <div class="my-container">
        <strong>Route Maker</strong>
        <p>Climbing Gym Request Form</p>
        <br />
        <p class="description">
          Please submit gym requests here. We will respond to you via email in 2 to 10 hours. Thank
          you for your support.
        </p>
        <gym-request-form />
      </div>
    </ion-content>
  </ion-page>
</template>

<script lang="ts">
import { IonContent, IonPage } from '@ionic/vue';
import { defineComponent } from 'vue';

import GymRequestForm from '@/components/gym-selector/GymRequestForm.vue';

export default defineComponent({
  name: 'RequestGym',
  components: {
    IonContent,
    IonPage,
    GymRequestForm,
  },
});
</script>

<style scoped lang="scss">
.my-container {
  text-align: center;
  margin: 0 auto;

  strong {
    font-size: 3em;
    line-height: 2em;
  }

  p {
    font-size: 1.6em;
    line-height: 1em;
    color: #8c8c8c;
    margin: 0;
  }

  a {
    text-decoration: none;
  }

  .description {
    font-size: 1.1em;
    line-height: 1.4em;
    color: var(--ion-color-medium-shade);
    margin: 1rem;
  }
}
</style>
