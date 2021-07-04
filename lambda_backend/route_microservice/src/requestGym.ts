import { Handler } from 'aws-lambda';
import SNS, { PublishInput } from 'aws-sdk/clients/sns';
import createError from 'http-errors';
import jwt_decode from 'jwt-decode';

import { getMiddlewareAddedHandler } from './common/middleware';
import { getCognitoUserDetails } from './common/cognito';
import { requestGymSchema } from './common/schema';
import { RequestGymEvent, JwtPayload } from './common/types';
import { logger } from './common/logger';

const SNSInstance = new SNS();

const requestGym: Handler = async (event: RequestGymEvent) => {
  if (!process.env['TELEGRAM_SNS_ARN']) {
    throw createError(500, 'Telegram SNS ARN is not set');
  }
  const {
    headers: { Authorization },
    body: { countryCode, postal, gymName },
  } = event;
  const { userEmail } = await getCognitoUserDetails(Authorization.split(' ')[1]);
  const { username } = (await jwt_decode(Authorization.split(' ')[1])) as JwtPayload;
  logger.info('requestGym initiated', {
    data: { username, userEmail, countryCode, postal, gymName },
  });

  const publishInput: PublishInput = {
    Message: `Email: ${userEmail}\nGym: [${gymName}]\nLoc: [${postal}] at [${countryCode}]`,
    TopicArn: process.env['TELEGRAM_SNS_ARN'],
  };

  try {
    await SNSInstance.publish(publishInput).promise();
  } catch (error) {
    logger.error('requestGym error', { data: { username, error: error.stack } });
    throw createError(500, 'Error publishing SNS', error);
  }

  logger.info('requestGym success', { data: { username } });
  return {
    statusCode: 200,
    body: JSON.stringify({ Message: 'Request gym success' }),
  };
};

export const handler = getMiddlewareAddedHandler(requestGym, requestGymSchema);
