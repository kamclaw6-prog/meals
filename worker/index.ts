import { Hono } from 'hono';
import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { AppEnv } from './env';
import { ApiError, isDemo } from './env';
import { authRoutes } from './auth';
import { repoRoutes } from './repo';
import { GitHubError } from './github';
import { readJson, apiErrorBody } from './http';
import { demoSession, readSession, requireSession } from './session';
import {
  listsFile,
  parseListsFile,
  parsePlansFile,
  parseRecipesFile,
  plansFile,
  recipesFile,
  resolveStore,
  type DataStore,
} from './store';
import {
  listsPayloadSchema,
  normalizeLists,
  normalizePlans,
  normalizeRecipes,
  plansPayloadSchema,
  recipesPayloadSchema,
} from './validate';
import {
  DATA_PATHS,
  type BootstrapPayload,
  type GroceryList,
  type MealPlan,
  type Recipe,
  type RepoInfo,
} from '../shared/types';

const app = new Hono<AppEnv>();

app.use('/api/*', async (c, next) => {
  c.header('Cache-Control', 'no-store');
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('Referrer-Policy', 'no-referrer');

  const method = c.req.method;
  if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
    // A custom header cannot be added cross-origin without a CORS preflight, and
    // this API never answers preflights. Together with the SameSite cookie this
    // blocks CSRF without hurting the Vite dev proxy.
    if (c.req.header('x-mise-csrf') !== '1') {
      throw new ApiError(403, 'CSRF', 'This request is missing its CSRF header.');
    }
  }

  const session = isDemo(c.env) ? demoSession() : await readSession(c);
  c.set('session', session);
  await next();
});

app.get('/api/health', (c) =>
  c.json({
    ok: true,
    demo: isDemo(c.env),
    authConfigured: Boolean(c.env.GITHUB_CLIENT_ID && c.env.GITHUB_CLIENT_SECRET),
  }),
);

app.route('/api/auth', authRoutes);
app.route('/api/repo', repoRoutes);

interface StoreContextResolved {
  store: DataStore;
  repo: RepoInfo;
  demo: boolean;
}

async function storeFor(c: Context<AppEnv>): Promise<StoreContextResolved> {
  const session = requireSession(c);
  return resolveStore(c.env, session);
}

async function writableStoreFor(c: Context<AppEnv>): Promise<StoreContextResolved> {
  const resolved = await storeFor(c);
  if (!resolved.repo.exists) {
    throw new ApiError(409, 'REPO_NOT_READY', 'Create or connect a GitHub data repository first.', {
      onboarding: true,
    });
  }
  if (!resolved.repo.canWrite) {
    throw new ApiError(403, 'REPO_READ_ONLY', 'You do not have write access to this repository.');
  }
  return resolved;
}

app.get('/api/bootstrap', async (c) => {
  const session = requireSession(c);
  const { store, repo, demo } = await resolveStore(c.env, session);

  const empty: BootstrapPayload['data'] = {
    recipes: { items: [], sha: null },
    plans: { items: [], sha: null },
    lists: { items: [], sha: null },
  };

  if (!repo.exists) {
    const payload: BootstrapPayload = { user: session.user, demo, repo, data: empty };
    return c.json(payload);
  }

  const [recipesResult, plansResult, listsResult] = await Promise.all([
    store.read(DATA_PATHS.recipes),
    store.read(DATA_PATHS.plans),
    store.read(DATA_PATHS.lists),
  ]);

  const payload: BootstrapPayload = {
    user: session.user,
    demo,
    repo,
    data: {
      recipes: { items: parseRecipesFile(recipesResult.data), sha: recipesResult.sha },
      plans: { items: parsePlansFile(plansResult.data), sha: plansResult.sha },
      lists: { items: parseListsFile(listsResult.data), sha: listsResult.sha },
    },
  };
  return c.json(payload);
});

