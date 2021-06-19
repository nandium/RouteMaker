import { Handler } from 'aws-lambda';
import CognitoIdentity, {
  ForgotPasswordRequest,
} from 'aws-sdk/clients/cognitoidentityserviceprovider';
import { ForgotPasswordEvent, forgotPasswordSchema, getMiddlewareAddedHandler } from './common';

const cognitoIdentity = new CognitoIdentity();

const forgotPassword: Handler = async (event: ForgotPasswordEvent) => {
  const {
    body: { name },
  } = event;
  const forgotPasswordRequest: ForgotPasswordRequest = {
    Username: name,
    ClientId: process.env['COGNITO_CLIENT_ID'] || '',
  };
  try {
    const { CodeDeliveryDetails } = await cognitoIdentity
      .forgotPassword(forgotPasswordRequest)
      .promise();
    return {
      statusCode: 200,
      body: JSON.stringify({ Message: 'Request password reset success', ...CodeDeliveryDetails }),
    };
  } catch (error) {
    return {
      statusCode: 400,
      body: JSON.stringify({ Message: error.code }),
    };
  }
};

export const handler = getMiddlewareAddedHandler(forgotPassword, forgotPasswordSchema);
