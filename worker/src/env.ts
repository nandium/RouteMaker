// Secrets may be unset; auth answers 503 until they are.
export type Env = Cloudflare.Env & { FIREBASE_API_KEY?: string };
