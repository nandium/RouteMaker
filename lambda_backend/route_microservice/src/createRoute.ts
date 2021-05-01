import { Handler } from 'aws-lambda';
import DynamoDB, { AttributeValue, QueryInput, PutItemInput } from 'aws-sdk/clients/dynamodb';
import S3, { PutObjectRequest } from 'aws-sdk/clients/s3';

import {
  getMiddlewareAddedHandler,
  CreateRouteEvent,
  createRouteSchema,
  getEmailFromCognito,
} from './common';
import { MAX_PHOTO_SIZE } from './config';
import { createHash } from 'crypto';
import createError from 'http-errors';

const dynamoDb = new DynamoDB.DocumentClient();
const s3 = new S3();

const deleteRoute: Handler = async (event: CreateRouteEvent) => {
  if (
    !process.env['GYM_TABLE_NAME'] ||
    !process.env['ROUTE_TABLE_NAME'] ||
    !process.env['S3_BUCKET_NAME']
  ) {
    throw createError(500, 'Table or Bucket names are not set!');
  }
  const {
    headers: { Authorization },
    body: { country, expiredTime, gymLocation, ownerGrade, routePhoto },
  } = event;

  const queryInput: QueryInput = {
    TableName: process.env['GYM_TABLE_NAME'],
    ConsistentRead: false,
    KeyConditionExpression: 'country = :country AND gymLocation = :gymLocation',
    ExpressionAttributeValues: {
      ':country': country as AttributeValue,
      ':gymLocation': gymLocation as AttributeValue,
    },
  };
  let Items;
  try {
    ({ Items } = await dynamoDb.query(queryInput).promise());
  } catch (error) {
    throw createError(500, 'Error querying table :' + error.stack);
  }
  if (!Items) {
    createError(400, 'Gym is not registered.');
  }

  const userEmail = await getEmailFromCognito(Authorization.split(' ')[1]);
  const { content, mimetype } = routePhoto;
  if (mimetype !== 'image/jpeg') {
    throw createError(400, 'Only JPEG is accepted');
  }
  if (content.byteLength > MAX_PHOTO_SIZE) {
    throw createError(400, 'Max allowed size is 5MB');
  }

  const createdAt = new Date().toISOString();
  const userEmailHash = createHash('sha256').update(userEmail).digest('base64');
  const putObjectRequest: PutObjectRequest = {
    Bucket: process.env['S3_BUCKET_NAME'],
    Key: `public/${userEmailHash}/${createdAt}`,
    ContentType: mimetype,
    Body: content,
  };
  let routeURL;
  try {
    ({ Location: routeURL } = await s3.upload(putObjectRequest).promise());
  } catch (error) {
    throw createError(500, 'S3 upload failed.' + error.stack);
  }

  const putItemInput: PutItemInput = {
    TableName: process.env['ROUTE_TABLE_NAME'] || '',
    Item: {
      userEmail: userEmail as AttributeValue,
      createdAt: createdAt as AttributeValue,
      expiredTime: expiredTime as AttributeValue,
      gymLocation: gymLocation as AttributeValue,
      routeURL: routeURL as AttributeValue,
      ownerGrade: ownerGrade as AttributeValue,
      publicGrade: ownerGrade as AttributeValue,
      publicGradeSubmissions: [{ userEmail: ownerGrade }] as AttributeValue,
      vote: 0 as AttributeValue,
      upVotes: [] as AttributeValue,
      reports: [] as AttributeValue,
      commentCount: 0 as AttributeValue,
      comments: [] as AttributeValue,
    },
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

export const handler = getMiddlewareAddedHandler(deleteRoute, createRouteSchema);
