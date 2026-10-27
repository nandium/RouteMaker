/** Types, limits, and paths shared by the app, browser tools, and Worker. */
export const APP_NAME = 'ROUTEMAKER';

export const MAP_COORDINATE_LIMITS = { latitude: 90, longitude: 180 } as const;
export const CLIMBING_GRADES = Array.from({ length: 18 }, (_, index) => `V${index}`);
export const DEFAULT_GRADE = 'V4';
export const MAX_NOTE_LENGTH = 500;
/** Inclusive [min, max] lengths, in characters, of what an account may be named and secured with. */
export const USERNAME_LENGTH = [3, 30] as const;
export const DISPLAY_NAME_LENGTH = [1, 50] as const;
export const EMAIL_LENGTH = [5, 254] as const;
export const PASSWORD_LENGTH = [8, 128] as const;
export const USERNAME_PATTERN = /^[A-Za-z0-9_-]+$/;
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MAX_ROUTE_NAME_LENGTH = 80;
export const MAX_REPORT_DETAILS_LENGTH = 500;
/** Characters allowed in a gym's name and address: [min, max]. */
export const GYM_NAME_LENGTH = [2, 100] as const;
export const GYM_ADDRESS_LENGTH = [3, 200] as const;
export const MAX_IMAGE_BYTES = 512 * 1024;
export const MAX_IMAGE_DIMENSION = 1600;
export const MAX_THUMBNAIL_BYTES = 64 * 1024;
export const MAX_THUMBNAIL_DIMENSION = 640;

/** Field names of the multipart form that publishes a route. */
export const ROUTE_FORM = {
  name: 'name',
  gym_id: 'gym_id',
  owner_grade: 'owner_grade',
  image: 'image',
  thumbnail: 'thumbnail',
} as const;
export const PLACE_SEARCH = {
  minQueryLength: 3,
  maxQueryLength: 100,
  resultLimit: 5,
  biasDecimals: 3,
} as const;

export const REPORT_REASONS = ['spam', 'offensive', 'inaccurate', 'other'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
export type ReportTarget = 'route' | 'ascent' | 'user';

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
  status: 'pending' | 'approved' | 'rejected';
};

/** A gym in GET /gyms, with its visible route count. */
export type GymListing = Gym & { route_count: number };

export type Place = {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
};

export type MapLocation = {
  latitude: number;
  longitude: number;
};

/** The signed-in climber's own log of a route. */
type MyAscent = {
  sent: boolean;
  grade: string | null;
  note: string | null;
  updated_at: number;
};

/** PUT replaces the whole ascent: an omitted grade or note is cleared. */
export type AscentInput = { sent: boolean; grade?: string | null; note?: string | null };

/** An ascent with a note, as listed under a route. */
export type AscentNote = {
  id: string;
  author: { username: string; display_name: string };
  sent: boolean;
  grade: string | null;
  note: string;
  updated_at: number;
};

/** A route as listed and as detailed. */
export type Route = {
  id: string;
  name: string;
  public_grade: string;
  likes: number;
  liked: boolean;
  sends: number;
  my_ascent: MyAscent | null;
  image_url: string;
  thumb_url: string;
  created_at: number;
  author: { username: string; display_name: string };
  gym: { id: string; name: string };
};

export type LikeResponse = { liked: boolean; likes: number };

export type PublicProfile = {
  id: string;
  username: string;
  display_name: string;
  followers: number;
  following: number;
  followed: boolean;
};

/** `followers` is the profile's follower count after the change. */
export type FollowResponse = { followed: boolean; followers: number };

/** The answer to a request that creates a gym request or a report. */
export type CreatedResponse = { id: string };

export type AuthSession = { token: string; user: User };
export type AuthMessage = { message: string };
export type HandoffCode = { code: string };

/** The address fragment key that carries a hand-off code from the app to the browser. */
export const HANDOFF_FRAGMENT_KEY = 'handoff';

/** A sign-in hand-off code: 256 random bits as lowercase hex. */
export const HANDOFF_CODE_PATTERN = /^[0-9a-f]{64}$/;

export type ReportInput = {
  target_type: ReportTarget;
  target_id: string;
  reason: ReportReason;
  details?: string;
};

/** An open report, as moderators see it. */
export type Report = {
  id: string;
  target_type: ReportTarget;
  target_id: string;
  target_label: string | null;
  route_id: string | null;
  reason: ReportReason;
  details: string | null;
};

// Builders encode every id they take: ids reach these paths from links as well as from the API.
export const API_PATHS = {
  gyms: '/gyms',
  location: '/location',
  places: (query: string, latitude: number, longitude: number) =>
    `/places?q=${encodeURIComponent(query)}&lat=${latitude.toFixed(PLACE_SEARCH.biasDecimals)}&lon=${longitude.toFixed(PLACE_SEARCH.biasDecimals)}`,
  routes: '/routes',
  route: (id: string) => `/routes/${encodeURIComponent(id)}`,
  like: (id: string) => `/routes/${encodeURIComponent(id)}/like`,
  ascent: (id: string) => `/routes/${encodeURIComponent(id)}/ascent`,
  notes: (id: string) => `/routes/${encodeURIComponent(id)}/notes`,
  auth: {
    signup: '/auth/signup',
    login: '/auth/login',
    logout: '/auth/logout',
    forgot: '/auth/forgot',
    verify: '/auth/verify',
    reset: '/auth/reset',
    handoff: '/auth/handoff',
    redeemHandoff: '/auth/handoff/redeem',
  },
  me: '/me',
  deleteAccount: '/me/delete',
  profile: (username: string) => `/users/${encodeURIComponent(username)}`,
  follow: (id: string) => `/users/${encodeURIComponent(id)}/follow`,
  report: '/reports',
  admin: {
    reports: '/admin/reports',
    report: (id: string) => `/admin/reports/${encodeURIComponent(id)}`,
    gyms: '/admin/gyms',
    gym: (id: string) => `/admin/gyms/${encodeURIComponent(id)}`,
    users: '/admin/users',
    user: (id: string) => `/admin/users/${encodeURIComponent(id)}`,
  },
} as const;
