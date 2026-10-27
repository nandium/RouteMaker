import { deleteAccount, getMe, updateProfile } from './account';
import {
  listPendingGyms,
  listReports,
  listUsers,
  moderateGym,
  moderateReport,
  setUserDisabled,
} from './admin';
import { listNotes, logAscent, removeAscent } from './ascents';
import { forgotPassword, login, resetPassword, signup, verifyEmail } from './auth';
import { first } from './db';
import type { Env } from './env';
import { fail, json, type Handler, type Params } from './http';
import { listGyms, requestGym } from './gyms';
import { getLocation, searchPlaces } from './places';
import { createReport } from './reports';
import {
  createRoute,
  getImage,
  getRoute,
  getThumbnail,
  likeRoute,
  listRoutes,
  removeRoute,
  unlikeRoute,
} from './routes';
import { issueHandoff, logout, redeemHandoff } from './session';
import { getRoutePage } from './share';
import { followUser, getProfile, unfollowUser } from './users';

async function getHealth(_req: Request, env: Env) {
  await first(env.DB, 'SELECT 1 FROM routes LIMIT 1');
  return json({ status: 'ok' });
}

// Every endpoint and who may call it is decided by its handler's first line.
const ENDPOINTS: [method: string, path: string, handler: Handler][] = [
  ['GET', '/api/health', getHealth],
  ['GET', '/api/location', getLocation],
  ['GET', '/api/places', searchPlaces],
  ['GET', '/media/:id', getImage],
  ['GET', '/media/:id/thumb', getThumbnail],
  ['GET', '/routes/:id', getRoutePage],
  ['HEAD', '/routes/:id', getRoutePage],

  ['POST', '/api/auth/signup', signup],
  ['POST', '/api/auth/login', login],
  ['POST', '/api/auth/logout', logout],
  ['POST', '/api/auth/forgot', forgotPassword],
  ['POST', '/api/auth/verify', verifyEmail],
  ['POST', '/api/auth/reset', resetPassword],
  ['POST', '/api/auth/handoff', issueHandoff],
  ['POST', '/api/auth/handoff/redeem', redeemHandoff],
  ['GET', '/api/me', getMe],
  ['PATCH', '/api/me', updateProfile],
  ['POST', '/api/me/delete', deleteAccount],

  ['GET', '/api/gyms', listGyms],
  ['POST', '/api/gyms', requestGym],
  ['GET', '/api/routes', listRoutes],
  ['POST', '/api/routes', createRoute],
  ['GET', '/api/routes/:id', getRoute],
  ['DELETE', '/api/routes/:id', removeRoute],
  ['PUT', '/api/routes/:id/like', likeRoute],
  ['DELETE', '/api/routes/:id/like', unlikeRoute],
  ['PUT', '/api/routes/:id/ascent', logAscent],
  ['DELETE', '/api/routes/:id/ascent', removeAscent],
  ['GET', '/api/routes/:id/notes', listNotes],
  ['POST', '/api/reports', createReport],
  ['GET', '/api/users/:username', getProfile],
  ['PUT', '/api/users/:id/follow', followUser],
  ['DELETE', '/api/users/:id/follow', unfollowUser],

  ['GET', '/api/admin/reports', listReports],
  ['PUT', '/api/admin/reports/:id', moderateReport],
  ['GET', '/api/admin/gyms', listPendingGyms],
  ['PUT', '/api/admin/gyms/:id', moderateGym],
  ['GET', '/api/admin/users', listUsers],
  ['PUT', '/api/admin/users/:id', setUserDisabled],
];

const endpoints = ENDPOINTS.map(([method, path, handler]) => ({
  method,
  handler,
  // ":name" matches one path segment and arrives in params.name.
  pattern: new URLPattern({ pathname: path }),
}));

async function dispatch(req: Request, env: Env, pathname: string) {
  try {
    const allowed: string[] = [];
    for (const { method, handler, pattern } of endpoints) {
      const match = pattern.exec({ pathname });
      if (!match) continue;
      if (method === req.method) return await handler(req, env, match.pathname.groups as Params);
      allowed.push(method);
    }
    if (allowed.length === 0) return fail(404, 'Not found');
    const response = fail(405, 'Method not allowed');
    response.headers.set('allow', allowed.join(', '));
    return response;
  } catch (error) {
    if (error instanceof Response) return error;
    console.error(error);
    return fail(500, 'Internal server error');
  }
}

// JSON and images are never pages: they are not to be sniffed, framed, embedded
// by other sites, or to leak their address as a referrer.
const HARDENING = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'cross-origin-resource-policy': 'same-origin',
  'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
  'strict-transport-security': 'max-age=31536000',
};

export default {
  async fetch(req, env) {
    const { pathname } = new URL(req.url);
    const response = await dispatch(req, env, pathname);
    if (pathname.startsWith('/api/') || pathname.startsWith('/media/'))
      for (const [name, value] of Object.entries(HARDENING)) response.headers.set(name, value);
    return response;
  },
} satisfies ExportedHandler<Env>;
