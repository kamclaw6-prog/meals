import type { RepoInfo, RepoRef, SessionUser } from '../shared/types';
import { ApiError } from './env';

const API = 'https://api.github.com';
const USER_AGENT = 'mise-meal-planner';

interface GitHubRepoResponse {
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  default_branch: string;
  owner: { login: string };
  permissions?: { push?: boolean; admin?: boolean; maintain?: boolean };
}

interface GitHubFileResponse {
  content?: string;
  encoding?: string;
  sha: string;
  html_url?: string;
}

interface GitHubContentResponse {
  sha: string;
  content?: { sha: string };
}

interface GitHubUserResponse {
  login: string;
  name: string | null;
  avatar_url: string;
  html_url: string;
}

interface GitHubErrorResponse {
  message?: string;
  documentation_url?: string;
}

export interface FilePayload {
  text: string;
  sha: string;
  htmlUrl?: string;
}

export interface RepoLookup {
  info: RepoInfo | null;
}

export class GitHubError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'GitHubError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function request<T>(
  token: string,
  path: string,
  init: RequestInit = {},
): Promise<{ data: T; status: number; headers: Headers }> {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('Accept', 'application/vnd.github+json');
  headers.set('X-GitHub-Api-Version', '2022-11-28');
  headers.set('User-Agent', USER_AGENT);
  if (init.body) headers.set('Content-Type', 'application/json');

  const response = await fetch(`${API}${path}`, { ...init, headers });
  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }

  if (!response.ok) {
    const message = (body as GitHubErrorResponse | null)?.message ?? response.statusText;
    if (response.status === 401) {
      throw new GitHubError(401, 'GITHUB_AUTH', 'Your GitHub session expired. Sign in again.');
    }
    if (response.status === 403) {
      const remaining = response.headers.get('x-ratelimit-remaining');
      if (remaining === '0') {
        const reset = Number(response.headers.get('x-ratelimit-reset') ?? 0) * 1000;
        const when = reset > 0 ? new Date(reset).toLocaleTimeString('en-US') : 'soon';
        throw new GitHubError(
          429,
          'GITHUB_RATE_LIMIT',
          `GitHub's API rate limit was reached. Try again after ${when}.`,
        );
      }
      throw new GitHubError(
        403,
        'GITHUB_FORBIDDEN',
        'GitHub refused that request. The GitHub App token may not have access to this repository.',
      );
    }
    if (response.status === 404) {
      throw new GitHubError(404, 'GITHUB_NOT_FOUND', 'That GitHub resource was not found.');
    }
    if (response.status === 409 || response.status === 422) {
      throw new GitHubError(
        409,
        'GITHUB_CONFLICT',
        message || 'GitHub could not apply that change.',
      );
    }
    throw new GitHubError(502, 'GITHUB_ERROR', message || 'GitHub returned an unexpected error.');
  }

  return { data: body as T, status: response.status, headers: response.headers };
}

export async function getAuthenticatedUser(token: string): Promise<SessionUser> {
  const { data } = await request<GitHubUserResponse>(token, '/user');
  return {
    login: data.login,
    name: data.name || data.login,
    avatarUrl: data.avatar_url,
    htmlUrl: data.html_url,
  };
}

function toRepoInfo(data: GitHubRepoResponse): RepoInfo {
  return {
    owner: data.owner.login,
    name: data.name,
    fullName: data.full_name,
    branch: data.default_branch || 'main',
    private: data.private,
    htmlUrl: data.html_url,
    exists: true,
    canWrite: Boolean(data.permissions?.push || data.permissions?.admin || data.permissions?.maintain),
  };
}

function parseFullName(fullName: string): RepoRef {
  const parts = fullName.split('/');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new ApiError(422, 'INVALID_REPO', 'Use the owner/name format, for example octocat/meal-planner-data.');
  }
  if (!/^[A-Za-z0-9._-]+$/.test(parts[0]) || !/^[A-Za-z0-9._-]+$/.test(parts[1])) {
    throw new ApiError(422, 'INVALID_REPO', 'That repository name contains unsupported characters.');
  }
  return { owner: parts[0], name: parts[1], branch: 'main' };
}

