<template>
  <div>
  <ion-segment class="mode-switcher" @ionChange="modeChanged($event)" value="handhold" color="primary">
    <ion-segment-button value="handhold">
      <ion-label>HandHold</ion-label>
    </ion-segment-button>
    <ion-segment-button value="foothold">
      <ion-label>FootHold</ion-label>
    </ion-segment-button>
    <ion-segment-button value="drawbox">
      <ion-label>DrawBox</ion-label>
    </ion-segment-button>
    <ion-segment-button value="export">
      <ion-label>Export</ion-label>
    </ion-segment-button>
  </ion-segment>
  <div id="konva-container"></div>
  </div>
</template>

<script lang="ts">
import { IonLabel, IonSegment, IonSegmentButton } from '@ionic/vue';
import { defineComponent, onMounted, ref, watch } from 'vue';
import Konva from 'konva';

Konva.pixelRatio = 1;

export default defineComponent({
  name: 'Canvas',
  components: {
      IonLabel,
      IonSegment,
      IonSegmentButton,
  },
  props: {
      imgSrc: {
          type: String,
          required: true
      },
      width: {
          type: Number,
          required: true
      },
  },
  setup(props) {
    const stage = ref<Konva.Stage | null>(null);
    const layer = ref<Konva.Layer | null>(null);

    const updateImage = () => {
        const image = new Image();
        image.onload = () => {
            if (stage.value !== null && layer.value !== null) {
                stage.value?.width(props.width);
                stage.value?.height(props.width / image.width * image.height);
                const konvaImage = new Konva.Image({
                    x: 0,
                    y: 0,
                    image: image,
                    width: props.width,
                    height: props.width / image.width * image.height
                });

                layer.value.add(konvaImage);
                layer.value.batchDraw();
            }
        };
        image.src = props.imgSrc;
    };

    onMounted(() => {
        stage.value = new Konva.Stage({
            container: 'konva-container',
        });
        const tempLayer = new Konva.Layer();
        layer.value = tempLayer;
        stage.value.add(tempLayer);
        updateImage();
    });
    watch(() => props.imgSrc, updateImage);
    watch(() => props.width, updateImage);

    return {
        stage,
        layer,
    }
  },
  methods: {
    modeChanged(e: CustomEvent) {
      console.log(e.detail.value);
    }
  }
});
</script>

<style scoped>
.mode-switcher {
  min-width: 2em;
  max-width: 500px;
  margin: 0 auto;
}
</style>
