import { Handler } from 'aws-lambda';
import DynamoDB, { AttributeValue, UpdateItemInput } from 'aws-sdk/clients/dynamodb';
import SNS, { PublishInput } from 'aws-sdk/clients/sns';
import jwt_decode from 'jwt-decode';
import createError from 'http-errors';

import { getMiddlewareAddedHandler } from './common/middleware';
import { getItemFromRouteTable } from './common/db';
import { reportRouteSchema } from './common/schema';
import { ReportRouteEvent, JwtPayload } from './common/types';

const dynamoDb = new DynamoDB.DocumentClient();
const SNSInstance = new SNS();

const reportRoute: Handler = async (event: ReportRouteEvent) => {
  if (!process.env['ROUTE_TABLE_NAME'] || !process.env['TELEGRAM_SNS_ARN']) {
    throw createError(500, 'Route table name or Telegram SNS is not set');
  }
  const {
    headers: { Authorization },
    body: { username: routeOwnerUsername, createdAt },
  } = event;

  const Item = await getItemFromRouteTable(routeOwnerUsername, createdAt);

  const { username } = (await jwt_decode(Authorization.split(' ')[1])) as JwtPayload;
  const { reports } = Item;

  // Only if the user has not reported the route before
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
      throw createError(500, 'Error updating item', error);
    }

    const publishInput: PublishInput = {
      Message: `Report\nBy: ${username}\nOwner: ${routeOwnerUsername}\nAt: ${createdAt}\nTally: ${reports.length}`,
      TopicArn: process.env['TELEGRAM_SNS_ARN'],
    };
    try {
      await SNSInstance.publish(publishInput).promise();
    } catch (error) {
      throw createError(500, 'Error publishing SNS', error);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ Message: 'Report route success' }),
    };
  } else {
    return {
      statusCode: 400,
      body: JSON.stringify({ Message: 'Duplicate route report' }),
    };
  }
};

export const handler = getMiddlewareAddedHandler(reportRoute, reportRouteSchema);
