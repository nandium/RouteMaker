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
    <v-line :config="configTape1" />
    <v-line :config="configTape2" />
  </v-group>
</template>

<script>
import SelectModes from '@/common/enumSelectMode';
import HandStartMode from '@/common/enumHandStartMode';
import { mapGetters, mapMutations, mapActions } from 'vuex';
import { OPTIMIZATION_PARAMS } from '@/common/konva';
import {
  DefaultBoundingBox,
  ActiveBoundingBoxFootHold,
  ActiveBoundingBoxHandHold,
  BoundingBoxNumbering,
} from '@/common/boundingBoxAttributes';

export default {
  name: 'BoundingBox',
  data() {
    return {
      strokeWidth: DefaultBoundingBox.strokeWidth,
      boxOpacity: DefaultBoundingBox.opacity,
      textOpacity: 0,
      tape1Opacity: 0,
      tape2Opacity: 0,
      text: '',
      fill: DefaultBoundingBox.fill,
      stroke: DefaultBoundingBox.stroke,
      selected: false,
      selectMode: null,
      showOrderMode: true,
      selectNumber: 0,
      handStartMode: HandStartMode.NOSHOW,
    };
  },
  mounted() {
    this.selectMode = this.getSelectMode;
    this.showOrderMode = this.getShowOrderMode;
    this.handStartMode = this.getHandStartMode;

    this.$store.subscribe(async (mutation, state) => {
      if (mutation.type === 'home/setSelectMode') {
        this.selectMode = state.home.selectMode;
        if (this.selectMode === SelectModes.EXPORT) {
          this.setDone();
          if (this.getDownloadMode === false) this.setDownloadMode(true);
        }
      }
      if (mutation.type === 'home/setHandStartMode') {
        this.handStartMode = state.home.handStartMode;
        const selectNumber = state.home.boxIdToSelectNumberMapping.get(this.boxId);
        this.updateHandStartSymbol(selectNumber, state.home.boxIdToSelectNumberMapping);
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
        this.text = selectNumber;
        this.updateHandStartSymbol(selectNumber, state.home.boxIdToSelectNumberMapping);
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
      getHandStartMode: 'getHandStartMode',
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
        fontSize: BoundingBoxNumbering.fontSize,
        fontFamily: BoundingBoxNumbering.fontFamily,
        fontStyle: BoundingBoxNumbering.fontStyle,
        stroke: BoundingBoxNumbering.stroke,
        fill: BoundingBoxNumbering.fill,
        fillAfterStrokeEnabled: true,
        opacity: this.textOpacity,
        ...OPTIMIZATION_PARAMS,
      };
    },
    configTape1() {
      const corner = Math.min(-this.w / 5, -10);

      return {
        points: [0, 0, corner, corner],
        stroke: 'red',
        strokeWidth: this.strokeWidth * 1.5,
        opacity: this.tape1Opacity,
        ...OPTIMIZATION_PARAMS,
      };
    },
    configTape2() {
      const corner = Math.min(-this.w / 5, -10);

      return {
        points: [10, 0, corner + 10, corner],
        stroke: 'red',
        strokeWidth: this.strokeWidth * 1.5,
        opacity: this.tape2Opacity,
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
      this.tape1Opacity = 0;
      this.tape2Opacity = 0;
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

      let sameMode = (this.selectMode === SelectModes.HANDHOLD && this.fill === ActiveBoundingBoxHandHold.fill) ||
                    (this.selectMode === SelectModes.FOOTHOLD && this.fill === ActiveBoundingBoxFootHold.fill);
      if (this.selected && sameMode) {
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
          if (this.fill === ActiveBoundingBoxHandHold.fill) {
            this.textOpacity = 0;
            this.removeBoxIdFromSelected(this.boxId);
            this.updateBoundingBoxNumbers();
          }
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
    /**
     * Depending on the HandStart Mode and the order of box selection, updates the tapes on bounding boxes
     */
    updateHandStartSymbol(selectNumber, boxIdToSelectNumberMapping) {
      if (this.handStartMode === HandStartMode.ONEHAND) {
        const maxSelectNumber = Math.max(...boxIdToSelectNumberMapping.values());
        if (selectNumber === 1 || selectNumber === maxSelectNumber) {
          this.tape1Opacity = 1;
          this.tape2Opacity = 1;
        } else {
          this.tape1Opacity = 0;
          this.tape2Opacity = 0;
        }
      } else if (this.handStartMode === HandStartMode.TWOHAND) {
        const maxSelectNumber = Math.max(...boxIdToSelectNumberMapping.values());
        if (selectNumber === maxSelectNumber) {
          this.tape1Opacity = 1;
          this.tape2Opacity = 1;
        } else if (selectNumber === 1 || selectNumber === 2) {
          this.tape1Opacity = 1;
          this.tape2Opacity = 0;
        } else {
          this.tape1Opacity = 0;
          this.tape2Opacity = 0;
        }
      } else {
        this.tape1Opacity = 0;
        this.tape2Opacity = 0;
      }
    },
  },
};
</script>

<style></style>
