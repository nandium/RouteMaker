<template>
  <v-rect
    :config="configRect"
    @mouseover="onMouseOver"
    @mouseout="onMouseOut"
    @click="onClick"
  ></v-rect>
</template>

<script>
import SelectModes from "@/common/selectModes";

export default {
  name: "BoundingBox",
  data() {
    return {
      strokeWidth: 2,
      opacity: 0.2,
      fill: "yellow",
      stroke: "black",
      selected: false,
      selectMode: SelectModes.HANDHOLD_NUMBER,
    };
  },
  mounted() {
    this.$store.subscribe(async (mutation, state) => {
      if (mutation.type == "home/setSelectMode") {
        this.selectMode = state.home.selectMode;
      }
    });
  },
  props: {
    x: Number,
    y: Number,
    w: Number,
    h: Number,
  },
  computed: {
    configRect() {
      return {
        x: this.x,
        y: this.y,
        width: this.w,
        height: this.h,
        fill: this.fill,
        stroke: "black",
        strokeWidth: this.strokeWidth,
        opacity: this.opacity,
      };
    },
  },
  methods: {
    onMouseOver() {
      this.strokeWidth = 4;
    },
    onMouseOut() {
      this.strokeWidth = 2;
    },
    onClick() {
      if (this.selected) {
        this.opacity = 0.2;
        this.fill = "yellow";
        this.selected = false;
      } else if (this.selectMode === SelectModes.HANDHOLD_NUMBER) {
        this.opacity = 0.6;
        this.selected = true;
      } else if (this.selectMode === SelectModes.FOOTHOLD_NO_NUMBER) {
        this.opacity = 0.6;
        this.fill = "blue";
        this.selected = true;
      }
    },
  },
};
</script>

<style>
</style>