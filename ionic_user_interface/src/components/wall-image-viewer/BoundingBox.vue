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

<script lang="ts">
import { defineComponent, onMounted, ref } from 'vue';
import { BoxState, SelectMode } from './enums';
import {
  ActiveBoundingBoxFootHold,
  ActiveBoundingBoxHandHold,
  BoundingBoxNumbering,
  DefaultBoundingBox,
  OPTIMIZATION_PARAMS,
} from './boundingBoxAttributes';
import { ConfigGroup, ConfigText, ConfigTape, ConfigRect } from './types';

export default defineComponent({
  name: 'BoundingBox',
  props: {
    boxId: {
      type: Number,
      required: true,
    },
    boxState: {
      required: true,
    },
    selectMode: {
      required: true,
    },
    numberText: {
      type: Number,
      required: true,
    },
    boxDims: {
      type: Object,
      required: true,
    },
  },
  setup(props) {
    const configGroup = ref<ConfigGroup>();
    const configText = ref<ConfigText>();
    const configRect = ref<ConfigRect>();
    const configTape1 = ref<ConfigTape>();
    const configTape2 = ref<ConfigTape>();
    const isHover = ref<boolean>(false);

    // Update the rectangles depending on the type of hold
    const updateRect = () => {
      const { w, h } = props.boxDims;
      let boundingBoxAttributes = null;
      switch (props.boxState) {
        case BoxState.HIDDEN:
          boundingBoxAttributes = { opacity: 0, strokeWidth: 0 };
          break;
        case BoxState.UNSELECTED:
          boundingBoxAttributes = DefaultBoundingBox;
          break;
        case BoxState.NORMAL_HANDHOLD:
        case BoxState.SINGLE_START_HANDHOLD:
        case BoxState.DUAL_START_HANDHOLD:
        case BoxState.END_HANDHOLD:
          boundingBoxAttributes = ActiveBoundingBoxHandHold;
          break;
        case BoxState.FOOTHOLD:
          boundingBoxAttributes = ActiveBoundingBoxFootHold;
          break;
        default:
          boundingBoxAttributes = DefaultBoundingBox;
      }
      configRect.value = {
        width: w,
        height: h,
        ...boundingBoxAttributes,
        ...OPTIMIZATION_PARAMS,
        strokeWidth: isHover.value ? 4 : boundingBoxAttributes.strokeWidth,
      };
    };
    // Update hand hold tapes depending on type of hold
    const updateTape = () => {
      const { w } = props.boxDims;
      const corner = Math.min(w / 5, -10);

      switch (props.boxState) {
        case BoxState.DUAL_START_HANDHOLD:
        case BoxState.END_HANDHOLD:
          configTape2.value = {
            points: [10, 0, corner + 10, corner],
            stroke: 'red',
            strokeWidth: configRect.value ? configRect.value.strokeWidth * 1.5 : 0,
            opacity: 1,
            ...OPTIMIZATION_PARAMS,
          };
        // eslint-disable-next-line no-fallthrough
        case BoxState.SINGLE_START_HANDHOLD:
          configTape1.value = {
            points: [0, 0, corner, corner],
            stroke: 'red',
            strokeWidth: configRect.value ? configRect.value.strokeWidth * 1.5 : 0,
            opacity: 1,
            ...OPTIMIZATION_PARAMS,
          };
          break;
        default:
          configTape1.value = {
            opacity: 0,
            ...OPTIMIZATION_PARAMS,
          };
          configTape2.value = {
            opacity: 0,
            ...OPTIMIZATION_PARAMS,
          };
      }
    };
    /**
     * Number will always be passed in as prop
     * If it is not equal to 0, it will be displayed
     */
    const updateText = () => {
      const { h } = props.boxDims;
      if (props.numberText !== 0) {
        configText.value = {
          x: 0,
          y: h + 2,
          text: props.numberText.toString(),
          fillAfterStrokeEnabled: true,
          opacity: 1,
          ...BoundingBoxNumbering,
          ...OPTIMIZATION_PARAMS,
        };
      } else {
        configText.value = { opacity: 0, ...OPTIMIZATION_PARAMS };
      }
    };
    const onClick = () => {
      console.log('clicked');
    };
    const onTap = () => {
      console.log('tapped');
    };
    const onMouseOver = () => {
      if (props.selectMode !== SelectMode.DRAWBOX) {
        isHover.value = true;
      }
      updateRect();
    };
    const onMouseOut = () => {
      isHover.value = false;
      updateRect();
    };
    onMounted(() => {
      const { x, y, w, h } = props.boxDims;
      configGroup.value = { x, y, width: w, height: h };

      updateRect();
      updateTape();
      updateText();
    });

    return {
      configGroup,
      configText,
      configTape1,
      configTape2,
      configRect,
      onMouseOver,
      onMouseOut,
      onClick,
      onTap,
    };
  },
});
</script>
