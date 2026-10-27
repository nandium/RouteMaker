import { beforeEach, expect, test } from 'vitest';

import type { Gym, Report } from '../../../client-contract.js';
import { ApiError } from '../../../http.js';
import {
  account,
  gym,
  resetHost,
  route,
  sessionStore,
  startApp,
  submitCredentials,
  tapLabel,
  tapText,
} from './helpers.js';

beforeEach(() => resetHost({ initialPage: { name: 'admin' } }));

const admin = { ...account, role: 'admin' as const };
const report: Report = {
  id: 'report',
  target_type: 'route',
  target_id: route.id,
  target_label: route.name,
  route_id: route.id,
  reason: 'inaccurate',
  details: 'Wrong gym',
};
const noteReport: Report = {
  id: 'note-report',
  target_type: 'ascent',
  target_id: 'note',
  target_label: 'Rude words',
  route_id: route.id,
  reason: 'offensive',
  details: null,
};
const userReport: Report = {
  id: 'user-report',
  target_type: 'user',
  target_id: 'leon',
  target_label: 'leon',
  route_id: null,
  reason: 'spam',
  details: null,
};
const other = { ...account, id: 'leon', username: 'leon', display_name: 'Leon' };
const pending: Gym = { ...gym, status: 'pending' };
const asAdmin = { me: () => admin };

test('lists the open reports with their reason and what the reporter said', async () => {
  sessionStore('admin-token');
  const { queries } = startApp({ ...asAdmin, adminReports: () => [report] });

  expect(await queries.findByText('Moderation', { selector: '.hero-title' })).toBeInTheDocument();
  expect(await queries.findByText('Blue Moon')).toBeInTheDocument();
  expect(queries.getByText('Inaccurate')).toBeInTheDocument();
  expect(queries.getByText('Wrong gym')).toBeInTheDocument();
  expect(queries.getByText('Route')).toBeInTheDocument();
});

test('shows how much waits in each queue on the tabs', async () => {
  sessionStore('admin-token');
  const { queries } = startApp({
    ...asAdmin,
    adminReports: () => [report, noteReport],
    adminGyms: () => [pending],
    adminUsers: () => [admin, other],
  });

  expect(await queries.findByLabelText('Reports 2')).toHaveAttribute('aria-pressed', 'true');
  expect(queries.getByLabelText('Gyms 1')).toBeInTheDocument();
  expect(queries.getByLabelText('Accounts 1')).toBeInTheDocument();
});

test('lists the pending gyms and the accounts, without the administrator themselves', async () => {
  sessionStore('admin-token');
  const { queries } = startApp({
    ...asAdmin,
    adminGyms: () => [pending],
    adminUsers: () => [admin, other],
  });
  await tapLabel(queries, 'Gyms 1');
  expect(await queries.findByText('1 Test Street')).toBeInTheDocument();

  await tapLabel(queries, 'Accounts 1');

  expect(await queries.findByText('Leon')).toBeInTheDocument();
  expect(queries.getByText('@leon')).toBeInTheDocument();
  expect(queries.getByText('Active')).toBeInTheDocument();
  expect(queries.queryByText('@maya')).not.toBeInTheDocument();
});

test('shows all three queues side by side on a wide screen', async () => {
  resetHost({ initialPage: { name: 'admin' }, wideLayout: true });
  sessionStore('admin-token');
  const { queries } = startApp({
    ...asAdmin,
    adminReports: () => [report],
    adminGyms: () => [pending],
    adminUsers: () => [admin, other],
  });

  expect(await queries.findByText('Blue Moon')).toBeInTheDocument();
  expect(queries.getByText('1 Test Street')).toBeInTheDocument();
  expect(queries.getByText('Leon')).toBeInTheDocument();
  expect(queries.getByText('Reports')).toBeInTheDocument();
  expect(queries.getByText('Gym requests')).toBeInTheDocument();
  expect(queries.getByText('Accounts')).toBeInTheDocument();
  expect(queries.getByText('gyms waiting')).toBeInTheDocument();
  expect(queries.queryByLabelText('Reports 1')).not.toBeInTheDocument();
});

test('shows empty queues as such', async () => {
  sessionStore('admin-token');
  const { queries } = startApp(asAdmin);

  expect(await queries.findByText('No open reports')).toBeInTheDocument();
  await tapLabel(queries, 'Gyms 0');
  expect(await queries.findByText('No gyms awaiting approval')).toBeInTheDocument();
  await tapLabel(queries, 'Accounts 0');
  expect(await queries.findByText('No other accounts')).toBeInTheDocument();
});

test('dismisses a report at once', async () => {
  sessionStore('admin-token');
  const { api, queries } = startApp({ ...asAdmin, adminReports: () => [report] });

  await tapText(queries, 'Dismiss');

  expect(await queries.findByText('No open reports')).toBeInTheDocument();
  expect(api.to('moderateReport')[0]).toMatchObject({
    param: 'report',
    body: { decision: 'dismiss' },
    token: 'admin-token',
  });
});

