import { Handler } from 'aws-lambda';
import DynamoDB, { AttributeValue, QueryInput } from 'aws-sdk/clients/dynamodb';
import createError from 'http-errors';

import { getMiddlewareAddedHandler } from './common/middleware';
import { getRoutesByUserSchema } from './common/schema';
import { GetRoutesByUserEvent, GymItem, UserRoutesIndexItem } from './common/types';
import { logger } from './common/logger';

const dynamoDb = new DynamoDB.DocumentClient();

const getRoutesByUser: Handler = async (event: GetRoutesByUserEvent) => {
  if (!process.env['ROUTE_TABLE_NAME'] || !process.env['GYM_TABLE_NAME']) {
    throw createError(500, 'Route or Gym table name is not set');
  }
  const {
    queryStringParameters: { username },
  } = event;
  logger.info('getRoutesByUser initiated', { data: { username } });

  const routeQueryInput: QueryInput = {
    TableName: process.env['ROUTE_TABLE_NAME'],
    IndexName: 'userRoutesIndex',
    ConsistentRead: false,
    ScanIndexForward: false,
    KeyConditionExpression: 'username = :username',
    ExpressionAttributeValues: {
      ':username': username as AttributeValue,
    },
  };
  let userRouteIndexItems: UserRoutesIndexItem[];
  try {
    const response = await dynamoDb.query(routeQueryInput).promise();
    userRouteIndexItems = response.Items as UserRoutesIndexItem[];
  } catch (error) {
    logger.error('getRoutesByUser error', { data: { username, error: error.stack } });
    throw createError(500, 'Error querying table', error);
  }

  // Assumes that one user will not post from too many countries
  const countryCodeSet = new Set(userRouteIndexItems.map((item) => item.countryCode));
  const gymLocationToNameMapping = {};

  logger.info('getRoutesByUser countryCodes', {
    data: { username, countryCodes: Array.from(countryCodeSet) },
  });
  for (const countryCode of Array.from(countryCodeSet)) {
    const gymQueryInput: QueryInput = {
      TableName: process.env['GYM_TABLE_NAME'],
      ConsistentRead: false,
      KeyConditionExpression: 'countryCode = :countryCode',
      ExpressionAttributeValues: {
        ':countryCode': countryCode as AttributeValue,
      },
    };
    try {
      const response = await dynamoDb.query(gymQueryInput).promise();
      const gymItems = response.Items as GymItem[];
      gymItems.forEach((gym) => (gymLocationToNameMapping[gym.gymLocation] = gym.gymName));
    } catch (error) {
      logger.error('getRoutesByUser error', {
        data: { username, countryCode, error: error.stack },
      });
      throw createError(500, 'Error querying table', error);
    }
  }

  const Items = userRouteIndexItems.map((item) => {
    return { ...item, gymName: gymLocationToNameMapping[item.gymLocation] };
  });

  logger.info('getRoutesByUser success', { data: { username } });
  return {
    statusCode: 200,
    body: JSON.stringify({ Message: 'Query routes by user success', Items }),
  };
};

export const handler = getMiddlewareAddedHandler(getRoutesByUser, getRoutesByUserSchema);
