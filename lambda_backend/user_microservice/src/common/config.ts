export const getAllowedOrigin = (): string => {
  switch (process.env['NODE_ENV']) {
    case 'prod':
      return process.env['ALLOWED_ORIGIN'] || '*';
    default:
      return '*';
  }
};
