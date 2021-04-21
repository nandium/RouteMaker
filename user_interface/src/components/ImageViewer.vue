<template>
  <b-container fluid class="my-2">
    <v-stage ref="stage" class="canva" v-if="isImageUploaded" :config="configStage">
      <v-layer ref="layer">
        <v-image :config="configImage"></v-image>
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
import { waitForKonvaStageLoad, addPinchZoomToStage } from '@/common/konvaMethods';
import BoundingBox from '@/components/BoundingBox.vue';

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
    };
  },
  computed: {
    ...mapGetters('home', {
      getWindowWidth: 'getWindowWidth',
    }),
    configStage() {
      return {
        width: this.windowWidth,
        height: this.windowWidth * 1.5,
      };
    },
  },
  created() {
    this.windowWidth = this.getWindowWidth;
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
        this.boxes = state.home.boxes.filter((box) => box.class === 'hold');
      }
      if (mutation.type === 'home/setWindowWidth') {
        this.windowWidth = state.home.windowWidth;
      }
      /**
       * Awaits for 0.5 sec so that all bounding boxes update properly (Not the best way)
       * Downloads the image
       */
      if (mutation.type === 'home/setDownloadMode') {
        if (state.home.downloadMode === true) {
          await new Promise((resolve) => setTimeout(resolve, 500));
          this.downloadKonva();
        }
      }
    });
  },
  methods: {
    ...mapMutations('home', {
      setDownloadMode: 'setDownloadMode',
    }),
    /**
     * When Image URL is set, the Konva image component is re-rendered
     * Image is set to a fixed width relative to user's device, the height is rescaled
     */
    async rerenderKonva(state) {
      const image = new window.Image();
      const imageURL = state.home.imageURL;
      const { height, width } = await getHeightAndWidthFromDataUrl(imageURL);
      const imageHeight = (height / width) * this.windowWidth;
      image.src = imageURL;
      this.configImage = {
        image,
        width: this.windowWidth,
        height: imageHeight,
      };
      await this.setStageZoom(this.windowWidth, imageHeight);
    },
    /**
     * Creates an link html and downloads it
     */
    async downloadKonva() {
      const uri = this.$refs.stage.getNode().toDataURL({ mimeType: 'image/jpeg' });
      downloadURI(uri, 'Route.jpg');
      this.setDownloadMode(false);
    },
    async setStageZoom(imageWidth, imageHeight) {
      /**
       * Rerendering causes race condition where this.$refs are not immediately ready
       */
      await waitForKonvaStageLoad(this.$refs, 100);
      const stage = this.$refs.stage.getNode();
      addPinchZoomToStage(stage, imageWidth, imageHeight);
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
