<template>
  <div>
    <br />
    <br />
    <ion-segment
      class="mode-switcher"
      @ionChange="modeChanged($event)"
      :value="SelectMode.HANDHOLD"
      color="tertiary"
      mode="ios"
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
    </ion-segment>
    <br />
    <ion-button class="outline-button" @click="handleHideNumbersClick" :fill="hideNumbersFill" color="tertiary">{{hideNumbersText}}</ion-button>
    <ion-button class="outline-button" @click="handleTapeClick" :fill="tapeFill" color="primary">{{tapeText}}</ion-button>
    <ion-button class="solid-button" fill="solid" color="secondary">Export</ion-button>
    <ion-button class="solid-button" fill="solid" color="danger">Reset</ion-button>
    <br />
    <br />
    <div id="konva-container"></div>
  </div>
</template>

<script lang="ts">
import Konva from 'konva';
import { IonButton, IonLabel, IonSegment, IonSegmentButton } from '@ionic/vue';
import { defineComponent, onMounted, ref, watch } from 'vue';

import getBoundingBoxes from '@/components/wall-image-viewer/getBoundingBoxes';
import { SelectMode } from '@/components/wall-image-viewer/enums';
import { useBoxLayer } from '@/components/wall-image-viewer/useBoxLayer';
import { ModeChangedEvent } from '@/components/wall-image-viewer/types';

Konva.pixelRatio = 1;

export default defineComponent({
  name: 'Canvas',
  components: {
    IonButton,
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
    const selectedMode = ref<SelectMode>(SelectMode.HANDHOLD);
    const hideNumbersFill = ref<string>("outline");
    const hideNumbersText = ref<string>("Hide Numbers");
    const tapeFill = ref<string>("outline");
    const tapeText = ref<string>("No Tape");

    let stage: Konva.Stage;
    const imageLayer = new Konva.Layer();
    const konvaImage = new Konva.Image();
    const { boxLayer, resizeBoxLayer, addBoxLayerBoundingBoxes, clearBoxLayer } = useBoxLayer(
      selectedMode,
    );

    /**
     * Loads the Image and the bounding boxes retrieved from backend.
     */
    const loadStage = async () => {
      const image = new Image();
      image.onload = async () => {
        // Clear all boxes first
        clearBoxLayer();
        // Add image to stage
        stage.width(props.width);
        stage.height((props.width / image.width) * image.height);
        konvaImage.x(0);
        konvaImage.y(0);
        konvaImage.image(image);
        konvaImage.width(props.width);
        konvaImage.height((props.width / image.width) * image.height);
        imageLayer.batchDraw();
        // Get new boxes
        const formData = new FormData();
        formData.append('image', await (await fetch(props.imgSrc)).blob());
        formData.append('width', props.width.toString());
        const rawBoundingBoxes = await getBoundingBoxes(formData);
        addBoxLayerBoundingBoxes(rawBoundingBoxes);
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
      resizeBoxLayer(factor);
    };

    const modeChanged = (event: ModeChangedEvent) => {
      selectedMode.value = event.detail.value;
    };

    const handleHideNumbersClick = () => {
      if (hideNumbersFill.value === "outline") {
        hideNumbersFill.value = "solid";
        hideNumbersText.value = "Unhide Numbers";
      } else {
        hideNumbersFill.value = "outline";
        hideNumbersText.value = "Hide Numbers";
      }
    };

    const handleTapeClick = () => {
      if (tapeText.value === "No Tape") {
        tapeFill.value = "solid";
        tapeText.value = "1-Hold Start";
      } else if (tapeText.value === "1-Hold Start") {
        tapeText.value = "2-Hold Start";
      } else {
        tapeFill.value = "outline";
        tapeText.value = "No Tape";
      }
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
      hideNumbersFill,
      hideNumbersText,
      handleHideNumbersClick,
      tapeFill,
      tapeText,
      handleTapeClick,
    };
  },
});
</script>

<style scoped>
ion-segment {
  max-width: 500px;
  margin: 0 auto;
  height: 44px;
  border-radius: 3px;
  border: 2px solid var(--ion-color-tertiary);
  padding: 1px 3px;
  filter: hue-rotate(90deg);
}

ion-segment-button {
  color: var(--ion-color-dark);
  border-radius: 0px;
}

ion-segment-button::part(indicator-background) {
  background: var(--ion-color-tertiary);
}

.segment-button-checked {
  background: var(--ion-color-tertiary);
}

ion-label {
  font-size: 1.3em;
}

ion-button {
  border-radius: 4px;
  margin: 5px 9px;
  filter: brightness(90%);
}

ion-button::part(native) {
  font-weight: 600;
}

.outline-button::part(native) {
  border: 2px solid;
  filter: sepia(35%);
}

.outline-button::part(native):hover {
  filter: sepia(10%);
}
</style>
