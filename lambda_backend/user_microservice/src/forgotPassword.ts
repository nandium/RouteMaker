import { Handler } from 'aws-lambda';
import CognitoIdentity, {
  ForgotPasswordRequest,
} from 'aws-sdk/clients/cognitoidentityserviceprovider';

import { getMiddlewareAddedHandler } from './common/middleware';
import { ForgotPasswordEvent } from './common/types';
import { forgotPasswordSchema } from './common/schema';
import { logger } from './common/logger';

const cognitoIdentity = new CognitoIdentity();

const forgotPassword: Handler = async (event: ForgotPasswordEvent) => {
  const {
    body: { name: username },
  } = event;
  logger.info('forgotPassword initiated', { data: { username } });

  const forgotPasswordRequest: ForgotPasswordRequest = {
    Username: username,
    ClientId: process.env['COGNITO_CLIENT_ID'] || '',
  };
  try {
    const { CodeDeliveryDetails } = await cognitoIdentity
      .forgotPassword(forgotPasswordRequest)
      .promise();
    logger.info('forgotPassword success', { data: { username } });
    return {
      statusCode: 200,
      body: JSON.stringify({ Message: 'Request password reset success', ...CodeDeliveryDetails }),
    };
  } catch (error) {
    if (error.code === 'UserNotFoundException') {
      logger.info('forgotPassword UserNotFoundException', { data: { username } });
    } else if (error.code === 'LimitExceededException') {
      logger.error('forgotPassword LimitExceededException', { data: { username } });
    } else {
      logger.error('forgotPassword error', { data: { username, error: error.stack } });
    }
    return {
      statusCode: 400,
      body: JSON.stringify({ Message: error.code }),
    };
  }
};

export const handler = getMiddlewareAddedHandler(forgotPassword, forgotPasswordSchema);
