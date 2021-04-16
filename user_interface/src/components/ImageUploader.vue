<template>
  <div class="m-1">
    <b-form-file
      v-model="imageFile"
      placeholder="Choose a file or drop it here..."
      drop-placeholder="Drop file here..."
    ></b-form-file>
    <div class="mt-1">
      <b-button :disabled="loading" @click="processFile">{{
        loading ? "Loading.." : "Insert"
      }}</b-button>
    </div>
    <div class="mt-1 font-italic text-danger">{{ errorString }}</div>
  </div>
</template>

<script>
import { mapMutations } from "vuex";
import getBoundingBox from "../api/getBoundingBox";

export default {
  name: "ImageUploader",
  data() {
    return {
      imageFile: null,
      loading: false,
      errorString: "",
    };
  },
  methods: {
    ...mapMutations("home", {
      setImageURL: "setImageURL",
      setIsImageUploaded: "setIsImageUploaded",
    }),
    /**
     * Creates a browser URL for displaying image.
     * Retrieves the bounding boxes from the backend.
     */
    async processFile() {
      if(!this.validate()) return;

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
    async uploadFile() {
      const formData = new FormData();
      formData.append("image", this.imageFile);
      console.log(this.imageFile);

      const data = await getBoundingBox(formData);
      console.log(data);
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

<style>
</style>