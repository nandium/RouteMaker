const state = () => ({
  // items: [],
  isImageUploaded: false,
  imageURL: "",
  windowWidth: 500,
  boxes: []
});

const getters = {
  getIsImageUploaded: (state) => {
    return state.isImageUploaded;
  },
  getImageURL: (state) => {
    return state.imageURL;
  },
  getWindowWidth: (state) => {
    return state.windowWidth;
  },
  getBoxes: (state) => {
    return state.boxes;
  }

  // cartProducts: (state, getters, rootState) => {
  //   return state.items.map(({ id, quantity }) => {
  //     const product = rootState.products.all.find(product => product.id === id)
  //     return {
  //       title: product.title,
  //       price: product.price,
  //       quantity
  //     }
  //   })
  // },

  // cartTotalPrice: (state, getters) => {
  //   return getters.cartProducts.reduce((total, product) => {
  //     return total + product.price * product.quantity
  //   }, 0)
  // }
};

const mutations = {
  setIsImageUploaded: (state, isUploaded) => {
    state.isImageUploaded = isUploaded;
  },
  setImageURL: (state, imageURL) => {
    state.imageURL = imageURL;
  },
  setWindowWidth: (state, windowWidth) => {
    state.windowWidth = windowWidth;
  },
  setBoxes: (state, boxes) => {
    state.boxes = [...boxes]
  }

  // pushProductToCart (state, { id }) {
  //   state.items.push({
  //     id,
  //     quantity: 1
  //   })
  // },

  // incrementItemQuantity (state, { id }) {
  //   const cartItem = state.items.find(item => item.id === id)
  //   cartItem.quantity++
  // },

  // setCartItems (state, { items }) {
  //   state.items = items
  // },
};

const actions = {
  // checkout ({ commit, state }, products) {
  //   const savedCartItems = [...state.items]
  //   commit('setCheckoutStatus', null)
  //   // empty cart
  //   commit('setCartItems', { items: [] })
  //   shop.buyProducts(
  //     products,
  //     () => commit('setCheckoutStatus', 'successful'),
  //     () => {
  //       commit('setCheckoutStatus', 'failed')
  //       // rollback to the cart saved before sending the request
  //       commit('setCartItems', { items: savedCartItems })
  //     }
  //   )
  // },
  // addProductToCart ({ state, commit }, product) {
  //   commit('setCheckoutStatus', null)
  //   if (product.inventory > 0) {
  //     const cartItem = state.items.find(item => item.id === product.id)
  //     if (!cartItem) {
  //       commit('pushProductToCart', { id: product.id })
  //     } else {
  //       commit('incrementItemQuantity', cartItem)
  //     }
  //     // remove 1 item from stock
  //     commit('products/decrementProductInventory', { id: product.id }, { root: true })
  //   }
  // }
};

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations,
};
