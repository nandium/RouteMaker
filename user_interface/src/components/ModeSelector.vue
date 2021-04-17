<template>
  <b-container fluid class="m-2">
    <b-row class="justify-content-center">
      <b-col md="4" sm="10">
        <b-button-group size="md">
          <b-button
            v-for="(btn, idx) in buttons"
            :key="idx"
            @click="onButtonClick(idx)"
            :variant="getButtonVariant(btn.state)"
          >
            {{ btn.caption }}
          </b-button>
        </b-button-group>
      </b-col>
    </b-row>
  </b-container>
</template>

<script>
import SelectModes from "@/common/selectModes";
import { mapMutations } from "vuex";

export default {
  name: "ModeSelector",
  data() {
    return {
      isImageUploaded: false,
      buttons: [
        {
          caption: "HandHold",
          state: true,
          mode: SelectModes.HANDHOLD_NUMBER,
        },
        {
          caption: "FootHold",
          state: false,
          mode: SelectModes.FOOTHOLD_NO_NUMBER,
        },
        {
          caption: "Done",
          state: false,
          mode: SelectModes.DONE,
        },
      ],
    };
  },
  methods: {
    ...mapMutations("home", {
      setSelectMode: "setSelectMode"
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
          .filter(button => this.buttons[idx].caption !== button.caption)
          .map(button => {
            return { ...button, state: false };
          }),
      ].sort((a, b) => (a.caption < b.caption ? 1 : -1));

      this.setSelectMode(this.buttons[idx].mode);
    },
    getButtonVariant(state) {
      if (state) return "secondary";
      return "outline-secondary";
    },
  },
  mounted() {
    this.$store.subscribe(async (mutation, state) => {
      if (mutation.type == "home/setIsImageUploaded") {
        this.isImageUploaded = state.home.isImageUploaded;
      }
    });
  },
};
</script>

<style scoped>
</style>