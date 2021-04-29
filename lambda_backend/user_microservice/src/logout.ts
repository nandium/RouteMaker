import { Handler } from 'aws-lambda';
import CognitoIdentity, {
  GlobalSignOutRequest,
} from 'aws-sdk/clients/cognitoidentityserviceprovider';
import httpSecurityHeaders from '@middy/http-security-headers';
import httpErrorHandler from '@middy/http-error-handler';
import cors from '@middy/http-cors';
import middy from '@middy/core';
import createError from 'http-errors';

import { getAllowedOrigin, LogoutEvent } from './common';

const cognitoIdentity = new CognitoIdentity();

const logout: Handler = async (event: LogoutEvent) => {
  if (!process.env['COGNITO_CLIENT_ID']) {
    throw createError(400, 'Cognito Client ID is not set');
  }
  const {
    headers: { Authorization },
  } = event;
  const globalSignOutRequest: GlobalSignOutRequest = {
    AccessToken: Authorization.split(' ')[1],
  };
  try {
    await cognitoIdentity.globalSignOut(globalSignOutRequest).promise();
  } catch (error) {
    throw createError(400, 'Error occurred during sign out in Cognito: ' + error.stack);
  }
  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Sign out success',
    }),
  };
};

export const handler = middy(logout)
  .use(httpErrorHandler())
  .use(httpSecurityHeaders())
  .use(cors({ origin: getAllowedOrigin() }));
