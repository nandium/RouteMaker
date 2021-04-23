<template>
  <v-group :config="configGroup">
    <v-text :config="configText"></v-text>
    <v-rect
      :config="configRect"
      @mouseover="onMouseOver"
      @mouseout="onMouseOut"
      @click="onClick"
      @tap="onTap"
    ></v-rect>
  </v-group>
</template>

<script>
import SelectModes from '@/common/enumSelectModes';
import { mapGetters, mapMutations, mapActions } from 'vuex';
import { OPTIMIZATION_PARAMS } from '@/common/konva';
import {
  DefaultBoundingBox,
  ActiveBoundingBoxFootHold,
  ActiveBoundingBoxHandHold,
  ActiveBoundingBoxStartHold,
} from '@/common/boundingBoxAttributes';

export default {
  name: 'BoundingBox',
  data() {
    return {
      strokeWidth: DefaultBoundingBox.strokeWidth,
      boxOpacity: DefaultBoundingBox.opacity,
      textOpacity: 0,
      text: '',
      fill: DefaultBoundingBox.fill,
      stroke: DefaultBoundingBox.stroke,
      selected: false,
      selectMode: null,
      showNumberMode: true,
      selectNumber: 0,
    };
  },
  mounted() {
    this.selectMode = this.getSelectMode;

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
      getSelectMode: 'getSelectMode',
    }),
    configRect() {
      return {
        width: this.w,
        height: this.h,
        fill: this.fill,
        stroke: this.stroke,
        strokeWidth: this.strokeWidth,
        opacity: this.boxOpacity,
        ...OPTIMIZATION_PARAMS,
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
        x: 0,
        y: this.h + 2,
        text: this.text,
        fontSize: 24,
        fontFamily: 'Calibri',
        fontStyle: 'bold',
        opacity: this.textOpacity,
        ...OPTIMIZATION_PARAMS,
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
      this.strokeWidth = DefaultBoundingBox.strokeWidth;
      this.boxOpacity = DefaultBoundingBox.opacity;
      this.textOpacity = 0;
      this.fill = DefaultBoundingBox.fill;
      this.stroke = DefaultBoundingBox.stroke;
      if (this.selected) {
        this.removeBoxIdFromSelected(this.boxId);
        this.selected = false;
      }
    },
    onMouseOver() {
      if (this.selectMode === SelectModes.DRAWBOX) return;
      this.strokeWidth = 4;
    },
    onMouseOut() {
      if (this.selectMode === SelectModes.DRAWBOX) return;
      if (!this.selected) this.strokeWidth = DefaultBoundingBox.strokeWidth;
    },
    /**
     * Do not allow box changes if current mode is DRAWBOX
     * If the box is selected, unselect it
     * If the box is not selected, select and number if handhold
     * If the box is not selected, select only if foothold
     */
    onClick() {
      if (this.selectMode === SelectModes.DRAWBOX) return;

      if (this.selected) {
        this.boxOpacity = DefaultBoundingBox.opacity;
        this.fill = DefaultBoundingBox.fill;
        this.textOpacity = 0;
        this.selected = false;
        this.removeBoxIdFromSelected(this.boxId);
        this.updateBoundingBoxNumbers();
      } else {
        this.selected = true;
        if (this.selectMode === SelectModes.HANDHOLD) {
          this.boxOpacity = ActiveBoundingBoxHandHold.opacity;
          this.fill = ActiveBoundingBoxHandHold.fill;
          this.strokeWidth = ActiveBoundingBoxHandHold.strokeWidth;
          this.stroke = ActiveBoundingBoxHandHold.stroke;

          this.textOpacity = this.showNumberMode ? 1 : 0;
          this.addBoxIdToSelected(this.boxId);
          this.updateBoundingBoxNumbers();
        } else if (this.selectMode === SelectModes.FOOTHOLD) {
          this.boxOpacity = ActiveBoundingBoxFootHold.opacity;
          this.fill = ActiveBoundingBoxFootHold.fill;
          this.strokeWidth = ActiveBoundingBoxFootHold.strokeWidth;
          this.stroke = ActiveBoundingBoxFootHold.stroke;
        } else if (this.selectMode === SelectModes.STARTHOLDS) {
          this.boxOpacity = ActiveBoundingBoxStartHold.opacity;
          this.fill = ActiveBoundingBoxStartHold.fill;
          this.strokeWidth = ActiveBoundingBoxStartHold.strokeWidth;
          this.stroke = ActiveBoundingBoxStartHold.stroke;
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
