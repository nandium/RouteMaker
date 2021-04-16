<template>
  <b-container>
    <v-stage class="canva" v-if="isImageUploaded" :config="configKonva">
      <v-layer ref="layer">
        <v-image :config="configImage"></v-image>
        <v-circle :config="configCircle1"></v-circle>
        <v-circle :config="configCircle2"></v-circle>
      </v-layer>
    </v-stage>

    <!-- <div class="font-weight-normal" v-else>Insert an image!</div> -->
  </b-container>
</template>

<script>
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
      configImage: {
        image: null,
      },
      isImageUploaded: false,
    };
  },
  /**
   * When Image URL is set, the Konva image component is re-rendered
   */
  mounted() {
    this.$store.subscribe((mutation, state) => {
      if (mutation.type == "home/setImageURL") {
        const image = new window.Image();
        image.src = state.home.imageURL;
        this.configImage = { image };
      }
      if (mutation.type == "home/setIsImageUploaded") {
        this.isImageUploaded = state.home.isImageUploaded;
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
