import { Handler } from 'aws-lambda';
import CognitoIdentity, { SignUpRequest } from 'aws-sdk/clients/cognitoidentityserviceprovider';

import { getMiddlewareAddedHandler } from './common/middleware';
import { SignupEvent } from './common/types';
import { signupSchema } from './common/schema';

const cognitoIdentity = new CognitoIdentity();

const signup: Handler = async (event: SignupEvent) => {
  const {
    body: { email, name, password },
  } = event;
  const signUpRequest: SignUpRequest = {
    Username: name,
    Password: password,
    UserAttributes: [{ Name: 'email', Value: email }],
    ClientId: process.env['COGNITO_CLIENT_ID'] || '',
  };
  try {
    const { CodeDeliveryDetails } = await cognitoIdentity.signUp(signUpRequest).promise();
    return {
      statusCode: 201,
      body: JSON.stringify({ Message: 'Sign up success', ...CodeDeliveryDetails }),
    };
  } catch (error) {
    return {
      statusCode: 400,
      body: JSON.stringify({ Message: error.code }),
    };
  }
};

export const handler = getMiddlewareAddedHandler(signup, signupSchema);
