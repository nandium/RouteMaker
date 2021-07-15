import { Handler } from 'aws-lambda';
import DynamoDB, { AttributeValue, UpdateItemInput } from 'aws-sdk/clients/dynamodb';
import jwt_decode from 'jwt-decode';
import createError from 'http-errors';

import { getMiddlewareAddedHandler } from './common/middleware';
import { getItemFromRouteTable } from './common/db';
import { gradeRouteSchema } from './common/schema';
import { GradeRouteEvent, JwtPayload } from './common/types';
import { logger } from './common/logger';

const dynamoDb = new DynamoDB.DocumentClient();

const gradeRoute: Handler = async (event: GradeRouteEvent) => {
  if (!process.env['ROUTE_TABLE_NAME']) {
    throw createError(500, 'Route table name is not set');
  }
  const {
    headers: { Authorization },
    body: { username: routeOwnerUsername, createdAt, grade },
  } = event;
  const { username } = (await jwt_decode(Authorization.split(' ')[1])) as JwtPayload;
  logger.info('gradeRoute initiated', { data: { username, routeOwnerUsername, createdAt, grade } });

  const Item = await getItemFromRouteTable(routeOwnerUsername, createdAt);
  let { publicGradeSubmissions, ownerGrade } = Item;
  let publicGradeTotal = 0;
  let userHasGradedBefore = false;
  // If user has graded before, replace the original entry
  publicGradeSubmissions = publicGradeSubmissions.map((gradeSubmission) => {
    const { username: submittedName, grade: submittedGrade } = gradeSubmission;
    if (submittedName === username) {
      publicGradeTotal += grade;
      userHasGradedBefore = true;
      return { username, grade };
    } else {
      publicGradeTotal += submittedGrade;
      return gradeSubmission;
    }
  });
  if (!userHasGradedBefore) {
    publicGradeTotal += grade;
    publicGradeSubmissions = [...publicGradeSubmissions, { username, grade }];
  }

  if (username === routeOwnerUsername) {
    ownerGrade = grade;
  }
  const newPublicGrade = Math.floor(publicGradeTotal / publicGradeSubmissions.length);
  const updateItemInput: UpdateItemInput = {
    TableName: process.env['ROUTE_TABLE_NAME'],
    Key: {
      username: routeOwnerUsername as AttributeValue,
      createdAt: createdAt as AttributeValue,
    },
    UpdateExpression: `
      SET publicGradeSubmissions = :publicGradeSubmissions,
      publicGrade = :publicGrade,
      ownerGrade = :ownerGrade
    `,
    ExpressionAttributeValues: {
      ':publicGradeSubmissions': publicGradeSubmissions as AttributeValue,
      ':publicGrade': newPublicGrade as AttributeValue,
      ':ownerGrade': ownerGrade as AttributeValue,
    },
  };
  logger.info('gradeRoute updateItem', { data: { username } });
  try {
    await dynamoDb.update(updateItemInput).promise();
  } catch (error) {
    logger.error('gradeRoute error', { data: { username, error: error.stack } });
    throw createError(500, 'Error updating item', error);
  }

  logger.info('gradeRoute success', { data: { username } });
  return {
    statusCode: 200,
    body: JSON.stringify({
      Message: 'Grade route success',
      Item: {
        publicGrade: newPublicGrade,
        ownerGrade,
      },
    }),
  };
};

export const handler = getMiddlewareAddedHandler(gradeRoute, gradeRouteSchema);
