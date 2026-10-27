#!/usr/bin/env node
/**
 * End-to-end smoke test against a running Mise Worker in demo mode.
 *
 *   npm run dev:worker           # terminal 1
 *   npm run smoke                # terminal 2
 *
 * Override the target with MISE_URL=https://your-deployment.example.
 */

const base = (process.env.MISE_URL ?? 'http://127.0.0.1:8787').replace(/\/$/, '');
const csrf = { 'X-Mise-CSRF': '1' };

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function check(name, run) {
  try {
    await run();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failed += 1;
    const message = error instanceof Error ? error.message : String(error);
    console.error(`  ✗ ${name}\n      ${message}`);
  }
}

async function json(path, init) {
  const response = await fetch(`${base}${path}`, init);
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  return { response, body, text };
}

async function bootstrap() {
  const { response, body } = await json('/api/bootstrap');
  assert(response.status === 200, `bootstrap returned ${response.status}`);
  return body;
}

function saveHeaders() {
  return { ...csrf, 'Content-Type': 'application/json' };
}

console.log(`\nMise smoke test → ${base}\n`);

await check('health endpoint reports demo mode', async () => {
  const { response, body } = await json('/api/health');
  assert(response.status === 200, `status ${response.status}`);
  assert(body.ok === true, 'expected ok:true');
  assert(body.demo === true, 'expected demo mode to be enabled');
});

await check('serves the single-page app shell', async () => {
  const response = await fetch(`${base}/`);
  const html = await response.text();
  assert(response.status === 200, `status ${response.status}`);
  assert(html.includes('<div id="root">'), 'missing React root');
  assert(html.includes('Mise'), 'missing Mise title');
});

await check('falls back to the SPA for deep links', async () => {
  const response = await fetch(`${base}/recipes/r_miso_salmon`);
  const html = await response.text();
  assert(response.status === 200, `status ${response.status}`);
  assert(html.includes('<div id="root">'), 'deep link did not return the app shell');
});

await check('serves static assets', async () => {
  const response = await fetch(`${base}/favicon.svg`);
  const text = await response.text();
  assert(response.status === 200, `status ${response.status}`);
  assert(text.includes('<svg'), 'favicon is not an SVG');
});

await check('bootstrap returns the seeded demo kitchen', async () => {
  const body = await bootstrap();
  assert(body.demo === true, 'expected demo:true');
  assert(body.user?.login === 'mise-demo', `unexpected user ${body.user?.login}`);
  assert(body.repo?.exists === true, 'demo repo should exist');
  assert(Array.isArray(body.data.recipes.items) && body.data.recipes.items.length >= 10, 'expected seeded recipes');
  assert(body.data.recipes.sha, 'expected a recipe sha');
  assert(Array.isArray(body.data.plans.items) && body.data.plans.items.length >= 1, 'expected a seeded plan');
  assert(Array.isArray(body.data.lists.items) && body.data.lists.items.length >= 1, 'expected a seeded list');
});

await check('rejects writes without the CSRF header', async () => {
  const { response, body } = await json('/api/recipes', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: [], sha: null }),
  });
  assert(response.status === 403, `expected 403, got ${response.status}`);
  assert(body?.error?.code === 'CSRF', `expected CSRF error, got ${body?.error?.code}`);
});

