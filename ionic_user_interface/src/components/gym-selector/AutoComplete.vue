<template>
  <ion-item>
    <ion-label class="global-absolute-position">{{ label }}</ion-label>
    <ion-input
      class="ion-text-end"
      v-model="userInput"
      @keyup.enter="onEnter"
      @keydown.tab="onEnter"
    />
  </ion-item>
  <ion-list v-if="filteredSuggestions.length && showList" class="ion-no-padding">
    <ion-item
      button
      class="ion-no-margin"
      v-for="(s, i) in filteredSuggestions"
      :key="i"
      @click="onSelected(s)"
    >
      {{ s[optionsKey] }}
    </ion-item>
  </ion-list>
</template>

<script lang="ts">
import { defineComponent, watch, computed, ref, Ref } from 'vue';
import { IonInput, IonLabel, IonList, IonItem } from '@ionic/vue';

export default defineComponent({
  name: 'AutoComplete',
  components: {
    IonInput,
    IonItem,
    IonLabel,
    IonList,
  },
  props: {
    options: {
      type: Array,
      required: true,
    },
    optionsKey: {
      type: String,
      required: true,
    },
    label: {
      type: String,
      required: true,
    },
  },
  emits: ['matchedItem'],
  setup(props, { emit }) {
    const userInput = ref('');
    const filteredSuggestions: Ref<Array<Record<string, any>>> = ref([]);
    const showList = ref(true);
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
      showList.value = true;
      if (userInput.value.length === 0) {
        filteredSuggestions.value = [];
        return;
      }
      // The number of suggestions can be edited here
      filteredSuggestions.value = suggestions.value.filter(
        (suggestion) =>
          suggestion[props.optionsKey as string]
            .toLowerCase()
            .indexOf(userInput.value.toLowerCase()) === 0,
      );
      // Don't show anymore if the user input is the same as suggestion
      if (
        filteredSuggestions.value.length === 1 &&
        filteredSuggestions.value[0][props.optionsKey as string] === userInput.value
      ) {
        showList.value = false;
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
      showList,
      suggestions,
      onSelected,
      onEnter,
      setValue,
    };
  },
});
</script>

<style scoped lang="scss">
ion-list {
  direction: rtl;
  max-height: 200px;
  overflow-y: scroll;
}
</style>
