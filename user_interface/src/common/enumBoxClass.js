/**
 * ENUM
 * https://stackoverflow.com/questions/44447847/enums-in-javascript-with-es6
 */
class BoxClass {
  // Private Fields
  static #_HOLD = 0;
  static #_VOLUME = 1;
  static #_DRAWN = 2;

  // Accessors for "get" functions only (no "set" functions)
  static get HOLD() {
    return this.#_HOLD;
  }
  static get VOLUME() {
    return this.#_VOLUME;
  }
  static get DRAWN() {
    return this.#_DRAWN;
  }
}

export default BoxClass;