await check('creates a recipe, persists it, and deletes it again', async () => {
  const before = await bootstrap();
  const recipeSha = before.data.recipes.sha;
  const now = new Date().toISOString();
  const temp = {
    id: 'r_smoke_test',
    title: 'Smoke test soup',
    description: 'Created by scripts/smoke.mjs',
    servings: 2,
    prepMinutes: 5,
    cookMinutes: 15,
    tags: ['dinner', 'quick'],
    ingredients: [
      { id: 'i_smoke_water', name: 'Water', quantity: 2, unit: 'cup', category: 'pantry' },
      { id: 'i_smoke_salt', name: 'Salt', quantity: null, category: 'pantry' },
    ],
    steps: ['Boil the water.', 'Season and serve.'],
    createdAt: now,
    updatedAt: now,
  };
  const saved = await json('/api/recipes', {
    method: 'PUT',
    headers: saveHeaders(),
    body: JSON.stringify({ items: [...before.data.recipes.items, temp], sha: recipeSha }),
  });
  assert(saved.response.status === 200, `save failed: ${saved.response.status} ${saved.text}`);
  assert(saved.body?.sha && saved.body.sha !== recipeSha, 'expected a new sha');

  const after = await bootstrap();
  assert(after.data.recipes.items.some((item) => item.id === temp.id), 'recipe was not persisted');
  assert(after.data.recipes.sha === saved.body.sha, 'bootstrap sha does not match the save');

  const removed = await json('/api/recipes', {
    method: 'PUT',
    headers: saveHeaders(),
    body: JSON.stringify({ items: before.data.recipes.items, sha: saved.body.sha }),
  });
  assert(removed.response.status === 200, `delete failed: ${removed.response.status} ${removed.text}`);

  const cleaned = await bootstrap();
  assert(!cleaned.data.recipes.items.some((item) => item.id === temp.id), 'recipe was not removed');
});

await check('rejects a planned meal with an unknown recipe', async () => {
  const body = await bootstrap();
  const plan = body.data.plans.items[0];
  assert(plan, 'expected a seeded plan');
  const broken = {
    ...plan,
    meals: [
      ...plan.meals,
      { id: 'm_smoke_missing', date: plan.weekStart, slot: 'dinner', recipeId: 'r_missing', servings: 2 },
    ],
  };
  const result = await json('/api/plans', {
    method: 'PUT',
    headers: saveHeaders(),
    body: JSON.stringify({ items: [broken, ...body.data.plans.items.slice(1)], sha: body.data.plans.sha }),
  });
  assert(result.response.status === 422, `expected 422, got ${result.response.status}`);
  assert(result.body?.error?.code === 'UNKNOWN_RECIPE', `unexpected error ${result.body?.error?.code}`);
});

await check('toggles a grocery item and restores it', async () => {
  const before = await bootstrap();
  const list = before.data.lists.items.find((item) => item.items.length > 0);
  assert(list, 'expected a grocery list with items');
  const first = list.items[0];
  const toggled = {
    ...list,
    items: list.items.map((item) => (item.id === first.id ? { ...item, checked: !item.checked } : item)),
  };
  const lists = before.data.lists.items.map((item) => (item.id === list.id ? toggled : item));

  const saved = await json('/api/lists', {
    method: 'PUT',
    headers: saveHeaders(),
    body: JSON.stringify({ items: lists, sha: before.data.lists.sha }),
  });
  assert(saved.response.status === 200, `toggle failed: ${saved.response.status} ${saved.text}`);

  const after = await bootstrap();
  const savedList = after.data.lists.items.find((item) => item.id === list.id);
  assert(savedList?.items.find((item) => item.id === first.id)?.checked === !first.checked, 'checked state not saved');

  const restored = await json('/api/lists', {
    method: 'PUT',
    headers: saveHeaders(),
    body: JSON.stringify({ items: before.data.lists.items, sha: after.data.lists.sha }),
  });
  assert(restored.response.status === 200, `restore failed: ${restored.response.status} ${restored.text}`);
});

await check('demo login redirects straight into the app', async () => {
  const response = await fetch(`${base}/api/auth/login`, { redirect: 'manual' });
  assert([302, 303, 307].includes(response.status), `expected a redirect, got ${response.status}`);
  assert(response.headers.get('location') === '/', `unexpected location ${response.headers.get('location')}`);
});

await check('returns JSON 404s for unknown API routes', async () => {
  const { response, body } = await json('/api/not-a-route');
  assert(response.status === 404, `expected 404, got ${response.status}`);
  assert(body?.error?.code === 'NOT_FOUND', 'expected NOT_FOUND');
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exitCode = 1;
