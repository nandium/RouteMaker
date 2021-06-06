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

export interface LoginEvent {
  body: {
    email: string;
    password: string;
  };
}

interface AuthHeader {
  headers: {
    Authorization: string;
  };
}

export type LogoutEvent = AuthHeader;

export type DeleteEvent = AuthHeader;
