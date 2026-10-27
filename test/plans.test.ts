import { describe, expect, it } from 'vitest';
import type { Meal, MealPlan, Recipe } from '../shared/types';
import {
  addMeal,
  emptyPlan,
  findPlan,
  mealTimeMinutes,
  mealsForWeek,
  recipeUsageCount,
  recipesForMealSlot,
  removeMeal,
  removeMealsForRecipe,
  resolveWeekRecipes,
  updateMeal,
} from '../shared/plans';

function recipe(id: string, title: string, overrides: Partial<Recipe> = {}): Recipe {
  return {
    id,
    title,
    servings: 4,
    tags: [],
    ingredients: [],
    steps: [],
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-01T10:00:00.000Z',
    ...overrides,
  };
}

function meal(id: string, date: string, recipeId: string, slot: Meal['slot'] = 'dinner'): Meal {
  return { id, date, slot, recipeId, servings: 4 };
}

function plan(weekStart: string, meals: Meal[]): MealPlan {
  return { id: weekStart, weekStart, meals, updatedAt: '2026-10-01T10:00:00.000Z' };
}

describe('plan helpers', () => {
  it('creates an empty plan for a week', () => {
    expect(emptyPlan('2026-10-26')).toMatchObject({
      id: '2026-10-26',
      weekStart: '2026-10-26',
      meals: [],
    });
  });

  it('adds meals and keeps plans sorted by week', () => {
    const later = plan('2026-11-02', []);
    const result = addMeal([later], '2026-10-26', meal('m1', '2026-10-27', 'r1'));
    expect(result.map((entry) => entry.weekStart)).toEqual(['2026-10-26', '2026-11-02']);
    expect(mealsForWeek(result, '2026-10-26')).toHaveLength(1);
    expect(mealsForWeek(result, '2026-11-02')).toEqual([]);
  });

  it('appends to an existing week', () => {
    const existing = plan('2026-10-26', [meal('m1', '2026-10-26', 'r1')]);
    const result = addMeal([existing], '2026-10-26', meal('m2', '2026-10-28', 'r2'));
    expect(mealsForWeek(result, '2026-10-26').map((entry) => entry.id)).toEqual(['m1', 'm2']);
  });

  it('removes a meal and drops an empty week', () => {
    const existing = plan('2026-10-26', [meal('m1', '2026-10-26', 'r1')]);
    expect(removeMeal([existing], '2026-10-26', 'm1')).toEqual([]);
  });

  it('updates a meal in place', () => {
    const existing = plan('2026-10-26', [meal('m1', '2026-10-26', 'r1')]);
    const result = updateMeal([existing], '2026-10-26', { ...meal('m1', '2026-10-26', 'r2'), servings: 6 });
    expect(findPlan(result, '2026-10-26')?.meals[0]).toMatchObject({ recipeId: 'r2', servings: 6 });
  });

  it('removes every meal for a deleted recipe', () => {
    const plans = [
      plan('2026-10-26', [meal('m1', '2026-10-26', 'r1'), meal('m2', '2026-10-27', 'r2')]),
      plan('2026-11-02', [meal('m3', '2026-11-03', 'r1')]),
    ];
    const result = removeMealsForRecipe(plans, 'r1');
    expect(result).toHaveLength(1);
    expect(result[0]?.weekStart).toBe('2026-10-26');
    expect(result[0]?.meals.map((entry) => entry.id)).toEqual(['m2']);
  });

  it('counts recipe usage across all weeks', () => {
    const plans = [
      plan('2026-10-26', [meal('m1', '2026-10-26', 'r1'), meal('m2', '2026-10-27', 'r1')]),
      plan('2026-11-02', [meal('m3', '2026-11-03', 'r1'), meal('m4', '2026-11-04', 'r2')]),
    ];
    expect(recipeUsageCount(plans, 'r1')).toBe(3);
    expect(recipeUsageCount(plans, 'r2')).toBe(1);
    expect(recipeUsageCount(plans, 'missing')).toBe(0);
  });

  it('resolves weekly entries and reports missing recipes', () => {
    const plans = [plan('2026-10-26', [meal('m1', '2026-10-26', 'r1'), meal('m2', '2026-10-27', 'gone')])];
    const result = resolveWeekRecipes(plans, '2026-10-26', [recipe('r1', 'Soup')]);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]?.recipe.title).toBe('Soup');
    expect(result.entries[0]?.servings).toBe(4);
    expect(result.missingRecipeIds).toEqual(['gone']);
  });

  it('computes total cooking time', () => {
    expect(mealTimeMinutes(recipe('r1', 'Soup', { prepMinutes: 10, cookMinutes: 25 }))).toBe(35);
    expect(mealTimeMinutes(recipe('r2', 'Toast'))).toBe(0);
    expect(mealTimeMinutes(undefined)).toBe(0);
  });

  it('ranks recipes for a meal slot by matching tags', () => {
    const recipes = [
      recipe('a', 'Weeknight dinner', { tags: ['dinner'] }),
      recipe('b', 'Anything', { tags: [] }),
      recipe('c', 'Sunday roast', { tags: ['dinner', 'main'] }),
    ];
    expect(recipesForMealSlot(recipes, 'dinner').map((entry) => entry.id)).toEqual(['c', 'a', 'b']);

    const breakfast = [
      recipe('x', 'Pancakes', { tags: ['breakfast'] }),
      recipe('y', 'Soup', { tags: ['dinner'] }),
    ];
    expect(recipesForMealSlot(breakfast, 'breakfast')[0]?.id).toBe('x');
  });
});
