export interface SignupEvent {
  body: {
    email: string;
    password: string;
    name: string;
  };
}

export interface ConfirmSignupEvent {
  body: {
    name: string;
    code: string;
  };
}

interface UserIdentifer {
  body: {
    name: string;
  };
}

export type ResendCodeEvent = UserIdentifer;

export type ForgotPasswordEvent = UserIdentifer;

export interface ConfirmForgotPasswordEvent {
  body: {
    name: string;
    code: string;
    password: string;
  };
}

export interface LoginEvent {
  body: {
    name: string;
    password: string;
  };
}

export interface RefreshTokenEvent {
  body: {
    refreshToken: string;
  };
}

interface AuthHeader {
  headers: {
    Authorization: string;
  };
}

export type LogoutEvent = AuthHeader;

export type DeleteEvent = AuthHeader;

export interface DisableUserEvent extends AuthHeader, UserIdentifer {}

export interface ReportUserEvent extends AuthHeader {
  body: {
    name: string;
    reason: string;
  };
}

export interface JwtPayload {
  sub: string;
  event_id: string;
  token_use: string;
  scope: 'aws.cognito.signin.user.admin';
  auth_time: number;
  iss: string;
  exp: number;
  iat: number;
  jti: string;
  client_id: string;
  username: string;
}

/**
 * Refer to AWS Cognito User Pool Attributes
 */
export interface CognitoUserDetails {
  userEmail: string;
  userRole: UserRole;
}

/**
 * Refer to lambda_backend/user/signup.ts and lambda_backend/user/enableAdmin.ts
 */
export type UserRole = 'admin' | 'user';
