import { Handler } from 'aws-lambda';
import DynamoDB, { AttributeValue, UpdateItemInput } from 'aws-sdk/clients/dynamodb';
import {
  getMiddlewareAddedHandler,
  DeleteCommentEvent,
  deleteCommentSchema,
  JwtPayload,
  getItemFromRouteTable,
} from './common';
import jwt_decode from 'jwt-decode';
import createError from 'http-errors';

const dynamoDb = new DynamoDB.DocumentClient();

const deleteComment: Handler = async (event: DeleteCommentEvent) => {
  if (!process.env['ROUTE_TABLE_NAME']) {
    throw createError(500, 'Route table name is not set');
  }
  const {
    headers: { Authorization },
    queryStringParameters: { username: routeOwnerUsername, createdAt, commenterName, timestamp },
  } = event;

  const Item = await getItemFromRouteTable(routeOwnerUsername, createdAt);
  const { username: requestUsername } = (await jwt_decode(
    Authorization.split(' ')[1],
  )) as JwtPayload;

  // Delete only if requester is route owner or comment writer
  if (requestUsername !== commenterName && requestUsername !== routeOwnerUsername) {
    return { statusCode: 403 };
  }

  let { comments } = Item;
  comments = comments.filter((comment) => {
    const { timestamp: currTimestamp, username: currUsername } = comment;
    if (timestamp === currTimestamp && currUsername === commenterName) {
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
  try {
    await dynamoDb.update(updateItemInput).promise();
  } catch (error) {
    throw createError(500, 'Error updating item :' + error.stack);
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      Message: 'Delete comment success',
    }),
  };
};

export const handler = getMiddlewareAddedHandler(deleteComment, deleteCommentSchema);
