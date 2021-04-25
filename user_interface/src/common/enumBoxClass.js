/**
 * ENUM
 * https://stackoverflow.com/questions/44447847/enums-in-javascript-with-es6
 */
class BoxClass {
  // Private Fields
  static #HOLD = 0;
  static #VOLUME = 1;
  static #DRAWN = 2;

  // Accessors for "get" functions only (no "set" functions)
  static get HOLD() {
    return this.#HOLD;
  }
  static get VOLUME() {
    return this.#VOLUME;
  }
  static get DRAWN() {
    return this.#DRAWN;
  }
}

export default BoxClass;
