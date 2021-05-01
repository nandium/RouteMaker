import CognitoIdentityServiceProvider, {
  GetUserRequest,
} from 'aws-sdk/clients/cognitoidentityserviceprovider';
import createError from 'http-errors';

const cognitoIdentity = new CognitoIdentityServiceProvider();

export const getEmailFromCognito = async (accessToken: string): Promise<string> => {
  const getUserRequest: GetUserRequest = {
    AccessToken: accessToken,
  };
  try {
    const { UserAttributes } = await cognitoIdentity.getUser(getUserRequest).promise();
    return UserAttributes.filter((attribute) => attribute.Name === 'email')[0].Value as string;
  } catch (error) {
    throw createError(400, 'Error getting user from Cognito: ' + error.stack);
  }
};
