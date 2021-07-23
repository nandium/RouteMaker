import Filter from 'bad-words';

const filter = new Filter();

/**
 * https://www.npmjs.com/package/bad-words
 */
export const cleanBadWords = (str: string): string => {
  return filter.clean(str);
};
