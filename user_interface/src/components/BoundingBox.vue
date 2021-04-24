<template>
  <v-group :config="configGroup">
    <v-text :config="configText" />
    <v-rect
      :config="configRect"
      @mouseover="onMouseOver"
      @mouseout="onMouseOut"
      @click="onClick"
      @tap="onTap"
    />
    <v-line :config="configLine1" />
    <v-line :config="configLine2" />
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
} from '@/common/boundingBoxAttributes';

export default {
  name: 'BoundingBox',
  data() {
    return {
      strokeWidth: DefaultBoundingBox.strokeWidth,
      boxOpacity: DefaultBoundingBox.opacity,
      textOpacity: 0,
      lineOpacity: 0,
      text: '',
      fill: DefaultBoundingBox.fill,
      stroke: DefaultBoundingBox.stroke,
      selected: false,
      selectMode: null,
      showOrderMode: true,
      selectNumber: 0,
    };
  },
  mounted() {
    this.selectMode = this.getSelectMode;
    this.showOrderMode = this.getShowOrderMode;

    this.$store.subscribe(async (mutation, state) => {
      if (mutation.type === 'home/setSelectMode') {
        this.selectMode = state.home.selectMode;
        if (this.selectMode === SelectModes.EXPORT) {
          this.setDone();
          if (this.getDownloadMode === false) this.setDownloadMode(true);
        }
      }
      /**
       * ShowOrderMode unhides the numbering of handholds
       */
      if (mutation.type === 'home/setShowOrderMode') {
        if (state.home.showOrderMode) {
          if (this.selected) {
            this.textOpacity = 1;
          }
        } else {
          this.textOpacity = 0;
        }
        this.showOrderMode = state.home.showOrderMode;
      }
    });
    this.$store.subscribeAction((action, state) => {
      if (action.type === 'home/resetBoundingBoxChanges') {
        this.reset();
      }
      if (action.type === 'home/updateBoundingBoxNumbers') {
        const selectNumber = state.home.boxIdToSelectNumberMapping.get(this.boxId);
        const maxSelectNumber = Math.max(...state.home.boxIdToSelectNumberMapping.values());
        // If the number turns out to be start or end, draw the crosses too
        if (selectNumber === 1 || selectNumber === maxSelectNumber) {
          this.lineOpacity = this.boxOpacity;
        } else {
          this.lineOpacity = 0;
        }
        this.text = selectNumber;
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
      getShowOrderMode: 'getShowOrderMode',
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
    configLine1() {
      return {
        points: [0, 0, this.w, this.h],
        stroke: this.stroke,
        opacity: this.lineOpacity,
        ...OPTIMIZATION_PARAMS,
      };
    },
    configLine2() {
      return {
        points: [this.w, 0, 0, this.h],
        stroke: this.stroke,
        opacity: this.lineOpacity,
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

          this.textOpacity = this.showOrderMode ? 1 : 0;
          this.addBoxIdToSelected(this.boxId);
          this.updateBoundingBoxNumbers();
        } else if (this.selectMode === SelectModes.FOOTHOLD) {
          this.boxOpacity = ActiveBoundingBoxFootHold.opacity;
          this.fill = ActiveBoundingBoxFootHold.fill;
          this.strokeWidth = ActiveBoundingBoxFootHold.strokeWidth;
          this.stroke = ActiveBoundingBoxFootHold.stroke;
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