export async function getRepo(token: string, fullName: string): Promise<RepoInfo | null> {
  const ref = parseFullName(fullName);
  try {
    const { data } = await request<GitHubRepoResponse>(token, `/repos/${ref.owner}/${ref.name}`);
    return toRepoInfo(data);
  } catch (error) {
    if (error instanceof GitHubError && error.status === 404) return null;
    throw error;
  }
}

export async function createRepo(
  token: string,
  input: { name: string; private: boolean; description?: string },
): Promise<RepoInfo> {
  if (!/^[A-Za-z0-9._-]{1,100}$/.test(input.name)) {
    throw new ApiError(422, 'INVALID_REPO_NAME', 'Repository names may only contain letters, numbers, dots, dashes and underscores.');
  }
  try {
    const { data } = await request<GitHubRepoResponse>(token, '/user/repos', {
      method: 'POST',
      body: JSON.stringify({
        name: input.name,
        private: input.private,
        auto_init: true,
        description: input.description ?? 'Meal plans, recipes and grocery lists for Mise.',
      }),
    });
    return toRepoInfo(data);
  } catch (error) {
    if (error instanceof GitHubError && error.status === 409) {
      throw new ApiError(409, 'REPO_EXISTS', 'A repository with that name already exists.');
    }
    throw error;
  }
}

export async function getFile(
  token: string,
  repo: RepoRef,
  path: string,
  branch: string,
): Promise<FilePayload | null> {
  try {
    const { data } = await request<GitHubFileResponse | GitHubFileResponse[]>(
      token,
      `/repos/${repo.owner}/${repo.name}/contents/${encodeURI(path)}?ref=${encodeURIComponent(branch)}`,
    );
    if (Array.isArray(data) || !data.sha) {
      throw new GitHubError(502, 'GITHUB_ERROR', 'Expected a file but found a directory.');
    }
    const content = data.content && data.encoding === 'base64' ? decodeBase64Utf8(data.content) : '';
    return { text: content, sha: data.sha, htmlUrl: data.html_url };
  } catch (error) {
    if (error instanceof GitHubError && error.status === 404) return null;
    throw error;
  }
}

export async function putFile(
  token: string,
  repo: RepoRef,
  path: string,
  text: string,
  options: { sha?: string | null; message: string; branch: string },
): Promise<{ sha: string }> {
  const body: Record<string, unknown> = {
    message: options.message,
    content: encodeBase64Utf8(text),
    branch: options.branch,
  };
  if (options.sha) body.sha = options.sha;

  try {
    const { data } = await request<GitHubContentResponse>(
      token,
      `/repos/${repo.owner}/${repo.name}/contents/${encodeURI(path)}`,
      { method: 'PUT', body: JSON.stringify(body) },
    );
    const sha = data.content?.sha ?? data.sha;
    if (!sha) throw new GitHubError(502, 'GITHUB_ERROR', 'GitHub did not return a commit for the write.');
    return { sha };
  } catch (error) {
    if (error instanceof GitHubError && error.status === 409) {
      throw new ApiError(
        409,
        'CONFLICT',
        'This data changed elsewhere while you were editing. Reload to get the latest version.',
      );
    }
    throw error;
  }
}

export async function deleteFile(
  token: string,
  repo: RepoRef,
  path: string,
  sha: string,
  message: string,
  branch: string,
): Promise<void> {
  await request(token, `/repos/${repo.owner}/${repo.name}/contents/${encodeURI(path)}`, {
    method: 'DELETE',
    body: JSON.stringify({ message, sha, branch }),
  });
}

function encodeBase64Utf8(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function decodeBase64Utf8(value: string): string {
  const binary = atob(value.replace(/\s/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export const __testing = { encodeBase64Utf8, decodeBase64Utf8, parseFullName };
