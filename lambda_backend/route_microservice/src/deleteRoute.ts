import { Handler } from 'aws-lambda';
import DynamoDB, { AttributeValue, QueryInput, DeleteItemInput } from 'aws-sdk/clients/dynamodb';
import S3, { DeleteObjectRequest } from 'aws-sdk/clients/s3';

import {
  getMiddlewareAddedHandler,
  DeleteRouteEvent,
  deleteRouteSchema,
  getEmailFromCognito,
} from './common';
import { createHash } from 'crypto';
import createError from 'http-errors';

const dynamoDb = new DynamoDB.DocumentClient();
const s3 = new S3();

const deleteRoute: Handler = async (event: DeleteRouteEvent) => {
  if (
    !process.env['GYM_TABLE_NAME'] ||
    !process.env['ROUTE_TABLE_NAME'] ||
    !process.env['S3_BUCKET_NAME']
  ) {
    throw createError(500, 'Table or Bucket names are not set!');
  }
  const {
    headers: { Authorization },
    body: { createdAt },
  } = event;

  const userEmail = await getEmailFromCognito(Authorization.split(' ')[1]);
  const queryInput: QueryInput = {
    TableName: process.env['ROUTE_TABLE_NAME'],
    ConsistentRead: false,
    KeyConditionExpression: 'userEmail = :userEmail AND createdAt = :createdAt',
    ExpressionAttributeValues: {
      ':userEmail': userEmail as AttributeValue,
      ':createdAt': createdAt as AttributeValue,
    },
  };
  let Items;
  try {
    ({ Items } = await dynamoDb.query(queryInput).promise());
  } catch (error) {
    throw createError(500, 'Error querying table :' + error.stack);
  }
  if (!Items) {
    createError(400, 'Route does not exist.');
  }

  const userEmailHash = createHash('sha256').update(userEmail).digest('base64');
  const decodedRouteURL = decodeURIComponent(Items[0].routeURL as string);
  const deleteObjectRequest: DeleteObjectRequest = {
    Bucket: process.env['S3_BUCKET_NAME'],
    Key: `public/${userEmailHash}${decodedRouteURL.split(userEmailHash)[1]}`,
  };
  try {
    await s3.deleteObject(deleteObjectRequest).promise();
  } catch (error) {
    throw createError(500, 'S3 deletion failed.' + error.stack);
  }

  const deleteItemInput: DeleteItemInput = {
    TableName: process.env['ROUTE_TABLE_NAME'],
    Key: {
      userEmail: userEmail as AttributeValue,
      createdAt: createdAt as AttributeValue,
    },
  };
  try {
    await dynamoDb.delete(deleteItemInput).promise();
  } catch (error) {
    throw createError(500, 'DB delete operation failed: ' + error.stack);
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ Message: 'Delete route success' }),
  };
};

export const handler = getMiddlewareAddedHandler(deleteRoute, deleteRouteSchema);
