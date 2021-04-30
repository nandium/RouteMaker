<template>
  <div id="konva-container"></div>
</template>

<script lang="ts">
import { defineComponent, onMounted, ref, watch } from 'vue';
import Konva from 'konva';

Konva.pixelRatio = 1;

export default defineComponent({
  name: 'Canvas',
  components: {},
  props: {
    imgSrc: {
      type: String,
      required: true,
    },
    width: {
      type: Number,
      required: true,
    },
  },
  setup(props) {
    const stage = ref<Konva.Stage>(null);
    const layer = ref<Konva.Layer>(null);

    const updateImage = () => {
      const image = new Image();
      image.onload = () => {
        if (stage.value !== null && layer.value !== null) {
          stage.value?.width(props.width);
          stage.value?.height((props.width / image.width) * image.height);
          const konvaImage = new Konva.Image({
            x: 0,
            y: 0,
            image: image,
            width: props.width,
            height: (props.width / image.width) * image.height,
          });

          layer.value.add(konvaImage);
          layer.value.batchDraw();
        }
      };
      image.src = props.imgSrc;
    };

    onMounted(() => {
      stage.value = new Konva.Stage({
        container: 'konva-container',
        width: props.width,
        height: window.innerHeight,
      });
      layer.value = new Konva.Layer();
      stage.value.add(layer.value);
      updateImage();
    });
    watch(() => props.imgSrc, updateImage);
    watch(() => props.width, updateImage);

    return {
      stage,
      layer,
    };
  },
});
</script>

<style scoped></style>
