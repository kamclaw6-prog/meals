import type { GroceryList, MealPlan, Recipe, RepoInfo, RepoRef, SaveResponse } from '../shared/types';
import { DATA_PATHS } from '../shared/types';
import { ApiError, isDemo } from './env';
import type { Env, Session } from './env';
import { getFile, getRepo, putFile } from './github';

export interface StoreContext {
  demo: boolean;
  store: DataStore;
  repo: RepoInfo;
}

export interface ReadResult {
  data: unknown;
  sha: string | null;
}

export interface DataStore {
  demo: boolean;
  repo: RepoInfo;
  read(path: string): Promise<ReadResult>;
  write(path: string, value: unknown, sha: string | null, message: string): Promise<SaveResponse>;
  invalidate(path?: string): void;
}

// File reads are memoized briefly so a single page load does not burn API quota.
const FILE_TTL_MS = 8_000;
const REPO_TTL_MS = 20_000;

interface CacheEntry {
  expires: number;
  value: ReadResult;
}

const fileCache = new Map<string, CacheEntry>();
const repoCache = new Map<string, { expires: number; info: RepoInfo | null }>();

function cacheKey(repo: RepoRef, branch: string, path: string): string {
  return `${repo.owner}/${repo.name}@${branch}:${path}`;
}

export class GitHubStore implements DataStore {
  demo = false;
  token: string;
  repo: RepoInfo;
  branch: string;

  constructor(token: string, repo: RepoInfo) {
    this.token = token;
    this.repo = repo;
    this.branch = repo.branch;
  }

  async read(path: string): Promise<ReadResult> {
    const key = cacheKey(this.repo, this.branch, path);
    const cached = fileCache.get(key);
    if (cached && cached.expires > Date.now()) return cached.value;

    const file = await getFile(this.token, this.repo, path, this.branch);
    if (!file) {
      const empty = { data: null, sha: null };
      fileCache.set(key, { expires: Date.now() + FILE_TTL_MS, value: empty });
      return empty;
    }

    let data: unknown = null;
    try {
      data = JSON.parse(file.text || 'null');
    } catch {
      throw new ApiError(
        502,
        'DATA_CORRUPT',
        `The file ${path} in ${this.repo.fullName} is not valid JSON. Fix it in GitHub and reload.`,
      );
    }

    const value = { data, sha: file.sha };
    fileCache.set(key, { expires: Date.now() + FILE_TTL_MS, value });
    return value;
  }

  async write(path: string, value: unknown, sha: string | null, message: string): Promise<SaveResponse> {
    const text = `${JSON.stringify(value, null, 2)}\n`;
    const result = await putFile(this.token, this.repo, path, text, {
      sha,
      message,
      branch: this.branch,
    });
    this.invalidate(path);
    return { sha: result.sha, updatedAt: new Date().toISOString() };
  }

  invalidate(path?: string): void {
    if (!path) {
      for (const key of fileCache.keys()) {
        if (key.startsWith(`${this.repo.fullName}@${this.branch}:`)) fileCache.delete(key);
      }
      return;
    }
    fileCache.delete(cacheKey(this.repo, this.branch, path));
  }
}

interface MemoryFile {
  value: unknown;
  sha: string;
}

export class MemoryStore implements DataStore {
  demo = true;
  repo: RepoInfo;
  private files = new Map<string, MemoryFile>();
  private version = 0;

  constructor(repo: RepoInfo, initial: Record<string, unknown>) {
    this.repo = repo;
    for (const [path, value] of Object.entries(initial)) {
      this.files.set(path, { value: structuredClone(value), sha: this.nextSha() });
    }
  }

  private nextSha(): string {
    this.version += 1;
    return `demo${String(this.version).padStart(36, '0')}`;
  }

  async read(path: string): Promise<ReadResult> {
    const file = this.files.get(path);
    if (!file) return { data: null, sha: null };
    return { data: structuredClone(file.value), sha: file.sha };
  }

