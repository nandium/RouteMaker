/** `1 send`, `2 sends`. */
export const plural = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`;
