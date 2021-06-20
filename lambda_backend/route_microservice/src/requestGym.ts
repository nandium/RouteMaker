import { Handler } from 'aws-lambda';
import SNS, { PublishInput } from 'aws-sdk/clients/sns';
import createError from 'http-errors';

import { getMiddlewareAddedHandler } from './common/middleware';
import { getCognitoUserDetails } from './common/cognito';
import { requestGymSchema } from './common/schema';
import { RequestGymEvent } from './common/types';

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
  const publishInput: PublishInput = {
    Message: `Email: ${userEmail}\nGym: [${gymName}]\nLoc: [${postal}] at [${countryCode}]`,
    TopicArn: process.env['TELEGRAM_SNS_ARN'],
  };

  try {
    await SNSInstance.publish(publishInput).promise();
  } catch (error) {
    throw createError(500, 'Error publishing SNS :' + error.stack);
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ Message: 'Request gym success' }),
  };
};

export const handler = getMiddlewareAddedHandler(requestGym, requestGymSchema);
