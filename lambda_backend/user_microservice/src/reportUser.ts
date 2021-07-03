import { Handler } from 'aws-lambda';
import SNS, { PublishInput } from 'aws-sdk/clients/sns';
import createError from 'http-errors';
import jwt_decode from 'jwt-decode';

import { getMiddlewareAddedHandler } from './common/middleware';
import { reportUserSchema } from './common/schema';
import { ReportUserEvent, JwtPayload } from './common/types';
import { logger } from './common/logger';

const SNSInstance = new SNS();

const reportUser: Handler = async (event: ReportUserEvent) => {
  if (!process.env['TELEGRAM_SNS_ARN']) {
    throw createError(500, 'Telegram SNS ARN is not set');
  }

  const {
    headers: { Authorization },
    body: { name: reportedUsername, reason },
  } = event;
  const { username: requestUsername } = (await jwt_decode(
    Authorization.split(' ')[1],
  )) as JwtPayload;
  logger.info('reportUser initiated', { data: { username: requestUsername, reportedUsername } });

  if (requestUsername === reportedUsername) {
    return {
      statusCode: 400,
      body: JSON.stringify({ Message: 'Self report' }),
    };
  }

  const publishInput: PublishInput = {
    Message: `Report User\nBy: ${requestUsername}\nOn: ${reportedUsername}\nFor: ${reason}`,
    TopicArn: process.env['TELEGRAM_SNS_ARN'],
  };
  try {
    await SNSInstance.publish(publishInput).promise();
  } catch (error) {
    logger.error('reportUser error', { data: { username: requestUsername, error: error.stack } });
    throw createError(500, 'Error publishing SNS', error);
  }

  logger.info('reportUser success', { data: { username: requestUsername, reportedUsername } });
  return {
    statusCode: 200,
    body: JSON.stringify({ Message: 'Report user success' }),
  };
};

export const handler = getMiddlewareAddedHandler(reportUser, reportUserSchema);
