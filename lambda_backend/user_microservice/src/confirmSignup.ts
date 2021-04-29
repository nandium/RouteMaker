import { Handler } from 'aws-lambda';
import CognitoIdentity, {
  ConfirmSignUpRequest,
} from 'aws-sdk/clients/cognitoidentityserviceprovider';
import { ConfirmSignupEvent, confirmSignupSchema, getMiddlewareAddedHandler } from './common';
import createError from 'http-errors';

const cognitoIdentity = new CognitoIdentity();

const confirmSignup: Handler = async (event: ConfirmSignupEvent) => {
  if (!process.env['COGNITO_CLIENT_ID']) {
    throw createError(400, 'Cognito Client ID is not set');
  }
  const {
    body: { email, code },
  } = event;
  const confirmSignUpRequest: ConfirmSignUpRequest = {
    Username: email,
    ConfirmationCode: code,
    ClientId: process.env['COGNITO_CLIENT_ID'] || '',
  };
  try {
    await cognitoIdentity.confirmSignUp(confirmSignUpRequest).promise();
  } catch (error) {
    throw createError(400, 'Error occurred while confirming sign up in Cognito: ' + error.stack);
  }
  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Confirmation successful',
    }),
  };
};

export const handler = getMiddlewareAddedHandler(confirmSignup, confirmSignupSchema);
