import Filter from 'bad-words';

const filter = new Filter();

export const cleanBadwords = (str: string): string => {
  return filter.clean(str);
};
