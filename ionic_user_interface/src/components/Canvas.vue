<template>
  <canvas class="canvas" ref="myCanvas"></canvas>
</template>

<script lang="ts">
import { defineComponent, onMounted, ref, watch } from 'vue';

export default defineComponent({
  name: 'Canvas',
  components: {},
  props: {
      imgSrc: {
          type: String,
          required: true
      },
      width: {
          type: Number,
          required: true
      },
  },
  setup(props) {
      const myCanvas = ref<HTMLCanvasElement | null>(null);
      const updateImage = () => {
        if (myCanvas.value) {
            const ctx = myCanvas.value.getContext('2d');
            if (ctx) {
                const image = new Image();
                image.onload = () => {
                    if (myCanvas.value) {
                        myCanvas.value.width = props.width;
                        myCanvas.value.height = props.width / image.width * image.height;
                        ctx.drawImage(image, 0, 0, myCanvas.value.width, myCanvas.value.height);
                    }
                };
                image.src = props.imgSrc;
            }
        }
      }

      onMounted(updateImage);
      watch(() => props.imgSrc, updateImage);
      watch(() => props.width, updateImage);

      return {
          myCanvas
      }
  }
});
</script>

<style scoped></style>
