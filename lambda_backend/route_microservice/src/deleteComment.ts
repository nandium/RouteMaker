import { Handler } from 'aws-lambda';
import DynamoDB, { AttributeValue, UpdateItemInput } from 'aws-sdk/clients/dynamodb';
import jwt_decode from 'jwt-decode';
import createError from 'http-errors';

import { getMiddlewareAddedHandler } from './common/middleware';
import { getItemFromRouteTable } from './common/db';
import { deleteCommentSchema } from './common/schema';
import { DeleteCommentEvent, JwtPayload } from './common/types';
import { getCognitoUserDetails } from './common/cognito';
import { logger } from './common/logger';

const dynamoDb = new DynamoDB.DocumentClient();

/**
 * Allows a user to delete a comment if he is:
 * - The author of the comment OR
 * - The owner of the post OR
 * - An admin of the application
 */
const deleteComment: Handler = async (event: DeleteCommentEvent) => {
  if (!process.env['ROUTE_TABLE_NAME']) {
    throw createError(500, 'Route table name is not set');
  }
  const {
    headers: { Authorization },
    queryStringParameters: { username: routeOwnerUsername, createdAt, commentUsername, timestamp },
  } = event;
  const accessToken = Authorization.split(' ')[1];
  const { username: requestUsername } = (await jwt_decode(accessToken)) as JwtPayload;
  logger.info('deleteComment initiated', {
    data: { username: requestUsername, routeOwnerUsername, createdAt, commentUsername, timestamp },
  });

  const Item = await getItemFromRouteTable(routeOwnerUsername, createdAt);

  // Delete only if the user (requester) is the route owner or the comment author or an admin
  if (requestUsername !== commentUsername && requestUsername !== routeOwnerUsername) {
    const { userRole } = await getCognitoUserDetails(accessToken);
    if (userRole !== 'admin') {
      logger.error('deleteComment Unauthorized', { data: { username: requestUsername, userRole } });
      return {
        statusCode: 403,
        body: JSON.stringify({
          Message: 'Unauthorized',
        }),
      };
    }
  }

  let { comments } = Item;
  comments = comments.filter((comment) => {
    const { timestamp: currTimestamp, username: currUsername } = comment;
    if (timestamp === currTimestamp && currUsername === commentUsername) {
      return false;
    }
    return true;
  });

  const updateItemInput: UpdateItemInput = {
    TableName: process.env['ROUTE_TABLE_NAME'],
    Key: {
      username: routeOwnerUsername as AttributeValue,
      createdAt: createdAt as AttributeValue,
    },
    UpdateExpression: `
      SET comments=:comments, commentCount=:commentCount
    `,
    ExpressionAttributeValues: {
      ':comments': comments as AttributeValue,
      ':commentCount': comments.length as AttributeValue,
    },
  };
  logger.info('deleteComment updateItem', { data: { username: requestUsername } });
  try {
    await dynamoDb.update(updateItemInput).promise();
  } catch (error) {
    logger.error('deleteComment error', {
      data: { username: requestUsername, error: error.stack },
    });
    throw createError(500, 'Error updating item', error);
  }

  logger.info('deleteComment success', { data: { username: requestUsername } });
  return {
    statusCode: 200,
    body: JSON.stringify({
      Message: 'Delete comment success',
    }),
  };
};

export const handler = getMiddlewareAddedHandler(deleteComment, deleteCommentSchema);
