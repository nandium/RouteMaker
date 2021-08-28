<template>
  <div>
    <br />
    <br />
    <div v-if="isLoading" class="loading-spinner-div">
      <ion-spinner name="crescent"></ion-spinner>
      <p>Detecting holds...</p>
    </div>
    <div v-else class="sticky-button-rows">
      <ion-item class="instruction-steps ion-text-center">
        <div
          class="instruction-arrow shift-down"
          v-if="routeMakingStep > 0"
          slot="start"
          @click="changeRouteMakingStep(routeMakingStep - 1)"
        >
          <ion-icon :icon="caretBackOutline"></ion-icon>
        </div>
        <ion-text v-if="routeMakingStep === 0">
          1. Drag to draw the undetected holds. Pinch to zoom
        </ion-text>
        <ion-text v-if="routeMakingStep === 1">2. Select handholds &#38; footholds</ion-text>
        <ion-text v-if="routeMakingStep === 2">3. Does handhold order matter?</ion-text>
        <ion-text v-if="routeMakingStep === 3">4. One hand or two hand start?</ion-text>
        <ion-text v-if="routeMakingStep === 4">5. Export locally or post to share?</ion-text>
        <div
          class="instruction-arrow"
          v-if="routeMakingStep < 4"
          slot="end"
          @click="changeRouteMakingStep(routeMakingStep + 1)"
        >
          <ion-icon :icon="caretForwardOutline"></ion-icon>
        </div>
      </ion-item>

      <div v-if="routeMakingStep === 0">
        <ion-button @click="handleUndoDraw" class="solid-button" fill="solid" color="danger">
          Undo Draw
        </ion-button>
        <ion-button @click="handleScrollTop" class="solid-button" fill="solid" color="tertiary">
          Scroll Top
        </ion-button>
      </div>
      <ion-row class="hold-picker" v-if="routeMakingStep === 1">
        <ion-col class="ion-no-padding" size-xs="9">
          <ion-segment
            @ionChange="changeSelectMode($event.detail.value)"
            color="tertiary"
            mode="ios"
            :value="selectedMode"
          >
            <ion-segment-button :value="SelectMode.HANDHOLD">
              <ion-label>HandHold</ion-label>
            </ion-segment-button>
            <ion-segment-button :value="SelectMode.FOOTHOLD">
              <ion-label>FootHold</ion-label>
            </ion-segment-button>
          </ion-segment>
        </ion-col>
        <ion-col class="ion-no-padding" size-xs="3">
          <ion-button class="solid-button" fill="solid" color="danger" @click="handleReset">
            Reset
          </ion-button>
        </ion-col>
      </ion-row>
      <div v-if="routeMakingStep === 2">
        <ion-button class="outline-button" @click="handleHideNumbersClick" color="tertiary">
          {{ hideNumbersText }}
        </ion-button>
      </div>
      <div v-if="routeMakingStep === 3">
        <ion-button class="outline-button" @click="handleTapeClick" color="primary">
          {{ tapeText }}
        </ion-button>
      </div>
      <div v-if="routeMakingStep === 4">
        <ion-button @click="handleExportClick" class="solid-button" color="medium">
          Export
        </ion-button>
        <ion-button @click="handlePostClick" class="solid-button" fill="solid" color="tertiary">
          Post
        </ion-button>
      </div>
    </div>
    <div id="konva-container" class="konva-container"></div>
  </div>
</template>

<script lang="ts">
import Konva from 'konva';
import {
  IonButton,
  IonLabel,
  IonSegment,
  IonSegmentButton,
  IonContent,
  IonIcon,
  IonItem,
  IonText,
  IonRow,
  IonCol,
  IonSpinner,
} from '@ionic/vue';
import { defineComponent, inject, onMounted, ref, watch, PropType } from 'vue';
import { useRouter } from 'vue-router';
import { caretForwardOutline, caretBackOutline } from 'ionicons/icons';

