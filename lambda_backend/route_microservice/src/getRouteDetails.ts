import { Handler } from 'aws-lambda';
import {
  getItemFromRouteTable,
  getMiddlewareAddedHandler,
  GetRouteDetailsEvent,
  getRouteDetailsSchema,
  JwtPayload,
} from './common';
import jwt_decode from 'jwt-decode';
import createError from 'http-errors';

const getRouteDetails: Handler = async (event: GetRouteDetailsEvent) => {
  if (!process.env['ROUTE_TABLE_NAME']) {
    throw createError(500, 'Route table name is not set');
  }
  const {
    headers: { Authorization },
    body: { username: routeOwnerUsername, createdAt },
  } = event;

  const Item = await getItemFromRouteTable(routeOwnerUsername, createdAt);

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
    const { username } = (await jwt_decode(Authorization.split(' ')[1])) as JwtPayload;
    publicGradeSubmissions.forEach(({ username: name, grade }) => {
      if (name === username) {
        hasGraded = true;
        graded = grade;
      }
    });
    upVotes.forEach((name) => {
      if (name === username) {
        hasVoted = true;
      }
    });
    reports.forEach((name) => {
      if (name === username) {
        hasReported = true;
      }
    });
  }
  return {
    statusCode: 200,
    body: JSON.stringify({
      Message: 'Get route details success',
      Item: {
        username: routeOwnerUsername,
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
