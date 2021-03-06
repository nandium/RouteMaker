import { Handler } from 'aws-lambda';
import DynamoDB, { AttributeValue, QueryInput } from 'aws-sdk/clients/dynamodb';
import createError from 'http-errors';
import jwt_decode from 'jwt-decode';

import { getMiddlewareAddedHandler } from './common/middleware';
import { getRoutesByUserSchema } from './common/schema';
import { GetRoutesByUserEvent, GymItem, JwtPayload } from './common/types';
import { getUserRoutesIndexItems } from './common/db';
import { logger } from './common/logger';

const dynamoDb = new DynamoDB.DocumentClient();

/**
 * A public endpoint to return the list of routes by a user
 * If an authorization token is provided, returns whether the user (requester) has graded the route
 */
const getRoutesByUser: Handler = async (event: GetRoutesByUserEvent) => {
  if (!process.env['ROUTE_TABLE_NAME'] || !process.env['GYM_TABLE_NAME']) {
    throw createError(500, 'Route or Gym table name is not set');
  }
  const {
    headers: { Authorization },
    queryStringParameters: { username: routeOwnerUsername },
  } = event;
  logger.info('getRoutesByUser initiated', { data: { routeOwnerUsername } });

  const userRouteIndexItems = await getUserRoutesIndexItems(routeOwnerUsername);

  // Assumes that one user will not post from too many countries
  const countryCodeSet = new Set(userRouteIndexItems.map((item) => item.countryCode));
  const gymLocationToNameMapping = {};

  logger.info('getRoutesByUser countryCodes', {
    data: { routeOwnerUsername, countryCodes: Array.from(countryCodeSet) },
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
      logger.error('getRoutesByUser query gyms error', {
        data: { routeOwnerUsername, countryCode, error: error.stack },
      });
      throw createError(500, 'Error querying table', error);
    }
  }

  let username = '';
  if (Authorization) {
    // Only utilizes token for username, no enforcing authorization as endpoint is GET & public
    ({ username } = (await jwt_decode(Authorization.split(' ')[1])) as JwtPayload);
    logger.info('getRoutesByUser user identifier included', { data: { username } });
  }
  const Items = userRouteIndexItems.map((item) => {
    const { upvotes, ...returnItem } = item;
    const hasVoted = upvotes.find((name) => name === username) ? true : false;
    return {
      ...returnItem,
      gymName: gymLocationToNameMapping[item.gymLocation],
      voteCount: upvotes.length,
      hasVoted,
    };
  });

  logger.info('getRoutesByUser success', { data: { routeOwnerUsername } });
  return {
    statusCode: 200,
    body: JSON.stringify({ Message: 'Query routes by user success', Items }),
  };
};

export const handler = getMiddlewareAddedHandler(getRoutesByUser, getRoutesByUserSchema);
