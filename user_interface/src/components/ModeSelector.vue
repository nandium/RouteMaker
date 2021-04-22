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
        <b-button-group size="md" class="m-1">
          <b-button @click="onReset" variant="outline-info">Reset</b-button>
          <b-button @click="toggleShowNumbers" variant="outline-info"
            >{{ this.getShowNumberMode ? 'Hide' : 'Unhide' }} Numbers</b-button
          >
        </b-button-group>
      </b-col>
    </b-row>
  </b-container>
</template>

<script>
import SelectModes from '@/common/enumSelectModes';
import { mapMutations, mapGetters, mapActions } from 'vuex';

export default {
  name: 'ModeSelector',
  mounted() {
    this.isImageUploaded = this.getIsImageUploaded;
    this.showNumberMode = this.getShowNumberMode;

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
  },
  data() {
    return {
      showAllButtons: true,
      isImageUploaded: false,
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
          caption: 'Export',
          state: false,
          mode: SelectModes.EXPORT,
        },
        {
          caption: 'DrawBox',
          state: false,
          mode: SelectModes.DRAWBOX,
        },
      ],
    };
  },
  computed: {
    ...mapGetters('home', {
      getShowNumberMode: 'getShowNumberMode',
      getIsImageUploaded: 'getIsImageUploaded',
      getSelectMode: 'getSelectMode',
    }),
  },
  methods: {
    ...mapMutations('home', {
      setSelectMode: 'setSelectMode',
      setShowNumberMode: 'setShowNumberMode',
    }),
    ...mapActions('home', {
      resetBoundingBoxChanges: 'resetBoundingBoxChanges',
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
    toggleShowNumbers() {
      this.showNumberMode = !this.getShowNumberMode;
      this.setShowNumberMode(this.showNumberMode);
    },
    /**
     * Unselect the rest of the buttons
     * Sort them by alphebetical to maintain the order
     */
    updateDisplayButtons(newMode) {
      this.buttons = this.buttons
        .map((button) => {
          if (button.mode === newMode) {
            return { ...button, state: true };
          }
          return { ...button, state: false };
        })
        .sort((a, b) => (a.caption < b.caption ? 1 : -1));
    },
  },
};
</script>

<style scoped></style>
