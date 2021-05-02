import { Handler } from 'aws-lambda';
import DynamoDB, { AttributeValue, UpdateItemInput } from 'aws-sdk/clients/dynamodb';
import {
  getMiddlewareAddedHandler,
  GradeRouteEvent,
  gradeRouteSchema,
  JwtPayload,
  getItemFromRouteTable,
} from './common';
import jwt_decode from 'jwt-decode';
import createError from 'http-errors';

const dynamoDb = new DynamoDB.DocumentClient();

const gradeRoute: Handler = async (event: GradeRouteEvent) => {
  if (!process.env['ROUTE_TABLE_NAME']) {
    throw createError(500, 'Route table name is not set');
  }
  const {
    headers: { Authorization },
    body: { username: routeOwnerUsername, createdAt, grade },
  } = event;

  const Item = await getItemFromRouteTable(routeOwnerUsername, createdAt);

  const { username } = (await jwt_decode(Authorization.split(' ')[1])) as JwtPayload;
  let { publicGradeSubmissions, ownerGrade } = Item;

  let publicGradeTotal = 0;
  publicGradeSubmissions = publicGradeSubmissions.map((gradeSubmission) => {
    const { username: submittedName, grade: submittedGrade } = gradeSubmission;
    if (submittedName === username) {
      publicGradeTotal += grade;
      return { username, grade };
    } else {
      publicGradeTotal += submittedGrade;
      return gradeSubmission;
    }
  });

  if (username === routeOwnerUsername) {
    ownerGrade = grade;
  }
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
      ':publicGrade': Math.floor(
        publicGradeTotal / publicGradeSubmissions.length,
      ) as AttributeValue,
      ':ownerGrade': ownerGrade as AttributeValue,
    },
  };
  try {
    await dynamoDb.update(updateItemInput).promise();
  } catch (error) {
    throw createError(500, 'Error updating item :' + error.stack);
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ Message: 'Grade route success' }),
  };
};

export const handler = getMiddlewareAddedHandler(gradeRoute, gradeRouteSchema);
