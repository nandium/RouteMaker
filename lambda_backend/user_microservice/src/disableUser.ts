import { Handler } from 'aws-lambda';

import { getMiddlewareAddedHandler } from './common/middleware';
import { adminDisableUser, getCognitoUserDetails } from './common/identityProvider';
import { disableUserSchema } from './common/schema';
import { DisableUserEvent } from './common/types';

const disableUser: Handler = async (event: DisableUserEvent) => {
  const {
    headers: { Authorization },
    body: { name },
  } = event;

  const { userRole } = await getCognitoUserDetails(Authorization.split(' ')[1]);
  if (userRole === 'admin') {
    await adminDisableUser(name);
  } else {
    return {
      statusCode: 403,
      body: JSON.stringify({ Message: 'Unauthorized' }),
    };
  }
  return {
    statusCode: 200,
    body: JSON.stringify({ Message: 'Disable user success' }),
  };
};

export const handler = getMiddlewareAddedHandler(disableUser, disableUserSchema);
