import { Handler } from 'aws-lambda';
import DynamoDB, { AttributeValue, UpdateItemInput } from 'aws-sdk/clients/dynamodb';
import jwt_decode from 'jwt-decode';
import createError from 'http-errors';

import { getMiddlewareAddedHandler } from './common/middleware';
import { getItemFromRouteTable } from './common/db';
import { addCommentSchema } from './common/schema';
import { AddCommentEvent, Comment, JwtPayload } from './common/types';
import { cleanBadWords } from './common/badwords';
import { logger } from './common/logger';
import { COMMENT_LIMIT } from './config';

const dynamoDb = new DynamoDB.DocumentClient();

const addComment: Handler = async (event: AddCommentEvent) => {
  if (!process.env['ROUTE_TABLE_NAME']) {
    throw createError(500, 'Route table name is not set');
  }
  const {
    headers: { Authorization },
    body: { username: routeOwnerUsername, createdAt, comment: commentStr },
  } = event;
  const accessToken = Authorization.split(' ')[1];
  const { username } = (await jwt_decode(accessToken)) as JwtPayload;
  logger.info('addComment initiated', {
    data: { username, routeOwnerUsername, createdAt, comment: commentStr },
  });

  const Item = await getItemFromRouteTable(routeOwnerUsername, createdAt);

  let { comments } = Item;

  const isCommentLimitReached =
    comments.filter((comment) => username === comment.username).length >= COMMENT_LIMIT;
  if (isCommentLimitReached) {
    logger.info('addComment CommentLimitReached', { data: { username } });
    return {
      statusCode: 400,
      body: JSON.stringify({ Message: 'User comment limit reached' }),
    };
  }

  const newComment: Comment = {
    username,
    timestamp: Date.now(),
    comment: cleanBadWords(commentStr),
  };
  comments = [...comments, newComment];

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
  logger.info('addComment updateItem', { data: { username, updateItemInput } });
  try {
    await dynamoDb.update(updateItemInput).promise();
  } catch (error) {
    logger.error('addComment error', { data: { username, error: error.stack } });
    throw createError(500, 'Error updating item', error);
  }

  logger.info('addComment success', { data: { username } });
  return {
    statusCode: 200,
    body: JSON.stringify({
      Message: 'Comment route success',
      Item: newComment,
    }),
  };
};

export const handler = getMiddlewareAddedHandler(addComment, addCommentSchema);