import getBoundingBoxes from '@/components/wall-image-viewer/getBoundingBoxes';
import { useBoxLayer, DrawLayer } from '@/components/wall-image-viewer/box-layer';
import { downloadURI } from '@/common/download';
import { SelectMode, TapeMode, NumberMode } from '@/components/wall-image-viewer/types';
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
    IonIcon,
    IonItem,
    IonText,
    IonRow,
    IonCol,
    IonSpinner,
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
    ionContent: {
      type: Object as PropType<typeof IonContent>,
      required: true,
    },
  },
  setup(props) {
    const router = useRouter();
    const selectedMode = ref<SelectMode>(SelectMode.DRAWBOX);
    const tapeMode = ref<TapeMode>(TapeMode.NONE);
    const numberMode = ref<NumberMode>(NumberMode.ON);
    const hideNumbersText = ref<string>('Hide Numbers');
    const tapeText = ref<string>('No Tape');
    const isLoading = ref(false);
    const routeMakingStep = ref(0);

    const computeDimensions = (heightToWidthRatio: number) => {
      const windowHeight =
        window.innerHeight && document.documentElement.clientHeight
          ? Math.min(window.innerHeight, document.documentElement.clientHeight)
          : window.innerHeight ||
            document.documentElement.clientHeight ||
            document.getElementsByTagName('body')[0].clientHeight;
      const height = Math.min(props.width * heightToWidthRatio, windowHeight * 0.95);
      const width = height * (1 / heightToWidthRatio);
      return { width, height };
    };

    const setRouteImageUri: (imageUri: string) => void = inject(
      'setRouteImageUri',
      () => undefined,
    );

    let stage: Konva.Stage;
    const imageLayer = new Konva.Layer();
    const konvaImage = new Konva.Image({ image: undefined });
    const {
      boxLayer,
      resizeBoxLayer,
      addBoxLayerBoundingBoxes,
      clearBoxLayer,
      resetBoxLayerToUnSelected,
    } = useBoxLayer(selectedMode, tapeMode, numberMode);

    /**
     * Loads the Image and the bounding boxes retrieved from backend.
     */
    const loadImageOnStage = async () => {
      const image = new Image();
      // eslint-disable-next-line
      image.addEventListener('load', async function () {
        // Clear all boxes first
        clearBoxLayer();
        // Add image to stage
        const { width, height } = computeDimensions(image.height / image.width);
        stage.width(width);
        stage.height(height);
        konvaImage.setAttrs({ image, width, height });
        // Get new boxes
        const formData = new FormData();
        const imageWidth = this.width;
        formData.append('image', await (await fetch(props.imgSrc)).blob());
        formData.append('width', imageWidth.toString());
        let rawBoundingBoxes: Array<any>;
        isLoading.value = true;
        try {
          rawBoundingBoxes = await getBoundingBoxes(formData);
        } finally {
          isLoading.value = false;
        }
        addBoxLayerBoundingBoxes(rawBoundingBoxes);
        resizeBoxLayer(width / imageWidth);
        imageLayer.batchDraw();

        // Listeners must be added after image is loaded
        // Currently initial listeners are for SelectMode.DRAWBOX
        addKonvaListenerPinchZoom(stage);
        DrawLayer.addKonvaDrawLayer(stage);
      });
      image.src = props.imgSrc;
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

    /**
     * Changing to drawing mode -> Draw layer is added
     * Changing away from drawing mode -> Boxes are exported from Draw layer into BoxLayer
     */
    const changeSelectMode = (newSelectedMode: SelectMode) => {
      const oldSelectedMode = selectedMode.value;
      if (+newSelectedMode === SelectMode.DRAWBOX) {
        offKonvaStageListeners(stage);
        addKonvaListenerPinchZoom(stage);
        DrawLayer.addKonvaDrawLayer(stage);
      } else if (+oldSelectedMode === SelectMode.DRAWBOX) {
        const newBoundingBoxes = DrawLayer.getKonvaDrawLayerBoundingBoxes(stage);
        DrawLayer.removeKonvaDrawLayer(stage);
        addKonvaListenerTouchMove(stage, props.ionContent);
        addBoxLayerBoundingBoxes(newBoundingBoxes);
        imageLayer.batchDraw();
      }
      selectedMode.value = newSelectedMode;
    };

    const resizeStage = () => {
      const { width: newWidth, height: newHeight } = computeDimensions(
        konvaImage.height() / konvaImage.width(),
      );
      const factor = newWidth / konvaImage.width();
      konvaImage.width(newWidth);
      konvaImage.height(newHeight);
      imageLayer.batchDraw();
      stage.width(newWidth);
      stage.height(newHeight);
      resizeBoxLayer(factor);
      if (DrawLayer.isDrawLayerAdded(stage)) {
        DrawLayer.resizeDrawLayer(stage, factor);
      }
    };
    watch(() => props.width, resizeStage);

    const handleHideNumbersClick = () => {
      if (numberMode.value === NumberMode.ON) {
        hideNumbersText.value = 'Unhide Numbers';
        numberMode.value = NumberMode.OFF;
      } else {
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

    const handlePostClick = () => {
      const imageUri = stage.toDataURL({ mimeType: 'image/jpeg', pixelRatio: 4 });
      setRouteImageUri(imageUri);
      router.push({ name: 'UploadRoute' });
    };

    const handleTapeClick = () => {
      if (tapeText.value === 'No Tape') {
        tapeText.value = '1-Hold Start';
        tapeMode.value = TapeMode.SINGLE_START;
      } else if (tapeText.value === '1-Hold Start') {
        tapeText.value = '2-Hold Start';
        tapeMode.value = TapeMode.DUAL_START;
      } else {
        tapeText.value = 'No Tape';
        tapeMode.value = TapeMode.NONE;
      }
    };

    const handleUndoDraw = () => {
      if (DrawLayer.isDrawLayerAdded(stage)) {
        DrawLayer.removeKonvaLastDrawnRect(stage);
      }
    };

    const handleScrollTop = () => {
      props.ionContent.$el.scrollToTop(500);
    };

    watch(
      () => props.imgSrc,
      async () => {
        changeRouteMakingStep(0);
        await loadImageOnStage();
      },
    );

    /**
     * Depending on the step of the route making process, the canvas mode is switched accordingly
     */
    const changeRouteMakingStep = (step: number) => {
      if (step > 4 || step < 0) return;
      routeMakingStep.value = step;

      switch (routeMakingStep.value) {
        case 0:
          changeSelectMode(SelectMode.DRAWBOX);
          break;
        case 1:
          changeSelectMode(SelectMode.HANDHOLD);
          break;
        case 2:
          changeSelectMode(SelectMode.MARKDONE);
          break;
        case 3:
          changeSelectMode(SelectMode.MARKDONE);
          break;
        case 4:
          changeSelectMode(SelectMode.MARKDONE);
          break;
      }
    };

    return {
      SelectMode,
      selectedMode,
      hideNumbersText,
      handleHideNumbersClick,
      tapeText,
      handleTapeClick,
      handleExportClick,
      handlePostClick,
      handleUndoDraw,
      handleScrollTop,
      handleReset,
      routeMakingStep,
      caretForwardOutline,
      caretBackOutline,
      changeRouteMakingStep,
      changeSelectMode,
      isLoading,
    };
  },
});
</script>

<style scoped lang="scss">
.instruction-steps {
  max-width: 500px;
  margin: 0 auto;
  border-radius: 5px;
  border: 2px solid var(--ion-color-tertiary);
  filter: hue-rotate(90deg);
  background-color: var(--ion-background-color);
  display: flex;
  align-items: center;
  justify-content: center;
}

.instruction-arrow {
  height: 25px;
  width: 25px;

  ion-icon {
    height: 25px;
    width: 25px;
    color: var(--ion-color-medium);
  }

  &:hover {
    cursor: pointer;
  }

  &:hover > ion-icon {
    color: var(--ion-color-dark-shade);
  }
}

.shift-down {
  margin-top: 1px;
}

.hold-picker {
  max-width: 500px;
  margin: 0 auto;
  display: flex;
  align-items: center;
}

ion-segment {
  margin: 2px auto;
  height: 44px;
  border-radius: 3px;
  border: 2px solid var(--ion-color-tertiary);
  padding: 1px 3px;
  filter: hue-rotate(90deg);
  background-color: var(--ion-background-color);
}

ion-segment-button {
  color: var(--ion-color-dark);
  border-radius: 0px;

  &::part(indicator-background) {
    background: var(--ion-color-tertiary);
  }
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

  &::part(native) {
    font-weight: 600;
  }
}

.outline-button::part(native) {
  border: 2px solid;
  filter: sepia(35%);

  &:hover {
    filter: sepia(10%);
  }
}

.konva-container {
  width: max-content;
  margin: 0 auto;
}

.sticky-button-rows {
  position: sticky;
  position: -webkit-sticky; /* Safari */
  top: 0px;
  padding-top: 10px;
  z-index: 10;
}

.loading-spinner-div {
  margin: 2rem;

  p {
    font-size: 1.2em;
  }

  ion-spinner {
    height: 3rem;
    width: 3rem;
  }
}
</style>
