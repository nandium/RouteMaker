<template>
  <b-container fluid class="m-2">
    <v-stage
      :key="stageKey"
      class="canva"
      v-if="isImageUploaded"
      :config="configKonva"
    >
      <v-layer ref="layer">
        <v-image :config="configImage"></v-image>
        <BoundingBox
          :key="idx"
          v-for="(box, idx) in boxes"
          :x="box.x"
          :y="box.y"
          :w="box.w"
          :h="box.h"
        />
      </v-layer>
    </v-stage>
  </b-container>
</template>

<script>
import { getHeightAndWidthFromDataUrl } from "@/common/utils";
import BoundingBox from "./BoundingBox";

export default {
  name: "ImageViewer",
  components: {
    BoundingBox,
  },
  data() {
    return {
      stageKey: 10,
      windowWidth: 400,
      boxes: [],
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
   * Image is set to a fixed width relative to user's device, the height is rescaled
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
        this.boxes = state.home.boxes.filter(box => box.class === "hold");
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
