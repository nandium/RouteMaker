const ISODateStringPattern =
  '^\\d{4}-(0[1-9]|1[012])-(0[1-9]|[12][0-9]|3[01])T\\d{2}:\\d{2}:\\d{2}.\\d{3}Z$';
const AlphanumericSpaceHyphen = '^[a-zA-Z0-9 \\-]*$';
const NumericDecimalCommaSpace = '^[0-9., ]*$';
const AsciiCharacters = '^[ -~]+$';

export const createRouteSchema = {
  type: 'object',
  properties: {
    body: {
      type: 'object',
      properties: {
        countryCode: {
          type: 'string',
          maxLength: 3,
          pattern: AlphanumericSpaceHyphen,
        },
        routeName: {
          type: 'string',
          maxLength: 50,
          pattern: AlphanumericSpaceHyphen,
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
      required: [
        'countryCode',
        'routeName',
        'expiredTime',
        'gymLocation',
        'ownerGrade',
        'routePhoto',
      ],
    },
  },
};

export const deleteRouteSchema = {
  type: 'object',
  properties: {
    queryStringParameters: {
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
        username: {
          type: 'string',
          pattern: AlphanumericSpaceHyphen,
        },
        createdAt: {
          type: 'string',
          pattern: ISODateStringPattern,
        },
      },
      required: ['username', 'createdAt'],
    },
  },
};

export const upVoteRouteSchema = getRouteDetailsSchema;

export const reportRouteSchema = getRouteDetailsSchema;

export const gradeRouteSchema = {
  type: 'object',
  properties: {
    body: {
      type: 'object',
      properties: {
        ...getRouteDetailsSchema.properties.body.properties,
        grade: { type: 'number' },
      },
      required: [...getRouteDetailsSchema.properties.body.required, 'grade'],
    },
  },
};

export const addCommentSchema = {
  type: 'object',
  properties: {
    body: {
      type: 'object',
      properties: {
        ...getRouteDetailsSchema.properties.body.properties,
        comment: {
          type: 'string',
          maxLength: 150,
          pattern: AsciiCharacters,
        },
      },
      required: [...getRouteDetailsSchema.properties.body.required, 'comment'],
    },
  },
};

export const deleteCommentSchema = {
  type: 'object',
  properties: {
    queryStringParameters: {
      type: 'object',
      properties: {
        ...getRouteDetailsSchema.properties.body.properties,
        commenterName: {
          type: 'string',
          pattern: AlphanumericSpaceHyphen,
        },
        timestamp: { type: 'number' },
      },
      required: [...getRouteDetailsSchema.properties.body.required, 'timestamp'],
    },
  },
};

export const requestGymSchema = {
  type: 'object',
  properties: {
    body: {
      type: 'object',
      properties: {
        countryCode: {
          type: 'string',
          maxLength: 3,
          pattern: AlphanumericSpaceHyphen,
        },
        postal: {
          type: 'string',
          maxLength: 12,
          pattern: AsciiCharacters,
        },
        gymName: {
          type: 'string',
          maxLength: 30,
          pattern: AsciiCharacters,
        },
      },
      required: ['countryCode', 'postal', 'gymName'],
    },
  },
};
