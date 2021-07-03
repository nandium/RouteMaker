import { Handler } from 'aws-lambda';
import DynamoDB, { AttributeValue, QueryInput } from 'aws-sdk/clients/dynamodb';
import createError from 'http-errors';
import jwt_decode from 'jwt-decode';

import { getMiddlewareAddedHandler } from './common/middleware';
import { getRoutesByGymSchema } from './common/schema';
import { GetRoutesByGymEvent, GymLocationIndexItem, JwtPayload } from './common/types';
import { logger } from './common/logger';

const dynamoDb = new DynamoDB.DocumentClient();

const getRoutesByGym: Handler = async (event: GetRoutesByGymEvent) => {
  if (!process.env['ROUTE_TABLE_NAME']) {
    throw createError(500, 'Route table name is not set');
  }
  const {
    headers: { Authorization },
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
  let gymLocationIndexItems: GymLocationIndexItem[];
  try {
    const response = await dynamoDb.query(queryInput).promise();
    gymLocationIndexItems = response.Items as GymLocationIndexItem[];
  } catch (error) {
    logger.error('getRoutesByGym error', { data: { gymLocation, error: error.stack } });
    throw createError(500, 'Error querying table', error);
  }

  let username = '';
  if (Authorization) {
    // Only utilizes token for username, no enforcing authorization as endpoint is GET & public
    ({ username } = (await jwt_decode(Authorization.split(' ')[1])) as JwtPayload);
    logger.info('getRoutesByGym user identifier included', { data: { username } });
  }
  const Items = gymLocationIndexItems.map((queryItem) => {
    let hasVoted = false;
    const { upvotes, ...returnItem } = queryItem;
    upvotes.forEach((name) => {
      if (name === username) {
        hasVoted = true;
      }
    });
    return { ...returnItem, hasVoted, voteCount: upvotes.length };
  });

  logger.info('getRoutesByGym success', { data: { gymLocation } });
  return {
    statusCode: 200,
    body: JSON.stringify({ Message: 'Query routes by gym success', Items }),
  };
};

export const handler = getMiddlewareAddedHandler(getRoutesByGym, getRoutesByGymSchema);
