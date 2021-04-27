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
import SelectMode from '@/common/enumSelectMode';
import BoxMode from '@/common/enumBoxMode';
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
      tape1Opacity: 0,
      tape2Opacity: 0,
      text: '',
      boxMode: BoxMode.NOTSELECTED,
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
      /**
       * If user changes to export mode, make unselected boxes invisible
       * If user changes from export mode, undo the changes
       */
      if (mutation.type === 'home/setSelectMode') {
        const oldSelectMode = this.selectMode;
        this.selectMode = state.home.selectMode;
        if (oldSelectMode === SelectMode.EXPORT && this.selectMode !== SelectMode.EXPORT) {
          if (this.boxMode === BoxMode.INVISIBLE) {
            this.boxMode = BoxMode.NOTSELECTED;
          }
        } else if (this.selectMode === SelectMode.EXPORT) {
          if (this.boxMode === BoxMode.NOTSELECTED) {
            this.boxMode = BoxMode.INVISIBLE;
          }
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
      let boundingBoxAttributes = null;
      switch (this.boxMode) {
        case BoxMode.NOTSELECTED:
          boundingBoxAttributes = DefaultBoundingBox;
          break;
        case BoxMode.HANDHOLD:
          boundingBoxAttributes = ActiveBoundingBoxHandHold;
          break;
        case BoxMode.FOOTHOLD:
          boundingBoxAttributes = ActiveBoundingBoxFootHold;
          break;
        default:
          return {
            opacity: 0,
            ...OPTIMIZATION_PARAMS,
          };
      }
      return {
        width: this.w,
        height: this.h,
        fill: boundingBoxAttributes.fill,
        stroke: boundingBoxAttributes.stroke,
        opacity: boundingBoxAttributes.opacity,
        strokeWidth: boundingBoxAttributes.strokeWidth,
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
      let textOpacity = this.boxMode === BoxMode.HANDHOLD && this.showOrderMode ? 1 : 0;
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
        opacity: textOpacity,
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
      this.tape1Opacity = 0;
      this.tape2Opacity = 0;
      if (this.boxMode !== BoxMode.NOTSELECTED) {
        this.removeBoxIdFromSelected(this.boxId);
        this.boxMode = BoxMode.NOTSELECTED;
      }
    },
    onMouseOver() {
      if (this.selectMode === SelectMode.DRAWBOX) return;
      this.strokeWidth = 4;
    },
    onMouseOut() {
      if (this.selectMode === SelectMode.DRAWBOX) return;
      if (!this.selected) this.strokeWidth = DefaultBoundingBox.strokeWidth;
    },
    /**
     * Do not allow box changes if current mode is DRAWBOX
     * If the box is selected, unselect it
     * If the box is not selected, select and number if handhold
     * If the box is not selected, select only if foothold
     */
    onClick() {
      if (this.selectMode === SelectMode.DRAWBOX) return;

      let sameMode =
        (this.selectMode === SelectMode.HANDHOLD && this.boxMode === BoxMode.HANDHOLD) ||
        (this.selectMode === SelectMode.FOOTHOLD && this.boxMode === BoxMode.FOOTHOLD);

      if (this.boxMode !== BoxMode.NOTSELECTED && sameMode) {
        this.boxMode = BoxMode.NOTSELECTED;
        this.removeBoxIdFromSelected(this.boxId);
        this.updateBoundingBoxNumbers();
      } else {
        if (this.selectMode === SelectMode.HANDHOLD) {
          this.boxMode = BoxMode.HANDHOLD;
          this.addBoxIdToSelected(this.boxId);
          this.updateBoundingBoxNumbers();
        } else if (this.selectMode === SelectMode.FOOTHOLD) {
          if (this.boxMode === BoxMode.HANDHOLD) {
            this.removeBoxIdFromSelected(this.boxId);
            this.updateBoundingBoxNumbers();
          }
          this.boxMode = BoxMode.FOOTHOLD;
        }
      }
    },
    onTap() {
      this.onClick();
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
