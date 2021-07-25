import { Handler } from 'aws-lambda';
import DynamoDB, { AttributeValue, DeleteItemInput } from 'aws-sdk/clients/dynamodb';
import jwt_decode from 'jwt-decode';
import createError from 'http-errors';

import { getMiddlewareAddedHandler } from './common/middleware';
import { getItemFromRouteTable } from './common/db';
import { deleteRouteSchema } from './common/schema';
import { DeleteRouteEvent, JwtPayload } from './common/types';
import { getCognitoUserDetails } from './common/cognito';
import { deleteRouteImageContent } from './common/s3';
import { logger } from './common/logger';

const dynamoDb = new DynamoDB.DocumentClient();

/**
 * Allows a user to delete a route if he is the route owner or an admin
 * The route details are removed from the database and the route image is deleted from S3
 */
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
    queryStringParameters: { username: routeOwnerUsername, createdAt },
  } = event;
  const accessToken = Authorization.split(' ')[1];
  const { username: requestUsername } = (await jwt_decode(accessToken)) as JwtPayload;
  logger.info('deleteRoute initiated', {
    data: { username: requestUsername, routeOwnerUsername, createdAt },
  });

  // Delete only if requester is route owner or an admin
  if (requestUsername !== routeOwnerUsername) {
    const { userRole } = await getCognitoUserDetails(accessToken);
    logger.error('deleteRoute Unauthorized', { data: { username: requestUsername, userRole } });
    if (userRole !== 'admin') {
      return {
        statusCode: 403,
        body: JSON.stringify({
          Message: 'Unauthorized',
        }),
      };
    }
  }

  const Item = await getItemFromRouteTable(routeOwnerUsername, createdAt);

  await deleteRouteImageContent(routeOwnerUsername, Item.routeURL);

  const deleteItemInput: DeleteItemInput = {
    TableName: process.env['ROUTE_TABLE_NAME'],
    Key: {
      username: routeOwnerUsername as AttributeValue,
      createdAt: createdAt as AttributeValue,
    },
  };
  logger.info('deleteRoute deleteItem', { data: { username: requestUsername } });
  try {
    await dynamoDb.delete(deleteItemInput).promise();
  } catch (error) {
    logger.error('deleteRoute error', { data: { username: requestUsername, error: error.stack } });
    throw createError(500, 'DB delete operation failed', error);
  }

  logger.info('deleteRoute success', { data: { username: requestUsername } });
  return {
    statusCode: 200,
    body: JSON.stringify({ Message: 'Delete route success' }),
  };
};

export const handler = getMiddlewareAddedHandler(deleteRoute, deleteRouteSchema);
