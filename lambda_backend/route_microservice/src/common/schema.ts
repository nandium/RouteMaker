const ISODateStringPattern =
  '^\\d{4}-(0[1-9]|1[012])-(0[1-9]|[12][0-9]|3[01])T\\d{2}:\\d{2}:\\d{2}.\\d{3}Z$';
const Alphanumeric = '^[a-zA-Z0-9]*$';
const NumericDecimalCommaSpace = '^[0-9., ]*$';

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
