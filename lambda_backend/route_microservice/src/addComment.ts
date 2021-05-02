import { Handler } from 'aws-lambda';
import DynamoDB, { AttributeValue, UpdateItemInput } from 'aws-sdk/clients/dynamodb';
import {
  getMiddlewareAddedHandler,
  AddCommentEvent,
  addCommentSchema,
  JwtPayload,
  getItemFromRouteTable,
  Comment,
} from './common';
import jwt_decode from 'jwt-decode';
import createError from 'http-errors';

const dynamoDb = new DynamoDB.DocumentClient();

const addComment: Handler = async (event: AddCommentEvent) => {
  if (!process.env['ROUTE_TABLE_NAME']) {
    throw createError(500, 'Route table name is not set');
  }
  const {
    headers: { Authorization },
    body: { username: routeOwnerUsername, createdAt, comment },
  } = event;

  const Item = await getItemFromRouteTable(routeOwnerUsername, createdAt);

  const { username } = (await jwt_decode(Authorization.split(' ')[1])) as JwtPayload;
  let { comments } = Item;
  const newComment: Comment = {
    username,
    timestamp: Date.now(),
    comment,
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
  try {
    await dynamoDb.update(updateItemInput).promise();
  } catch (error) {
    throw createError(500, 'Error updating item :' + error.stack);
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      Message: 'Comment route success',
      Item: newComment,
    }),
  };
};

export const handler = getMiddlewareAddedHandler(addComment, addCommentSchema);
