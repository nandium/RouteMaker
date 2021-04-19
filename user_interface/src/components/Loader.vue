<template>
  <loading :active.sync="isLoading" :can-cancel="false" :is-full-page="true"></loading>
</template>

<script>
import Loading from 'vue-loading-overlay';
import 'vue-loading-overlay/dist/vue-loading.css';

/**
 * Full screen spinner overlay will be shown no matter
 * where the component is position
 */
export default {
  name: 'Loader',
  components: {
    Loading,
  },
  props: {
    isLoading: Boolean,
  },
};
</script>

<style scoped></style>
