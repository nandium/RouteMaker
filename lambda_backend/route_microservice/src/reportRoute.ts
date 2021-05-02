import { Handler } from 'aws-lambda';
import DynamoDB, { AttributeValue, UpdateItemInput } from 'aws-sdk/clients/dynamodb';
import {
  getMiddlewareAddedHandler,
  ReportRouteEvent,
  reportRouteSchema,
  JwtPayload,
  getItemFromRouteTable,
} from './common';
import jwt_decode from 'jwt-decode';
import createError from 'http-errors';

const dynamoDb = new DynamoDB.DocumentClient();

const reportRoute: Handler = async (event: ReportRouteEvent) => {
  if (!process.env['ROUTE_TABLE_NAME']) {
    throw createError(500, 'Route table name is not set');
  }
  const {
    headers: { Authorization },
    body: { username: routeOwnerUsername, createdAt },
  } = event;

  const Item = await getItemFromRouteTable(routeOwnerUsername, createdAt);

  const { username } = (await jwt_decode(Authorization.split(' ')[1])) as JwtPayload;
  const { reports } = Item;
  if (!reports.includes(username)) {
    reports.push(username);
    const updateItemInput: UpdateItemInput = {
      TableName: process.env['ROUTE_TABLE_NAME'],
      Key: {
        username: routeOwnerUsername as AttributeValue,
        createdAt: createdAt as AttributeValue,
      },
      UpdateExpression: 'SET reports = :reports',
      ExpressionAttributeValues: {
        ':reports': reports as AttributeValue,
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
    body: JSON.stringify({ Message: 'Report route success' }),
  };
};

export const handler = getMiddlewareAddedHandler(reportRoute, reportRouteSchema);
