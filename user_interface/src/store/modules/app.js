const state = () => ({
  currentRoute: 'Home',
});

const getters = {
  getCurrentRoute: (state) => {
    return state.currentRoute;
  },
};

const mutations = {
  setCurrentRoute: (state, route) => {
    state.currentRoute = route;
  },
};

const actions = {};

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations,
};
