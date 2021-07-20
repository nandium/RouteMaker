<template>
  <div class="range">
    <ion-range
      class="slider"
      type="range"
      min="0"
      max="14"
      step="1"
      :value="14 - value"
      :disabled="disabled"
      snaps
      :ticks="false"
      debounce="600"
      @ionChange="(changeEvent) => changeHandler(14 - changeEvent.detail.value)"
    ></ion-range>
    <div class="sliderticks">
      <p v-for="index of range(0, 14).reverse()" :key="index">V{{ index }}</p>
    </div>
  </div>
</template>

<script lang="ts">
import { IonRange } from '@ionic/vue';
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'GradeSlider',
  components: {
    IonRange,
  },
  props: {
    value: {
      type: Number,
      required: true,
    },
    disabled: {
      type: Boolean,
      required: false,
      default: false,
    },
    changeHandler: {
      type: Function,
      required: false,
      default: () => undefined,
    },
  },
  setup() {
    const range = (start: number, end: number) => {
      return Array.from({ length: end - start + 1 }, (_, i) => i);
    };
    return {
      range,
    };
  },
});
</script>

<style scoped lang="scss">
* {
  box-sizing: border-box;
}

.slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 25px;
  background: transparent;
  outline: none;
  opacity: 1;
  border-radius: 20px;
  padding: 0;
  margin: 0;

  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 25px;
    height: 25px;
    background: #ff0000;
    cursor: pointer;
  }

  &::-moz-range-thumb {
    width: 25px;
    height: 25px;
    background: #ff0000;
    cursor: pointer;
    border-radius: 20px;
  }
}

.sliderticks {
  display: flex;
  justify-content: space-between;
  padding: 0 0;

  p {
    font-size: 2.4vmin;
    position: relative;
    display: flex;
    justify-content: center;
    text-align: center;
    width: 1px;
    background: #d3d3d3;
    height: 10px;
    line-height: 40px;
    margin: 0 0 20px 0;
  }
}
</style>
