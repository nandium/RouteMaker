/** The small set of data shapes, paths, and constants shared by app and browser clients. */
export const APP_NAME = 'ROUTEMAKER';
export const LAYOUT_CHANGE_EVENT = 'routemaker:layout-change';
export const SYSTEM_THEME_EVENT = 'routemaker:system-theme-change';

export type User = {
  id: string;
  email: string;
  username: string;
  display_name: string;
  role: 'user' | 'admin';
  disabled: boolean;
};

export type Gym = {
  id: string;
  name: string;
  address: string;
  country_code: string;
  latitude: number;
  longitude: number;
  status: string;
};

export type Annotation = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type Route = {
  id: string;
  name: string;
  public_grade: string;
  votes: number;
  voted: boolean;
  comment_count: number;
  image_url: string;
  author: { username: string; display_name: string };
  gym: { name: string };
};

export type Comment = {
  id: string;
  body: string;
  author: { username: string; display_name: string };
};

export type PublicProfile = {
  id: string;
  username: string;
  display_name: string;
  followers: number;
  following: number;
  followed: boolean;
};

export type Metadata = {
  grades: string[];
  default_grade: string;
  max_image_bytes: number;
  max_image_dimension: number;
};
export type AuthSession = { token: string; user: User };
export type AuthMessage = { message: string };
export type VoteResponse = { voted: boolean; votes: number };
export type GradeResponse = { public_grade: string };
export type FollowResponse = { followed: boolean };
export type Report = {
  id: string;
  target_type: 'route' | 'comment' | 'user';
  target_id: string;
  target_label: string | null;
  route_id: string | null;
  reason: string;
};

export const STORAGE_KEYS = {
  session: 'routemaker.session',
  theme: 'routemaker.theme',
} as const;

export const API_PATHS = {
  gyms: '/gyms',
  routes: '/routes',
  route: (id: string) => `/routes/${id}`,
  comments: (routeId: string) => `/routes/${routeId}/comments`,
  meta: '/meta',
  auth: {
    signup: '/auth/signup',
    login: '/auth/login',
    logout: '/auth/logout',
    forgot: '/auth/forgot',
    verify: '/auth/verify',
    reset: '/auth/reset',
  },
  me: '/me',
  profile: (username: string) => `/users/${encodeURIComponent(username)}`,
  follow: (id: string) => `/users/${id}/follow`,
  vote: (id: string) => `/routes/${id}/vote`,
  grade: (id: string) => `/routes/${id}/grade`,
  report: '/reports',
  admin: {
    reports: '/admin/reports',
    report: (id: string) => `/admin/reports/${id}`,
    gyms: '/admin/gyms',
    gym: (id: string) => `/admin/gyms/${id}`,
    users: '/admin/users',
    userDisabled: (id: string, disabled: boolean) =>
      `/admin/users/${id}/disabled?disabled=${disabled}`,
  },
} as const;
