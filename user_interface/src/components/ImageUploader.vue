<template>
  <b-container fluid class="m-2">
    <b-row class="justify-content-center m-1">
      <b-col class="input-group" xl="4" md="6" sm="10">
        <span v-if="!imageFile" class="input-group-btn mx-1">
          <b-button variant="link" to="/about#section2"
            ><b-icon-question-circle class="align-middle" variant="info" scale="1.5"
          /></b-button>
        </span>
        <b-form-file
          v-model="imageFile"
          class="formFile"
          placeholder="Wall image.."
          :disabled="isLoading"
          accept="image/jpeg"
        ></b-form-file>
      </b-col>
    </b-row>
    <b-row class="justify-content-center m-1">
      <b-col class="text-danger font-italic" xl="4" md="6" sm="10">
        {{ errorString }}
      </b-col>
    </b-row>
    <Loader :isLoading="isLoading" />
  </b-container>
</template>

<script>
import { mapMutations, mapGetters, mapActions } from 'vuex';
import getBoundingBox from '@/common/api/getBoundingBox';
import Loader from '@/components/Loader.vue';
import imageCompression from 'browser-image-compression';

export default {
  name: 'ImageUploader',
  components: {
    Loader,
  },
  data() {
    return {
      imageFile: null,
      compressedImageFile: null,
      isLoading: false,
      errorString: '',
      windowWidth: 0,
    };
  },
  created() {
    this.windowWidth = this.getWindowWidth;
  },
  async mounted() {
    this.$store.subscribe(async (mutation, state) => {
      if (mutation.type === 'home/setWindowWidth') {
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
  computed: {
    ...mapGetters('home', {
      getWindowWidth: 'getWindowWidth',
    }),
  },
  methods: {
    ...mapMutations('home', {
      setImageURL: 'setImageURL',
      setIsImageUploaded: 'setIsImageUploaded',
      setBoxes: 'setBoxes',
    }),
    ...mapActions('home', {
      resetBoundingBoxChanges: 'resetBoundingBoxChanges',
    }),
    /**
     * Creates a browser URL for displaying image.
     * Retrieves the bounding boxes from the backend.
     */
    async processFile() {
      if (!this.validate()) return;

      try {
        this.isLoading = true;
        const compressImageOptions = {
          maxSizeMB: 8,
          maxWidthOrHeight: 1024,
          useWebWorker: true
        }
        this.compressedImageFile = await imageCompression(this.imageFile, compressImageOptions);
        const imageURL = URL.createObjectURL(this.imageFile);
        this.setImageURL(imageURL);
        await this.uploadFile();
      } catch (error) {
        console.error(error);
      } finally {
        this.isLoading = false;
      }
    },
    /**
     * FormData is sent with image attached and the desired rescaled width
     *
     * Existing boxes are reset before the new ones are added
     */
    async uploadFile() {
      const formData = new FormData();
      formData.append('image', this.compressedImageFile);
      formData.append('width', this.windowWidth);

      const boxes = await getBoundingBox(formData);
      this.setBoxes(boxes);
      this.resetBoundingBoxChanges();
      this.setIsImageUploaded(true);
    },
    validate() {
      this.errorString = '';
      this.setIsImageUploaded(false);
      if (!this.imageFile) {
        this.errorString = 'Please attach a file';
        return false;
      }
      if (this.imageFile.size > 8 * 1024 * 1024) {
        this.errorString = 'Max image size is 8 MB';
        return false;
      }
      if (!['image/jpeg'].includes(this.imageFile.type)) {
        this.errorString = 'Only JPG is allowed';
        return false;
      }
      return true;
    },
  },
};
</script>

<style scoped>
.m-2 {
  margin: 0 !important;
}
.icon {
  vertical-align: middle;
}
.formFile {
  text-align: left;
}
</style>
