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
