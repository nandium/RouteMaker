<template>
  <v-group :config="configGroup">
    <v-rect
      :config="configRect"
      @mouseover="onMouseOver"
      @mouseout="onMouseOut"
      @click="onClick"
      @tap="onTap"
    ></v-rect>
    <v-text
      :config="configText"
      @mouseover="onMouseOver"
      @mouseout="onMouseOut"
      @click="onClick"
      @tap="onTap"
    ></v-text>
  </v-group>
</template>

<script>
import SelectModes from '@/common/selectModes';
import { mapGetters, mapMutations, mapActions } from 'vuex';

export default {
  name: 'BoundingBox',
  data() {
    return {
      strokeWidth: 2,
      boxOpacity: 0.2,
      textOpacity: 0,
      text: '',
      fill: 'yellow',
      stroke: 'black',
      selected: false,
      selectMode: SelectModes.HANDHOLD,
      showNumberMode: true,
      selectNumber: 0,
    };
  },
  mounted() {
    this.$store.subscribe(async (mutation, state) => {
      if (mutation.type === 'home/setSelectMode') {
        this.selectMode = state.home.selectMode;
        if (this.selectMode === SelectModes.EXPORT) {
          this.setDone();
          if (this.getDownloadMode === false) this.setDownloadMode(true);
        }
      }
      /**
       * ShowNumberMode unhides the numbering of handholds
       */
      if (mutation.type === 'home/setShowNumberMode') {
        if (state.home.showNumberMode) {
          if (this.selected) {
            this.textOpacity = 1;
          }
        } else {
          this.textOpacity = 0;
        }
        this.showNumberMode = state.home.showNumberMode;
      }
    });
    this.$store.subscribeAction((action, state) => {
      if (action.type === 'home/resetBoundingBoxChanges') {
        this.reset();
      }
      if (action.type === 'home/updateBoundingBoxNumbers') {
        if (this.selected) {
          this.text = state.home.boxIdToSelectNumberMapping.get(this.boxId);
        }
      }
    });
  },
  props: {
    x: Number,
    y: Number,
    w: Number,
    h: Number,
    boxId: Number,
  },
  computed: {
    ...mapGetters('home', {
      getDownloadMode: 'getDownloadMode',
    }),
    configRect() {
      return {
        width: this.w,
        height: this.h,
        fill: this.fill,
        stroke: 'black',
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
        x: 5,
        y: this.h / 2,
        text: this.text,
        fontSize: 24,
        fontFamily: 'Calibri',
        fontStyle: 'bold',
        opacity: this.textOpacity,
      };
    },
  },
  methods: {
    ...mapMutations('home', {
      addBoxIdToSelected: 'addBoxIdToSelected',
      removeBoxIdFromSelected: 'removeBoxIdFromSelected',
      setDownloadMode: 'setDownloadMode',
    }),
    ...mapActions('home', {
      updateBoundingBoxNumbers: 'updateBoundingBoxNumbers',
    }),
    reset() {
      this.strokeWidth = 2;
      this.boxOpacity = 0.2;
      this.textOpacity = 0;
      this.fill = 'yellow';
      this.stroke = 'black';
      if (this.selected) {
        this.removeBoxIdFromSelected(this.boxId);
        this.selected = false;
      }
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
     * If the box is not selected, select only if foothold
     */
    onClick() {
      if (this.selected) {
        this.boxOpacity = 0.2;
        this.fill = 'yellow';
        this.textOpacity = 0;
        this.selected = false;
        this.removeBoxIdFromSelected(this.boxId);
        this.updateBoundingBoxNumbers();
      } else {
        this.boxOpacity = 0.6;
        this.selected = true;
        if (this.selectMode === SelectModes.HANDHOLD) {
          this.textOpacity = this.showNumberMode ? 1 : 0;
          this.addBoxIdToSelected(this.boxId);
          this.updateBoundingBoxNumbers();
        } else if (this.selectMode === SelectModes.FOOTHOLD) {
          this.fill = 'blue';
        }
      }
    },
    onTap() {
      this.onClick();
    },
    setDone() {
      if (!this.selected) {
        this.boxOpacity = 0;
        this.textOpacity = 0;
      }
    },
  },
};
</script>

<style></style>
