<template>
  <ion-input class="ion-text-end" v-model="userInput" @keyup.enter="onEnter" />
  <ion-card class="suggestions-card" v-if="filteredSuggestions.length && showCard">
    <ion-text
      class="suggestion-item"
      v-for="(s, i) in filteredSuggestions"
      :key="i"
      @click="onSelected(s)"
    >
      {{ s[optionsKey] }}
    </ion-text>
  </ion-card>
</template>

<script lang="ts">
import { defineComponent, toRefs, reactive, watch } from 'vue';
import { IonInput, IonCard, IonText } from '@ionic/vue';

export default defineComponent({
  name: 'AutoComplete',
  components: {
    IonInput,
    IonCard,
    IonText,
  },
  props: {
    msg: String,
    options: Array,
    optionsKey: String,
  },
  setup(props, { emit }) {
    const state = reactive({
      userInput: '',
      filteredSuggestions: [] as Array<Record<string, any>>,
      suggestions: [] as Array<Record<string, any>>,
      showCard: true,
    });

    const onSelected = (_item: Record<string, any>) => {
      state.userInput = _item[props.optionsKey as string];
      state.filteredSuggestions = [];
    };

    // Make user input the same as the top suggestion
    const onEnter = () => {
      if (state.filteredSuggestions.length > 0) {
        state.userInput = state.filteredSuggestions[0][props.optionsKey as string];
      }
    };

    watch(
      () => props.options,
      () => {
        state.suggestions = props.options as Array<Record<string, any>>;
      },
    );

    watch(
      () => state.userInput,
      () => {
        state.showCard = true;
        if (state.userInput.length === 0) {
          state.filteredSuggestions = [];
          return;
        }
        // The number of suggestions can be edited here
        state.filteredSuggestions = state.suggestions
          .filter(
            (suggestion) =>
              suggestion[props.optionsKey as string]
                .toLowerCase()
                .indexOf(state.userInput.toLowerCase()) === 0,
          )
          .slice(0, 1);
        // Don't show anymore if the user input is the same as suggestion
        if (
          state.filteredSuggestions.length === 1 &&
          state.filteredSuggestions[0][props.optionsKey as string] === state.userInput
        ) {
          state.showCard = false;
          // Returns completed input
          emit('completed', state.filteredSuggestions[0]);
        }
      },
    );

    return {
      ...toRefs(state),
      onSelected,
      onEnter,
    };
  },
});
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
.suggestions-card {
  margin-left: 10px;
}
</style>
