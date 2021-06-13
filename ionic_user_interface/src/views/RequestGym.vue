<template>
  <ion-page>
    <Header />
    <ion-content :fullscreen="true">
      <ion-header collapse="condense"></ion-header>
      <div id="container">
        <strong>Route Maker</strong>
        <p>Climbing Gym Request Form</p>
        <br />
        <gym-request-form />
      </div>
    </ion-content>
  </ion-page>
</template>

<script lang="ts">
import { IonContent, IonHeader, IonPage } from '@ionic/vue';
import { defineComponent } from 'vue';

import Header from '@/components/header/Header.vue';
import GymRequestForm from '@/components/gym-selector/GymRequestForm.vue';

export default defineComponent({
  name: 'RequestGym',
  components: {
    IonContent,
    IonHeader,
    IonPage,
    Header,
    GymRequestForm,
  },
});
</script>

<style scoped>
#container {
  text-align: center;
  position: absolute;
  left: 0;
  right: 0;
}

#container strong {
  font-size: 3em;
  line-height: 2em;
}

#container p {
  font-size: 1.6em;
  line-height: 1em;
  color: #8c8c8c;
  margin: 0;
}

#container a {
  text-decoration: none;
}
</style>
