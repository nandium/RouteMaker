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
    return {
      statusCode: 400,
      body: JSON.stringify({ Message: error.code }),
    };
  }
  return {
    statusCode: 200,
    body: JSON.stringify({ Message: 'Confirmation success' }),
  };
};

export const handler = getMiddlewareAddedHandler(confirmSignup, confirmSignupSchema);
