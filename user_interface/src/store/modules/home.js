import SelectModes from '@/common/enumSelectMode';
import HandStartMode from '@/common/enumHandStartMode';

const state = () => ({
  // items: [],
  isImageUploaded: false,
  imageURL: '',
  windowWidth: 0,
  boxes: [],
  selectMode: SelectModes.HANDHOLD,
  boxIdToSelectNumberMapping: new Map(),
  selectNumberToBoxIdArray: [],
  downloadMode: false,
  showOrderMode: true,
  handStartMode: HandStartMode.NOSHOW,
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
  getShowOrderMode: (state) => {
    return state.showOrderMode;
  },
  getHandStartMode: (state) => {
    return state.handStartMode;
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
  /**
   * Box IDs are not changed,
   * but their SelectNumbers propagate starting from the removed index
   */
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
  setShowOrderMode: (state, showOrderMode) => {
    state.showOrderMode = showOrderMode;
  },
  setHandStartMode: (state, handStartMode) => {
    state.handStartMode = handStartMode;
  },
};

const actions = {
  /**
   * BoundingBoxes also subscribe to this action to reset individually
   */
  resetBoundingBoxChanges({ commit }) {
    commit('setSelectMode', SelectModes.HANDHOLD);
  },
  updateBoundingBoxNumbers() {},
  undoDrawBox() {},
};

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations,
};
