import DynamoDB, { AttributeValue, GetItemInput } from 'aws-sdk/clients/dynamodb';
import { RouteItem } from './types';
import createError from 'http-errors';

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
    throw createError(500, 'Error getting item :' + error.stack);
  }
  if (!Item) {
    throw createError(400, 'Route does not exist');
  }
  return Item as RouteItem;
};
