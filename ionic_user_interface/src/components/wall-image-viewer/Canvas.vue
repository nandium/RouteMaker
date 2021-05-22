<template>
  <div>
    <br />
    <br />
    <ion-segment
      class="mode-switcher"
      @ionChange="modeChanged($event)"
      v-model="selectedMode"
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
      <ion-segment-button :value="SelectMode.MARKDONE">
        <ion-label>MarkDone</ion-label>
      </ion-segment-button>
    </ion-segment>
    <div v-if="+selectedMode !== SelectMode.MARKDONE">
      <ion-button
        class="outline-button"
        @click="handleHideNumbersClick"
        :fill="hideNumbersFill"
        color="tertiary"
        >{{ hideNumbersText }}</ion-button
      >
      <ion-button
        class="outline-button"
        @click="handleTapeClick"
        :fill="tapeFill"
        color="primary"
        >{{ tapeText }}</ion-button
      >
      <ion-button class="solid-button" fill="solid" color="danger" @click="handleReset"
        >Reset</ion-button
      >
    </div>
    <ion-button
      v-else
      @click="handleExportClick"
      class="solid-button"
      fill="solid"
      color="secondary"
      >Export</ion-button
    >
    <div id="konva-container" class="konva-container"></div>
  </div>
</template>

<script lang="ts">
import Konva from 'konva';
import { IonButton, IonLabel, IonSegment, IonSegmentButton } from '@ionic/vue';
import { defineComponent, onMounted, ref, watch } from 'vue';

import getBoundingBoxes from '@/components/wall-image-viewer/getBoundingBoxes';
import { useBoxLayer } from '@/components/wall-image-viewer/box-layer';
import { downloadURI } from '@/common/download';
import {
  SelectMode,
  TapeMode,
  NumberMode,
  ModeChangedEvent,
} from '@/components/wall-image-viewer/types';
import {
  addKonvaListenerPinchZoom,
  addKonvaListenerTouchMove,
  offKonvaStageListeners,
} from '@/components/wall-image-viewer/stageListeners';

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
    const tapeMode = ref<TapeMode>(TapeMode.NONE);
    const numberMode = ref<NumberMode>(NumberMode.ON);
    const hideNumbersFill = ref<string>('outline');
    const hideNumbersText = ref<string>('Hide Numbers');
    const tapeFill = ref<string>('outline');
    const tapeText = ref<string>('No Tape');

    let stage: Konva.Stage;
    const imageLayer = new Konva.Layer();
    const konvaImage = new Konva.Image();
    const {
      boxLayer,
      resizeBoxLayer,
      addBoxLayerBoundingBoxes,
      clearBoxLayer,
      resetBoxLayerToUnSelected,
    } = useBoxLayer(selectedMode, tapeMode, numberMode);

    const clipWidth = (width: number) => {
      return Math.min(width, 800);
    };
    /**
     * Loads the Image and the bounding boxes retrieved from backend.
     */
    const loadImageOnStage = async () => {
      const image = new Image();
      // eslint-disable-next-line
      image.onload = async () => {
        // Clear all boxes first
        clearBoxLayer();
        // Add image to stage
        const newWidth = clipWidth(props.width);
        stage.width(newWidth);
        stage.height((newWidth / image.width) * image.height);
        konvaImage.setAttrs({
          image,
          width: newWidth,
          height: (newWidth / image.width) * image.height,
        });
        // Get new boxes
        const formData = new FormData();
        formData.append('image', await (await fetch(props.imgSrc)).blob());
        formData.append('width', newWidth.toString());
        const rawBoundingBoxes = await getBoundingBoxes(formData);
        addBoxLayerBoundingBoxes(rawBoundingBoxes);
        imageLayer.batchDraw();

        // Listeners must be added after image is loaded
        addKonvaListenerPinchZoom(stage);
        addKonvaListenerTouchMove(stage);
      };
      image.src = props.imgSrc;
    };

    const resizeStage = () => {
      const newWidth = clipWidth(props.width);
      const factor = newWidth / konvaImage.width();
      const newHeight = factor * konvaImage.height();
      konvaImage.width(newWidth);
      konvaImage.height(newHeight);
      imageLayer.batchDraw();
      stage.width(newWidth);
      stage.height(newHeight);
      resizeBoxLayer(factor);
    };

    const modeChanged = (event: ModeChangedEvent) => {
      selectedMode.value = event.detail.value;
    };

    const handleHideNumbersClick = () => {
      if (numberMode.value === NumberMode.ON) {
        hideNumbersFill.value = 'solid';
        hideNumbersText.value = 'Unhide Numbers';
        numberMode.value = NumberMode.OFF;
      } else {
        hideNumbersFill.value = 'outline';
        hideNumbersText.value = 'Hide Numbers';
        numberMode.value = NumberMode.ON;
      }
    };

    const handleReset = () => {
      selectedMode.value = SelectMode.HANDHOLD;
      resetBoxLayerToUnSelected();
    };

    const handleExportClick = async () => {
      const imageUri = stage.toDataURL({ mimeType: 'image/jpeg', pixelRatio: 4 });
      await downloadURI(imageUri, 'Route.jpg');
    };

    const handleTapeClick = () => {
      if (tapeText.value === 'No Tape') {
        tapeFill.value = 'solid';
        tapeText.value = '1-Hold Start';
        tapeMode.value = TapeMode.SINGLE_START;
      } else if (tapeText.value === '1-Hold Start') {
        tapeText.value = '2-Hold Start';
        tapeMode.value = TapeMode.DUAL_START;
      } else {
        tapeFill.value = 'outline';
        tapeText.value = 'No Tape';
        tapeMode.value = TapeMode.NONE;
      }
    };

    onMounted(async () => {
      stage = new Konva.Stage({
        container: 'konva-container',
      });
      imageLayer.listening(false);
      imageLayer.add(konvaImage);
      stage.add(imageLayer);
      stage.add(boxLayer);

      await loadImageOnStage();
    });

    watch(
      () => props.imgSrc,
      async () => {
        offKonvaStageListeners(stage);
        await loadImageOnStage();
      },
    );
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
      handleExportClick,
      handleReset,
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
  margin: 10px 3px;
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

.konva-container {
  width: max-content;
  margin: 0 auto;
}
</style>
