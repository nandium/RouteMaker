/**
 * ENUM
 * https://stackoverflow.com/questions/44447847/enums-in-javascript-with-es6
 */
class HandStartMode {
  // Private Fields
  static #_NOSHOW = 0;
  static #_ONEHAND = 1;
  static #_TWOHAND = 2;

  // Accessors for "get" functions only (no "set" functions)
  static get NOSHOW() {
    return this.#_NOSHOW;
  }
  static get ONEHAND() {
    return this.#_ONEHAND;
  }
  static get TWOHAND() {
    return this.#_TWOHAND;
  }
}

export default HandStartMode;
