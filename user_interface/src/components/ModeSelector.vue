<template>
  <b-container fluid class="m-2">
    <b-row class="justify-content-center" v-if="isImageUploaded">
      <b-col md="4" sm="10">
        <b-button-group size="md" class="mx-1">
          <b-button
            v-for="(btn, idx) in buttons"
            :key="idx"
            @click="onButtonClick(idx)"
            :variant="getButtonVariant(btn.state)"
          >
            {{ btn.caption }}
          </b-button>
        </b-button-group>

        <b-button @click="toggleShowNumbers">Hide #</b-button>
      </b-col>
    </b-row>
  </b-container>
</template>

<script>
import SelectModes from "@/common/selectModes";
import { mapMutations, mapGetters } from "vuex";

export default {
  name: "ModeSelector",
  mounted() {
    this.$store.subscribe(async (mutation, state) => {
      if (mutation.type == "home/setIsImageUploaded") {
        this.isImageUploaded = state.home.isImageUploaded;
      }
    });
  },
  data() {
    return {
      isImageUploaded: false,
      showNumberMode: this.getShowNumberMode,
      buttons: [
        {
          caption: "Reset",
          state: false,
          mode: SelectModes.RESET,
        },
        {
          caption: "HandHold",
          state: true,
          mode: SelectModes.HANDHOLD,
        },
        {
          caption: "FootHold",
          state: false,
          mode: SelectModes.FOOTHOLD,
        },
        {
          caption: "Export",
          state: false,
          mode: SelectModes.EXPORT,
        },
      ],
    };
  },
  computed: {
    ...mapGetters("home", {
      getShowNumberMode: "getShowNumberMode",
    }),
  },
  methods: {
    ...mapMutations("home", {
      setSelectMode: "setSelectMode",
      setShowNumberMode: "setShowNumberMode",
    }),
    /**
     * Unselect the rest of the buttons
     * Sort them by alphebetical to maintain the order
     * Update the selected mode state
     */
    onButtonClick(idx) {
      if (this.buttons[idx].state) return;

      this.buttons = [
        { ...this.buttons[idx], state: true },
        ...this.buttons
          .filter((button) => this.buttons[idx].caption !== button.caption)
          .map((button) => {
            return { ...button, state: false };
          }),
      ].sort((a, b) => (a.caption < b.caption ? 1 : -1));

      this.setSelectMode(this.buttons[idx].mode);
    },
    getButtonVariant(state) {
      if (state) return "secondary";
      return "outline-secondary";
    },
    toggleShowNumbers() {
      this.showNumberMode = !this.getShowNumberMode;
      this.setShowNumberMode(this.showNumberMode);
    },
  },
};
</script>

<style scoped>
</style>