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
        name: { type: 'string', pattern: AlphanumericSpace, maxLength: 20 },
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
        name: { type: 'string', pattern: AlphanumericSpace, maxLength: 20 },
        code: { type: 'string', pattern: AlphanumericSpace },
      },
      required: ['name', 'code'],
    },
  },
};

export const loginSchema = {
  type: 'object',
  properties: {
    body: {
      type: 'object',
      properties: {
        name: { type: 'string', pattern: AlphanumericSpace, maxLength: 20 },
        password: { type: 'string' },
      },
      required: ['name', 'password'],
    },
  },
};

const identiferSchema = {
  type: 'object',
  properties: {
    body: {
      type: 'object',
      properties: {
        name: { type: 'string', pattern: AlphanumericSpace, maxLength: 20 },
      },
      required: ['name'],
    },
  },
};

export const resendCodeSchema = identiferSchema;

export const forgotPasswordSchema = identiferSchema;

export const disableUserSchema = identiferSchema;

export const reportUserSchema = {
  type: 'object',
  properties: {
    body: {
      type: 'object',
      properties: {
        name: { type: 'string', pattern: AlphanumericSpace, maxLength: 20 },
        reason: { type: 'string', pattern: AlphanumericSpace, maxLength: 20 },
      },
      required: ['name', 'reason'],
    },
  },
};

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
