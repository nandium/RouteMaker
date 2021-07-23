import { Handler } from 'aws-lambda';

import { enableAdminPermission } from './common/identityProvider';

/**
 * Change the role of a user to admin
 *
 * sls invoke --function enableAdmin --stage {stage} --region ap-southeast-1 --data {username}
 */

const enableAdmin: Handler = async (username: string) => {
  await enableAdminPermission(username);
  return 'Enable admin success';
};

export const handler = enableAdmin;
