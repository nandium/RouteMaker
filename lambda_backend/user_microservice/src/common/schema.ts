export const signupSchema = {
  type: 'object',
  properties: {
    body: {
      type: 'object',
      properties: {
        email: { type: 'string' },
        password: { type: 'string' },
        name: { type: 'string' },
      },
      required: ['email', 'password', 'name'],
    },
  },
};

export const confirmSignupSchema = {
  type: 'object',
  properties: {
    body: {
      type: 'object',
      properties: {
        email: { type: 'string' },
        code: { type: 'string' },
      },
      required: ['email', 'code'],
    },
  },
};
