import { Handler } from 'aws-lambda';
import CognitoIdentity, { DeleteUserRequest } from 'aws-sdk/clients/cognitoidentityserviceprovider';
import { DeleteEvent, getMiddlewareAddedHandler } from './common';
import createError from 'http-errors';

const cognitoIdentity = new CognitoIdentity();

const deleteUser: Handler = async (event: DeleteEvent) => {
  if (!process.env['COGNITO_CLIENT_ID']) {
    throw createError(500, 'Cognito Client ID is not set');
  }
  const {
    headers: { Authorization },
  } = event;
  const deleteUserRequest: DeleteUserRequest = {
    AccessToken: Authorization.split(' ')[1],
  };
  try {
    await cognitoIdentity.deleteUser(deleteUserRequest).promise();
  } catch (error) {
    return {
      statusCode: 400,
      body: JSON.stringify({ Message: error.code }),
    };
  }
  return { statusCode: 204 };
};

export const handler = getMiddlewareAddedHandler(deleteUser);
