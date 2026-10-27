import { Hono } from 'hono';
import type { Context } from 'hono';
import type { AppEnv } from './env';
import { ApiError, isDemo } from './env';
import { readJson } from './http';
import { createRepo, getFile, getRepo, putFile } from './github';
import { GitHubStore, getDemoStore, invalidateRepoCache, resolveStore } from './store';
import { requireSession, writeSessionCookie } from './session';
import { repoInitSchema, repoUseSchema } from './validate';
import { DEFAULT_DATA_REPO, DATA_PATHS } from '../shared/types';
import type { RepoInfo } from '../shared/types';
import { demoSeed, repoReadme } from './seed';

export const repoRoutes = new Hono<AppEnv>();

async function seedRepo(
  store: GitHubStore,
  token: string,
  repo: RepoInfo,
  options: { overwriteReadme: boolean },
): Promise<void> {
  const seed = demoSeed();

  const [recipes, plans, lists] = await Promise.all([
    store.read(DATA_PATHS.recipes),
    store.read(DATA_PATHS.plans),
    store.read(DATA_PATHS.lists),
  ]);

  if (!recipes.sha) {
    await store.write(
      DATA_PATHS.recipes,
      { version: 1, recipes: seed.recipes },
      null,
      'Mise: add starter recipe box',
    );
  }
  if (!plans.sha) {
    await store.write(
      DATA_PATHS.plans,
      { version: 1, plans: seed.plans },
      null,
      'Mise: add this week’s meal plan',
    );
  }
  if (!lists.sha) {
    await store.write(
      DATA_PATHS.lists,
      { version: 1, lists: seed.lists },
      null,
      'Mise: add grocery list',
    );
  }

  const readme = await getFile(token, repo, 'README.md', repo.branch);
  if (!readme || options.overwriteReadme) {
    await putFile(token, repo, 'README.md', repoReadme(), {
      sha: readme?.sha,
      message: 'Mise: document the data format',
      branch: repo.branch,
    });
  }
}

async function attachRepo(c: Context<AppEnv>, repo: RepoInfo): Promise<void> {
  const session = requireSession(c);
  await writeSessionCookie(c, {
    ...session,
    repo: { owner: repo.owner, name: repo.name, branch: repo.branch },
  });
}

repoRoutes.get('/status', async (c) => {
  const session = requireSession(c);
  const { repo, demo } = await resolveStore(c.env, session);
  return c.json({ repo, demo });
});

repoRoutes.post('/use', async (c) => {
  const session = requireSession(c);
  if (isDemo(c.env)) {
    const store = await getDemoStore();
    return c.json({ repo: store.repo, demo: true });
  }

  const { fullName } = await readJson(c, repoUseSchema);
  const repo = await getRepo(session.token, fullName);
  if (!repo) {
    throw new ApiError(404, 'REPO_NOT_FOUND', `GitHub could not find ${fullName}, or your token cannot see it.`);
  }
  if (!repo.canWrite) {
    throw new ApiError(403, 'REPO_READ_ONLY', 'You do not have permission to write to that repository.');
  }

  await attachRepo(c, repo);
  return c.json({ repo, demo: false });
});

repoRoutes.post('/init', async (c) => {
  const session = requireSession(c);
  if (isDemo(c.env)) {
    const store = await getDemoStore();
    return c.json({ repo: store.repo, demo: true, seeded: false });
  }

  const body = await readJson(c, repoInitSchema);
  const name = body.name?.trim() || DEFAULT_DATA_REPO;

  let repo: RepoInfo;
  try {
    repo = await createRepo(session.token, {
      name,
      private: body.private ?? true,
    });
  } catch (error) {
    if (!(error instanceof ApiError) || error.code !== 'REPO_EXISTS') throw error;
    const existing = await getRepo(session.token, `${session.user.login}/${name}`);
    if (!existing) throw error;
    if (!existing.canWrite) {
      throw new ApiError(403, 'REPO_READ_ONLY', `You do not have write access to ${existing.fullName}.`);
    }
    repo = existing;
  }

  invalidateRepoCache(repo.fullName);
  const store = new GitHubStore(session.token, repo);
  const recipes = await store.read(DATA_PATHS.recipes);
  if (recipes.sha) {
    throw new ApiError(
      409,
      'REPO_HAS_DATA',
      `${repo.fullName} already contains Mise data. Open it instead of creating a new data store.`,
    );
  }

  await seedRepo(store, session.token, repo, { overwriteReadme: true });
  await attachRepo(c, repo);
  return c.json({ repo, demo: false, seeded: true });
});

repoRoutes.post('/seed', async (c) => {
  const session = requireSession(c);
  if (isDemo(c.env)) {
    const store = await getDemoStore();
    return c.json({ repo: store.repo, demo: true, seeded: false });
  }

  const { store, repo } = await resolveStore(c.env, session);
  if (!repo.exists) {
    throw new ApiError(409, 'REPO_NOT_READY', 'Create or connect a data repository first.');
  }
  if (!repo.canWrite) {
    throw new ApiError(403, 'REPO_READ_ONLY', 'You do not have write access to this repository.');
  }

  const recipes = await store.read(DATA_PATHS.recipes);
  if (recipes.sha) {
    throw new ApiError(409, 'REPO_HAS_DATA', 'This repository already has a recipe box.');
  }

  await seedRepo(store as GitHubStore, session.token, repo, { overwriteReadme: false });
  return c.json({ repo, demo: false, seeded: true });
});
