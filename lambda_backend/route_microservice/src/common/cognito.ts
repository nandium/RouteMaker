import CognitoIdentityServiceProvider, {
  AdminGetUserRequest,
  AttributeType,
  GetUserRequest,
} from 'aws-sdk/clients/cognitoidentityserviceprovider';
import createError from 'http-errors';

import { CognitoUserDetails } from './types';

const cognitoIdentity = new CognitoIdentityServiceProvider();

export const getCognitoUserDetails = async (AccessToken: string): Promise<CognitoUserDetails> => {
  const getUserParams: GetUserRequest = { AccessToken };
  try {
    const { UserAttributes } = await cognitoIdentity.getUser(getUserParams).promise();
    return parseUserAttributes(UserAttributes);
  } catch (error) {
    throw createError(500, 'Error retrieving Cognito user details');
  }
};

export const adminGetCognitoUserDetails = async (Username: string): Promise<CognitoUserDetails> => {
  const adminGetUserParams: AdminGetUserRequest = {
    Username,
    UserPoolId: process.env['COGNITO_USERPOOL_ID'] as string,
  };
  try {
    const adminGetUserResponse = await cognitoIdentity.adminGetUser(adminGetUserParams).promise();
    const UserAttributes = adminGetUserResponse.UserAttributes as AttributeType[];
    return parseUserAttributes(UserAttributes);
  } catch (error) {
    throw createError(500, 'Error retrieving Cognito user details');
  }
};

const parseUserAttributes = (UserAttributes: AttributeType[]): CognitoUserDetails => {
  const userEmail = UserAttributes.filter((attribute) => attribute.Name === 'email')[0]
    .Value as string;
  const fullName = UserAttributes.filter((attribute) => attribute.Name === 'name')[0]
    .Value as string;
  return { fullName, userEmail };
};
