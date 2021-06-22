import { Handler } from 'aws-lambda';
import CognitoIdentity, {
  ConfirmForgotPasswordRequest,
} from 'aws-sdk/clients/cognitoidentityserviceprovider';

import { getMiddlewareAddedHandler } from './common/middleware';
import { ConfirmForgotPasswordEvent } from './common/types';
import { confirmForgotPasswordSchema } from './common/schema';

const cognitoIdentity = new CognitoIdentity();

const confirmForgotPassword: Handler = async (event: ConfirmForgotPasswordEvent) => {
  const {
    body: { code, name, password },
  } = event;
  const confirmForgotPasswordRequest: ConfirmForgotPasswordRequest = {
    Username: name,
    ConfirmationCode: code,
    Password: password,
    ClientId: process.env['COGNITO_CLIENT_ID'] || '',
  };
  try {
    await cognitoIdentity.confirmForgotPassword(confirmForgotPasswordRequest).promise();
  } catch (error) {
    return {
      statusCode: 400,
      body: JSON.stringify({ Message: error.code }),
    };
  }
  return {
    statusCode: 200,
    body: JSON.stringify({ Message: 'Password reset success' }),
  };
};

export const handler = getMiddlewareAddedHandler(
  confirmForgotPassword,
  confirmForgotPasswordSchema,
);
