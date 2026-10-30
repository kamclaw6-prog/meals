import { afterEach, describe, expect, it, vi } from 'vitest';
import { authRoutes } from '../worker/auth';
import type { Env } from '../worker/env';

const SECRET = 'a-test-secret-that-is-long-enough-123';

const githubEnv = {
  GITHUB_CLIENT_ID: 'client-id',
  GITHUB_CLIENT_SECRET: 'client-secret',
  SESSION_SECRET: SECRET,
} as Env;

function signIn(path: string, env: Env, cookie?: string) {
  const headers: Record<string, string> = {};
  if (cookie) headers.Cookie = cookie;
  return authRoutes.request(`https://meals.example.com${path}`, { headers }, env);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('GET /login', () => {
  it('reports a missing SESSION_SECRET instead of sending the user to GitHub', async () => {
    const res = await signIn('/login', {
      GITHUB_CLIENT_ID: 'client-id',
      GITHUB_CLIENT_SECRET: 'client-secret',
    } as Env);

    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/login?error=session_secret');
    expect(res.headers.get('set-cookie')).toBeNull();
  });

  it('reports a missing GitHub OAuth app', async () => {
    const res = await signIn('/login', { SESSION_SECRET: SECRET } as Env);
    expect(res.headers.get('location')).toBe('/login?error=not_configured');
  });

  it('redirects to GitHub with state, scope and the deployment callback', async () => {
    const res = await signIn('/login?returnTo=%2Frecipes', githubEnv);

    expect(res.status).toBe(302);
    const location = new URL(res.headers.get('location') ?? '');
    expect(location.origin).toBe('https://github.com');
    expect(location.searchParams.get('client_id')).toBe('client-id');
    expect(location.searchParams.get('scope')).toBe('repo');
    expect(location.searchParams.get('redirect_uri')).toBe(
      'https://meals.example.com/api/auth/callback',
    );
    expect(location.searchParams.get('state')).toBeTruthy();
    expect(res.headers.get('set-cookie')).toContain('mise_oauth_state=');
  });
});

describe('GET /callback', () => {
  const stateCookie = (state: string) => `mise_oauth_state=${state}~%2F`;

  it('reports a missing SESSION_SECRET as a configuration problem', async () => {
    const res = await signIn(
      '/callback?code=abc&state=state123',
      { GITHUB_CLIENT_ID: 'client-id', GITHUB_CLIENT_SECRET: 'client-secret' } as Env,
      stateCookie('state123'),
    );

    expect(res.headers.get('location')).toBe('/login?error=session_secret');
  });

  it('reports GitHub rejecting the token as a GitHub problem', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).includes('/login/oauth/access_token')) {
          return new Response(JSON.stringify({ access_token: 'gho_test' }), { status: 200 });
        }
        return new Response(JSON.stringify({ message: 'Bad credentials' }), { status: 401 });
      }),
    );

    const res = await signIn('/callback?code=abc&state=state123', githubEnv, stateCookie('state123'));
    expect(res.headers.get('location')).toBe('/login?error=github_failed');
  });

  it('sets an encrypted session cookie on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).includes('/login/oauth/access_token')) {
          return new Response(JSON.stringify({ access_token: 'gho_test' }), { status: 200 });
        }
        return new Response(
          JSON.stringify({
            login: 'octocat',
            name: 'The Octocat',
            avatar_url: 'https://avatars.example.com/octocat',
            html_url: 'https://github.com/octocat',
          }),
          { status: 200 },
        );
      }),
    );

    const res = await signIn('/callback?code=abc&state=state123', githubEnv, stateCookie('state123'));

    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/');
    const cookie = res.headers.get('set-cookie') ?? '';
    expect(cookie).toContain('mise_session=');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).not.toContain('gho_test');
  });

  it('rejects a callback whose state does not match the cookie', async () => {
    const res = await signIn('/callback?code=abc&state=other', githubEnv, stateCookie('state123'));
    expect(res.headers.get('location')).toBe('/login?error=invalid_state');
  });
});
