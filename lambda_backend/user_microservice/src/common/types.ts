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
