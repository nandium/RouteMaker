import { Handler } from 'aws-lambda';
import DynamoDB, { AttributeValue, GetItemInput } from 'aws-sdk/clients/dynamodb';
import {
  getEmailFromCognito,
  getMiddlewareAddedHandler,
  GetRouteDetailsEvent,
  getRouteDetailsSchema,
} from './common';
import createError from 'http-errors';

const dynamoDb = new DynamoDB.DocumentClient();

const getRouteDetails: Handler = async (event: GetRouteDetailsEvent) => {
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

  let hasVoted = false;
  let hasReported = false;
  let hasGraded = false;
  let graded = -1;
  const {
    expiredTime,
    routeName,
    gymLocation,
    routeURL,
    ownerGrade,
    publicGrade,
    publicGradeSubmissions,
    vote,
    upVotes,
    reports,
    comments,
  } = Item;
  if (Authorization) {
    const userEmail = await getEmailFromCognito(Authorization.split(' ')[1]);
    publicGradeSubmissions.forEach(({ email, grade }) => {
      if (email === userEmail) {
        hasGraded = true;
        graded = grade;
      }
    });
    upVotes.forEach((email) => {
      if (email === userEmail) {
        hasVoted = true;
      }
    });
    reports.forEach((email) => {
      if (email === userEmail) {
        hasReported = true;
      }
    });
  }
  return {
    statusCode: 200,
    body: JSON.stringify({
      Message: 'Get route details success',
      Item: {
        userEmail: routeOwnerEmail,
        createdAt,
        expiredTime,
        routeName,
        gymLocation,
        routeURL,
        ownerGrade,
        publicGrade,
        vote,
        comments,
        hasVoted,
        hasReported,
        hasGraded,
        graded,
      },
    }),
  };
};

export const handler = getMiddlewareAddedHandler(getRouteDetails, getRouteDetailsSchema);
