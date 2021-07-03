import { Handler } from 'aws-lambda';
import CognitoIdentity, { DeleteUserRequest } from 'aws-sdk/clients/cognitoidentityserviceprovider';
import jwt_decode from 'jwt-decode';

import { getMiddlewareAddedHandler } from './common/middleware';
import { DeleteEvent, JwtPayload } from './common/types';
import { logger } from './common/logger';

const cognitoIdentity = new CognitoIdentity();

const deleteUser: Handler = async (event: DeleteEvent) => {
  const {
    headers: { Authorization },
  } = event;
  const { username } = (await jwt_decode(Authorization.split(' ')[1])) as JwtPayload;
  logger.info('deleteUser initiated', { data: { username } });

  const deleteUserRequest: DeleteUserRequest = {
    AccessToken: Authorization.split(' ')[1],
  };
  try {
    await cognitoIdentity.deleteUser(deleteUserRequest).promise();
  } catch (error) {
    logger.error('deleteUser error', { data: { username, error: error.stack } });
    return {
      statusCode: 400,
      body: JSON.stringify({ Message: error.code }),
    };
  }
  logger.info('deleteUser success', { data: { username } });
  return { statusCode: 204 };
};

export const handler = getMiddlewareAddedHandler(deleteUser);
