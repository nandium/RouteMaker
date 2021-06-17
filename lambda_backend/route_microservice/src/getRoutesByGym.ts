import { Handler } from 'aws-lambda';
import DynamoDB, { AttributeValue, QueryInput } from 'aws-sdk/clients/dynamodb';
import { getMiddlewareAddedHandler, GetRoutesByGymEvent } from './common';
import createError from 'http-errors';

const dynamoDb = new DynamoDB.DocumentClient();

const getRoutesByGym: Handler = async (event: GetRoutesByGymEvent) => {
  if (!process.env['ROUTE_TABLE_NAME']) {
    throw createError(500, 'Route table name is not set');
  }
  const {
    queryStringParameters: { gymLocation },
  } = event;
  const queryInput: QueryInput = {
    TableName: process.env['ROUTE_TABLE_NAME'],
    IndexName: 'gymLocationIndex',
    ConsistentRead: false,
    ScanIndexForward: false,
    KeyConditionExpression: 'gymLocation = :gymLocation',
    ExpressionAttributeValues: {
      ':gymLocation': gymLocation as AttributeValue,
    },
  };
  try {
    const { Items } = await dynamoDb.query(queryInput).promise();
    return {
      statusCode: 200,
      body: JSON.stringify({ Message: 'Query routes by gym success', Items }),
    };
  } catch (error) {
    throw createError(500, 'Error querying table :' + error.stack);
  }
};

export const handler = getMiddlewareAddedHandler(getRoutesByGym);
