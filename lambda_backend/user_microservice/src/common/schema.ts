// JSON Validation Schemas
// After modification, change the frontend validation accordingly

const AlphanumericSpace = '^[a-zA-Z0-9 ]+$';
const Email = "^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:.[a-zA-Z0-9-]+)*$";

const email = { type: 'string', pattern: Email };
const name = { type: 'string', pattern: AlphanumericSpace, maxLength: 20 };
const password = { type: 'string' };
const code = { type: 'string', pattern: AlphanumericSpace };
const reason = { type: 'string', pattern: AlphanumericSpace, maxLength: 20 };
const refreshToken = { type: 'string' };

export const signupSchema = {
  type: 'object',
  properties: {
    body: {
      type: 'object',
      properties: {
        email,
        password,
        name,
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
        name,
        code,
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
        name,
        password,
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
        name,
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
        name,
        reason,
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
        name,
        password,
        code,
      },
      required: ['name', 'password', 'code'],
    },
  },
};

export const refreshTokenSchema = {
  type: 'object',
  properties: {
    body: {
      type: 'object',
      properties: {
        refreshToken,
      },
      required: ['refreshToken'],
    },
  },
};
