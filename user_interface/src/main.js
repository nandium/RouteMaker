import Vue from "vue";
import App from "./App.vue";
import router from "./router";
import store from "./store";

import "./scripts/BootstrapScript";
import "./scripts/KonvaScript";

Vue.config.productionTip = false;

new Vue({
  router,
  store,
  render: (h) => h(App),
  created () {
    if (sessionStorage.redirect) {
        const redirect = sessionStorage.redirect
        delete sessionStorage.redirect
        this.$router.push(redirect)
    }
}
}).$mount("#app");
