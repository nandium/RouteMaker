<template>
  <div class="home">
    <b-jumbotron
      header-level="4"
      header="Route Maker"
      lead="Quickly make custom climbing routes"
    >
    </b-jumbotron>
    <ImageUploader />
    <ModeSelector />
    <ImageViewer />
    <Loader :isLoading="isLoading" />
  </div>
</template>

<script>
// @ is an alias to /src
import ImageViewer from "@/components/ImageViewer.vue";
import ImageUploader from "@/components/ImageUploader.vue";
import ModeSelector from "@/components/ModeSelector.vue";
import Loader from "@/components/Loader.vue";
import { mapMutations } from "vuex";

export default {
  name: "Home",
  components: {
    ImageViewer,
    ImageUploader,
    ModeSelector,
    Loader
  },
  data() {
    return {
      isLoading: true
    }
  },
  /**
   * On device window loaded, set a window size to display the picture
   * for all the calculations
   */
  created() {
    window.onload = () => {
      this.setWindowWidth(this.calculateCanvaWindowWidth(window.innerWidth));
      this.isLoading = false;
    };
    window.addEventListener("resize", () => {
      this.setWindowWidth(this.calculateCanvaWindowWidth(window.innerWidth));
    });
  },
  methods: {
    ...mapMutations("home", {
      setWindowWidth: "setWindowWidth",
    }),
    calculateCanvaWindowWidth(innerWidth) {
      return Math.min(800, Math.floor((innerWidth / 6) * 5));
    },
  },
};
</script>
