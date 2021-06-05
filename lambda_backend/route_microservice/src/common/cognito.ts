import CognitoIdentityServiceProvider, {
  GetUserRequest,
} from 'aws-sdk/clients/cognitoidentityserviceprovider';
import createError from 'http-errors';

import { CognitoUserDetails } from './types';

const cognitoIdentity = new CognitoIdentityServiceProvider();

export const getCognitoUserDetails = async (AccessToken: string): Promise<CognitoUserDetails> => {
  const getUserParams: GetUserRequest = { AccessToken };
  try {
    const { UserAttributes } = await cognitoIdentity.getUser(getUserParams).promise();
    const userEmail = UserAttributes.filter((attribute) => attribute.Name === 'email')[0]
      .Value as string;
    const fullName = UserAttributes.filter((attribute) => attribute.Name === 'name')[0]
      .Value as string;
    return { fullName, userEmail };
  } catch (error) {
    throw createError(500, 'Error retrieving Cognito user details');
  }
};
