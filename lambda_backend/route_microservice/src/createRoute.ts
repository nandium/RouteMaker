import { Handler } from 'aws-lambda';
import DynamoDB, {
  PutItemInput,
  AttributeMap,
  QueryInput,
  AttributeValue,
} from 'aws-sdk/clients/dynamodb';
import jwt_decode from 'jwt-decode';
import createError from 'http-errors';

import { getMiddlewareAddedHandler } from './common/middleware';
import { getGymIsRegistered } from './common/db';
import { createRouteSchema } from './common/schema';
import { CreateRouteEvent, RouteItem, JwtPayload } from './common/types';
import { cleanBadWords } from './common/badwords';
import { uploadRouteImageContent } from './common/s3';
import { trimRouteURL } from './common/s3/utils';
import { logger } from './common/logger';
import { MAX_PHOTO_SIZE, DAILY_POST_LIMIT } from './config';

const dynamoDb = new DynamoDB.DocumentClient();

/**
 * Allows a user to create a route if the gym is registered and daily post limit is not reached
 * The route image is uploaded to S3 and the route details are put in the database
 */
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
  const accessToken = Authorization.split(' ')[1];
  const { username } = (await jwt_decode(accessToken)) as JwtPayload;
  logger.info('createRoute initiated', {
    data: { username, countryCode, routeName, expiredTime, gymLocation, ownerGrade },
  });

  const { content, mimetype } = routePhoto;
  if (mimetype !== 'image/jpeg') {
    logger.error('createRoute InvalidFileType', { data: { username, mimetype } });
    return {
      statusCode: 400,
      body: JSON.stringify({ Message: 'Invalid file type' }),
    };
  }
  if (content.byteLength > MAX_PHOTO_SIZE) {
    logger.error('createRoute InvalidFileSize', {
      data: { username, fileByte: content.byteLength },
    });
    return {
      statusCode: 400,
      body: JSON.stringify({ Message: 'Invalid file size' }),
    };
  }
  const gymIsRegistered = await getGymIsRegistered(countryCode, gymLocation);
  if (!gymIsRegistered) {
    logger.error('createRoute UnregisteredGym', { data: { username, countryCode, gymLocation } });
    return {
      statusCode: 400,
      body: JSON.stringify({ Message: 'Unregistered gym' }),
    };
  }
  const createdAt = new Date().toISOString();
  if (await userHasReachedUploadLimit(username, createdAt)) {
    logger.error('createRoute UserHasReachedUploadLimit', {
      data: { username, countryCode, gymLocation },
    });
    return {
      statusCode: 400,
      body: JSON.stringify({ Message: 'Upload Limit Reached', Limit: DAILY_POST_LIMIT }),
    };
  }

  /* -- Begin to create route -- */
  const routeURL = await uploadRouteImageContent(username, createdAt, mimetype, content);
  const trimedRouteURL = trimRouteURL(routeURL);
  logger.info('createRoute UploadImageSuccess', { data: { username, routeURL } });

  const routeItem: RouteItem = {
    username,
    createdAt,
    ttl: new Date(expiredTime).getTime(),
    routeName: cleanBadWords(routeName),
    gymLocation,
    countryCode,
    routeURL: trimedRouteURL, // To save storage
    ownerGrade,
    publicGrade: ownerGrade,
    publicGradeSubmissions: [{ username, grade: ownerGrade }],
    upvotes: [],
    reports: [],
    commentCount: 0,
    comments: [],
  };
  const putItemInput: PutItemInput = {
    TableName: process.env['ROUTE_TABLE_NAME'] || '',
    Item: routeItem as unknown as AttributeMap,
  };
  logger.info('createRoute putItemInput', { data: { username } });
  try {
    await dynamoDb.put(putItemInput).promise();
  } catch (error) {
    logger.error('createRoute error', { data: { username, error: error.stack } });
    throw createError(500, 'DB put operation failed', error);
  }

  // Return untrimmed routeURL as response
  const Item = Object.assign({}, routeItem);
  Item.routeURL = routeURL;
  logger.info('createRoute success', { data: { username } });
  return {
    statusCode: 201,
    body: JSON.stringify({ Message: 'Create route success', Item }),
  };
};

/**
 * Returns true if the daily number of posts is reached
 * Purpose is to prevent spamming
 */
const userHasReachedUploadLimit = async (username: string, createdAt: string): Promise<boolean> => {
  const dateString = createdAt.split('T')[0];
  const queryInput: QueryInput = {
    TableName: process.env['ROUTE_TABLE_NAME'] || '',
    ConsistentRead: false,
    IndexName: 'userRoutesIndex',
    KeyConditionExpression: 'username = :username AND begins_with (createdAt, :dateString)',
    ExpressionAttributeValues: {
      ':username': username as AttributeValue,
      ':dateString': dateString as AttributeValue,
    },
  };
  let Items;
  try {
    ({ Items } = await dynamoDb.query(queryInput).promise());
  } catch (error) {
    logger.error('createRoute userHasReachedUploadLimit error', {
      data: { username, createdAt, error: error.stack },
    });
    throw createError(500, 'Error querying table', error);
  }
  logger.info('createRoute userHasUploaded', { data: { count: Items.length } });
  return Items.length >= DAILY_POST_LIMIT;
};

export const handler = getMiddlewareAddedHandler(createRoute, createRouteSchema);
