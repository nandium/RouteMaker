<template>
  <div class="home">
    <ImageViewer />
    <ImageUploader />
  </div>
</template>

<script>
// @ is an alias to /src
import ImageViewer from "@/components/ImageViewer.vue";
import ImageUploader from "@/components/ImageUploader.vue";

export default {
  name: "Home",
  components: {
    ImageViewer,
    ImageUploader,
  },
};
</script>
