import Filter from 'bad-words';

const filter = new Filter();

export const cleanBadWords = (str: string): string => {
  return filter.clean(str);
};
