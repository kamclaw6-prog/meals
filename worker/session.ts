import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { AppEnv, Env, Session } from './env';
import { ApiError } from './env';
import type { RepoRef, SessionUser } from '../shared/types';
import { DEFAULT_DATA_BRANCH, DEFAULT_DATA_REPO } from '../shared/types';

const SESSION_COOKIE = 'mise_session';
const STATE_COOKIE = 'mise_oauth_state';
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function requireSecret(env: Env): string {
  const secret = env.SESSION_SECRET;
  if (!secret || secret.length < 24) {
    throw new ApiError(
      500,
      'CONFIG',
      'SESSION_SECRET is missing or too short. Set a random value of at least 32 characters.',
    );
  }
  return secret;
}

async function sessionKey(secret: string): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(secret));
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export async function encryptValue(value: unknown, secret: string): Promise<string> {
  const key = await sessionKey(secret);
  const iv = Uint8Array.from(crypto.getRandomValues(new Uint8Array(12)));
  const plaintext = encoder.encode(JSON.stringify(value));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: encoder.encode('mise-session-v1') },
    key,
    plaintext,
  );
  return `${bytesToBase64Url(iv)}.${bytesToBase64Url(new Uint8Array(ciphertext))}`;
}

export async function decryptValue<T>(value: string, secret: string): Promise<T | null> {
  try {
    const [ivPart, cipherPart] = value.split('.');
    if (!ivPart || !cipherPart) return null;
    const key = await sessionKey(secret);
    const plaintext = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: Uint8Array.from(base64UrlToBytes(ivPart)),
        additionalData: encoder.encode('mise-session-v1'),
      },
      key,
      Uint8Array.from(base64UrlToBytes(cipherPart)),
    );
    return JSON.parse(decoder.decode(plaintext)) as T;
  } catch {
    return null;
  }
}

export function defaultRepo(env: Env, login: string): RepoRef {
  const configured = env.DATA_REPO?.trim();
  const branch = env.GITHUB_DATA_BRANCH?.trim() || DEFAULT_DATA_BRANCH;
  if (configured) {
    const [owner, name] = configured.includes('/')
      ? configured.split('/')
      : [login, configured];
    if (owner && name) return { owner, name, branch };
  }
  return { owner: login, name: DEFAULT_DATA_REPO, branch };
}

export function demoSession(): Session {
  return {
    token: 'demo',
    user: {
      login: 'mise-demo',
      name: 'Mise Demo',
      avatarUrl: '',
      htmlUrl: 'https://github.com',
    },
    repo: { owner: 'mise-demo', name: DEFAULT_DATA_REPO, branch: DEFAULT_DATA_BRANCH },
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE,
  };
}

function cookieOptions(c: Context<AppEnv>, maxAge: number) {
  return {
    httpOnly: true,
    secure: new URL(c.req.url).protocol === 'https:',
    sameSite: 'Lax' as const,
    path: '/',
    maxAge,
  };
}

export async function writeSessionCookie(c: Context<AppEnv>, session: Session): Promise<void> {
  const token = await encryptValue(session, requireSecret(c.env));
  setCookie(c, SESSION_COOKIE, token, cookieOptions(c, SESSION_MAX_AGE));
}

export async function readSession(c: Context<AppEnv>): Promise<Session | null> {
  const raw = getCookie(c, SESSION_COOKIE);
  if (!raw) return null;
  const secret = c.env.SESSION_SECRET;
  if (!secret) return null;
  const session = await decryptValue<Session>(raw, secret);
  if (!session || typeof session !== 'object' || !session.user || !session.repo) return null;
  if (session.exp * 1000 < Date.now()) return null;
  return session;
}

export function clearSession(c: Context<AppEnv>): void {
  deleteCookie(c, SESSION_COOKIE, { path: '/' });
}

export function writeStateCookie(c: Context<AppEnv>, value: string): void {
  setCookie(c, STATE_COOKIE, value, {
    ...cookieOptions(c, 600),
    path: '/api/auth',
  });
}

export function readStateCookie(c: Context<AppEnv>): string | undefined {
  return getCookie(c, STATE_COOKIE);
}

export function clearStateCookie(c: Context<AppEnv>): void {
  deleteCookie(c, STATE_COOKIE, { path: '/api/auth' });
}

export function requireSession(c: Context<AppEnv>): Session {
  const session = c.get('session');
  if (!session) {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Sign in with GitHub to continue.', {
      loginUrl: '/api/auth/login',
    });
  }
  return session;
}

export function sessionUser(session: Session): SessionUser {
  return session.user;
}

export function buildSession(input: {
  token: string;
  user: SessionUser;
  repo: RepoRef;
}): Session {
  return {
    token: input.token,
    user: input.user,
    repo: input.repo,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE,
  };
}

export function randomState(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return bytesToBase64Url(bytes);
}
