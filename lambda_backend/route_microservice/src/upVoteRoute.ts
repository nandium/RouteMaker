import { Handler } from 'aws-lambda';
import DynamoDB, { AttributeValue, GetItemInput, UpdateItemInput } from 'aws-sdk/clients/dynamodb';
import {
  getEmailFromCognito,
  getMiddlewareAddedHandler,
  UpVoteRouteEvent,
  upVoteRouteSchema,
} from './common';
import createError from 'http-errors';

const dynamoDb = new DynamoDB.DocumentClient();

const upVoteDetails: Handler = async (event: UpVoteRouteEvent) => {
  if (!process.env['ROUTE_TABLE_NAME']) {
    throw createError(500, 'Route table name is not set');
  }
  const {
    headers: { Authorization },
    body: { userEmail: routeOwnerEmail, createdAt },
  } = event;
  const getItemInput: GetItemInput = {
    TableName: process.env['ROUTE_TABLE_NAME'],
    ConsistentRead: false,
    Key: {
      userEmail: routeOwnerEmail as AttributeValue,
      createdAt: createdAt as AttributeValue,
    },
  };
  let Item;
  try {
    ({ Item } = await dynamoDb.get(getItemInput).promise());
  } catch (error) {
    throw createError(500, 'Error getting item :' + error.stack);
  }
  if (!Item) {
    throw createError(400, 'Route does not exist');
  }

  const userEmail = await getEmailFromCognito(Authorization.split(' ')[1]);
  const { upVotes } = Item;
  if (!upVotes.includes(userEmail)) {
    upVotes.push(userEmail);
    const updateItemInput: UpdateItemInput = {
      TableName: process.env['ROUTE_TABLE_NAME'],
      Key: {
        userEmail: routeOwnerEmail as AttributeValue,
        createdAt: createdAt as AttributeValue,
      },
      UpdateExpression: 'SET upVotes = :upVotes, vote = :vote',
      ExpressionAttributeValues: {
        ':upVotes': upVotes,
        ':vote': upVotes.length,
      },
    };
    try {
      await dynamoDb.update(updateItemInput).promise();
    } catch (error) {
      throw createError(500, 'Error updating item :' + error.stack);
    }
  }
  return {
    statusCode: 200,
    body: JSON.stringify({ Message: 'Upvote route success' }),
  };
};

export const handler = getMiddlewareAddedHandler(upVoteDetails, upVoteRouteSchema);