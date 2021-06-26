import S3, { PutObjectRequest, DeleteObjectRequest } from 'aws-sdk/clients/s3';
import { createHash } from 'crypto';
import createError from 'http-errors';

const s3 = new S3();

export const uploadRouteImageContent = async (
  username: string,
  createdAt: string,
  mimetype: string,
  content: Buffer,
): Promise<string> => {
  if (!process.env['S3_BUCKET_NAME']) {
    throw createError(500, 'Bucket name is not set!');
  }
  const usernameHash = createHash('sha256').update(username).digest('base64');
  const putObjectRequest: PutObjectRequest = {
    Bucket: process.env['S3_BUCKET_NAME'],
    Key: `public/${usernameHash}/${createdAt}`,
    ContentType: mimetype,
    Body: content,
  };
  let routeURL = '';
  try {
    ({ Location: routeURL } = await s3.upload(putObjectRequest).promise());
  } catch (error) {
    throw createError(500, 'S3 upload failed', error);
  }
  return routeURL;
};

export const deleteRouteImageContent = async (
  username: string,
  routeURL: string,
): Promise<void> => {
  if (!process.env['S3_BUCKET_NAME']) {
    throw createError(500, 'Bucket name is not set!');
  }
  const usernameHash = createHash('sha256').update(username).digest('base64');
  const decodedRouteURL = decodeURIComponent(routeURL);
  const deleteObjectRequest: DeleteObjectRequest = {
    Bucket: process.env['S3_BUCKET_NAME'],
    Key: `public/${usernameHash}${decodedRouteURL.split(usernameHash)[1]}`,
  };
  try {
    await s3.deleteObject(deleteObjectRequest).promise();
  } catch (error) {
    throw createError(500, 'S3 deletion failed', error);
  }
};
