import { Handler } from 'aws-lambda';
import DynamoDB, {
  AttributeValue,
  ScanInput,
  QueryInput,
  ItemList,
} from 'aws-sdk/clients/dynamodb';
import { getMiddlewareAddedHandler, GetAllGymsEvent } from './common';
import createError from 'http-errors';

const dynamoDb = new DynamoDB.DocumentClient();

const getAllGyms: Handler = async (event: GetAllGymsEvent) => {
  if (!process.env['GYM_TABLE_NAME']) {
    throw createError(400, 'Gym table name is not set');
  }
  const {
    queryStringParameters: { country },
  } = event;
  // QueryString of country exists, query by country. If not, return all gyms.
  if (country) {
    const queryInput: QueryInput = {
      TableName: process.env['GYM_TABLE_NAME'],
      ConsistentRead: false,
      KeyConditionExpression: 'country = :country',
      ExpressionAttributeValues: {
        ':country': country as AttributeValue,
      },
    };
    try {
      const { Items } = await dynamoDb.query(queryInput).promise();
      return {
        statusCode: 200,
        body: JSON.stringify({ Message: 'Query all gyms success', Items }),
      };
    } catch (error) {
      throw createError(400, 'Error querying table :' + error.stack);
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
      throw createError(400, 'Error scanning table :' + error.stack);
    }
  }
};

export const handler = getMiddlewareAddedHandler(getAllGyms);
