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
import { IonLabel, IonSegment, IonSegmentButton } from '@ionic/vue';
import { defineComponent, onMounted, ref, watch } from 'vue';
import Konva from 'konva';
import getBoundingBoxes from './getBoundingBoxes';
import BoxClass from './enumBoxClass';
import { DefaultBoundingBox } from './boundingBoxAttributes';

Konva.pixelRatio = 1;

interface BoundingBox {
  x: number;
  y: number;
  w: number;
  h: number;
  class: BoxClass;
}

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
    enum SelectMode {
      HANDHOLD,
      FOOTHOLD,
      DRAWBOX,
      EXPORT,
    }
    const stage = ref<Konva.Stage | null>(null);
    const imageLayer = ref<Konva.Layer | null>(null);
    const boxLayer = ref<Konva.Layer | null>(null);
    const boundingBoxes = ref<BoundingBox[]>([]);

    const updateImage = async () => {
      const image = new Image();
      image.onload = async () => {
        // Clear all boxes first
        if (boxLayer.value) {
          boxLayer.value.destroyChildren();
        }
        // Add image to stage
        if (stage.value && imageLayer.value) {
          stage.value?.width(props.width);
          stage.value?.height((props.width / image.width) * image.height);
          const konvaImage = new Konva.Image({
            x: 0,
            y: 0,
            image: image,
            width: props.width,
            height: (props.width / image.width) * image.height,
          });
          imageLayer.value.clear();
          imageLayer.value.add(konvaImage);
          imageLayer.value.batchDraw();
        }
        // Get new boxes
        const formData = new FormData();
        formData.append('image', await (await fetch(props.imgSrc)).blob());
        formData.append('width', props.width.toString());
        boundingBoxes.value = await getBoundingBoxes(formData);
        if (boxLayer.value) {
          for (const { x, y, w, h, class: boxClass } of boundingBoxes.value) {
            if (boxClass === BoxClass.HOLD) {
              const rect = new Konva.Rect({
                x: x,
                y: y,
                width: w,
                height: h,
                fill: DefaultBoundingBox.fill,
                stroke: DefaultBoundingBox.stroke,
                strokeWidth: DefaultBoundingBox.strokeWidth,
                opacity: DefaultBoundingBox.opacity,
              });
              boxLayer.value.add(rect);
            }
          }
          boxLayer.value.batchDraw();
        }
      };
      image.src = props.imgSrc;
    };

    const resizeBoundingBoxes = () => {
      console.log('hi');
    };

    const modeChanged = (event: CustomEvent) => {
      console.log(event.detail.value);
    };

    onMounted(() => {
      stage.value = new Konva.Stage({
        container: 'konva-container',
      });

      const tempImageLayer = new Konva.Layer();
      tempImageLayer.listening(false);
      imageLayer.value = tempImageLayer;
      stage.value.add(tempImageLayer);

      const tempBoxLayer = new Konva.Layer();
      boxLayer.value = tempBoxLayer;
      stage.value.add(tempBoxLayer);

      updateImage();
    });
    watch(() => props.imgSrc, updateImage);
    watch(
      () => props.width,
      () => {
        updateImage().then(resizeBoundingBoxes);
      },
    );

    return {
      SelectMode,
      modeChanged,
      stage,
      imageLayer,
      boxLayer,
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
