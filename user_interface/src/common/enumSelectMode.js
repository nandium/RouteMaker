/**
 * ENUM
 * https://stackoverflow.com/questions/44447847/enums-in-javascript-with-es6
 */
class SelectModes {
  // Private Fields
  static #HANDHOLD = 0;
  static #FOOTHOLD = 1;
  static #DRAWBOX = 2;
  static #EXPORT = 3;

  // Accessors for "get" functions only (no "set" functions)
  static get HANDHOLD() {
    return this.#HANDHOLD;
  }
  static get FOOTHOLD() {
    return this.#FOOTHOLD;
  }
  static get DRAWBOX() {
    return this.#DRAWBOX;
  }
  static get EXPORT() {
    return this.#EXPORT;
  }
}

export default SelectModes;
