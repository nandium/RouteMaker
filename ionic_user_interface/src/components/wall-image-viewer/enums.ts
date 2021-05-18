enum BoxClass {
  HOLD,
  VOLUME,
  DRAWN,
}

enum BoxState {
  NORMAL_HANDHOLD,
  FOOTHOLD,
  SINGLE_START_HANDHOLD,
  DUAL_START_HANDHOLD,
  END_HANDHOLD,
  UNSELECTED,
  HIDDEN,
}

enum TapeMode {
  SINGLE_START,
  DUAL_START,
  NONE,
}

enum SelectMode {
  HANDHOLD,
  FOOTHOLD,
  DRAWBOX,
  EXPORT,
}

export { BoxClass, BoxState, SelectMode, TapeMode };
