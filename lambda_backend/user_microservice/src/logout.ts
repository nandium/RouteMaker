import { Handler } from 'aws-lambda';
import CognitoIdentity, {
  GlobalSignOutRequest,
} from 'aws-sdk/clients/cognitoidentityserviceprovider';
import jwt_decode from 'jwt-decode';

import { getMiddlewareAddedHandler } from './common/middleware';
import { LogoutEvent, JwtPayload } from './common/types';
import { logger } from './common/logger';

const cognitoIdentity = new CognitoIdentity();

/**
 * Invalidates the JWT token
 */
const logout: Handler = async (event: LogoutEvent) => {
  const {
    headers: { Authorization },
  } = event;
  const globalSignOutRequest: GlobalSignOutRequest = {
    AccessToken: Authorization.split(' ')[1],
  };
  const { username } = (await jwt_decode(Authorization.split(' ')[1])) as JwtPayload;
  logger.info('logout initiated', { data: { username } });

  try {
    await cognitoIdentity.globalSignOut(globalSignOutRequest).promise();
  } catch (error) {
    logger.error('logout error', { data: { username, error: error.stack } });
    return {
      statusCode: 400,
      body: JSON.stringify({ Message: error.code }),
    };
  }
  logger.info('logout success', { data: { username } });
  return {
    statusCode: 200,
    body: JSON.stringify({ Message: 'Sign out success' }),
  };
};

export const handler = getMiddlewareAddedHandler(logout);