test.each([
  ['route', report, 'Remove', 'Remove route', /deletes its photo for good/],
  ['note', noteReport, 'Hide', 'Hide note', /The send and grade stay/],
  ['user', userReport, 'Disable', 'Disable account', /hides all its routes/],
])(
  'asks again, saying what will happen, before deciding on a %s report',
  async (_kind, queued, button, confirm, consequence) => {
    sessionStore('admin-token');
    const { api, queries } = startApp({ ...asAdmin, adminReports: () => [queued] });

    await tapText(queries, button);
    expect(await queries.findByText(consequence)).toBeInTheDocument();
    expect(api.to('moderateReport')).toHaveLength(0);

    await tapText(queries, confirm);

    expect(await queries.findByText('No open reports')).toBeInTheDocument();
    expect(api.to('moderateReport')[0]).toMatchObject({
      param: queued.id,
      body: { decision: 'hide' },
      token: 'admin-token',
    });
  }
);

test('leaves a report open when the confirmation is cancelled', async () => {
  sessionStore('admin-token');
  const { api, queries } = startApp({ ...asAdmin, adminReports: () => [report] });
  await tapText(queries, 'Remove');
  await queries.findByText(/deletes its photo for good/);

  await tapText(queries, 'Cancel');

  expect(queries.queryByText(/deletes its photo for good/)).not.toBeInTheDocument();
  expect(queries.getByText('Dismiss')).toBeInTheDocument();
  expect(api.to('moderateReport')).toHaveLength(0);
});

test('opens a reported route from its report', async () => {
  sessionStore('admin-token');
  const { api, queries } = startApp({ ...asAdmin, adminReports: () => [report] });

  await tapText(queries, 'Inspect');

  expect(await queries.findByText('Friendly finish')).toBeInTheDocument();
  expect(api.to('route')[0].token).toBe('admin-token');
});

test('approves or rejects a gym', async () => {
  sessionStore('admin-token');
  const { api, queries } = startApp({
    ...asAdmin,
    adminGyms: () => [pending, { ...pending, id: 'second', name: 'Second Wall' }],
  });
  await tapLabel(queries, 'Gyms 2');

  await tapText(queries, 'Approve');
  expect(await queries.findByText('Second Wall')).toBeInTheDocument();
  expect(api.to('moderateGym')[0]).toMatchObject({
    param: 'central',
    body: { decision: 'approve' },
  });

  await tapText(queries, 'Reject');
  expect(await queries.findByText('No gyms awaiting approval')).toBeInTheDocument();
  expect(api.to('moderateGym')[1]).toMatchObject({ param: 'second', body: { decision: 'reject' } });
});

test('disables an account after confirming, and enables it again at once', async () => {
  sessionStore('admin-token');
  const { api, queries } = startApp({ ...asAdmin, adminUsers: () => [admin, other] });
  await tapLabel(queries, 'Accounts 1');

  await tapText(queries, 'Disable');
  expect(
    await queries.findByText(/Enabling it again does not bring the routes back/)
  ).toBeInTheDocument();
  expect(api.to('setUserDisabled')).toHaveLength(0);
  await tapText(queries, 'Disable account');

  expect(await queries.findByText('Disabled')).toBeInTheDocument();
  expect(api.to('setUserDisabled')[0].body).toEqual({ disabled: true });

  await tapText(queries, 'Enable');
  expect(await queries.findByText('Active')).toBeInTheDocument();
  expect(api.to('setUserDisabled')[1].body).toEqual({ disabled: false });
});

test('a rejected moderator session returns to sign-in instead of an empty page', async () => {
  sessionStore('admin-token');
  const { queries } = startApp({
    ...asAdmin,
    adminReports: () => [report],
    moderateReport: () => {
      throw new ApiError('Session is invalid', 401);
    },
  });

  await tapText(queries, 'Dismiss');

  expect(
    await queries.findByText('Your saved session expired. Sign in again to continue.')
  ).toBeInTheDocument();
  expect(await queries.findByText('Forgot password?')).toBeInTheDocument();
});

test('tells a signed-in climber who is not an administrator that the page is not for them', async () => {
  sessionStore('saved-token');
  const { queries } = startApp();

  expect(await queries.findByText('Admins only')).toBeInTheDocument();
  expect(queries.getByText('Administrator access is required.')).toBeInTheDocument();
  expect(queries.queryByLabelText('Admin')).not.toBeInTheDocument();

  await tapText(queries, 'Go to account');
  expect(await queries.findByText('Delete account')).toBeInTheDocument();
});

test('offers moderation in the navigation to administrators only', async () => {
  sessionStore('admin-token');
  const { queries } = startApp({ ...asAdmin, adminReports: () => [report] });

  expect(await queries.findByLabelText('Admin')).toHaveAttribute('aria-current', 'page');
});

test('signing in as an administrator from the admin link opens moderation', async () => {
  const { queries } = startApp({
    login: () => ({ token: 'admin-token', user: admin }),
    adminReports: () => [report],
  });
  await queries.findByText('Forgot password?');

  await submitCredentials(queries);

  expect(await queries.findByText('Moderation', { selector: '.hero-title' })).toBeInTheDocument();
});
