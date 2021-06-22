import { Handler } from 'aws-lambda';
import SNS, { PublishInput } from 'aws-sdk/clients/sns';
import createError from 'http-errors';
import jwt_decode from 'jwt-decode';

import { getMiddlewareAddedHandler } from './common/middleware';
import { reportUserSchema } from './common/schema';
import { ReportUserEvent, JwtPayload } from './common/types';

const SNSInstance = new SNS();

const reportUser: Handler = async (event: ReportUserEvent) => {
  if (!process.env['TELEGRAM_SNS_ARN']) {
    throw createError(500, 'Telegram SNS ARN is not set');
  }

  const {
    headers: { Authorization },
    body: { name, reason },
  } = event;

  const { username: requestUsername } = (await jwt_decode(
    Authorization.split(' ')[1],
  )) as JwtPayload;

  if (requestUsername === name) {
    return {
      statusCode: 400,
      body: JSON.stringify({ Message: 'Self report' }),
    };
  }

  const publishInput: PublishInput = {
    Message: `Report User\nBy: ${requestUsername}\nOn: ${name}\nFor: ${reason}`,
    TopicArn: process.env['TELEGRAM_SNS_ARN'],
  };
  try {
    await SNSInstance.publish(publishInput).promise();
  } catch (error) {
    throw createError(500, 'Error publishing SNS', error);
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ Message: 'Report user success' }),
  };
};

export const handler = getMiddlewareAddedHandler(reportUser, reportUserSchema);
