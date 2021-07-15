<template>
  <div>
    <br />
    <br />
    <div class="sticky-button-rows">
      <ion-item class="instruction-steps">
        <ion-icon
          v-if="routeMakingStep > 0"
          slot="start"
          :icon="chevronBackOutline"
          @click="changeRouteMakingStep(false)"
        ></ion-icon>
        <ion-text v-if="routeMakingStep === 0">Draw unmarked rocks. Pinch to zoom</ion-text>
        <ion-text v-if="routeMakingStep === 1">Select handholds &#38; footholds</ion-text>
        <ion-text v-if="routeMakingStep === 2">Do handhold orders matter?</ion-text>
        <ion-text v-if="routeMakingStep === 3">One hand or two hand start?</ion-text>
        <ion-text v-if="routeMakingStep === 4">Export locally or post on wall?</ion-text>
        <ion-icon
          v-if="routeMakingStep < 4"
          slot="end"
          :icon="chevronForwardOutline"
          @click="changeRouteMakingStep(true)"
        ></ion-icon>
      </ion-item>

      <ion-button
        v-if="routeMakingStep === 0"
        @click="handleUndoDraw"
        class="solid-button"
        fill="solid"
        color="danger"
      >
        Undo Draw
      </ion-button>
      <ion-row class="hold-picker" v-if="routeMakingStep === 1">
        <ion-col size-xs="9">
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
        <ion-col size-xs="3">
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
        <ion-button @click="handlePostClick" class="solid-button" fill="solid" color="primary">
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
} from '@ionic/vue';
import { defineComponent, inject, onMounted, ref, watch, PropType } from 'vue';
import { useRouter } from 'vue-router';
import { chevronForwardOutline, chevronBackOutline } from 'ionicons/icons';

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
    const loadingSpinner = inject('$loading') as Record<string, any>;
    const routeMakingStep = ref(0);

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
      image.onload = async () => {
        // Clear all boxes first
        clearBoxLayer();
        // Add image to stage
        stage.width(props.width);
        stage.height((props.width / image.width) * image.height);
        konvaImage.setAttrs({
          image,
          width: props.width,
          height: (props.width / image.width) * image.height,
        });
        // Get new boxes
        const formData = new FormData();
        formData.append('image', await (await fetch(props.imgSrc)).blob());
        formData.append('width', props.width.toString());
        let rawBoundingBoxes: Array<any>;
        const loadingSpinnerInstance = loadingSpinner.show({ canCancel: false });
        try {
          rawBoundingBoxes = await getBoundingBoxes(formData);
        } finally {
          loadingSpinnerInstance.hide();
        }
        addBoxLayerBoundingBoxes(rawBoundingBoxes);
        imageLayer.batchDraw();

        // Listeners must be added after image is loaded
        // Currently initial listeners are for SelectMode.DRAWBOX
        addKonvaListenerPinchZoom(stage);
        DrawLayer.addKonvaDrawLayer(stage);
      };
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
      const factor = props.width / konvaImage.width();
      const newHeight = factor * konvaImage.height();
      konvaImage.width(props.width);
      konvaImage.height(newHeight);
      imageLayer.batchDraw();
      stage.width(props.width);
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
      router.push('/uploadRoute');
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

    watch(
      () => props.imgSrc,
      async () => {
        offKonvaStageListeners(stage);
        await loadImageOnStage();
      },
    );

    /**
     * Depending on the step of the route making process, the canvas mode is switched accordingly
     */
    const changeRouteMakingStep = (doIncrement: boolean) => {
      if (doIncrement) {
        if (routeMakingStep.value + 1 > 4) return;
        routeMakingStep.value = routeMakingStep.value + 1;
      } else {
        if (routeMakingStep.value - 1 < 0) return;
        routeMakingStep.value = routeMakingStep.value - 1;
      }
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
      handleReset,
      routeMakingStep,
      chevronForwardOutline,
      chevronBackOutline,
      changeRouteMakingStep,
      changeSelectMode,
    };
  },
});
</script>

<style scoped>
.instruction-steps {
  max-width: 500px;
  margin: 0 auto;
  border-radius: 5px;
  border: 2px solid var(--ion-color-tertiary);
  filter: hue-rotate(90deg);
  background-color: var(--ion-background-color);
}

.hold-picker {
  max-width: 500px;
  margin: 0 auto;
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

.sticky-button-rows {
  position: sticky;
  position: -webkit-sticky; /* Safari */
  top: 0px;
  padding-top: 10px;
  z-index: 10;
}
</style>