  async write(path: string, value: unknown, _sha: string | null, _message: string): Promise<SaveResponse> {
    const sha = this.nextSha();
    this.files.set(path, { value: structuredClone(value), sha });
    return { sha, updatedAt: new Date().toISOString() };
  }

  invalidate(): void {
    // Nothing cached outside the map.
  }
}

let demoStore: MemoryStore | null = null;

async function buildDemoStore(): Promise<MemoryStore> {
  const { demoSeed } = await import('./seed');
  const seed = demoSeed();
  return new MemoryStore(
    {
      owner: 'mise-demo',
      name: 'meal-planner-data',
      fullName: 'mise-demo/meal-planner-data',
      branch: 'main',
      private: true,
      htmlUrl: 'https://github.com',
      exists: true,
      canWrite: true,
    },
    {
      [DATA_PATHS.recipes]: recipesFile(seed.recipes),
      [DATA_PATHS.plans]: plansFile(seed.plans),
      [DATA_PATHS.lists]: listsFile(seed.lists),
    },
  );
}

export async function getDemoStore(): Promise<MemoryStore> {
  if (!demoStore) demoStore = await buildDemoStore();
  return demoStore;
}

export function resetDemoStore(): void {
  demoStore = null;
}

async function repoInfoCached(token: string, fullName: string): Promise<RepoInfo | null> {
  const cached = repoCache.get(fullName);
  if (cached && cached.expires > Date.now()) return cached.info;
  const info = await getRepo(token, fullName);
  repoCache.set(fullName, { expires: Date.now() + REPO_TTL_MS, info });
  return info;
}

export function invalidateRepoCache(fullName: string): void {
  repoCache.delete(fullName);
}

export async function resolveStore(
  env: Pick<Env, 'DEMO_MODE'>,
  session: Session,
): Promise<StoreContext> {
  if (isDemo(env)) {
    const store = await getDemoStore();
    return { demo: true, store, repo: store.repo };
  }

  const fullName = `${session.repo.owner}/${session.repo.name}`;
  const info = await repoInfoCached(session.token, fullName);

  if (!info) {
    const missing: RepoInfo = {
      ...session.repo,
      fullName,
      private: false,
      htmlUrl: `https://github.com/${fullName}`,
      exists: false,
      canWrite: false,
    };
    return { demo: false, store: new GitHubStore(session.token, missing), repo: missing };
  }

  const store = new GitHubStore(session.token, info);
  return { demo: false, store, repo: info };
}

export function recipesFile(recipes: Recipe[]) {
  return { version: 1, recipes };
}

export function plansFile(plans: MealPlan[]) {
  return { version: 1, plans };
}

export function listsFile(lists: GroceryList[]) {
  return { version: 1, lists };
}

export function parseRecipesFile(data: unknown): Recipe[] {
  if (data === null) return [];
  if (typeof data !== 'object' || !Array.isArray((data as { recipes?: unknown }).recipes)) {
    throw new ApiError(502, 'DATA_CORRUPT', 'The recipes file is missing its "recipes" array.');
  }
  return (data as { recipes: Recipe[] }).recipes;
}

export function parsePlansFile(data: unknown): MealPlan[] {
  if (data === null) return [];
  if (typeof data !== 'object' || !Array.isArray((data as { plans?: unknown }).plans)) {
    throw new ApiError(502, 'DATA_CORRUPT', 'The plans file is missing its "plans" array.');
  }
  return (data as { plans: MealPlan[] }).plans;
}

export function parseListsFile(data: unknown): GroceryList[] {
  if (data === null) return [];
  if (typeof data !== 'object' || !Array.isArray((data as { lists?: unknown }).lists)) {
    throw new ApiError(502, 'DATA_CORRUPT', 'The grocery lists file is missing its "lists" array.');
  }
  return (data as { lists: GroceryList[] }).lists;
}
