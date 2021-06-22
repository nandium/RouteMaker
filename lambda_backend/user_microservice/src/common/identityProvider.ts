import CognitoIdentityServiceProvider, {
  AdminGetUserRequest,
  AdminUpdateUserAttributesRequest,
  AdminDisableUserRequest,
  AttributeType,
  GetUserRequest,
} from 'aws-sdk/clients/cognitoidentityserviceprovider';
import createError from 'http-errors';

const cognitoIdentity = new CognitoIdentityServiceProvider();

export const enableAdminPermission = async (Username: string): Promise<void> => {
  const adminUpdateUserAttributesParams: AdminUpdateUserAttributesRequest = {
    Username,
    UserPoolId: process.env['COGNITO_USERPOOL_ID'] as string,
    UserAttributes: [{ Name: 'custom:role', Value: 'admin' }],
  };
  try {
    await cognitoIdentity.adminUpdateUserAttributes(adminUpdateUserAttributesParams).promise();
  } catch (error) {
    throw createError(400, 'Error updating Cognito user details', error);
  }
};

export const adminDisableUser = async (Username: string): Promise<void> => {
  const adminDisableUserParams: AdminDisableUserRequest = {
    Username,
    UserPoolId: process.env['COGNITO_USERPOOL_ID'] as string,
  };
  try {
    await cognitoIdentity.adminDisableUser(adminDisableUserParams).promise();
  } catch (error) {
    throw createError(400, 'Error disabling user', error);
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
    throw createError(500, 'Error retrieving Cognito user details', error);
  }
};

export const getCognitoUserDetails = async (AccessToken: string): Promise<CognitoUserDetails> => {
  const getUserParams: GetUserRequest = { AccessToken };
  try {
    const { UserAttributes } = await cognitoIdentity.getUser(getUserParams).promise();
    return parseUserAttributes(UserAttributes);
  } catch (error) {
    throw createError(500, 'Error retrieving Cognito user details', error);
  }
};

const parseUserAttributes = (UserAttributes: AttributeType[]): CognitoUserDetails => {
  const userEmail = UserAttributes.filter((attribute) => attribute.Name === 'email')[0]
    .Value as string;
  const userRole = UserAttributes.filter((attribute) => attribute.Name === 'custom:role')[0]
    .Value as UserRole;
  return { userEmail, userRole };
};

interface CognitoUserDetails {
  userEmail: string;
  userRole: UserRole;
}

type UserRole = 'admin' | 'user';
