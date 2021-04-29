import { Handler } from 'aws-lambda';
import CognitoIdentity, {
  InitiateAuthRequest,
} from 'aws-sdk/clients/cognitoidentityserviceprovider';
import httpSecurityHeaders from '@middy/http-security-headers';
import jsonBodyParser from '@middy/http-json-body-parser';
import httpErrorHandler from '@middy/http-error-handler';
import validator from '@middy/validator';
import cors from '@middy/http-cors';
import middy from '@middy/core';
import createError from 'http-errors';

import { getAllowedOrigin, LoginEvent, loginSchema } from './common';

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
  let response = {};
  try {
    response = await cognitoIdentity.initiateAuth(initiateAuthRequest).promise();
  } catch (error) {
    throw createError(400, 'Error occurred during login in Cognito: ' + error.stack);
  }
  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
};

export const handler = middy(login)
  .use(jsonBodyParser())
  .use(validator({ inputSchema: loginSchema }))
  .use(httpErrorHandler())
  .use(httpSecurityHeaders())
  .use(cors({ origin: getAllowedOrigin() }));
