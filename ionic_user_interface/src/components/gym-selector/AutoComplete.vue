<template>
  <ion-input
    v-bind="$attrs"
    class="ion-text-end"
    v-model="userInput"
    @keyup.enter="onEnter"
    @keydown.tab="onEnter"
  />
  <ion-card class="global-margin-left" v-if="filteredSuggestions.length && showCard">
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
import { defineComponent, watch, computed, ref, Ref } from 'vue';
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
    const userInput = ref('');
    const filteredSuggestions: Ref<Array<Record<string, any>>> = ref([]);
    const showCard = ref(true);
    const suggestions = computed(() => props.options as Array<Record<string, any>>);

    const onSelected = (_item: Record<string, any>) => {
      userInput.value = _item[props.optionsKey as string];
      filteredSuggestions.value = [];
    };

    const setValue = (value: string) => {
      userInput.value = value;
    };

    // Make user input the same as the top suggestion
    const onEnter = () => {
      if (filteredSuggestions.value.length > 0) {
        userInput.value = filteredSuggestions.value[0][props.optionsKey as string];
      }
    };

    // Emits null if no match-
    const emitItemIfMatchFound = () => {
      showCard.value = true;
      if (userInput.value.length === 0) {
        filteredSuggestions.value = [];
        return;
      }
      // The number of suggestions can be edited here
      filteredSuggestions.value = suggestions.value
        .filter(
          (suggestion) =>
            suggestion[props.optionsKey as string]
              .toLowerCase()
              .indexOf(userInput.value.toLowerCase()) === 0,
        )
        .slice(0, 1);
      // Don't show anymore if the user input is the same as suggestion
      if (
        filteredSuggestions.value.length === 1 &&
        filteredSuggestions.value[0][props.optionsKey as string] === userInput.value
      ) {
        showCard.value = false;
        // Returns completed input
        emit('matchedItem', filteredSuggestions.value[0]);
      } else {
        emit('matchedItem', null);
      }
    };

    watch(userInput, emitItemIfMatchFound);

    return {
      userInput,
      filteredSuggestions,
      showCard,
      suggestions,
      onSelected,
      onEnter,
      setValue,
    };
  },
});
</script>
