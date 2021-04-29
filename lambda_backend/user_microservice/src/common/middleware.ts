import { Handler } from 'aws-lambda';

import httpSecurityHeaders from '@middy/http-security-headers';
import jsonBodyParser from '@middy/http-json-body-parser';
import httpErrorHandler from '@middy/http-error-handler';
import validator from '@middy/validator';
import cors from '@middy/http-cors';
import middy from '@middy/core';

export const getMiddlewareAddedHandler = (
  handler: Handler,
  schema: Record<string, unknown> = {},
) => {
  if (schema) {
    return middy(handler)
      .use(jsonBodyParser())
      .use(validator({ inputSchema: schema }))
      .use(httpErrorHandler())
      .use(httpSecurityHeaders())
      .use(cors({ origin: getAllowedOrigin() }));
  } else {
    return middy(handler)
      .use(httpErrorHandler())
      .use(httpSecurityHeaders())
      .use(cors({ origin: getAllowedOrigin() }));
  }
};

const getAllowedOrigin = (): string => {
  switch (process.env['NODE_ENV']) {
    case 'prod':
      return process.env['ALLOWED_ORIGIN'] || '*';
    default:
      return '*';
  }
};
