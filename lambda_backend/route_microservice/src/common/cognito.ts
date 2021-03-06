import CognitoIdentityServiceProvider, {
  AdminGetUserRequest,
  AttributeType,
  GetUserRequest,
} from 'aws-sdk/clients/cognitoidentityserviceprovider';
import { CognitoUserDetails, UserRole } from './types';
import createError from 'http-errors';

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
  const userRole = UserAttributes.filter((attribute) => attribute.Name === 'custom:role')[0]
    .Value as UserRole;
  return { userEmail, userRole };
};
