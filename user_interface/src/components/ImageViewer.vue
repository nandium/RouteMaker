<template>
  <b-container fluid class="m-2">
    <v-stage :key="stageKey" class="canva" v-if="isImageUploaded" :config="configKonva">
      <v-layer ref="layer">
        <v-image :config="configImage"></v-image>
        <v-rect :key="idx" v-for="(configRect, idx) in configRects" :config="configRect"></v-rect>
      </v-layer>
    </v-stage>
  </b-container>
</template>

<script>
import { getHeightAndWidthFromDataUrl } from "@/common/utils";

export default {
  name: "ImageViewer",
  data() {
    return {
      stageKey: 10,
      windowWidth: 0,
      boxes: [],
      configRects: [{
        x: -10,
        y: -10,
        width: 30,
        height: 50,
        fill: "red",
        stroke: "black",
        strokeWidth: 4,
        opacity: 0.5,
      }],
      configImage: {
        image: null,
      },
      isImageUploaded: false,
    };
  },
  computed: {
    configKonva() {
      return {
        width: this.windowWidth,
        height: this.windowWidth * 1.5,
      };
    },
  },
  /**
   * When Image URL is set, the Konva image component is re-rendered
   * Image is set to a fixed width, the height is rescaled
   * 
   * Stage dimensions are in proportion to the user's device width
   */
  mounted() {
    this.$store.subscribe(async (mutation, state) => {
      if (mutation.type == "home/setImageURL") {
        const image = new window.Image();
        const imageURL = state.home.imageURL;
        const { height, width } = await getHeightAndWidthFromDataUrl(imageURL);
        image.src = imageURL;
        this.configImage = {
          image,
          width: this.windowWidth,
          height: (height / width) * this.windowWidth,
        };
      }
      if (mutation.type == "home/setIsImageUploaded") {
        this.isImageUploaded = state.home.isImageUploaded;
      }
      if (mutation.type == "home/setBoxes") {
        this.boxes = [...state.home.boxes];
      }
      if (mutation.type == "home/setWindowWidth") {
        this.windowWidth = state.home.windowWidth;
        this.stageKey += 1;
      }
    });
  },
};
</script>

<style scoped>
.canva {
  display: flex;
  justify-content: center;
}
</style>
