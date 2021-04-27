<template>
  <b-container fluid class="my-2">
    <v-stage ref="stage" class="canva" v-if="isImageUploaded" :config="configStage">
      <v-layer ref="layer">
        <v-image :config="configImage"></v-image>
        <v-text :config="configWatermark"></v-text>
        <BoundingBox
          :key="idx"
          v-for="(box, idx) in boxes"
          :x="box.x"
          :y="box.y"
          :w="box.w"
          :h="box.h"
          :boxId="idx"
        />
      </v-layer>
    </v-stage>
  </b-container>
</template>

<script>
import { mapMutations, mapGetters } from 'vuex';
import { getHeightAndWidthFromDataUrl, downloadURI } from '@/common/utils';
import {
  waitForKonvaStageLoad,
  addKonvaListenerPinchZoom,
  addKonvaListenerTouchMove,
  offKonvaStageListeners,
  addKonvaDrawLayer,
  getKonvaDrawLayerBoundingBoxes,
  removeKonvaDrawLayer,
  removeKonvaLastDrawnRect,
  OPTIMIZATION_PARAMS,
} from '@/common/konva';
import BoundingBox from '@/components/BoundingBox.vue';
import SelectModes from '@/common/enumSelectMode';
import BoxClass from '@/common/enumBoxClass';

export default {
  name: 'ImageViewer',
  components: {
    BoundingBox,
  },
  data() {
    return {
      windowWidth: 0,
      boxes: [],
      configImage: {
        image: null,
      },
      isImageUploaded: false,
      selectMode: null,
      configStage: {
        width: null,
        height: null,
      },
      configWatermark: {
        x: 5,
        y: 5,
        fill: 'black',
        text: 'tinyurl.com/makeclimbroutes',
        opacity: 0,
        fontSize: 15,
        ...OPTIMIZATION_PARAMS,
      },
    };
  },
  computed: {
    ...mapGetters('home', {
      getWindowWidth: 'getWindowWidth',
      getSelectMode: 'getSelectMode',
    }),
  },
  created() {
    this.windowWidth = this.getWindowWidth;
    this.selectMode = this.getSelectMode;
  },
  mounted() {
    this.$store.subscribe(async (mutation, state) => {
      if (mutation.type === 'home/setImageURL') {
        await this.rerenderKonva(state);
      }
      if (mutation.type === 'home/setIsImageUploaded') {
        this.isImageUploaded = state.home.isImageUploaded;
      }
      if (mutation.type === 'home/setBoxes') {
        this.boxes = state.home.boxes.filter((box) => box.class !== BoxClass.VOLUME);
      }
      if (mutation.type === 'home/setWindowWidth') {
        this.windowWidth = state.home.windowWidth;
        await this.rerenderKonva(state);
      }
      if (mutation.type === 'home/setSelectMode') {
        this.selectMode = state.home.selectMode;
      }
      /**
       * Awaits for 0.5 sec so that all bounding boxes update properly (Not the best way)
       * Downloads the image after adding watermark
       */
      if (mutation.type === 'home/setDownloadMode') {
        if (state.home.downloadMode === true) {
          this.configWatermark = { ...this.configWatermark, opacity: 1 };
          await new Promise((resolve) => setTimeout(resolve, 500));
          this.downloadKonva();
          this.configWatermark = { ...this.configWatermark, opacity: 0 };
        }
      }
    });

    /**
     * When undo action is received, the last rectangle added is destroyed
     */
    this.$store.subscribeAction((action) => {
      if (action.type === 'home/undoDrawBox') {
        if (this.selectMode === SelectModes.DRAWBOX && this.$refs.stage) {
          removeKonvaLastDrawnRect(this.$refs.stage.getNode());
        }
      }
    });
  },
  watch: {
    /**
     * If switching to DRAW mode, remove all listeners, add back touch move listener and add DrawLayer
     * If switching away from DRAW mode, remove DrawLayer, add back pinch zoom, and store the new boxes
     */
    selectMode(newSelectMode, oldSelectMode) {
      if (newSelectMode === SelectModes.DRAWBOX) {
        const stageNode = this.$refs.stage.getNode();
        offKonvaStageListeners(stageNode);
        addKonvaListenerPinchZoom(stageNode);
        addKonvaDrawLayer(stageNode);
      } else if (oldSelectMode === SelectModes.DRAWBOX) {
        const stageNode = this.$refs.stage.getNode();
        const newBoxes = getKonvaDrawLayerBoundingBoxes(stageNode);
        removeKonvaDrawLayer(stageNode);
        addKonvaListenerTouchMove(stageNode);
        this.setBoxes([...this.boxes, ...newBoxes]);
      }
    },
  },
  methods: {
    ...mapMutations('home', {
      setDownloadMode: 'setDownloadMode',
      setBoxes: 'setBoxes',
    }),
    /**
     * When Image URL is set, the Konva Stage component is re-rendered
     * Image is set to a fixed width relative to user's device, the height is rescaled
     * Event listeners are registered to the Konva Stage
     */
    async rerenderKonva(state) {
      const image = new window.Image();
      const imageURL = state.home.imageURL;
      const { height, width } = await getHeightAndWidthFromDataUrl(imageURL);
      const imageHeight = (height / width) * this.windowWidth;
      if (this.configImage.image !== null) {
        const sizeChangeRatio = imageHeight / this.configImage.height;
        let newBoxes = [];
        for (const { x, y, w, h, class: boxClass } of this.boxes) {
          newBoxes.push({
            x: x * sizeChangeRatio,
            y: y * sizeChangeRatio,
            w: w * sizeChangeRatio,
            h: h * sizeChangeRatio,
            class: boxClass,
          });
        }
        this.setBoxes(newBoxes);
      }
      image.src = imageURL;
      this.configStage = {
        width: this.windowWidth,
        height: imageHeight,
      };
      this.configImage = {
        image,
        width: this.windowWidth,
        height: imageHeight,
      };
      await this.updateStageListeners();
    },
    /**
     * Creates an link html and downloads it
     */
    downloadKonva() {
      const uri = this.$refs.stage.getNode().toDataURL({ mimeType: 'image/jpeg', pixelRatio: 4 });
      downloadURI(uri, 'Route.jpg');
      this.setDownloadMode(false);
    },
    async updateStageListeners() {
      /**
       * Rerendering causes race condition where this.$refs are not immediately ready
       */
      await waitForKonvaStageLoad(this.$refs, 100);
      const stageNode = this.$refs.stage.getNode();
      offKonvaStageListeners(stageNode);
      addKonvaListenerPinchZoom(stageNode);
      addKonvaListenerTouchMove(stageNode);
    },
  },
};
</script>

<style scoped>
.canva {
  display: flex;
  justify-content: center;
}
</style>
