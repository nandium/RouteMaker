import createError from 'http-errors';

export const trimRouteURL = (routeURL: string): string => {
  if (!process.env['S3_BUCKET_NAME']) {
    throw createError(500, 'Bucket name is not set!');
  }
  return routeURL.split(process.env['S3_BUCKET_NAME'])[1];
};

export const restoreRouteURL = (trimedRouteURL: string): string => {
  if (!process.env['S3_BUCKET_NAME']) {
    throw createError(500, 'Bucket name is not set!');
  }
  return 'https://' + process.env['S3_BUCKET_NAME'] + trimedRouteURL;
};
