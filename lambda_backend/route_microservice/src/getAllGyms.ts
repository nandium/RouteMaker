import { Handler } from 'aws-lambda';
import DynamoDB, {
  AttributeValue,
  ScanInput,
  QueryInput,
  ItemList,
} from 'aws-sdk/clients/dynamodb';
import createError from 'http-errors';

import { getMiddlewareAddedHandler } from './common/middleware';
import { GetAllGymsEvent } from './common/types';

const dynamoDb = new DynamoDB.DocumentClient();

const getAllGyms: Handler = async (event: GetAllGymsEvent) => {
  if (!process.env['GYM_TABLE_NAME']) {
    throw createError(500, 'Gym table name is not set');
  }
  const {
    queryStringParameters: { countryCode },
  } = event;
  // QueryString of countryCode exists, query by countryCode. If not, return all gyms.
  if (countryCode) {
    const queryInput: QueryInput = {
      TableName: process.env['GYM_TABLE_NAME'],
      ConsistentRead: false,
      KeyConditionExpression: 'countryCode = :countryCode',
      ExpressionAttributeValues: {
        ':countryCode': countryCode as AttributeValue,
      },
    };
    try {
      const { Items } = await dynamoDb.query(queryInput).promise();
      return {
        statusCode: 200,
        body: JSON.stringify({ Message: 'Query all gyms success', Items }),
      };
    } catch (error) {
      throw createError(500, 'Error querying table', error);
    }
  } else {
    const scanInput: ScanInput = {
      TableName: process.env['GYM_TABLE_NAME'],
      ConsistentRead: false,
    };
    try {
      let response = await dynamoDb.scan(scanInput).promise();
      let LastEvaluatedKey = response.LastEvaluatedKey;
      let responseItems = response.Items as ItemList;
      let Items = [...responseItems];
      while (LastEvaluatedKey) {
        response = await dynamoDb
          .scan({
            ...scanInput,
            ExclusiveStartKey: LastEvaluatedKey,
          })
          .promise();
        responseItems = response.Items as ItemList;
        Items = [...Items, ...responseItems];
        LastEvaluatedKey = response.LastEvaluatedKey;
      }
      return {
        statusCode: 200,
        body: JSON.stringify({ Message: 'Scan all gyms success', Items }),
      };
    } catch (error) {
      throw createError(500, 'Error scanning table', error);
    }
  }
};

export const handler = getMiddlewareAddedHandler(getAllGyms);
