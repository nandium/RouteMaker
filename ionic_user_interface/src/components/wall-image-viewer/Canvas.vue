<template>
  <div>
    <ion-segment
      class="mode-switcher"
      @ionChange="modeChanged($event)"
      :value="SelectMode.HANDHOLD"
      color="primary"
    >
      <ion-segment-button :value="SelectMode.HANDHOLD">
        <ion-label>HandHold</ion-label>
      </ion-segment-button>
      <ion-segment-button :value="SelectMode.FOOTHOLD">
        <ion-label>FootHold</ion-label>
      </ion-segment-button>
      <ion-segment-button :value="SelectMode.DRAWBOX">
        <ion-label>DrawBox</ion-label>
      </ion-segment-button>
      <ion-segment-button :value="SelectMode.EXPORT">
        <ion-label>Export</ion-label>
      </ion-segment-button>
    </ion-segment>
    <div id="konva-container"></div>
  </div>
</template>

<script lang="ts">
import Konva from 'konva';
import { IonLabel, IonSegment, IonSegmentButton } from '@ionic/vue';
import { defineComponent, onMounted, ref, watch } from 'vue';

import getBoundingBoxes from './getBoundingBoxes';
import { SelectMode } from './enums';
import { useBoundingBox } from '../../composables/useBoundingBox';
import { BoundingBox, ModeChangedEvent } from './types';

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
      required: true,
    },
    width: {
      type: Number,
      required: true,
    },
  },
  setup(props) {
    let stage: Konva.Stage;
    const imageLayer = new Konva.Layer();
    const boxLayer = new Konva.Layer();
    const konvaImage = new Konva.Image();
    let boundingBoxes: BoundingBox[] = [];

    const selectedMode = ref<SelectMode>(SelectMode.HANDHOLD);

    /**
     * Loads the Image and the bounding boxes retrieved from backend.
     */
    const loadStage = async () => {
      const image = new Image();
      // eslint-disable-next-line
      image.onload = async () => {
        // Clear all boxes first
        boxLayer.clear();
        boxLayer.destroyChildren();
        // Add image to stage
        stage.width(props.width);
        stage.height((props.width / image.width) * image.height);
        konvaImage.x(0);
        konvaImage.image(image);
        konvaImage.width(props.width);
        konvaImage.height((props.width / image.width) * image.height);
        imageLayer.batchDraw();
        // Get new boxes
        const formData = new FormData();
        formData.append('image', await (await fetch(props.imgSrc)).blob());
        formData.append('width', props.width.toString());
        const rawBoundingBoxes = await getBoundingBoxes(formData);
        boundingBoxes = rawBoundingBoxes.map((box, idx) => {
          const { x, y, w, h } = box;
          const { registerBoundingBox, resizeBoundingBox } = useBoundingBox(boxLayer, selectedMode);
          registerBoundingBox({
            x,
            y,
            width: w,
            height: h,
          });
          return { boxId: idx, resizeBoundingBox };
        });
        boxLayer.batchDraw();
      };
      image.src = props.imgSrc;
    };

    const resizeStage = () => {
      const factor = props.width / konvaImage.width();
      const newHeight = factor * konvaImage.height();
      konvaImage.width(props.width);
      konvaImage.height(newHeight);
      imageLayer.batchDraw();
      stage.width(props.width);
      stage.height(newHeight);
      for (const bbox of boundingBoxes) {
        const { resizeBoundingBox } = bbox;
        resizeBoundingBox(factor);
      }
      boxLayer.batchDraw();
    };

    const modeChanged = (event: ModeChangedEvent) => {
      selectedMode.value = event.detail.value;
    };

    onMounted(() => {
      stage = new Konva.Stage({
        container: 'konva-container',
      });
      imageLayer.listening(false);
      imageLayer.add(konvaImage);
      stage.add(imageLayer);
      stage.add(boxLayer);

      loadStage();
    });

    watch(() => props.imgSrc, loadStage);
    watch(() => props.width, resizeStage);

    return {
      SelectMode,
      modeChanged,
      selectedMode,
    };
  },
});
</script>

<style scoped>
.mode-switcher {
  min-width: 2em;
  max-width: 500px;
  margin: 0 auto;
}
</style>
