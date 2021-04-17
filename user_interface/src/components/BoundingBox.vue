<template>
  <v-group :config="configGroup">
    <v-rect
      :config="configRect"
      @mouseover="onMouseOver"
      @mouseout="onMouseOut"
      @click="onClick"
    ></v-rect>
    <v-text :config="configText"></v-text>
  </v-group>
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
        if(this.selectMode === SelectModes.RESET) {
          this.reset();
        }
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
        width: this.w,
        height: this.h,
        fill: this.fill,
        stroke: "black",
        strokeWidth: this.strokeWidth,
        opacity: this.opacity,
      };
    },
    configGroup() {
      return {
        x: this.x,
        y: this.y,
        width: this.w,
        height: this.h,
      };
    },
    configText() {
      return {
        y: this.h,
        text: '123',
        fontSize: 14,
        fontFamily: 'Calibri',
        opacity: 1,
      };
    },
  },
  methods: {
    reset() {
      this.strokeWidth = 2;
      this.opacity = 0.2;
      this.fill = "yellow";
      this.stroke = "black";
      this.selected = false;
    },
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