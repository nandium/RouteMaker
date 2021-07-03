import { Handler } from 'aws-lambda';
import DynamoDB, { AttributeValue, QueryInput } from 'aws-sdk/clients/dynamodb';
import createError from 'http-errors';

import { getMiddlewareAddedHandler } from './common/middleware';
import { getRoutesByGymSchema } from './common/schema';
import { GetRoutesByGymEvent } from './common/types';
import { logger } from './common/logger';

const dynamoDb = new DynamoDB.DocumentClient();

const getRoutesByGym: Handler = async (event: GetRoutesByGymEvent) => {
  if (!process.env['ROUTE_TABLE_NAME']) {
    throw createError(500, 'Route table name is not set');
  }
  const {
    queryStringParameters: { gymLocation },
  } = event;
  logger.info('getRoutesByGym initiated', { data: { gymLocation } });
  const queryInput: QueryInput = {
    TableName: process.env['ROUTE_TABLE_NAME'],
    IndexName: 'gymLocationIndex',
    ConsistentRead: false,
    ScanIndexForward: false,
    KeyConditionExpression: 'gymLocation = :gymLocation',
    ExpressionAttributeValues: {
      ':gymLocation': gymLocation as AttributeValue,
    },
  };
  try {
    const { Items } = await dynamoDb.query(queryInput).promise();
    logger.info('getRoutesByGym success', { data: { gymLocation } });
    return {
      statusCode: 200,
      body: JSON.stringify({ Message: 'Query routes by gym success', Items }),
    };
  } catch (error) {
    logger.error('getRoutesByGym error', { data: { gymLocation, error: error.stack } });
    throw createError(500, 'Error querying table', error);
  }
};

export const handler = getMiddlewareAddedHandler(getRoutesByGym, getRoutesByGymSchema);
