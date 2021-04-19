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
          :boxId="idx"
        />
      </v-layer>
    </v-stage>
  </b-container>
</template>

<script>
import { mapMutations, mapGetters } from "vuex";
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
      windowWidth: 0,
      boxes: [],
      configImage: {
        image: null,
      },
      isImageUploaded: false,
    };
  },
  computed: {
    ...mapGetters("home", {
      getWindowWidth: "getWindowWidth"
    }),
    configKonva() {
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
       * Awaits for 0.5 sec so that all bounding boxes update properly (Not the best way)
       * Downloads the image
       */
      if (mutation.type == "home/setDownloadMode") {
        if (state.home.downloadMode === true) {
          await new Promise((resolve) => setTimeout(resolve, 500));
          this.downloadKonva();
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
     * StageKey is changed to force update Konva canvas
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
      this.stageKey += 1;
    },
    /**
     * Creates an link html and downloads it
     */
    async downloadKonva() {
      const uri = this.$refs.stage
        .getNode()
        .toDataURL({ mimeType: "image/jpeg" });
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
