import winston from 'winston';

/**
 * Logs to Cloudwatch console
 * If New Relic monitoring is set up, the logs are ingested to its dashboard via Cloudwatch
 * https://github.com/newrelic/serverless-newrelic-lambda-layers
 */
export const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'route', env: process.env.NODE_ENV || 'dev' },
  transports: [new winston.transports.Console()],
});
