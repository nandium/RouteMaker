<template>
  <div>
    <img v-if="isImageUploaded" :src="imageURL" alt="" />
    <div class="font-weight-normal" v-else>Insert an image!</div>
  </div>
</template>

<script>
import { mapGetters } from "vuex";

export default {
  name: "ImageViewer",
  computed: {
    ...mapGetters("home", {
      isImageUploaded: "getIsImageUploaded",
      imageURL: "getImageURL",
    }),
  },
};
</script>

<style scoped>
</style>
