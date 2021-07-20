<template>
  <ion-page>
    <ion-content :fullscreen="true" ref="ionContent">
      <div class="my-container">
        <strong>Route Maker</strong>
        <p>Make custom climbing routes</p>
        <br />
        <br />
        <ion-button @click="takePhoto" color="tertiary" class="upload-button">
          <ion-icon class="global-margin-right-small" :icon="camera"></ion-icon>
          Upload wall image
        </ion-button>
        <Canvas
          v-if="photoUploaded"
          :imgSrc="photoData"
          :width="canvasWidth"
          :ionContent="ionContent"
        />
        <div v-if="!photoUploaded">
          <br />
          <ion-button @click="handleClickUserGuide" color="medium" fill="clear">
            User Guide
          </ion-button>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script lang="ts">
import { camera } from 'ionicons/icons';
import { IonButton, IonContent, IonPage, IonIcon } from '@ionic/vue';
import { defineComponent, watch, ref, onUnmounted, onMounted } from 'vue';
import { useRouter } from 'vue-router';

import Canvas from '@/components/wall-image-viewer/Canvas.vue';
import { usePhotoGallery } from '@/composables/usePhotoGallery';
import { useCanvasWidth } from '@/composables/useCanvasWidth';

export default defineComponent({
  name: 'New',
  components: {
    IonButton,
    IonContent,
    IonIcon,
    IonPage,
    Canvas,
  },
  setup() {
    const router = useRouter();
    const photoData = ref('');
    const photoUploaded = ref(false);
    const { photo, takePhoto } = usePhotoGallery();
    const { canvasWidth, updateCanvasWidth } = useCanvasWidth();

    const ionContent = ref<typeof IonContent | null>(null);

    watch(photo, (oldPhoto, newPhoto) => {
      if (newPhoto !== oldPhoto && oldPhoto !== null) {
        photoUploaded.value = true;
        if (oldPhoto.data) {
          photoData.value = oldPhoto.data;
        }
        updateCanvasWidth();
      }
    });

    window.addEventListener('resize', updateCanvasWidth);

    onMounted(() => {
      updateCanvasWidth();
    });

    onUnmounted(() => {
      window.removeEventListener('resize', updateCanvasWidth);
    });

    const handleClickUserGuide = () => {
      router.push({ name: 'Help', hash: '#section2' });
    };

    return {
      canvasWidth,
      photoData,
      photoUploaded,
      photo,
      takePhoto,
      camera,
      ionContent,
      handleClickUserGuide,
    };
  },
});
</script>

<style scoped lang="scss">
.my-container {
  text-align: center;
  position: absolute;
  left: 0;
  right: 0;

  strong {
    font-size: clamp(2rem, 7vw, 2.5rem);
    line-height: 2em;
  }

  p {
    font-size: clamp(1.4rem, 5vw, 1.6rem);
    line-height: 1em;
    color: #8c8c8c;
    margin: 0;
  }

  a {
    text-decoration: none;
  }
}

.upload-button {
  filter: hue-rotate(90deg);

  ion-icon {
    margin-right: 5px;
  }
}
</style>
