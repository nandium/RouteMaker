import { Handler } from 'aws-lambda';
import CognitoIdentity, {
  ResendConfirmationCodeRequest,
} from 'aws-sdk/clients/cognitoidentityserviceprovider';
import { ResendCodeEvent, resendCodeSchema, getMiddlewareAddedHandler } from './common';
import createError from 'http-errors';

const cognitoIdentity = new CognitoIdentity();

const resendCode: Handler = async (event: ResendCodeEvent) => {
  if (!process.env['COGNITO_CLIENT_ID']) {
    throw createError(400, 'Cognito Client ID is not set');
  }
  const {
    body: { email },
  } = event;
  const resendConfirmationCodeRequest: ResendConfirmationCodeRequest = {
    Username: email,
    ClientId: process.env['COGNITO_CLIENT_ID'] || '',
  };
  try {
    await cognitoIdentity.resendConfirmationCode(resendConfirmationCodeRequest).promise();
  } catch (error) {
    return {
      statusCode: 400,
      body: JSON.stringify({ Message: error.code }),
    };
  }
  return {
    statusCode: 200,
    body: JSON.stringify({ Message: 'Resend code success' }),
  };
};

export const handler = getMiddlewareAddedHandler(resendCode, resendCodeSchema);
