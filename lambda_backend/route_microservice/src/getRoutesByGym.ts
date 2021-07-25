import { Handler } from 'aws-lambda';
import createError from 'http-errors';
import jwt_decode from 'jwt-decode';

import { getMiddlewareAddedHandler } from './common/middleware';
import { getRoutesByGymSchema } from './common/schema';
import { GetRoutesByGymEvent, JwtPayload } from './common/types';
import { getGymLocationIndexItems } from './common/db';
import { logger } from './common/logger';

/**
 * A public endpoint to return the list of routes in a gym
 * If an authorization token is provided, returns whether the user (requester) has graded the route
 */
const getRoutesByGym: Handler = async (event: GetRoutesByGymEvent) => {
  if (!process.env['ROUTE_TABLE_NAME']) {
    throw createError(500, 'Route table name is not set');
  }
  const {
    headers: { Authorization },
    queryStringParameters: { gymLocation },
  } = event;
  logger.info('getRoutesByGym initiated', { data: { gymLocation } });

  const gymLocationIndexItems = await getGymLocationIndexItems(gymLocation);

  let username = '';
  if (Authorization) {
    // Only utilizes token for username, no enforcing authorization as endpoint is GET & public
    ({ username } = (await jwt_decode(Authorization.split(' ')[1])) as JwtPayload);
    logger.info('getRoutesByGym user identifier included', { data: { username } });
  }
  const Items = gymLocationIndexItems.map((queryItem) => {
    const { upvotes, ...returnItem } = queryItem;
    const hasVoted = upvotes.find((name) => name === username) ? true : false;
    return { ...returnItem, hasVoted, voteCount: upvotes.length };
  });

  logger.info('getRoutesByGym success', { data: { gymLocation } });
  return {
    statusCode: 200,
    body: JSON.stringify({ Message: 'Query routes by gym success', Items }),
  };
};

export const handler = getMiddlewareAddedHandler(getRoutesByGym, getRoutesByGymSchema);
