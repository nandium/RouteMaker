export interface SignupEvent {
  body: {
    email: string;
    password: string;
    name: string;
  };
}

export interface ConfirmSignupEvent {
  body: {
    email: string;
    code: string;
  };
}

interface EmailIdentifer {
  body: {
    email: string;
  };
}

export type ResendCodeEvent = EmailIdentifer;

export type ForgotPasswordEvent = EmailIdentifer;

export interface ConfirmForgotPasswordEvent {
  body: {
    email: string;
    code: string;
    password: string;
  };
}

export interface LoginEvent {
  body: {
    email: string;
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
