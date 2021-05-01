const ISODateStringPattern =
  '^\\d{4}-(0[1-9]|1[012])-(0[1-9]|[12][0-9]|3[01])T\\d{2}:\\d{2}:\\d{2}.\\d{3}Z$';
const Alphanumeric = '^[a-zA-Z0-9]*$';
const NumericDecimalCommaSpace = '^[0-9., ]*$';
const Email = "^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:.[a-zA-Z0-9-]+)*$";

export const createRouteSchema = {
  type: 'object',
  properties: {
    body: {
      type: 'object',
      properties: {
        country: {
          type: 'string',
          maxLength: 50,
          pattern: Alphanumeric,
        },
        expiredTime: {
          type: 'string',
          pattern: ISODateStringPattern,
        },
        gymLocation: {
          type: 'string',
          maxLength: 40,
          pattern: NumericDecimalCommaSpace,
        },
        ownerGrade: {
          type: 'number',
        },
        routePhoto: {
          type: 'object',
          properties: {
            filename: {
              type: 'string',
            },
            mimetype: {
              type: 'string',
            },
            content: {
              type: 'object',
            },
          },
        },
      },
      required: ['country', 'expiredTime', 'gymLocation', 'ownerGrade', 'routePhoto'],
    },
  },
};

export const deleteRouteSchema = {
  type: 'object',
  properties: {
    body: {
      type: 'object',
      properties: {
        createdAt: {
          type: 'string',
          pattern: ISODateStringPattern,
        },
      },
      required: ['createdAt'],
    },
  },
};

export const getRouteDetailsSchema = {
  type: 'object',
  properties: {
    body: {
      type: 'object',
      properties: {
        userEmail: {
          type: 'string',
          pattern: Email,
        },
        createdAt: {
          type: 'string',
          pattern: ISODateStringPattern,
        },
      },
      required: ['userEmail', 'createdAt'],
    },
  },
};

export const upVoteRouteSchema = getRouteDetailsSchema;
