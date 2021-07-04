import { Handler } from 'aws-lambda';
import CognitoIdentity, { SignUpRequest } from 'aws-sdk/clients/cognitoidentityserviceprovider';

import { getMiddlewareAddedHandler } from './common/middleware';
import { SignupEvent } from './common/types';
import { signupSchema } from './common/schema';
import { logger } from './common/logger';

const cognitoIdentity = new CognitoIdentity();

const signup: Handler = async (event: SignupEvent) => {
  const {
    body: { email, name: username, password },
  } = event;
  logger.info('signup initiated', { data: { username } });

  const signUpRequest: SignUpRequest = {
    Username: username,
    Password: password,
    UserAttributes: [
      { Name: 'email', Value: email },
      { Name: 'custom:role', Value: 'user' },
    ],
    ClientId: process.env['COGNITO_CLIENT_ID'] || '',
  };
  try {
    const { CodeDeliveryDetails } = await cognitoIdentity.signUp(signUpRequest).promise();
    logger.info('signup success', { data: { username } });
    return {
      statusCode: 201,
      body: JSON.stringify({ Message: 'Sign up success', ...CodeDeliveryDetails }),
    };
  } catch (error) {
    if (error.code === 'UsernameExistsException') {
      logger.info('signup UsernameExistsException', { data: { username } });
    } else {
      logger.error('signup error', { data: { username, error: error.stack } });
    }
    logger.info('signup success', { data: { username } });
    return {
      statusCode: 400,
      body: JSON.stringify({ Message: error.code }),
    };
  }
};

export const handler = getMiddlewareAddedHandler(signup, signupSchema);
