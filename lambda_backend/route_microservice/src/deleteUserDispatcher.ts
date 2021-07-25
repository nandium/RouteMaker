import { Handler, SNSEvent } from 'aws-lambda';
import DynamoDB, { AttributeValue, DeleteItemInput } from 'aws-sdk/clients/dynamodb';

import { getUserRoutesIndexItems } from './common/db';
import { logger } from './common/logger';

const dynamoDb = new DynamoDB.DocumentClient();

/**
 * Listens to SNS deleteUser events and deletes corresponding routes
 * The S3 image is not deleted, we will let it expire from S3 lifecycle configuration
 */
export const handler: Handler = async (event: SNSEvent) => {
  if (!process.env['ROUTE_TABLE_NAME']) {
    // Not HTTP Error
    throw Error('Table or Bucket names are not set!');
  }
  const { Records } = event;
  const {
    Sns: { Message: username },
  } = Records[0];
  logger.info('deleteUserDispatcher initiated', { data: { username } });

  const userRoutesIndexItems = await getUserRoutesIndexItems(username);

  logger.info('deleteUserDispatcher retrieved userRoutesIndexItems', { data: { username } });
  for (const userRoutesIndexItem of userRoutesIndexItems) {
    await deleteRouteWithRetry(userRoutesIndexItem.username, userRoutesIndexItem.createdAt);
  }
  logger.info('deleteUserDispatcher success', { data: { username } });
  return {
    statusCode: 200,
  };
};

/**
 * Deletes route from the database while retrying a few times if database provision throughput exceeds
 */
const deleteRouteWithRetry = async (
  username: string,
  createdAt: string,
  retryMilliseconds = 1000,
): Promise<void> => {
  if (retryMilliseconds > 4001) {
    logger.error('deleteUserDispatcher retry time is too long', { data: { username } });
    throw Error('Retry time is too long!');
  }
  const deleteItemInput: DeleteItemInput = {
    TableName: process.env['ROUTE_TABLE_NAME'] || '',
    Key: {
      username: username as AttributeValue,
      createdAt: createdAt as AttributeValue,
    },
  };
  try {
    await dynamoDb.delete(deleteItemInput).promise();
  } catch (error) {
    if (error.code === 'ProvisionThroughputExceededException') {
      await new Promise((resolve) => setTimeout(resolve, retryMilliseconds));
      await deleteRouteWithRetry(username, createdAt, retryMilliseconds * 2);
    } else {
      logger.error('deleteUserDispatcher error', { data: { username, error: error.stack } });
    }
  }
};
