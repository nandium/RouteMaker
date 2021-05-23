<template>
  <ion-page>
    <Header />
    <ion-content :fullscreen="true">
      <ion-header collapse="condense"> </ion-header>

      <div id="container">
        <strong>Route Maker</strong>
        <p>Quickly make custom climbing routes</p>
        <br /><br />
        <ion-button @click="takePhoto()" color="tertiary">
          <ion-icon class="camera-icon" :icon="camera"></ion-icon>
          Upload wall image
        </ion-button>
        <Canvas v-if="photoUploaded" :imgSrc="photoData" :width="canvasWidth" />
      </div>
    </ion-content>
  </ion-page>
</template>

<script lang="ts">
import { camera } from 'ionicons/icons';
import { IonButton, IonContent, IonHeader, IonIcon, IonPage } from '@ionic/vue';
import { defineComponent, watch, ref, onUnmounted } from 'vue';
import Canvas from '../components/wall-image-viewer/Canvas.vue';
import Header from '../components/Header.vue';
import { usePhotoGallery } from '../composables/usePhotoGallery';
import { debounce } from 'lodash';

export default defineComponent({
  name: 'Home',
  components: {
    IonButton,
    IonContent,
    IonHeader,
    IonIcon,
    IonPage,
    Canvas,
    Header,
  },
  setup() {
    const canvasWidth = ref(0);
    const photoData = ref('');
    const photoUploaded = ref(false);
    const { photo, takePhoto } = usePhotoGallery();

    /**
     * Get width of the device as platform-independent as possible
     * https://stackoverflow.com/questions/6942785/window-innerwidth-vs-document-documentelement-clientwidth
     */
    const updateCanvasWidth = debounce(() => {
      const windowWidth =
        window.innerWidth && document.documentElement.clientWidth
          ? Math.min(window.innerWidth, document.documentElement.clientWidth)
          : window.innerWidth ||
            document.documentElement.clientWidth ||
            document.getElementsByTagName('body')[0].clientWidth;

      canvasWidth.value = Math.min(windowWidth, 800);
    }, 100);

    watch(photo, (oldPhoto, newPhoto) => {
      if (newPhoto !== oldPhoto && oldPhoto !== null) {
        photoUploaded.value = true;
        if (oldPhoto.data) {
          photoData.value = oldPhoto.data;
        }
        updateCanvasWidth();
      }
    });
    window.onload = updateCanvasWidth;
    window.addEventListener('resize', updateCanvasWidth);
    onUnmounted(() => {
      window.removeEventListener('resize', updateCanvasWidth);
    });

    return {
      canvasWidth,
      photoData,
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

ion-button {
  filter: hue-rotate(90deg);
}
</style>
