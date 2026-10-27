/** Core domain types shared by the Worker API and the React app. */

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export const MEAL_SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;

export const MEAL_SLOT_LABEL: Record<MealSlot, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
};

export const GROCERY_CATEGORIES = [
  'produce',
  'meat',
  'seafood',
  'dairy',
  'bakery',
  'pantry',
  'frozen',
  'drinks',
  'household',
  'other',
] as const;

export type GroceryCategory = (typeof GROCERY_CATEGORIES)[number];

export const CATEGORY_LABEL: Record<GroceryCategory, string> = {
  produce: 'Produce',
  meat: 'Meat & poultry',
  seafood: 'Seafood',
  dairy: 'Dairy & eggs',
  bakery: 'Bakery',
  pantry: 'Pantry',
  frozen: 'Frozen',
  drinks: 'Drinks',
  household: 'Household',
  other: 'Other',
};

export interface Ingredient {
  id: string;
  name: string;
  /** Numeric amount. Null or omitted means "to taste" / unmeasured. */
  quantity?: number | null;
  unit?: string;
  category?: GroceryCategory;
  note?: string;
}

export interface Recipe {
  id: string;
  title: string;
  description?: string;
  servings: number;
  prepMinutes?: number;
  cookMinutes?: number;
  tags: string[];
  ingredients: Ingredient[];
  steps: string[];
  notes?: string;
  /** Optional image URL (https). */
  image?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Meal {
  id: string;
  /** YYYY-MM-DD, local calendar date. */
  date: string;
  slot: MealSlot;
  recipeId: string;
  servings: number;
  note?: string;
}

export interface MealPlan {
  /** The Monday of the week, YYYY-MM-DD. */
  id: string;
  weekStart: string;
  meals: Meal[];
  updatedAt: string;
}

export type GroceryItemSource = 'plan' | 'manual';

export interface GroceryItem {
  id: string;
  /** Stable matching key derived from normalized name + unit. */
  key: string;
  name: string;
  quantity?: number | null;
  unit?: string;
  category: GroceryCategory;
  note?: string;
  checked: boolean;
  source: GroceryItemSource;
  recipeIds?: string[];
}

export interface GroceryList {
  id: string;
  name: string;
  weekStart?: string;
  items: GroceryItem[];
  createdAt: string;
  updatedAt: string;
}

export interface RecipesFile {
  version: 1;
  recipes: Recipe[];
}

export interface PlansFile {
  version: 1;
  plans: MealPlan[];
}

export interface ListsFile {
  version: 1;
  lists: GroceryList[];
}

/* ------------------------------------------------------------------ */
/* API contracts                                                       */
/* ------------------------------------------------------------------ */

export interface SessionUser {
  login: string;
  name: string;
  avatarUrl: string;
  htmlUrl: string;
}

export interface RepoRef {
  owner: string;
  name: string;
  branch: string;
}

export interface RepoInfo extends RepoRef {
  fullName: string;
  private: boolean;
  htmlUrl: string;
  exists: boolean;
  canWrite: boolean;
}

export interface Dataset<T> {
  items: T[];
  sha: string | null;
}

export interface BootstrapPayload {
  user: SessionUser;
  demo: boolean;
  repo: RepoInfo;
  data: {
    recipes: Dataset<Recipe>;
    plans: Dataset<MealPlan>;
    lists: Dataset<GroceryList>;
  };
}

export interface SaveResponse {
  sha: string;
  updatedAt: string;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface RepoStatusPayload {
  repo: RepoInfo;
  demo: boolean;
}

export const DATA_PATHS = {
  recipes: 'data/recipes.json',
  plans: 'data/plans.json',
  lists: 'data/lists.json',
} as const;

export const DEFAULT_DATA_REPO = 'meal-planner-data';
export const DEFAULT_DATA_BRANCH = 'main';
