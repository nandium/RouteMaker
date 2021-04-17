<template>
  <div class="home">
    <ImageUploader />
    <ModeSelector />
    <ImageViewer />
  </div>
</template>

<script>
// @ is an alias to /src
import ImageViewer from "@/components/ImageViewer.vue";
import ImageUploader from "@/components/ImageUploader.vue";
import ModeSelector from "@/components/ModeSelector.vue";
import { mapMutations } from "vuex";

export default {
  name: "Home",
  components: {
    ImageViewer,
    ImageUploader,
    ModeSelector
  },
  /**
   * On device window loaded, set a window size to display the picture
   * for all the calculations
   */
  created() {
    window.onload = () => {
      this.setWindowWidth(this.calculateCanvaWindowWidth(window.innerWidth));
    };
    window.addEventListener('resize', () => {
      this.setWindowWidth(this.calculateCanvaWindowWidth(window.innerWidth));
    })
  },
  methods: {
    ...mapMutations("home", {
      setWindowWidth: "setWindowWidth",
    }),
    calculateCanvaWindowWidth(innerWidth) {
      return Math.min(
        800,
        Math.floor((innerWidth / 6) * 5)
      )
    }
  },
};
</script>
