<template>
  <div class="home">
    <b-jumbotron header-level="4" header="Route Maker" lead="Quickly make custom climbing routes">
    </b-jumbotron>
    <ImageUploader />
    <ModeSelector />
    <ImageViewer />
  </div>
</template>

<script>
// @ is an alias to /src
import { calculateDefaultKonvaWindowWidth } from '@/common/konva';
import ImageViewer from '@/components/ImageViewer.vue';
import ImageUploader from '@/components/ImageUploader.vue';
import ModeSelector from '@/components/ModeSelector.vue';
import { mapMutations } from 'vuex';

export default {
  name: 'Home',
  components: {
    ImageViewer,
    ImageUploader,
    ModeSelector,
  },
  /**
   * On device window loaded, set a window size to display the picture
   * for all the calculations
   */
  created() {
    window.onload = () => {
      this.setWindowWidth(calculateDefaultKonvaWindowWidth(document.body.clientWidth));
    };
  },
  methods: {
    ...mapMutations('home', {
      setWindowWidth: 'setWindowWidth',
    }),
  },
};
</script>
<style scoped>
.home {
  margin: 0 !important;
}
</style>
