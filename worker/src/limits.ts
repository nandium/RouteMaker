import {
  DISPLAY_NAME_LENGTH,
  EMAIL_LENGTH,
  MAX_NOTE_LENGTH,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_DIMENSION,
  MAX_REPORT_DETAILS_LENGTH,
  MAX_ROUTE_NAME_LENGTH,
  MAX_THUMBNAIL_BYTES,
  MAX_THUMBNAIL_DIMENSION,
  PASSWORD_LENGTH,
  ROUTE_FORM,
  USERNAME_LENGTH,
} from '../../app/src/client-contract';

export { GYM_ADDRESS_LENGTH, GYM_NAME_LENGTH } from '../../app/src/client-contract';

export type Range = readonly [min: number, max: number];

// Text ranges are also enforced by CHECK constraints in migrations/. The ones the app tells its
// visitors about are defined in the client contract.
export { DISPLAY_NAME_LENGTH, EMAIL_LENGTH, PASSWORD_LENGTH, USERNAME_LENGTH };
export const ROUTE_NAME_LENGTH: Range = [1, MAX_ROUTE_NAME_LENGTH];
export const NOTE_LENGTH: Range = [1, MAX_NOTE_LENGTH];
export const REPORT_DETAILS_LENGTH: Range = [1, MAX_REPORT_DETAILS_LENGTH];

// Firebase owns password and email policy; these only bound what is forwarded.
export const OOB_CODE_LENGTH: Range = [1, 2048];
export const ID_LENGTH: Range = [1, 200];

/** A JPEG form field: its name, and the size and dimension limits it must meet. */
export type JpegSpec = {
  field: string;
  label: string;
  maxBytes: number;
  maxDimension: number;
};
export const PHOTO: JpegSpec = {
  field: ROUTE_FORM.image,
  label: 'Image',
  maxBytes: MAX_IMAGE_BYTES,
  maxDimension: MAX_IMAGE_DIMENSION,
};
export const THUMBNAIL: JpegSpec = {
  field: ROUTE_FORM.thumbnail,
  label: 'Thumbnail',
  maxBytes: MAX_THUMBNAIL_BYTES,
  maxDimension: MAX_THUMBNAIL_DIMENSION,
};

export const MAX_JSON_BYTES = 64 * 1024;
// Photo and thumbnail plus headroom for multipart framing.
export const MAX_UPLOAD_BYTES = PHOTO.maxBytes + THUMBNAIL.maxBytes + 32 * 1024;

export const DAILY_ROUTE_LIMIT = 3;
export const DAILY_WINDOW_SECONDS = 24 * 60 * 60;
export const MAX_USER_IMAGES = 20;
// 200 x (512 + 64) KiB caps route photos near 112 MiB, inside D1's 500 MB Free database.
export const MAX_SITE_IMAGES = 200;
export const MAX_PENDING_GYMS_PER_USER = 5;
export const MAX_OPEN_REPORTS_PER_USER = 20;
export const LIST_LIMIT = 100;

export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
export const MAX_SESSIONS_PER_USER = 5;
export const HANDOFF_TTL_SECONDS = 120;

/** At most `limit` attempts per `windowSeconds`, counted per key. */
export type Throttle = { limit: number; windowSeconds: number };
/** Mail Firebase sends for one address: verification at signup, and password resets. */
export const MAIL_PER_ADDRESS: Throttle = { limit: 3, windowSeconds: 60 * 60 };
/** Signup, login, password and hand-off attempts from one client address. */
export const AUTH_PER_CLIENT: Throttle = { limit: 20, windowSeconds: 60 };
export const PLACE_SEARCH_PER_CLIENT: Throttle = { limit: 30, windowSeconds: 60 };
