<template>
  <b-container fluid class="m-2">
    <b-row class="justify-content-center m-1">
      <b-col md="4" sm="10">
        <b-form-file
          v-model="imageFile"
          :placeholder="loading ? 'Loading..' : 'Climb wall image..'"
          drop-placeholder="Drop file here..."
          :disabled="loading"
        ></b-form-file>
      </b-col>
    </b-row>
    <b-row class="justify-content-center m-1">
      <b-col class="text-danger font-italic" md="4" sm="10">
        {{ errorString }}
      </b-col>
    </b-row>
  </b-container>
</template>

<script>
import { mapMutations } from "vuex";
import getBoundingBox from "@/common/getBoundingBox";

export default {
  name: "ImageUploader",
  data() {
    return {
      imageFile: null,
      loading: false,
      errorString: "",
      windowWidth: window.innerWidth
    };
  },
  async mounted() {
    this.$store.subscribe(async (mutation, state) => {
      if (mutation.type == "home/setWindowWidth") {
        this.windowWidth = state.home.windowWidth;
      }
    });
  },
  watch: {
    /**
     * When image file is attached, triggers file processing
     */
    async imageFile() {
      this.processFile();
    },
  },
  methods: {
    ...mapMutations("home", {
      setImageURL: "setImageURL",
      setIsImageUploaded: "setIsImageUploaded",
      setBoxes: "setBoxes",
    }),
    /**
     * Creates a browser URL for displaying image.
     * Retrieves the bounding boxes from the backend.
     */
    async processFile() {
      if (!this.validate()) return;

      try {
        this.loading = true;
        const imageURL = URL.createObjectURL(this.imageFile);
        this.setImageURL(imageURL);
        await this.uploadFile();
      } catch (error) {
        console.log(error);
      } finally {
        this.loading = false;
      }
    },
    /**
     * FormData is sent with image attached and the desired rescaled width
     * 
     * Existing boxes are reset before the new ones are added
     */
    async uploadFile() {
      const formData = new FormData();
      formData.append("image", this.imageFile);
      formData.append("width", this.windowWidth);

      const boxes = await getBoundingBox(formData);
      this.setBoxes(boxes);
      this.setIsImageUploaded(true);
    },
    validate() {
      this.errorString = "";
      this.setIsImageUploaded(false);
      if (!this.imageFile) {
        this.errorString = "Please attach a file";
        return false;
      }
      if (this.imageFile.size > 4 * 1024 * 1024) {
        this.errorString = "Max image size is 4 MB";
        return false;
      }
      if (!["image/jpeg"].includes(this.imageFile.type)) {
        this.errorString = "Only JPG is allowed";
        return false;
      }
      return true;
    },
  },
};
</script>

<style scoped>
</style>