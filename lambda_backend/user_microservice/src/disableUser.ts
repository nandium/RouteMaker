import { Handler } from 'aws-lambda';
import jwt_decode from 'jwt-decode';

import { getMiddlewareAddedHandler } from './common/middleware';
import { adminDisableUser, getCognitoUserDetails } from './common/identityProvider';
import { disableUserSchema } from './common/schema';
import { DisableUserEvent, JwtPayload } from './common/types';
import { logger } from './common/logger';

const disableUser: Handler = async (event: DisableUserEvent) => {
  const {
    headers: { Authorization },
    body: { name: disableUsername },
  } = event;
  const { username } = (await jwt_decode(Authorization.split(' ')[1])) as JwtPayload;
  logger.info('disableUser initiated', { data: { username, disableUsername } });

  const { userRole } = await getCognitoUserDetails(Authorization.split(' ')[1]);
  if (userRole === 'admin') {
    await adminDisableUser(disableUsername);
  } else {
    logger.error('disableUser Unauthorized', { data: { username, disableUsername } });
    return {
      statusCode: 403,
      body: JSON.stringify({ Message: 'Unauthorized' }),
    };
  }
  logger.info('disableUser success', { data: { username, disableUsername } });
  return {
    statusCode: 200,
    body: JSON.stringify({ Message: 'Disable user success' }),
  };
};

export const handler = getMiddlewareAddedHandler(disableUser, disableUserSchema);
