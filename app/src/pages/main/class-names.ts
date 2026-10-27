/** Joins the class names that apply, so state reads as `cx('btn', busy && 'is-busy')`. */
export const cx = (...names: (string | false | null | undefined)[]) =>
  names.filter(Boolean).join(' ');
