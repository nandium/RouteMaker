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
import { mapGetters, mapMutations } from "vuex";

export default {
  name: "BoundingBox",
  data() {
    return {
      strokeWidth: 2,
      boxOpacity: 0.2,
      textOpacity: 0,
      text: "0",
      fill: "yellow",
      stroke: "black",
      selected: false,
      selectMode: SelectModes.HANDHOLD,
      showNumberMode: true
    };
  },
  mounted() {
    this.$store.subscribe(async (mutation, state) => {
      if (mutation.type == "home/setSelectMode") {
        this.selectMode = state.home.selectMode;
        if(this.selectMode === SelectModes.RESET) {
          this.reset();
        }
        if(this.selectMode === SelectModes.EXPORT) {
          this.setDone();
          if(this.getDownloadMode === false) this.setDownloadMode(true);
        }
      }
      if (mutation.type == "home/setShowNumberMode") {
        if(state.home.showNumberMode) {
          if(this.selected){
            this.textOpacity = 1;
          }
        } else {
          this.textOpacity = 0;
        }
        this.showNumberMode === state.home.showNumberMode;
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
    ...mapGetters("home", {
      getSelectNumber: "getSelectNumber",
      getDownloadMode: "getDownloadMode",
    }),
    configRect() {
      return {
        width: this.w,
        height: this.h,
        fill: this.fill,
        stroke: "black",
        strokeWidth: this.strokeWidth,
        opacity: this.boxOpacity,
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
        text: this.text,
        fontSize: 24,
        fontFamily: 'Calibri',
        fontStyle: 'bold',
        opacity: this.textOpacity,
      };
    },
  },
  methods: {
    ...mapMutations("home", {
      setSelectNumber: "setSelectNumber",
      setDownloadMode: "setDownloadMode"
    }),
    reset() {
      this.strokeWidth = 2;
      this.boxOpacity = 0.2;
      this.textOpacity = 0;
      this.text = "0";
      this.fill = "yellow";
      this.stroke = "black";
      this.selected = false;

      this.setSelectNumber(1);
    },
    onMouseOver() {
      this.strokeWidth = 4;
    },
    onMouseOut() {
      this.strokeWidth = 2;
    },
    /**
     * If the box is selected, unselect it
     * If the box is not selected, select and number if handhold
     * If the box is nto selected, select only if foothold
     */
    onClick() {
      if (this.selected) {
        this.boxOpacity = 0.2;
        this.fill = "yellow";
        this.selected = false;
      } else if (this.selectMode === SelectModes.HANDHOLD) {
        this.boxOpacity = 0.6;
        this.textOpacity = this.showNumberMode ? 1 : 0;
        this.text = this.getSelectNumber;

        this.setSelectNumber(this.text + 1);
        this.selected = true;
      } else if (this.selectMode === SelectModes.FOOTHOLD) {
        this.boxOpacity = 0.6;
        this.fill = "blue";
        this.selected = true;
      }
    },
    setDone() {
      if(!this.selected) {
        this.boxOpacity = 0;
        this.textOpacity = 0;
      }
    }
  },
};
</script>

<style>
</style>