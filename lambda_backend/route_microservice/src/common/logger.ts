import winston from 'winston';

/**
 * Logs to Cloudwatch console as usual
 * If New Relic monitoring is set up, the CloudWatch logs are ingested to New Relic dashboard
 * https://github.com/newrelic/serverless-newrelic-lambda-layers
 */
export const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'route', env: process.env.NODE_ENV || 'dev' },
  transports: [new winston.transports.Console()],
});
