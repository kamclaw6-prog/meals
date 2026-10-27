import { describe, expect, it } from 'vitest';
import type { GroceryItem, GroceryList, Recipe } from '../shared/types';
import {
  buildGroceryItems,
  groupGroceryItems,
  groceryListAsText,
  groceryStats,
  manualGroceryItem,
  mergeGroceryItems,
} from '../shared/grocery';

function recipe(overrides: Partial<Recipe> & Pick<Recipe, 'id' | 'title' | 'servings' | 'ingredients'>): Recipe {
  return {
    tags: [],
    steps: [],
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-01T10:00:00.000Z',
    ...overrides,
  };
}

const FLOUR_RECIPE = recipe({
  id: 'bread',
  title: 'Sourdough',
  servings: 2,
  ingredients: [
    { id: 'i1', name: 'Flour', quantity: 200, unit: 'grams' },
    { id: 'i2', name: 'eggs', quantity: 2 },
    { id: 'i3', name: 'tomatoes', quantity: 3 },
    { id: 'i4', name: 'Salt', quantity: null },
  ],
});

const OTHER_RECIPE = recipe({
  id: 'pasta',
  title: 'Pasta night',
  servings: 4,
  ingredients: [
    { id: 'i5', name: 'flour', quantity: 400, unit: 'g' },
    { id: 'i6', name: 'olive oil', quantity: 1, unit: 'tablespoon' },
    { id: 'i7', name: 'Tomato', quantity: 2 },
  ],
});

function findByKey(items: GroceryItem[], key: string): GroceryItem {
  const item = items.find((entry) => entry.key === key);
  if (!item) throw new Error(`Missing grocery item ${key}`);
  return item;
}

describe('buildGroceryItems', () => {
  const items = buildGroceryItems([
    { recipe: FLOUR_RECIPE, servings: 4 },
    { recipe: OTHER_RECIPE, servings: 4 },
  ]);

  it('scales quantities to the planned servings', () => {
    expect(findByKey(items, 'egg|').quantity).toBe(4);
    expect(findByKey(items, 'tomato|').quantity).toBe(8);
    expect(findByKey(items, 'salt|').quantity).toBeNull();
  });

  it('merges when normalized name and unit match', () => {
    const flour = findByKey(items, 'flour|g');
    expect(flour.quantity).toBe(800);
    expect(flour.unit).toBe('g');
    expect(flour.recipeIds).toEqual(['bread', 'pasta']);
  });

  it('normalizes unit aliases and keeps distinct units apart', () => {
    expect(findByKey(items, 'olive oil|tbsp').unit).toBe('tbsp');
    expect(items.some((item) => item.key === 'flour|cup')).toBe(false);
  });

  it('infers grocery categories and sorts by aisle', () => {
    expect(findByKey(items, 'tomato|').category).toBe('produce');
    expect(findByKey(items, 'flour|g').category).toBe('pantry');
    expect(items[0]?.category).toBe('produce');
  });

  it('creates stable ids for the same key', () => {
    const again = buildGroceryItems([{ recipe: FLOUR_RECIPE, servings: 4 }]);
    const first = buildGroceryItems([{ recipe: FLOUR_RECIPE, servings: 4 }]);
    expect(again.map((item) => item.id)).toEqual(first.map((item) => item.id));
  });

  it('ignores blank ingredient names', () => {
    const empty = recipe({
      id: 'empty',
      title: 'Empty',
      servings: 1,
      ingredients: [{ id: 'x', name: '   ', quantity: 1 }],
    });
    expect(buildGroceryItems([{ recipe: empty, servings: 1 }])).toEqual([]);
  });
});

