import { Handler } from 'aws-lambda';
import DynamoDB, {
  AttributeValue,
  QueryInput,
  PutItemInput,
  AttributeMap,
} from 'aws-sdk/clients/dynamodb';
import S3, { PutObjectRequest } from 'aws-sdk/clients/s3';

import {
  getMiddlewareAddedHandler,
  CreateRouteEvent,
  createRouteSchema,
  JwtPayload,
  RouteItem,
} from './common';
import { MAX_PHOTO_SIZE } from './config';
import { createHash } from 'crypto';
import jwt_decode from 'jwt-decode';
import createError from 'http-errors';

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

  const queryInput: QueryInput = {
    TableName: process.env['GYM_TABLE_NAME'],
    ConsistentRead: false,
    KeyConditionExpression: 'countryCode = :countryCode AND gymLocation = :gymLocation',
    ExpressionAttributeValues: {
      ':countryCode': countryCode as AttributeValue,
      ':gymLocation': gymLocation as AttributeValue,
    },
  };
  let Items;
  try {
    ({ Items } = await dynamoDb.query(queryInput).promise());
  } catch (error) {
    throw createError(500, 'Error querying table :' + error.stack);
  }
  if (Items.length === 0) {
    return {
      statusCode: 400,
      body: JSON.stringify({ Message: 'Unregistered gym' }),
    };
  }

  const { username } = (await jwt_decode(Authorization.split(' ')[1])) as JwtPayload;
  const { content, mimetype } = routePhoto;
  if (mimetype !== 'image/jpeg') {
    throw createError(400, 'Only JPEG is accepted');
  }
  if (content.byteLength > MAX_PHOTO_SIZE) {
    throw createError(400, 'Max allowed size is 5MB');
  }

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
    throw createError(500, 'S3 upload failed.' + error.stack);
  }

  const routeItem: RouteItem = {
    username,
    createdAt,
    ttl: new Date(expiredTime).getTime(),
    routeName,
    gymLocation,
    routeURL,
    ownerGrade,
    publicGrade: ownerGrade,
    publicGradeSubmissions: [{ username, grade: ownerGrade }],
    voteCount: 0,
    upVotes: [],
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
    throw createError(500, 'DB put operation failed: ' + error.stack);
  }
  return {
    statusCode: 201,
    body: JSON.stringify({ Message: 'Create route success', Item: putItemInput.Item }),
  };
};

export const handler = getMiddlewareAddedHandler(createRoute, createRouteSchema);
