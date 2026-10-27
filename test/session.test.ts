import { describe, expect, it } from 'vitest';
import type { Env } from '../worker/env';
import { isDemo } from '../worker/env';
import { decryptValue, defaultRepo, demoSession, encryptValue } from '../worker/session';

const SECRET = 'a-test-secret-that-is-long-enough-123';

describe('session encryption', () => {
  it('round-trips structured session data', async () => {
    const session = demoSession();
    const token = await encryptValue(session, SECRET);
    expect(token).not.toContain('mise-demo');
    expect(token.split('.')).toHaveLength(2);

    const restored = await decryptValue<typeof session>(token, SECRET);
    expect(restored).toEqual(session);
  });

  it('uses a fresh IV for every encryption', async () => {
    const first = await encryptValue({ hello: 'world' }, SECRET);
    const second = await encryptValue({ hello: 'world' }, SECRET);
    expect(first).not.toBe(second);
  });

  it('returns null for the wrong key', async () => {
    const token = await encryptValue({ sub: 'octocat' }, SECRET);
    expect(await decryptValue(token, 'another-secret-that-is-also-long')).toBeNull();
  });

  it('returns null for tampered or malformed payloads', async () => {
    const token = await encryptValue({ sub: 'octocat' }, SECRET);
    const [iv, cipher] = token.split('.');
    const tampered = `${iv}.${cipher?.slice(0, -2)}AA`;
    expect(await decryptValue(tampered, SECRET)).toBeNull();
    expect(await decryptValue('not-a-token', SECRET)).toBeNull();
    expect(await decryptValue('', SECRET)).toBeNull();
  });

  it('handles unicode values', async () => {
    const value = { note: 'Crème brûlée — 日本語 🍲' };
    const token = await encryptValue(value, SECRET);
    expect(await decryptValue(token, SECRET)).toEqual(value);
  });
});

describe('demoSession', () => {
  it('describes a local demo identity without a real token', () => {
    const session = demoSession();
    expect(session.token).toBe('demo');
    expect(session.user.login).toBe('mise-demo');
    expect(session.repo).toEqual({ owner: 'mise-demo', name: 'meal-planner-data', branch: 'main' });
    expect(session.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });
});

describe('defaultRepo', () => {
  it('defaults to a repo in the signed-in account', () => {
    expect(defaultRepo({} as Env, 'octocat')).toEqual({
      owner: 'octocat',
      name: 'meal-planner-data',
      branch: 'main',
    });
  });

  it('honors an explicit owner/name configuration and branch', () => {
    expect(
      defaultRepo({ DATA_REPO: 'team/meal-data', GITHUB_DATA_BRANCH: 'trunk' } as Env, 'octocat'),
    ).toEqual({ owner: 'team', name: 'meal-data', branch: 'trunk' });
  });

  it('places a bare repo name under the signed-in account', () => {
    expect(defaultRepo({ DATA_REPO: 'pantry' } as Env, 'octocat')).toEqual({
      owner: 'octocat',
      name: 'pantry',
      branch: 'main',
    });
  });

  it('falls back when the configured repo name is incomplete', () => {
    expect(defaultRepo({ DATA_REPO: 'team/' } as Env, 'octocat').name).toBe('meal-planner-data');
  });
});

describe('isDemo', () => {
  it('accepts the documented truthy values only', () => {
    expect(isDemo({ DEMO_MODE: 'true' })).toBe(true);
    expect(isDemo({ DEMO_MODE: '1' })).toBe(true);
    expect(isDemo({ DEMO_MODE: 'false' })).toBe(false);
    expect(isDemo({})).toBe(false);
  });
});
