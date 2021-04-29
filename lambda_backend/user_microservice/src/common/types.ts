export interface SignUpEvent {
  body: {
    email: string;
    password: string;
    name: string;
  };
}
