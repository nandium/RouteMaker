<template>
  <v-rect :config="configRect"></v-rect>
</template>

<script>
export default {
  name: "BoundingBox",
  data() { 
    return {
      opacity: 0.3,
    }
  },
  props: {
    x: Number,
    y: Number,
    w: Number,
    h: Number
  },
  computed: {
    configRect() {
      return {
        x: this.x,
        y: this.y,
        width: this.w,
        height: this.h,
        fill: "yellow",
        stroke: "black",
        strokeWidth: 1,
        opacity: this.opacity
      }
    }
  }
}
</script>

<style>

</style>