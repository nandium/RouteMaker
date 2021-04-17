<template>
  <b-container fluid class="m-2">
    <v-stage
      ref="stage"
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
import { mapMutations } from "vuex";
import { getHeightAndWidthFromDataUrl, downloadURI } from "@/common/utils";
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
  mounted() {
    this.$store.subscribe(async (mutation, state) => {
      if (mutation.type == "home/setImageURL") {
        await this.rerenderKonva(state);
      }
      if (mutation.type == "home/setIsImageUploaded") {
        this.isImageUploaded = state.home.isImageUploaded;
      }
      if (mutation.type == "home/setBoxes") {
        this.boxes = state.home.boxes.filter((box) => box.class === "hold");
      }
      if (mutation.type == "home/setWindowWidth") {
        this.windowWidth = state.home.windowWidth;
        this.stageKey += 1;
      }
      /**
       * Downloads and refresh the entire page
       */
      if (mutation.type == "home/setDownloadMode") {
        if (state.home.downloadMode === true) {
          await new Promise((resolve) => setTimeout(resolve, 500));
          this.downloadKonva();
          this.$router.go(0);
        }
      }
    });
  },
  methods: {
    ...mapMutations("home", {
      setDownloadMode: "setDownloadMode",
    }),
    /**
     * When Image URL is set, the Konva image component is re-rendered
     * Image is set to a fixed width relative to user's device, the height is rescaled
     */
    async rerenderKonva(state) {
      const image = new window.Image();
      const imageURL = state.home.imageURL;
      const { height, width } = await getHeightAndWidthFromDataUrl(imageURL);
      image.src = imageURL;
      this.configImage = {
        image,
        width: this.windowWidth,
        height: (height / width) * this.windowWidth,
      };
    },
    /**
     * Creates an link html and downloads it
     * Note: Requires page refresh afterwards as it messes up with html positions
     */
    async downloadKonva() {
      const uri = this.$refs.stage.getNode().toDataURL();
      downloadURI(uri, "Route.jpg");
      this.setDownloadMode(false);
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
