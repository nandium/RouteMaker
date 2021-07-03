import { Handler } from 'aws-lambda';
import CognitoIdentity, {
  ConfirmForgotPasswordRequest,
} from 'aws-sdk/clients/cognitoidentityserviceprovider';

import { getMiddlewareAddedHandler } from './common/middleware';
import { ConfirmForgotPasswordEvent } from './common/types';
import { confirmForgotPasswordSchema } from './common/schema';
import { logger } from './common/logger';

const cognitoIdentity = new CognitoIdentity();

const confirmForgotPassword: Handler = async (event: ConfirmForgotPasswordEvent) => {
  const {
    body: { code, name: username, password },
  } = event;
  logger.info('confirmForgotPassword initiated', { data: { username } });

  const confirmForgotPasswordRequest: ConfirmForgotPasswordRequest = {
    Username: username,
    ConfirmationCode: code,
    Password: password,
    ClientId: process.env['COGNITO_CLIENT_ID'] || '',
  };
  try {
    await cognitoIdentity.confirmForgotPassword(confirmForgotPasswordRequest).promise();
  } catch (error) {
    if (error.code === 'CodeMismatchException') {
      logger.info('confirmForgotPassword CodeMismatchException', { data: { username } });
    } else if (error.code === 'ExpiredCodeException') {
      logger.info('confirmForgotPassword ExpiredCodeException', { data: { username } });
    } else {
      logger.error('confirmForgotPassword error', { data: { username, error: error.stack } });
    }
    return {
      statusCode: 400,
      body: JSON.stringify({ Message: error.code }),
    };
  }
  logger.info('confirmForgotPassword success', { data: { username } });
  return {
    statusCode: 200,
    body: JSON.stringify({ Message: 'Password reset success' }),
  };
};

export const handler = getMiddlewareAddedHandler(
  confirmForgotPassword,
  confirmForgotPasswordSchema,
);
