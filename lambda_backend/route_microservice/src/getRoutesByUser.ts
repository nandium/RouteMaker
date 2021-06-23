import { Handler } from 'aws-lambda';
import DynamoDB, { AttributeValue, QueryInput } from 'aws-sdk/clients/dynamodb';
import createError from 'http-errors';

import { getMiddlewareAddedHandler } from './common/middleware';
import { getRoutesByUserSchema } from './common/schema';
import { GetRoutesByUserEvent } from './common/types';

const dynamoDb = new DynamoDB.DocumentClient();

const getRoutesByUser: Handler = async (event: GetRoutesByUserEvent) => {
  if (!process.env['ROUTE_TABLE_NAME']) {
    throw createError(500, 'Route table name is not set');
  }
  const {
    queryStringParameters: { username },
  } = event;
  const queryInput: QueryInput = {
    TableName: process.env['ROUTE_TABLE_NAME'],
    IndexName: 'userRoutesIndex',
    ConsistentRead: false,
    ScanIndexForward: false,
    KeyConditionExpression: 'username = :username',
    ExpressionAttributeValues: {
      ':username': username as AttributeValue,
    },
  };
  try {
    const { Items } = await dynamoDb.query(queryInput).promise();
    return {
      statusCode: 200,
      body: JSON.stringify({ Message: 'Query routes by user success', Items }),
    };
  } catch (error) {
    throw createError(500, 'Error querying table', error);
  }
};

export const handler = getMiddlewareAddedHandler(getRoutesByUser, getRoutesByUserSchema);