describe('mergeGroceryItems', () => {
  const existing: GroceryItem[] = [
    {
      id: 'plan_flour',
      key: 'flour|g',
      name: 'Flour',
      quantity: 200,
      unit: 'g',
      category: 'pantry',
      checked: true,
      source: 'plan',
      note: 'old note',
      recipeIds: ['bread'],
    },
    {
      id: 'plan_sugar',
      key: 'sugar|',
      name: 'Sugar',
      quantity: 1,
      category: 'pantry',
      checked: false,
      source: 'plan',
    },
    {
      id: 'plan_butter',
      key: 'butter|',
      name: 'Butter',
      quantity: 1,
      category: 'dairy',
      checked: true,
      source: 'plan',
    },
    {
      id: 'manual_milk',
      key: 'milk|l',
      name: 'Milk',
      quantity: 2,
      unit: 'l',
      category: 'dairy',
      checked: false,
      source: 'manual',
    },
    {
      id: 'manual_oil',
      key: 'olive oil|tbsp',
      name: 'Olive oil',
      quantity: 2,
      unit: 'tbsp',
      category: 'pantry',
      checked: false,
      source: 'manual',
    },
  ];

  const generated = buildGroceryItems([
    { recipe: OTHER_RECIPE, servings: 4 },
    { recipe: FLOUR_RECIPE, servings: 4 },
  ]);

  const merged = mergeGroceryItems(existing, generated);

  it('updates generated items while keeping checked state and ids', () => {
    const flour = findByKey(merged, 'flour|g');
    expect(flour.id).toBe('plan_flour');
    expect(flour.quantity).toBe(800);
    expect(flour.checked).toBe(true);
    expect(flour.note).toBe('old note');
  });

  it('drops unchecked plan items that are no longer needed', () => {
    expect(merged.some((item) => item.key === 'sugar|')).toBe(false);
  });

  it('keeps checked plan items until the shopper clears them', () => {
    expect(findByKey(merged, 'butter|').checked).toBe(true);
  });

  it('keeps manual items and prefers their amounts over generated ones', () => {
    const milk = findByKey(merged, 'milk|l');
    expect(milk.source).toBe('manual');
    expect(milk.quantity).toBe(2);

    const oil = findByKey(merged, 'olive oil|tbsp');
    expect(oil.source).toBe('manual');
    expect(oil.quantity).toBe(2);
    expect(merged.filter((item) => item.key === 'olive oil|tbsp')).toHaveLength(1);
  });

  it('adds newly planned items', () => {
    expect(findByKey(merged, 'tomato|').quantity).toBe(8);
    expect(findByKey(merged, 'egg|').quantity).toBe(4);
  });
});

describe('groceryStats and grouping', () => {
  const list: GroceryList = {
    id: 'list_1',
    name: 'Week of Oct 26',
    items: [
      {
        id: 'a', key: 'tomato|', name: 'Tomato', quantity: 2, category: 'produce', checked: true, source: 'plan',
      },
      {
        id: 'b', key: 'milk|l', name: 'Milk', quantity: 1, unit: 'l', category: 'dairy', checked: false, source: 'plan',
      },
      {
        id: 'c', key: 'flour|g', name: 'Flour', quantity: 500, unit: 'g', category: 'pantry', checked: false, source: 'manual',
      },
    ],
    createdAt: '2026-10-26T10:00:00.000Z',
    updatedAt: '2026-10-26T10:00:00.000Z',
  };

  it('computes progress', () => {
    expect(groceryStats(list)).toEqual({ total: 3, checked: 1, remaining: 2, percent: 33 });
    expect(groceryStats(undefined)).toEqual({ total: 0, checked: 0, remaining: 0, percent: 0 });
  });

  it('groups by aisle in canonical order', () => {
    const groups = groupGroceryItems([...list.items].reverse());
    expect(groups.map((group) => group.category)).toEqual(['produce', 'dairy', 'pantry']);
    expect(groups.map((group) => group.label)).toEqual(['Produce', 'Dairy & eggs', 'Pantry']);
  });

  it('renders a copyable plain-text list', () => {
    const text = groceryListAsText(list, [
      {
        ...FLOUR_RECIPE,
        id: 'r1',
        title: 'Sourdough',
      },
    ]);
    expect(text.startsWith('Week of Oct 26')).toBe(true);
    expect(text).toContain('PRODUCE');
    expect(text).toContain('[x] 2 Tomato');
    expect(text).toContain('[ ] 500 g Flour');
    expect(text.endsWith('\n')).toBe(true);
  });
});

describe('manualGroceryItem', () => {
  it('builds a normalized manual item', () => {
    const item = manualGroceryItem({ name: '  Dish Soap ', quantity: 1, unit: 'Bottles' });
    expect(item.name).toBe('Dish Soap');
    expect(item.key).toBe('dish soap|bottle');
    expect(item.unit).toBe('bottle');
    expect(item.category).toBe('household');
    expect(item.source).toBe('manual');
    expect(item.checked).toBe(false);
  });

  it('honors an explicit category and id', () => {
    const item = manualGroceryItem({ name: 'Mystery', category: 'other', id: 'fixed' });
    expect(item.category).toBe('other');
    expect(item.id).toBe('fixed');
    expect(item.quantity).toBeNull();
  });
});
