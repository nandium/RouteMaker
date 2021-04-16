<template>
  <div class="home">
    <ImageUploader />
    <ImageViewer />
  </div>
</template>

<script>
// @ is an alias to /src
import ImageViewer from "@/components/ImageViewer.vue";
import ImageUploader from "@/components/ImageUploader.vue";
import { mapMutations } from "vuex";

export default {
  name: "Home",
  components: {
    ImageViewer,
    ImageUploader,
  },
  /**
   * On device window loaded, set a window size to display the picture
   * for all the calculations
   */
  created() {
    window.onload = () => {
      this.setWindowWidth(Math.floor((window.innerWidth / 6) * 5));
    };
    window.addEventListener('resize', () => {
      this.setWindowWidth(Math.floor((window.innerWidth / 6) * 5));
    })
  },
  methods: {
    ...mapMutations("home", {
      setWindowWidth: "setWindowWidth",
    }),
  },
};
</script>
