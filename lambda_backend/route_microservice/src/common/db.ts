import DynamoDB, { AttributeValue, GetItemInput, QueryInput } from 'aws-sdk/clients/dynamodb';
import createError from 'http-errors';

import { RouteItem } from './types';
import { logger } from './logger';

const dynamoDb = new DynamoDB.DocumentClient();

export const getItemFromRouteTable = async (
  routeOwnerUsername: string,
  createdAt: string,
): Promise<RouteItem> => {
  const getItemInput: GetItemInput = {
    TableName: process.env['ROUTE_TABLE_NAME'] || '',
    ConsistentRead: false,
    Key: {
      username: routeOwnerUsername as AttributeValue,
      createdAt: createdAt as AttributeValue,
    },
  };
  let Item;
  try {
    ({ Item } = await dynamoDb.get(getItemInput).promise());
  } catch (error) {
    logger.error('getItemFromRouteTable error', {
      data: { routeOwnerUsername, createdAt, error: error.stack },
    });
    throw createError(500, 'Error getting item', error);
  }
  if (!Item) {
    throw createError(400, 'Route does not exist');
  }
  return Item as RouteItem;
};

export const getGymIsRegistered = async (
  countryCode: string,
  gymLocation: string,
): Promise<boolean> => {
  const queryInput: QueryInput = {
    TableName: process.env['GYM_TABLE_NAME'] || '',
    ConsistentRead: false,
    KeyConditionExpression: 'countryCode = :countryCode AND gymLocation = :gymLocation',
    ExpressionAttributeValues: {
      ':countryCode': countryCode as AttributeValue,
      ':gymLocation': gymLocation as AttributeValue,
    },
  };
  let Items;
  try {
    ({ Items } = await dynamoDb.query(queryInput).promise());
  } catch (error) {
    logger.error('getGymIsRegistered error', {
      data: { countryCode, gymLocation, error: error.stack },
    });
    throw createError(500, 'Error querying table', error);
  }
  return Items.length > 0;
};
