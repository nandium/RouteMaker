<template>
  <ion-page>
    <ion-content :fullscreen="true">
      <div id="container">
        <strong>Routes</strong>
      </div>
    </ion-content>
  </ion-page>
</template>

<script lang="ts">
import { IonContent, IonPage } from '@ionic/vue';
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'ViewRoute',
  components: {
    IonContent,
    IonPage,
  },
  setup() {
    console.log('this');
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
