<template>
  <ion-page>
    <Header />
    <ion-content :fullscreen="true">
      <ion-header collapse="condense">
        <ion-toolbar>
          <ion-title size="large">Blank</ion-title>
        </ion-toolbar>
      </ion-header>

      <div id="container">
        <strong>Route Maker</strong>
        <p>Quickly make custom climbing routes</p>
        <br /><br />
        <ion-button @click="takePhoto()">
          <ion-icon class="camera-icon" :icon="camera"></ion-icon>
          Upload wall image...
        </ion-button>
        <div v-if="photoUploaded">
          <ion-img class="image-view" :src="photo.webviewPath"></ion-img>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script lang="ts">
import { camera } from 'ionicons/icons';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonImg,
  IonPage,
  IonTitle,
  IonToolbar,
} from '@ionic/vue';
import { defineComponent, watch, ref } from 'vue';
import Header from '../components/Header.vue';
import { usePhotoGallery } from '../composables/usePhotoGallery';

export default defineComponent({
  name: 'Home',
  components: {
    IonButton,
    IonContent,
    IonHeader,
    IonIcon,
    IonImg,
    IonPage,
    IonTitle,
    IonToolbar,
    Header,
  },
  setup() {
    const photoUploaded = ref(false);
    const { photo, takePhoto } = usePhotoGallery();
    watch(photo, (oldPhoto, newPhoto) => {
      if (newPhoto !== oldPhoto && oldPhoto !== null) {
        photoUploaded.value = true;
      }
    });
    return {
      photoUploaded,
      photo,
      takePhoto,
      camera,
    };
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

.camera-icon {
  margin-right: 10px;
}
</style>
