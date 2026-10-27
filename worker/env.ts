import type { RepoRef, SessionUser } from '../shared/types';

export interface Env {
  ASSETS: Fetcher;
  DEMO_MODE?: string;
  SESSION_SECRET?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  GITHUB_OAUTH_SCOPE?: string;
  OAUTH_REDIRECT_URL?: string;
  DATA_REPO?: string;
  GITHUB_DATA_BRANCH?: string;
}

export interface Session {
  token: string;
  user: SessionUser;
  repo: RepoRef;
  /** Unix seconds. */
  exp: number;
}

export type AppEnv = {
  Bindings: Env;
  Variables: {
    session: Session | null;
  };
};

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function isDemo(env: Pick<Env, 'DEMO_MODE'>): boolean {
  return env.DEMO_MODE === 'true' || env.DEMO_MODE === '1';
}
