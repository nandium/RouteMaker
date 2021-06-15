import { Handler } from 'aws-lambda';
import CognitoIdentity, {
  ResendConfirmationCodeRequest,
} from 'aws-sdk/clients/cognitoidentityserviceprovider';
import { ResendCodeEvent, resendCodeSchema, getMiddlewareAddedHandler } from './common';

const cognitoIdentity = new CognitoIdentity();

const resendCode: Handler = async (event: ResendCodeEvent) => {
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
