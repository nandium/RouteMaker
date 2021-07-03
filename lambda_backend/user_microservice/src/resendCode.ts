import { Handler } from 'aws-lambda';
import CognitoIdentity, {
  ResendConfirmationCodeRequest,
} from 'aws-sdk/clients/cognitoidentityserviceprovider';

import { getMiddlewareAddedHandler } from './common/middleware';
import { ResendCodeEvent } from './common/types';
import { resendCodeSchema } from './common/schema';
import { logger } from './common/logger';

const cognitoIdentity = new CognitoIdentity();

const resendCode: Handler = async (event: ResendCodeEvent) => {
  const {
    body: { name: username },
  } = event;
  logger.info('resendCode initiated', { data: { username } });

  const resendConfirmationCodeRequest: ResendConfirmationCodeRequest = {
    Username: username,
    ClientId: process.env['COGNITO_CLIENT_ID'] || '',
  };
  try {
    await cognitoIdentity.resendConfirmationCode(resendConfirmationCodeRequest).promise();
  } catch (error) {
    if (error.code === 'UserNotFoundException') {
      logger.info('resendCode UserNotFoundException', { data: { username } });
    } else if (error.code === 'LimitExceededException') {
      logger.error('resendCode LimitExceededException', { data: { username } });
    } else {
      logger.error('resendCode error', { data: { username, error: error.stack } });
    }
    return {
      statusCode: 400,
      body: JSON.stringify({ Message: error.code }),
    };
  }
  logger.info('resendCode success', { data: { username } });
  return {
    statusCode: 200,
    body: JSON.stringify({ Message: 'Resend code success' }),
  };
};

export const handler = getMiddlewareAddedHandler(resendCode, resendCodeSchema);
