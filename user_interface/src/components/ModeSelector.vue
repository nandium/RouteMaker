<template>
  <b-container fluid class="m-2">
    <b-row class="justify-content-center" v-if="isImageUploaded" >
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

        <b-button>Hide #</b-button>
      </b-col>
    </b-row>
  </b-container>
</template>

<script>
import SelectModes from "@/common/selectModes";
import { mapMutations } from "vuex";

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
      buttons: [
        {
          caption: "Reset",
          state: false,
          mode: SelectModes.RESET,
        },
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
          caption: "Export",
          state: false,
          mode: SelectModes.EXPORT,
        },
      ],
    };
  },
  methods: {
    ...mapMutations("home", {
      setSelectMode: "setSelectMode",
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
  },
};
</script>

<style scoped>
</style>