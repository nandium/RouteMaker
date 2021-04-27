/**
 * ENUM
 * https://stackoverflow.com/questions/44447847/enums-in-javascript-with-es6
 */
class BoxModes {
  // Private Fields
  static #NOTSELECTED = 0;
  static #HANDHOLD = 1;
  static #FOOTHOLD = 2;
  static #INVISIBLE = 4;

  // Accessors for "get" functions only (no "set" functions)
  static get NOTSELECTED() {
    return this.#NOTSELECTED;
  }
  static get HANDHOLD() {
    return this.#HANDHOLD;
  }
  static get FOOTHOLD() {
    return this.#FOOTHOLD;
  }
  static get INVISIBLE() {
    return this.#INVISIBLE;
  }
}

export default BoxModes;
