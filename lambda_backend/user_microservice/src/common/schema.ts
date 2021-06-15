const AlphanumericSpace = '^[a-zA-Z0-9 ]*$';
const Email = "^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:.[a-zA-Z0-9-]+)*$";

export const signupSchema = {
  type: 'object',
  properties: {
    body: {
      type: 'object',
      properties: {
        email: { type: 'string', pattern: Email },
        password: { type: 'string' },
        name: { type: 'string', pattern: AlphanumericSpace },
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
        email: { type: 'string', pattern: Email },
        code: { type: 'string', pattern: AlphanumericSpace },
      },
      required: ['email', 'code'],
    },
  },
};

export const loginSchema = {
  type: 'object',
  properties: {
    body: {
      type: 'object',
      properties: {
        email: { type: 'string', pattern: Email },
        password: { type: 'string' },
      },
      required: ['email', 'password'],
    },
  },
};

const emailIdentiferSchema = {
  type: 'object',
  properties: {
    body: {
      type: 'object',
      properties: {
        email: { type: 'string', pattern: Email },
      },
      required: ['email'],
    },
  },
};

export const resendCodeSchema = emailIdentiferSchema;

export const forgotPasswordSchema = emailIdentiferSchema;

export const confirmForgotPasswordSchema = {
  type: 'object',
  properties: {
    body: {
      type: 'object',
      properties: {
        ...loginSchema.properties.body.properties,
        code: { type: 'string', pattern: AlphanumericSpace },
      },
      required: [...loginSchema.properties.body.required, 'code'],
    },
  },
};

export const refreshTokenSchema = {
  type: 'object',
  properties: {
    body: {
      type: 'object',
      properties: {
        refreshToken: { type: 'string' },
      },
      required: ['refreshToken'],
    },
  },
};
