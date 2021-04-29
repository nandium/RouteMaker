import { Handler } from 'aws-lambda';
import CognitoIdentity, {
  ConfirmSignUpRequest,
} from 'aws-sdk/clients/cognitoidentityserviceprovider';
import httpSecurityHeaders from '@middy/http-security-headers';
import jsonBodyParser from '@middy/http-json-body-parser';
import httpErrorHandler from '@middy/http-error-handler';
import validator from '@middy/validator';
import cors from '@middy/http-cors';
import middy from '@middy/core';
import createError from 'http-errors';

import { getAllowedOrigin, ConfirmSignupEvent, confirmSignupSchema } from './common';

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

export const handler = middy(confirmSignup)
  .use(jsonBodyParser())
  .use(validator({ inputSchema: confirmSignupSchema }))
  .use(httpErrorHandler())
  .use(httpSecurityHeaders())
  .use(cors({ origin: getAllowedOrigin() }));
