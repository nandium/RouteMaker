import { Handler } from 'aws-lambda';
import CognitoIdentity, {
  ConfirmSignUpRequest,
} from 'aws-sdk/clients/cognitoidentityserviceprovider';

import { getMiddlewareAddedHandler } from './common/middleware';
import { ConfirmSignupEvent } from './common/types';
import { confirmSignupSchema } from './common/schema';
import { logger } from './common/logger';

const cognitoIdentity = new CognitoIdentity();

const confirmSignup: Handler = async (event: ConfirmSignupEvent) => {
  const {
    body: { name: username, code },
  } = event;
  logger.info('confirmSignup initiated', { data: { username } });

  const confirmSignUpRequest: ConfirmSignUpRequest = {
    Username: username,
    ConfirmationCode: code,
    ClientId: process.env['COGNITO_CLIENT_ID'] || '',
  };
  try {
    await cognitoIdentity.confirmSignUp(confirmSignUpRequest).promise();
  } catch (error) {
    if (error.code === 'CodeMismatchException') {
      logger.info('confirmSignup CodeMismatchException', { data: { username } });
    } else if (error.code === 'ExpiredCodeException') {
      logger.info('confirmSignup ExpiredCodeException', { data: { username } });
    } else {
      logger.error('confirmSignup error', { data: { username, error: error.stack } });
    }
    return {
      statusCode: 400,
      body: JSON.stringify({ Message: error.code }),
    };
  }
  logger.info('confirmSignup success', { data: { username } });
  return {
    statusCode: 200,
    body: JSON.stringify({ Message: 'Confirmation success' }),
  };
};

export const handler = getMiddlewareAddedHandler(confirmSignup, confirmSignupSchema);
