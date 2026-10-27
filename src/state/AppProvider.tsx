import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import type {
  BootstrapPayload,
  GroceryList,
  MealPlan,
  Recipe,
  RepoInfo,
  SessionUser,
} from '../../shared/types';
import { ApiError, api } from '../lib/api';
import type { DatasetKey } from '../lib/api';
import { useToast } from './ToastProvider';

type Data = BootstrapPayload['data'];
type DatasetItems<K extends DatasetKey> = Data[K]['items'];
type AppStatus = 'loading' | 'ready' | 'unauth' | 'error';

interface AppContextValue {
  status: AppStatus;
  errorMessage: string | null;
  user: SessionUser | null;
  repo: RepoInfo | null;
  demo: boolean;
  recipes: Recipe[];
  plans: MealPlan[];
  lists: GroceryList[];
  pending: number;
  lastSavedAt: string | null;
  firstRunEmpty: boolean;
  refresh: () => Promise<void>;
  commitRecipes: (updater: (recipes: Recipe[]) => Recipe[]) => void;
  commitPlans: (updater: (plans: MealPlan[]) => MealPlan[]) => void;
  commitLists: (updater: (lists: GroceryList[]) => GroceryList[]) => void;
  createDataRepo: (input: { name?: string; private?: boolean }) => Promise<void>;
  connectRepo: (fullName: string) => Promise<void>;
  seedStarterData: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

const emptyData: Data = {
  recipes: { items: [], sha: null },
  plans: { items: [], sha: null },
  lists: { items: [], sha: null },
};

function itemsFor<K extends DatasetKey>(data: Data, kind: K): DatasetItems<K> {
  return data[kind].items as DatasetItems<K>;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [status, setStatus] = useState<AppStatus>('loading');
  const [payload, setPayload] = useState<BootstrapPayload | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(0);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  const dataRef = useRef<Data>(emptyData);
  const shaRef = useRef<Record<DatasetKey, string | null>>({ recipes: null, plans: null, lists: null });
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const pendingRef = useRef(0);
  const needsRefreshRef = useRef(false);
  const statusRef = useRef<AppStatus>('loading');
  const toastRef = useRef(toast);

  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  const applyPayload = useCallback((next: BootstrapPayload) => {
    dataRef.current = next.data;
    shaRef.current = {
      recipes: next.data.recipes.sha,
      plans: next.data.plans.sha,
      lists: next.data.lists.sha,
    };
    setPayload(next);
    setStatus('ready');
    statusRef.current = 'ready';
    setErrorMessage(null);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const next = await api.bootstrap();
      applyPayload(next);
      setLastSavedAt(new Date().toISOString());
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.code === 'UNAUTHENTICATED')) {
        setPayload(null);
        setStatus('unauth');
        statusRef.current = 'unauth';
        return;
      }
      const message =
        error instanceof ApiError ? error.message : 'Could not load your meal planner. Please try again.';
      setErrorMessage(message);
      setStatus('error');
      statusRef.current = 'error';
    }
  }, [applyPayload]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const commit = useCallback(
    <K extends DatasetKey>(kind: K, updater: (items: DatasetItems<K>) => DatasetItems<K>) => {
      if (statusRef.current !== 'ready') return;

      const current = itemsFor(dataRef.current, kind);
      const nextItems = updater(current);
      if (nextItems === current) return;

      const nextData: Data = {
        ...dataRef.current,
        [kind]: { ...dataRef.current[kind], items: nextItems },
      };
      dataRef.current = nextData;
      setPayload((previous) => (previous ? { ...previous, data: nextData } : previous));

      pendingRef.current += 1;
      setPending(pendingRef.current);

      queueRef.current = queueRef.current.then(async () => {
        try {
          const saved = await api.save(kind, nextItems, shaRef.current[kind]);
          shaRef.current[kind] = saved.sha;
          setLastSavedAt(saved.updatedAt);
        } catch (error) {
          if (error instanceof ApiError && error.status === 401) {
            setPayload(null);
            setStatus('unauth');
            statusRef.current = 'unauth';
            return;
          }
          const message =
            error instanceof ApiError ? error.message : 'Saving to GitHub failed. Please try again.';
          toastRef.current(message, 'error');
          needsRefreshRef.current = true;
        } finally {
          pendingRef.current = Math.max(0, pendingRef.current - 1);
          setPending(pendingRef.current);
          if (pendingRef.current === 0 && needsRefreshRef.current) {
            needsRefreshRef.current = false;
            void refresh();
          }
        }
      });
    },
    [refresh],
  );

  const commitRecipes = useCallback(
    (updater: (recipes: Recipe[]) => Recipe[]) => commit('recipes', updater),
    [commit],
  );
  const commitPlans = useCallback(
    (updater: (plans: MealPlan[]) => MealPlan[]) => commit('plans', updater),
    [commit],
  );
  const commitLists = useCallback(
    (updater: (lists: GroceryList[]) => GroceryList[]) => commit('lists', updater),
    [commit],
  );

  const createDataRepo = useCallback(
    async (input: { name?: string; private?: boolean }) => {
      await api.createRepo(input);
      await refresh();
      toastRef.current('Your GitHub data repository is ready.', 'success');
    },
    [refresh],
  );

  const connectRepo = useCallback(
    async (fullName: string) => {
      await api.connectRepo(fullName);
      await refresh();
      toastRef.current(`Connected to ${fullName}.`, 'success');
    },
    [refresh],
  );

  const seedStarterData = useCallback(async () => {
    await api.seedRepo();
    await refresh();
    toastRef.current('Added a starter recipe box and this week’s plan.', 'success');
  }, [refresh]);

  const signOut = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // Clearing the local session state matters more than the API call.
    }
    setPayload(null);
    setStatus('unauth');
    statusRef.current = 'unauth';
  }, []);

  const value = useMemo<AppContextValue>(() => {
    const data = payload?.data ?? emptyData;
    return {
      status,
      errorMessage,
      user: payload?.user ?? null,
      repo: payload?.repo ?? null,
      demo: payload?.demo ?? false,
      recipes: data.recipes.items,
      plans: data.plans.items,
      lists: data.lists.items,
      pending,
      lastSavedAt,
      firstRunEmpty: Boolean(payload && data.recipes.items.length === 0 && data.recipes.sha === null),
      refresh,
      commitRecipes,
      commitPlans,
      commitLists,
      createDataRepo,
      connectRepo,
      seedStarterData,
      signOut,
    };
  }, [
    status,
    errorMessage,
    payload,
    pending,
    lastSavedAt,
    refresh,
    commitRecipes,
    commitPlans,
    commitLists,
    createDataRepo,
    connectRepo,
    seedStarterData,
    signOut,
  ]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used inside AppProvider');
  return context;
}