app.put('/api/recipes', async (c) => {
  const { store } = await writableStoreFor(c);
  const payload = await readJson(c, recipesPayloadSchema);
  const items = normalizeRecipes(payload.items);

  const current = await store.read(DATA_PATHS.recipes);
  const currentRecipes = parseRecipesFile(current.data);
  const nextIds = new Set(items.map((recipe) => recipe.id));
  const removed = currentRecipes.map((recipe) => recipe.id).filter((id) => !nextIds.has(id));

  if (removed.length > 0) {
    const plans = parsePlansFile((await store.read(DATA_PATHS.plans)).data);
    const inUse = new Set<string>();
    for (const plan of plans) {
      for (const meal of plan.meals) {
        if (removed.includes(meal.recipeId)) inUse.add(meal.recipeId);
      }
    }
    if (inUse.size > 0) {
      throw new ApiError(
        409,
        'RECIPE_IN_USE',
        'Those recipes are still on a meal plan. Remove the planned meals first.',
        { recipeIds: Array.from(inUse) },
      );
    }
  }

  const saved = await store.write(
    DATA_PATHS.recipes,
    recipesFile(items),
    payload.sha ?? null,
    `Mise: update recipe box (${items.length} recipes)`,
  );
  return c.json(saved);
});

app.put('/api/plans', async (c) => {
  const { store } = await writableStoreFor(c);
  const payload = await readJson(c, plansPayloadSchema);
  const items = normalizePlans(payload.items);

  const recipeIds = new Set(parseRecipesFile((await store.read(DATA_PATHS.recipes)).data).map((recipe) => recipe.id));
  const missing = new Set<string>();
  for (const plan of items) {
    for (const meal of plan.meals) {
      if (!recipeIds.has(meal.recipeId)) missing.add(meal.recipeId);
    }
  }
  if (missing.size > 0) {
    throw new ApiError(422, 'UNKNOWN_RECIPE', 'A planned meal points at a recipe that no longer exists.', {
      recipeIds: Array.from(missing),
    });
  }

  const saved = await store.write(
    DATA_PATHS.plans,
    plansFile(items),
    payload.sha ?? null,
    `Mise: update meal plans (${items.length} weeks)`,
  );
  return c.json(saved);
});

app.put('/api/lists', async (c) => {
  const { store } = await writableStoreFor(c);
  const payload = await readJson(c, listsPayloadSchema);
  const items = normalizeLists(payload.items);

  const saved = await store.write(
    DATA_PATHS.lists,
    listsFile(items),
    payload.sha ?? null,
    `Mise: update grocery lists (${items.length} lists)`,
  );
  return c.json(saved);
});

app.get('/api/recipes', async (c) => {
  const { store } = await storeFor(c);
  const result = await store.read(DATA_PATHS.recipes);
  const recipes: Recipe[] = parseRecipesFile(result.data);
  return c.json({ items: recipes, sha: result.sha });
});

app.get('/api/plans', async (c) => {
  const { store } = await storeFor(c);
  const result = await store.read(DATA_PATHS.plans);
  const plans: MealPlan[] = parsePlansFile(result.data);
  return c.json({ items: plans, sha: result.sha });
});

app.get('/api/lists', async (c) => {
  const { store } = await storeFor(c);
  const result = await store.read(DATA_PATHS.lists);
  const lists: GroceryList[] = parseListsFile(result.data);
  return c.json({ items: lists, sha: result.sha });
});

app.notFound((c) => {
  const path = new URL(c.req.url).pathname;
  if (path.startsWith('/api/')) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Unknown API route.' } }, 404);
  }
  return c.env.ASSETS.fetch(c.req.raw);
});

app.onError((error, c) => {
  if (error instanceof ApiError) {
    return c.json(apiErrorBody(error), error.status as ContentfulStatusCode);
  }
  if (error instanceof GitHubError) {
    const status = error.status === 429 ? 429 : error.status === 401 ? 401 : error.status === 403 ? 403 : error.status === 404 ? 404 : error.status === 409 ? 409 : 502;
    const details = status === 401 ? { loginUrl: '/api/auth/login' } : undefined;
    return c.json(
      apiErrorBody(new ApiError(status, error.code, error.message, details)),
      status as ContentfulStatusCode,
    );
  }
  console.error('[mise] unhandled error', error);
  return c.json(
    apiErrorBody(new ApiError(500, 'INTERNAL', 'Something went wrong on the server. Please try again.')),
    500,
  );
});

export default app;
