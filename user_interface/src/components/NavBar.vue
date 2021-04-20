<template>
  <div id="nav">
    <router-link v-bind="getNavItemAttr('Home')" to="/">Home</router-link>
    <span class="h4">|</span>
    <router-link v-bind="getNavItemAttr('About')" to="/about">About</router-link>
  </div>
</template>

<script>
import { mapGetters } from 'vuex';

export default {
  name: 'NavBar',
  data() {
    return {
      currentRoute: 'Home',
    };
  },
  mounted() {
    this.currentRoute = this.getCurrentRoute;
    this.$store.subscribe(async (mutation, state) => {
      if (mutation.type === 'app/setCurrentRoute') {
        this.currentRoute = state.app.currentRoute;
      }
    });
  },
  computed: {
    ...mapGetters('app', {
      getCurrentRoute: 'getCurrentRoute',
    }),
  },
  methods: {
    getNavItemAttr(itemName) {
      if (this.currentRoute === itemName) {
        return {
          class: 'text-info mx-4',
        };
      } else {
        return {
          class: 'text-secondary mx-4',
        };
      }
    },
  },
};
</script>

<style scoped>
#nav {
  padding: 30px;
}

#nav a {
  font-size: 1.4em;
  font-weight: bold;
  color: #2c3e50;
}
</style>
