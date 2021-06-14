import { Handler } from 'aws-lambda';
import CognitoIdentity, {
  ForgotPasswordRequest,
} from 'aws-sdk/clients/cognitoidentityserviceprovider';
import { ForgotPasswordEvent, forgotPasswordSchema, getMiddlewareAddedHandler } from './common';
import createError from 'http-errors';

const cognitoIdentity = new CognitoIdentity();

const forgotPassword: Handler = async (event: ForgotPasswordEvent) => {
  if (!process.env['COGNITO_CLIENT_ID']) {
    throw createError(500, 'Cognito Client ID is not set');
  }
  const {
    body: { email },
  } = event;
  const forgotPasswordRequest: ForgotPasswordRequest = {
    Username: email,
    ClientId: process.env['COGNITO_CLIENT_ID'] || '',
  };
  try {
    await cognitoIdentity.forgotPassword(forgotPasswordRequest).promise();
  } catch (error) {
    return {
      statusCode: 400,
      body: JSON.stringify({ Message: error.code }),
    };
  }
  return {
    statusCode: 200,
    body: JSON.stringify({ Message: 'Request password reset success' }),
  };
};

export const handler = getMiddlewareAddedHandler(forgotPassword, forgotPasswordSchema);
