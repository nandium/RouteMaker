import { Handler } from 'aws-lambda';
import CognitoIdentity, {
  InitiateAuthRequest,
} from 'aws-sdk/clients/cognitoidentityserviceprovider';

import { getMiddlewareAddedHandler } from './common/middleware';
import { LoginEvent } from './common/types';
import { loginSchema } from './common/schema';
import { adminGetCognitoUserDetails } from './common/identityProvider';
import { logger } from './common/logger';

const cognitoIdentity = new CognitoIdentity();

const login: Handler = async (event: LoginEvent) => {
  const {
    body: { name: username, password },
  } = event;
  logger.info('login initiated', { data: { username } });

  const initiateAuthRequest: InitiateAuthRequest = {
    AuthFlow: 'USER_PASSWORD_AUTH',
    AuthParameters: {
      USERNAME: username,
      PASSWORD: password,
    },
    ClientId: process.env['COGNITO_CLIENT_ID'] || '',
  };
  try {
    const { AuthenticationResult } = await cognitoIdentity
      .initiateAuth(initiateAuthRequest)
      .promise();
    logger.info('login success', { data: { username } });
    return {
      statusCode: 200,
      body: JSON.stringify({ Message: 'Log in success', ...AuthenticationResult }),
    };
  } catch (error) {
    if (error.code === 'UserNotConfirmedException') {
      const { userEmail } = await adminGetCognitoUserDetails(username);
      logger.info('login UserNotConfirmedException', { data: { username, userEmail } });
      return {
        statusCode: 400,
        body: JSON.stringify({ Message: error.code, Email: userEmail }),
      };
    } else {
      if (error.code === 'NotAuthorizedException') {
        logger.info('login NotAuthorizedException', { data: { username } });
      } else {
        logger.error('login error', { data: { username, error: error.stack } });
      }
      return {
        statusCode: 400,
        body: JSON.stringify({ Message: error.code }),
      };
    }
  }
};

export const handler = getMiddlewareAddedHandler(login, loginSchema);
