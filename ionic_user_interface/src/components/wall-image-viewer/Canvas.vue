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
    <v-stage ref="stage" v-if="imgSrc" :config="configStage">
      <v-layer ref="layer">
        <v-image :config="configImage" />
        <!-- TODO: Add watermark -->
        <!-- <v-text :config="configWatermark" /> -->
        <BoundingBox
          v-for="(bConfig, idx) in boundingBoxeConfigs"
          :key="idx"
          :boxId="bConfig.boxId"
          :boxDims="bConfig.boxDims"
          :boxState="bConfig.boxState"
          :numberText="bConfig.numberText"
          :selectMode="selectedMode"
        />
      </v-layer>
    </v-stage>
  </div>
</template>

<script lang="ts">
import Konva from 'konva';
import getBoundingBoxes from './getBoundingBoxes';
import BoundingBox from './BoundingBox.vue';
import { IonLabel, IonSegment, IonSegmentButton } from '@ionic/vue';
import { defineComponent, onMounted, ref, watch } from 'vue';
import { BoxState, SelectMode } from './enums';
import { getHeightAndWidthFromDataUrl } from '../../common/utils';
import { ConfigStage, ConfigImage, ModeChangedEvent, BoundingBoxConfig } from './types';

Konva.pixelRatio = 1;

export default defineComponent({
  name: 'Canvas',
  components: {
    IonLabel,
    IonSegment,
    IonSegmentButton,
    BoundingBox,
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
    const configStage = ref<ConfigStage>();
    const configImage = ref<ConfigImage>();
    const boundingBoxeConfigs = ref<BoundingBoxConfig[]>([]);
    const selectedMode = ref<SelectMode>(SelectMode.HANDHOLD);

    /**
     * Updates the Konva stage dimension and Image
     * Add the bounding boxes retrieved from backend
     */
    const updateImage = async () => {
      const windowImage = new window.Image();
      windowImage.src = props.imgSrc;
      const { height: dataUrlHeight, width: dataUrlWidth } = await getHeightAndWidthFromDataUrl(
        props.imgSrc,
      );
      const imageHeight = (dataUrlHeight / dataUrlWidth) * props.width;
      const formData = new FormData();
      formData.append('image', await (await fetch(props.imgSrc)).blob());
      formData.append('width', props.width.toString());
      const boundingBoxes = await getBoundingBoxes(formData);
      boundingBoxeConfigs.value = boundingBoxes.map((box, idx) => {
        const { x, y, w, h } = box;
        return {
          boxId: idx,
          boxState: BoxState.UNSELECTED,
          numberText: 0,
          boxDims: {
            x,
            y,
            w,
            h,
          },
        };
      });
      configStage.value = {
        width: props.width,
        height: imageHeight,
      };
      configImage.value = {
        image: windowImage,
        width: props.width,
        height: imageHeight,
      };
    };

    const resizeBoundingBoxes = () => {
      console.log('hi');
    };

    // TODO: Mode changing is slow because the mode is passed as prop to all bounding boxes
    const modeChanged = (event: ModeChangedEvent) => {
      selectedMode.value = event.detail.value;
    };

    onMounted(updateImage);
    watch(() => props.imgSrc, updateImage);
    watch(() => props.width, updateImage);

    return {
      SelectMode,
      modeChanged,
      configStage,
      configImage,
      boundingBoxeConfigs,
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
