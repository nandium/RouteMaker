/**
 * ENUM
 * https://stackoverflow.com/questions/44447847/enums-in-javascript-with-es6
 */
class HandStartMode {
  // Private Fields
  static #NOSHOW = 0;
  static #ONEHAND = 1;
  static #TWOHAND = 2;

  // Accessors for "get" functions only (no "set" functions)
  static get NOSHOW() {
    return this.#NOSHOW;
  }
  static get ONEHAND() {
    return this.#ONEHAND;
  }
  static get TWOHAND() {
    return this.#TWOHAND;
  }
}

export default HandStartMode;
