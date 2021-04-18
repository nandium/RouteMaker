import SelectModes from "@/common/selectModes";

const state = () => ({
  // items: [],
  isImageUploaded: false,
  imageURL: "",
  windowWidth: 0,
  boxes: [],
  selectMode: SelectModes.HANDHOLD,
  boxIdToSelectNumberMapping: new Map(),
  selectNumberToBoxIdArray: [],
  downloadMode: false,
  showNumberMode: true
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
  },
  getSelectMode: (state) => {
    return state.selectMode;
  },
  getSelectNumber: (state) => (boxId) => {
    return state.boxIdToSelectNumberMapping.get(boxId);
  },
  getDownloadMode: (state) => {
    return state.downloadMode;
  },
  getShowNumberMode: (state) => {
    return state.showNumberMode;
  },
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
    state.boxes = [...boxes];
  },
  setSelectMode: (state, selectMode) => {
    state.selectMode = selectMode;
  },
  addBoxIdToSelected: (state, boxId) => {
    state.selectNumberToBoxIdArray = [...state.selectNumberToBoxIdArray, boxId];
    state.boxIdToSelectNumberMapping.set(boxId, state.selectNumberToBoxIdArray.length);
  },
  removeBoxIdFromSelected: (state, boxId) => {
    const removedSelectNumber = state.boxIdToSelectNumberMapping.get(boxId);
    state.boxIdToSelectNumberMapping.delete(boxId);
    for (let i = removedSelectNumber; i < state.selectNumberToBoxIdArray.length; i++) {
      state.boxIdToSelectNumberMapping.set(state.selectNumberToBoxIdArray[i], i);
    }
    state.selectNumberToBoxIdArray.splice(removedSelectNumber - 1, 1);
  },
  setDownloadMode: (state, downloadMode) => {
    state.downloadMode = downloadMode;
  },
  setShowNumberMode: (state, showNumberMode) => {
    state.showNumberMode = showNumberMode;
  },
};

const actions = {
  /**
   * BoundingBoxes also subscribe to this action to reset individually
   */
  resetBoundingBoxChanges({ commit }) {
    commit("setSelectMode", SelectModes.HANDHOLD);
  },
  updateBoundingBoxNumbers() {}
};

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations,
};
