import { Handler } from 'aws-lambda';
import DynamoDB, { PutItemInput, AttributeMap } from 'aws-sdk/clients/dynamodb';
import S3, { PutObjectRequest } from 'aws-sdk/clients/s3';
import { createHash } from 'crypto';
import jwt_decode from 'jwt-decode';
import createError from 'http-errors';

import { getMiddlewareAddedHandler } from './common/middleware';
import { getGymIsRegistered } from './common/db';
import { createRouteSchema } from './common/schema';
import { CreateRouteEvent, RouteItem, JwtPayload } from './common/types';
import { cleanBadWords } from './common/badwords';
import { MAX_PHOTO_SIZE } from './config';

const dynamoDb = new DynamoDB.DocumentClient();
const s3 = new S3();

const createRoute: Handler = async (event: CreateRouteEvent) => {
  if (
    !process.env['GYM_TABLE_NAME'] ||
    !process.env['ROUTE_TABLE_NAME'] ||
    !process.env['S3_BUCKET_NAME']
  ) {
    throw createError(500, 'Table or Bucket names are not set!');
  }
  const {
    headers: { Authorization },
    body: { countryCode, routeName, expiredTime, gymLocation, ownerGrade, routePhoto },
  } = event;

  const { content, mimetype } = routePhoto;
  if (mimetype !== 'image/jpeg') {
    return {
      statusCode: 400,
      body: JSON.stringify({ Message: 'Invalid file type' }),
    };
  }
  if (content.byteLength > MAX_PHOTO_SIZE) {
    return {
      statusCode: 400,
      body: JSON.stringify({ Message: 'Invalid file size' }),
    };
  }
  const gymIsRegistered = await getGymIsRegistered(countryCode, gymLocation);
  if (!gymIsRegistered) {
    return {
      statusCode: 400,
      body: JSON.stringify({ Message: 'Unregistered gym' }),
    };
  }

  const accessToken = Authorization.split(' ')[1];
  const { username } = (await jwt_decode(accessToken)) as JwtPayload;

  const createdAt = new Date().toISOString();
  const usernameHash = createHash('sha256').update(username).digest('base64');
  const putObjectRequest: PutObjectRequest = {
    Bucket: process.env['S3_BUCKET_NAME'],
    Key: `public/${usernameHash}/${createdAt}`,
    ContentType: mimetype,
    Body: content,
  };
  let routeURL;
  try {
    ({ Location: routeURL } = await s3.upload(putObjectRequest).promise());
  } catch (error) {
    throw createError(500, 'S3 upload failed', error);
  }

  const routeItem: RouteItem = {
    username,
    createdAt,
    ttl: new Date(expiredTime).getTime(),
    routeName: cleanBadWords(routeName),
    gymLocation,
    routeURL,
    ownerGrade,
    publicGrade: ownerGrade,
    publicGradeSubmissions: [{ username, grade: ownerGrade }],
    voteCount: 0,
    upvotes: [],
    reports: [],
    commentCount: 0,
    comments: [],
  };
  const putItemInput: PutItemInput = {
    TableName: process.env['ROUTE_TABLE_NAME'] || '',
    Item: routeItem as unknown as AttributeMap,
  };
  try {
    await dynamoDb.put(putItemInput).promise();
  } catch (error) {
    throw createError(500, 'DB put operation failed', error);
  }
  return {
    statusCode: 201,
    body: JSON.stringify({ Message: 'Create route success', Item: putItemInput.Item }),
  };
};

export const handler = getMiddlewareAddedHandler(createRoute, createRouteSchema);
