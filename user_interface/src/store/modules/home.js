import SelectModes from "@/common/selectModes";

const state = () => ({
  // items: [],
  isImageUploaded: false,
  imageURL: "",
  windowWidth: 500,
  boxes: [],
  selectMode: SelectModes.HANDHOLD_NUMBER,
  selectNumber: 1,
  downloadMode: false
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
  getSelectNumber: (state) => {
    return state.selectNumber;
  },
  getDownloadMode: (state) => {
    return state.downloadMode;
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
  setSelectNumber: (state, selectNumber) => {
    state.selectNumber = selectNumber;
  },
  setDownloadMode: (state, downloadMode) => {
    state.downloadMode = downloadMode;
  },

};

const actions = {
};

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations,
};
