import type { BootstrapPayload, SaveResponse } from '../../shared/types';

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

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('X-Mise-CSRF', '1');
  headers.set('Accept', 'application/json');
  if (init.body) headers.set('Content-Type', 'application/json');

  let response: Response;
  try {
    response = await fetch(path, {
      credentials: 'same-origin',
      ...init,
      headers,
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Could not reach the server. Check your connection and try again.');
  }

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
    const errorBody = body as { error?: { code?: string; message?: string; details?: unknown } } | null;
    throw new ApiError(
      response.status,
      errorBody?.error?.code ?? 'HTTP_ERROR',
      errorBody?.error?.message ?? `Request failed with status ${response.status}.`,
      errorBody?.error?.details,
    );
  }

  return body as T;
}

export type DatasetKey = 'recipes' | 'plans' | 'lists';

export const api = {
  bootstrap(): Promise<BootstrapPayload> {
    return request<BootstrapPayload>('/api/bootstrap');
  },

  save(
    kind: DatasetKey,
    items: BootstrapPayload['data'][DatasetKey]['items'],
    sha: string | null,
  ): Promise<SaveResponse> {
    return request<SaveResponse>(`/api/${kind}`, {
      method: 'PUT',
      body: JSON.stringify({ items, sha }),
    });
  },

  connectRepo(fullName: string) {
    return request<{ repo: BootstrapPayload['repo']; demo: boolean }>('/api/repo/use', {
      method: 'POST',
      body: JSON.stringify({ fullName }),
    });
  },

  createRepo(input: { name?: string; private?: boolean }) {
    return request<{ repo: BootstrapPayload['repo']; demo: boolean; seeded: boolean }>('/api/repo/init', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  seedRepo() {
    return request<{ repo: BootstrapPayload['repo']; demo: boolean; seeded: boolean }>('/api/repo/seed', {
      method: 'POST',
      body: JSON.stringify({}),
    });
  },

  logout() {
    return request<{ ok: boolean }>('/api/auth/logout', { method: 'POST', body: JSON.stringify({}) });
  },
};
