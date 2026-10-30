import { Hono } from 'hono';
import { getAuthenticatedUser, GitHubError } from './github';
import type { AppEnv } from './env';
import { ApiError, isDemo } from './env';
import {
  assertSessionSecret,
  buildSession,
  clearSession,
  clearStateCookie,
  defaultRepo,
  demoSession,
  randomState,
  readStateCookie,
  requireSession,
  writeSessionCookie,
  writeStateCookie,
} from './session';

export const authRoutes = new Hono<AppEnv>();

function oauthConfig(c: { env: AppEnv['Bindings'] }): { clientId: string; clientSecret: string; scope: string } {
  const clientId = c.env.GITHUB_CLIENT_ID?.trim();
  const clientSecret = c.env.GITHUB_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new ApiError(
      500,
      'AUTH_NOT_CONFIGURED',
      'GitHub OAuth is not configured on this deployment. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET.',
    );
  }
  return {
    clientId,
    clientSecret,
    scope: c.env.GITHUB_OAUTH_SCOPE?.trim() || 'repo',
  };
}

function safeReturnTo(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/';
  return value;
}

/**
 * Turns a failure raised while starting or finishing GitHub sign-in into a
 * `?error=` code the login page understands. Configuration problems get their
 * own code so they do not look like a transient GitHub hiccup.
 */
function authErrorCode(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'CONFIG') return 'session_secret';
    if (error.code === 'AUTH_NOT_CONFIGURED') return 'not_configured';
  }
  if (error instanceof GitHubError) return 'github_failed';
  return 'signin_failed';
}

function redirectUri(env: AppEnv['Bindings'], requestUrl: string): string {
  return env.OAUTH_REDIRECT_URL?.trim() || `${new URL(requestUrl).origin}/api/auth/callback`;
}

authRoutes.get('/login', async (c) => {
  if (isDemo(c.env)) return c.redirect('/');

  try {
    assertSessionSecret(c.env);
    const config = oauthConfig(c);
    const state = randomState();
    const returnTo = safeReturnTo(c.req.query('returnTo') ?? '/');
    writeStateCookie(c, `${state}~${returnTo}`);

    const authorize = new URL('https://github.com/login/oauth/authorize');
    authorize.searchParams.set('client_id', config.clientId);
    authorize.searchParams.set('redirect_uri', redirectUri(c.env, c.req.url));
    authorize.searchParams.set('scope', config.scope);
    authorize.searchParams.set('state', state);
    authorize.searchParams.set('allow_signup', 'true');
    return c.redirect(authorize.toString());
  } catch (error) {
    console.error('[mise] could not start GitHub sign-in', error);
    return c.redirect(`/login?error=${authErrorCode(error)}`);
  }
});

authRoutes.get('/callback', async (c) => {
  if (isDemo(c.env)) return c.redirect('/');

  const errorParam = c.req.query('error');
  if (errorParam) return c.redirect('/login?error=denied');

  const code = c.req.query('code');
  const state = c.req.query('state');
  const cookie = readStateCookie(c);
  clearStateCookie(c);

  if (!code || !state || !cookie) return c.redirect('/login?error=invalid_state');
  const separator = cookie.indexOf('~');
  const expectedState = separator === -1 ? cookie : cookie.slice(0, separator);
  const returnTo = separator === -1 ? '/' : safeReturnTo(cookie.slice(separator + 1));

  let timingSafeEqual = expectedState.length === state.length;
  if (timingSafeEqual) {
    let mismatch = 0;
    for (let i = 0; i < expectedState.length; i += 1) {
      mismatch |= expectedState.charCodeAt(i) ^ state.charCodeAt(i);
    }
    timingSafeEqual = mismatch === 0;
  }
  if (!timingSafeEqual) return c.redirect('/login?error=invalid_state');

  try {
    assertSessionSecret(c.env);
    const config = oauthConfig(c);
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'mise-meal-planner',
      },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: redirectUri(c.env, c.req.url),
      }),
    });

    const tokenBody = (await tokenResponse.json()) as {
      access_token?: string;
      error?: string;
      error_description?: string;
    };
    if (!tokenResponse.ok || !tokenBody.access_token) {
      return c.redirect('/login?error=exchange_failed');
    }

    const user = await getAuthenticatedUser(tokenBody.access_token);
    const session = buildSession({
      token: tokenBody.access_token,
      user,
      repo: defaultRepo(c.env, user.login),
    });
    await writeSessionCookie(c, session);
    return c.redirect(returnTo);
  } catch (error) {
    // Without this the real cause (a bad GitHub response, a missing secret, a
    // crypto failure) disappears behind the generic "try again" message.
    console.error('[mise] GitHub sign-in failed', error);
    return c.redirect(`/login?error=${authErrorCode(error)}`);
  }
});

authRoutes.post('/logout', async (c) => {
  if (isDemo(c.env)) {
    return c.json({ ok: true, demo: true });
  }
  requireSession(c);
  clearSession(c);
  return c.json({ ok: true });
});

authRoutes.get('/session', async (c) => {
  if (isDemo(c.env)) {
    return c.json({ user: demoSession().user, demo: true });
  }
  const session = requireSession(c);
  return c.json({ user: session.user, demo: false });
});
