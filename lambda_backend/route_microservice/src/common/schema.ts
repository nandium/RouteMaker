const ISODateStringPattern =
  '^\\d{4}-(0[1-9]|1[012])-(0[1-9]|[12][0-9]|3[01])T\\d{2}:\\d{2}:\\d{2}.\\d{3}Z$';
const AlphanumericSpace = '^[a-zA-Z0-9 ]*$';
const CapitalizedAlphabets = '^[A-Z]*$';
const NumericDecimalCommaSpace = '^[0-9., ]*$';
const AsciiCharacters = '^[ -~]+$';

const countryCode = { type: 'string', maxLength: 3, pattern: CapitalizedAlphabets };
const routeName = { type: 'string', maxLength: 30, pattern: AsciiCharacters };
const expiredTime = { type: 'string', pattern: ISODateStringPattern };
const gymLocation = { type: 'string', maxLength: 40, pattern: NumericDecimalCommaSpace };
const ownerGrade = { type: 'number', minimum: 0, maximum: 14 };
const username = { type: 'string', pattern: AlphanumericSpace };
const commentUsername = username;
const createdAt = { type: 'string', pattern: ISODateStringPattern };
const grade = ownerGrade;
const comment = { type: 'string', maxLength: 150, pattern: AsciiCharacters };
const timestamp = { type: 'number' };
const postal = { type: 'string', maxLength: 12, pattern: AsciiCharacters };
const gymName = { type: 'string', maxLength: 30, pattern: AsciiCharacters };
const routePhoto = {
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
};

export const createRouteSchema = {
  type: 'object',
  properties: {
    body: {
      type: 'object',
      properties: {
        countryCode,
        routeName,
        expiredTime,
        gymLocation,
        ownerGrade,
        routePhoto,
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
        username,
        createdAt,
      },
      required: ['username', 'createdAt'],
    },
  },
};

export const getRouteDetailsSchema = {
  type: 'object',
  properties: {
    body: {
      type: 'object',
      properties: {
        username,
        createdAt,
      },
      required: ['username', 'createdAt'],
    },
  },
};

export const upvoteRouteSchema = getRouteDetailsSchema;

export const reportRouteSchema = getRouteDetailsSchema;

export const gradeRouteSchema = {
  type: 'object',
  properties: {
    body: {
      type: 'object',
      properties: {
        username,
        createdAt,
        grade,
      },
      required: ['username', 'createdAt', 'grade'],
    },
  },
};

export const addCommentSchema = {
  type: 'object',
  properties: {
    body: {
      type: 'object',
      properties: {
        username,
        createdAt,
        comment,
      },
      required: ['username', 'createdAt', 'comment'],
    },
  },
};

export const deleteCommentSchema = {
  type: 'object',
  properties: {
    queryStringParameters: {
      type: 'object',
      properties: {
        username,
        createdAt,
        commentUsername,
        timestamp,
      },
      required: ['username', 'createdAt', 'timestamp', 'commentUsername'],
    },
  },
};

export const requestGymSchema = {
  type: 'object',
  properties: {
    body: {
      type: 'object',
      properties: {
        countryCode,
        postal,
        gymName,
      },
      required: ['countryCode', 'postal', 'gymName'],
    },
  },
};

export const getRoutesByGymSchema = {
  type: 'object',
  properties: {
    queryStringParameters: {
      type: 'object',
      properties: {
        gymLocation,
      },
      required: ['gymLocation'],
    },
  },
};

export const getRoutesByUserSchema = {
  type: 'object',
  properties: {
    queryStringParameters: {
      type: 'object',
      properties: {
        username,
      },
      required: ['username'],
    },
  },
};
