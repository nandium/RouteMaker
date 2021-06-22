import { Handler } from 'aws-lambda';
import CognitoIdentity, { DeleteUserRequest } from 'aws-sdk/clients/cognitoidentityserviceprovider';

import { getMiddlewareAddedHandler } from './common/middleware';
import { DeleteEvent } from './common/types';

const cognitoIdentity = new CognitoIdentity();

const deleteUser: Handler = async (event: DeleteEvent) => {
  const {
    headers: { Authorization },
  } = event;
  const deleteUserRequest: DeleteUserRequest = {
    AccessToken: Authorization.split(' ')[1],
  };
  try {
    await cognitoIdentity.deleteUser(deleteUserRequest).promise();
  } catch (error) {
    return {
      statusCode: 400,
      body: JSON.stringify({ Message: error.code }),
    };
  }
  return { statusCode: 204 };
};

export const handler = getMiddlewareAddedHandler(deleteUser);
