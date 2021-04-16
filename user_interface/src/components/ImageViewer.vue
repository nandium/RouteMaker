<template>
  <b-container>
    <v-stage class="canva" v-if="isImageUploaded" :config="configKonva">
      <v-layer>
        <v-image :config="{ image: uploadedImage }"></v-image>
        <v-circle :config="configCircle1"></v-circle>
        <v-circle :config="configCircle2"></v-circle>
      </v-layer>
    </v-stage>

    <!-- <div class="font-weight-normal" v-else>Insert an image!</div> -->
  </b-container>
</template>

<script>
import { mapGetters } from "vuex";

export default {
  name: "ImageViewer",
  data() {
    return {
      configKonva: {
        width: 500,
        height: 500,
      },
      configCircle1: {
        x: 100,
        y: 100,
        radius: 30,
        fill: "red",
        stroke: "black",
        strokeWidth: 4,
        opacity: 0.5,
      },
      configCircle2: {
        x: 120,
        y: 120,
        radius: 30,
        fill: "red",
        stroke: "black",
        strokeWidth: 4,
        opacity: 0.5,
      },
    };
  },
  computed: {
    ...mapGetters("home", {
      isImageUploaded: "getIsImageUploaded",
      imageURL: "getImageURL",
    }),
    uploadedImage() {
      const image = new window.Image();
      image.src = this.imageURL;
      return image;
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
