import type { GroceryCategory, GroceryItem, GroceryList, Recipe } from './types';
import { CATEGORY_LABEL, GROCERY_CATEGORIES } from './types';
import { formatAmount, inferCategory, ingredientKey, normalizeName, normalizeUnit, scaleQuantity } from './units';

export interface RecipeServing {
  recipe: Recipe;
  /** How many servings to shop for. */
  servings: number;
}

export function stableId(prefix: string, key: string): string {
  // FNV-1a, 32 bit. Short, deterministic ids keep grocery items stable across regenerations.
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${prefix}_${(hash >>> 0).toString(36)}`;
}

function categoryRank(category: GroceryCategory): number {
  return GROCERY_CATEGORIES.indexOf(category);
}

export function sortGroceryItems(items: GroceryItem[]): GroceryItem[] {
  return [...items].sort((a, b) => {
    const category = categoryRank(a.category) - categoryRank(b.category);
    if (category !== 0) return category;
    return a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });
  });
}

/**
 * Aggregate the ingredients for a set of planned meals into grocery items.
 * Items merge when normalized name + unit match; quantities add up.
 */
export function buildGroceryItems(entries: RecipeServing[]): GroceryItem[] {
  const items = new Map<string, GroceryItem>();

  for (const entry of entries) {
    const factor = entry.recipe.servings > 0 ? entry.servings / entry.recipe.servings : 1;
    for (const ingredient of entry.recipe.ingredients) {
      if (!ingredient.name.trim()) continue;
      const key = ingredientKey(ingredient.name, ingredient.unit);
      const quantity = scaleQuantity(ingredient.quantity, factor);
      const category = ingredient.category ?? inferCategory(ingredient.name);
      const existing = items.get(key);

      if (!existing) {
        items.set(key, {
          id: stableId('plan', key),
          key,
          name: ingredient.name.trim(),
          quantity,
          unit: normalizeUnit(ingredient.unit) || undefined,
          category,
          note: ingredient.note?.trim() || undefined,
          checked: false,
          source: 'plan',
          recipeIds: [entry.recipe.id],
        });
        continue;
      }

      if (quantity !== null) {
        existing.quantity =
          existing.quantity === null || existing.quantity === undefined
            ? quantity
            : Math.round((existing.quantity + quantity) * 100) / 100;
      }
      if (existing.category === 'other' && category !== 'other') existing.category = category;
      existing.recipeIds = Array.from(new Set([...(existing.recipeIds ?? []), entry.recipe.id]));
      existing.note = existing.note || ingredient.note?.trim() || undefined;
    }
  }

  return sortGroceryItems(Array.from(items.values()));
}

/**
 * Fold freshly generated items into a list without losing checked state or
 * manual items. Unchecked plan items that are no longer needed are dropped;
 * checked plan items stick around until the user clears them.
 */
export function mergeGroceryItems(existing: GroceryItem[], generated: GroceryItem[]): GroceryItem[] {
  const byKey = new Map(existing.map((item) => [item.key, item]));
  const seen = new Set<string>();
  const result: GroceryItem[] = [];

  for (const item of generated) {
    seen.add(item.key);
    const previous = byKey.get(item.key);

    if (!previous) {
      result.push(item);
      continue;
    }

    if (previous.source === 'manual') {
      result.push(previous);
      continue;
    }

    result.push({
      ...previous,
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      category: previous.category === 'other' ? item.category : previous.category,
      note: item.note ?? previous.note,
      recipeIds: item.recipeIds,
    });
  }

  for (const item of existing) {
    if (seen.has(item.key)) continue;
    if (item.source === 'manual' || item.checked) result.push(item);
  }

  return sortGroceryItems(result);
}

export function groceryStats(list: GroceryList | undefined): {
  total: number;
  checked: number;
  remaining: number;
  percent: number;
} {
  if (!list || list.items.length === 0) return { total: 0, checked: 0, remaining: 0, percent: 0 };
  const total = list.items.length;
  const checked = list.items.filter((item) => item.checked).length;
  return {
    total,
    checked,
    remaining: total - checked,
    percent: Math.round((checked / total) * 100),
  };
}

export interface GroceryGroup {
  category: GroceryCategory;
  label: string;
  items: GroceryItem[];
}

export function groupGroceryItems(items: GroceryItem[]): GroceryGroup[] {
  const groups = new Map<GroceryCategory, GroceryItem[]>();
  for (const item of sortGroceryItems(items)) {
    const group = groups.get(item.category) ?? [];
    group.push(item);
    groups.set(item.category, group);
  }
  return Array.from(groups.entries()).map(([category, groupItems]) => ({
    category,
    label: CATEGORY_LABEL[category],
    items: groupItems,
  }));
}

export function groceryItemLabel(item: GroceryItem): string {
  const amount = formatAmount(item.quantity, item.unit);
  return amount ? `${amount} ${item.name}` : item.name;
}

export function groceryListAsText(list: GroceryList, recipes: Recipe[] = []): string {
  const recipeNames = new Map(recipes.map((recipe) => [recipe.id, recipe.title]));
  const lines = [list.name, '='.repeat(list.name.length), ''];
  for (const group of groupGroceryItems(list.items)) {
    lines.push(group.label.toUpperCase());
    for (const item of group.items) {
      const sources = (item.recipeIds ?? [])
        .map((id) => recipeNames.get(id))
        .filter((name): name is string => Boolean(name));
      const meta = sources.length > 0 ? `  (${sources.join(', ')})` : '';
      lines.push(`${item.checked ? '[x]' : '[ ]'} ${groceryItemLabel(item)}${meta}`);
    }
    lines.push('');
  }
  return lines.join('\n').trimEnd() + '\n';
}

export function manualGroceryItem(input: {
  name: string;
  quantity?: number | null;
  unit?: string;
  category?: GroceryCategory;
  id?: string;
}): GroceryItem {
  const key = ingredientKey(input.name, input.unit);
  return {
    id: input.id ?? crypto.randomUUID(),
    key,
    name: input.name.trim(),
    quantity: input.quantity ?? null,
    unit: normalizeUnit(input.unit) || undefined,
    category: input.category ?? inferCategory(input.name),
    checked: false,
    source: 'manual',
  };
}

export function newGroceryList(input: {
  name: string;
  weekStart?: string;
  items?: GroceryItem[];
  now?: string;
}): GroceryList {
  const now = input.now ?? new Date().toISOString();
  return {
    id: `list_${crypto.randomUUID()}`,
    name: input.name,
    weekStart: input.weekStart,
    items: input.items ?? [],
    createdAt: now,
    updatedAt: now,
  };
}

export function scaleRecipeIngredients(recipe: Recipe, servings: number): Recipe['ingredients'] {
  const factor = recipe.servings > 0 ? servings / recipe.servings : 1;
  return recipe.ingredients.map((ingredient) => ({
    ...ingredient,
    quantity: scaleQuantity(ingredient.quantity, factor),
  }));
}

export function displayIngredient(name: string, quantity?: number | null, unit?: string): string {
  const amount = formatAmount(quantity, unit);
  return amount ? `${amount} ${name}` : name;
}

export function normalizeGroceryName(name: string): string {
  return normalizeName(name);
}
