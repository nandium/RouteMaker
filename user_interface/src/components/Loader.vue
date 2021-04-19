<template>
  <loading :active.sync="isLoading" :can-cancel="false" :is-full-page="true"></loading>
</template>

<script>
import Loading from 'vue-loading-overlay';
import 'vue-loading-overlay/dist/vue-loading.css';

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

<style></style>
