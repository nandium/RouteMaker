/**
 * ENUM
 * https://stackoverflow.com/questions/44447847/enums-in-javascript-with-es6
 */
class SelectModes {
  // Private Fields
  static #_HANDHOLD_NUMBER = 0;
  static #_FOOTHOLD_NO_NUMBER = 1;
  static #_EXPORT = 2;
  static #_RESET = 3;

  // Accessors for "get" functions only (no "set" functions)
  static get HANDHOLD_NUMBER() { return this.#_HANDHOLD_NUMBER; }
  static get FOOTHOLD_NO_NUMBER() { return this.#_FOOTHOLD_NO_NUMBER; }
  static get EXPORT() { return this.#_EXPORT; }
  static get RESET() { return this.#_RESET; }
}

export default SelectModes;