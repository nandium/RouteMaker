import { Handler } from 'aws-lambda';
import CognitoIdentity, {
  InitiateAuthRequest,
} from 'aws-sdk/clients/cognitoidentityserviceprovider';
import { LoginEvent, loginSchema, getMiddlewareAddedHandler } from './common';
import createError from 'http-errors';

const cognitoIdentity = new CognitoIdentity();

const login: Handler = async (event: LoginEvent) => {
  if (!process.env['COGNITO_CLIENT_ID']) {
    throw createError(400, 'Cognito Client ID is not set');
  }
  const {
    body: { email, password },
  } = event;
  const initiateAuthRequest: InitiateAuthRequest = {
    AuthFlow: 'USER_PASSWORD_AUTH',
    AuthParameters: {
      USERNAME: email,
      PASSWORD: password,
    },
    ClientId: process.env['COGNITO_CLIENT_ID'] || '',
  };
  try {
    const { AuthenticationResult } = await cognitoIdentity
      .initiateAuth(initiateAuthRequest)
      .promise();
    return {
      statusCode: 200,
      body: JSON.stringify({ Message: 'Log in success', ...AuthenticationResult }),
    };
  } catch (error) {
    return {
      statusCode: 400,
      body: JSON.stringify({ Message: error.code }),
    };
  }
};

export const handler = getMiddlewareAddedHandler(login, loginSchema);
