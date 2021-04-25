<template>
  <b-container fluid class="my-2">
    <b-row class="justify-content-center" v-if="isImageUploaded">
      <b-col xl="4" md="6" sm="10">
        <b-button-group size="md" class="m-1" v-if="showAllButtons">
          <b-button
            v-for="(btn, idx) in buttons"
            :key="idx"
            @click="onButtonClick(btn)"
            :variant="getButtonVariant(btn.state)"
          >
            {{ btn.caption }}
          </b-button>
        </b-button-group>
      </b-col>
    </b-row>
    <b-row class="justify-content-center" v-if="isImageUploaded">
      <b-col xl="4" md="6" sm="10">
        <b-button-group size="md" class="m-1">
          <b-button v-if="!isSelectModeDrawBox" @click="onReset" variant="outline-info"
            >Reset</b-button
          >
          <b-button v-if="!isSelectModeDrawBox" @click="toggleShowOrder" variant="outline-info"
            >{{ this.showOrderMode ? 'Hide' : 'Unhide' }} Order</b-button
          >
          <b-button v-if="!isSelectModeDrawBox" @click="toggleHandStart" variant="outline-info"
            >{{ this.handStartMode }}-HandStart</b-button
          >
          <b-button v-if="isSelectModeDrawBox" @click="undoDrawBox" variant="outline-info"
            >Undo Draw</b-button
          >
        </b-button-group>
      </b-col>
    </b-row>
  </b-container>
</template>

<script>
import SelectModes from '@/common/enumSelectMode';
import HandStartMode from '@/common/enumHandStartMode';
import { mapMutations, mapGetters, mapActions } from 'vuex';
import { throttle } from 'lodash';

export default {
  name: 'ModeSelector',
  mounted() {
    this.isImageUploaded = this.getIsImageUploaded;
    this.showOrderMode = this.getShowOrderMode;

    this.$store.subscribe(async (mutation, state) => {
      if (mutation.type === 'home/setIsImageUploaded') {
        this.isImageUploaded = state.home.isImageUploaded;
      }
      if (mutation.type === 'home/setSelectMode') {
        this.updateDisplayButtons(state.home.selectMode);
        if (state.home.selectMode === SelectModes.EXPORT) {
          this.showAllButtons = false;
        }
      }
    });

    this.updateDisplayButtons(this.getSelectMode);
    this.handStartMode = this.getHandStartMode;
    this.showOrderMode = this.getShowOrderMode;
  },
  data() {
    return {
      showAllButtons: true,
      isImageUploaded: false,
      handStartMode: HandStartMode.NOSHOW,
      showOrderMode: true,
      buttons: [
        {
          caption: 'HandHold',
          state: true,
          mode: SelectModes.HANDHOLD,
        },
        {
          caption: 'FootHold',
          state: false,
          mode: SelectModes.FOOTHOLD,
        },
        {
          caption: 'DrawBox',
          state: false,
          mode: SelectModes.DRAWBOX,
        },
        {
          caption: 'Export',
          state: false,
          mode: SelectModes.EXPORT,
        },
      ],
    };
  },
  computed: {
    ...mapGetters('home', {
      getShowOrderMode: 'getShowOrderMode',
      getIsImageUploaded: 'getIsImageUploaded',
      getSelectMode: 'getSelectMode',
      getHandStartMode: 'getHandStartMode',
    }),
    isSelectModeDrawBox() {
      return this.getSelectMode === SelectModes.DRAWBOX;
    },
  },
  methods: {
    ...mapMutations('home', {
      setSelectMode: 'setSelectMode',
      setShowOrderMode: 'setShowOrderMode',
      setHandStartMode: 'setHandStartMode',
    }),
    ...mapActions('home', {
      resetBoundingBoxChanges: 'resetBoundingBoxChanges',
      undoDrawBox: 'undoDrawBox',
    }),
    onButtonClick(selectedButton) {
      if (selectedButton.state) return;

      this.updateDisplayButtons(selectedButton.mode);
      this.setSelectMode(selectedButton.mode);
    },
    getButtonVariant(state) {
      if (state) return 'secondary';
      return 'outline-secondary';
    },
    onReset() {
      this.resetBoundingBoxChanges();
      this.showAllButtons = true;
    },
    toggleShowOrder: throttle(function () {
      this.showOrderMode = !this.showOrderMode;
      this.setShowOrderMode(this.showOrderMode);
    }, 200),
    toggleHandStart: throttle(function () {
      const currHandStartMode = this.handStartMode;
      switch (currHandStartMode) {
        case HandStartMode.NOSHOW:
          this.handStartMode = HandStartMode.ONEHAND;
          break;
        case HandStartMode.ONEHAND:
          this.handStartMode = HandStartMode.TWOHAND;
          break;
        case HandStartMode.TWOHAND:
          this.handStartMode = HandStartMode.NOSHOW;
          break;
      }
      this.setHandStartMode(this.handStartMode);
    }, 200),
    /**
     * Unselect the rest of the buttons
     */
    updateDisplayButtons(newMode) {
      this.buttons = this.buttons.map((button) => {
        if (button.mode === newMode) {
          return { ...button, state: true };
        }
        return { ...button, state: false };
      });
    },
  },
};
</script>

<style scoped></style>
