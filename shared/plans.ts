import type { Meal, MealPlan, Recipe } from './types';

export function findPlan(plans: MealPlan[], weekStart: string): MealPlan | undefined {
  return plans.find((plan) => plan.weekStart === weekStart);
}

export function mealsForWeek(plans: MealPlan[], weekStart: string): Meal[] {
  return findPlan(plans, weekStart)?.meals ?? [];
}

export function emptyPlan(weekStart: string): MealPlan {
  return { id: weekStart, weekStart, meals: [], updatedAt: new Date().toISOString() };
}

function withPlan(plans: MealPlan[], weekStart: string, update: (meals: Meal[]) => Meal[]): MealPlan[] {
  const existing = findPlan(plans, weekStart);
  const meals = update(existing?.meals ?? []);
  const next: MealPlan = {
    id: weekStart,
    weekStart,
    meals,
    updatedAt: new Date().toISOString(),
  };
  const without = plans.filter((plan) => plan.weekStart !== weekStart);
  return meals.length === 0 ? without : [...without, next].sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

export function addMeal(plans: MealPlan[], weekStart: string, meal: Meal): MealPlan[] {
  return withPlan(plans, weekStart, (meals) => [...meals, meal]);
}

export function removeMeal(plans: MealPlan[], weekStart: string, mealId: string): MealPlan[] {
  return withPlan(plans, weekStart, (meals) => meals.filter((meal) => meal.id !== mealId));
}

export function updateMeal(plans: MealPlan[], weekStart: string, meal: Meal): MealPlan[] {
  return withPlan(plans, weekStart, (meals) =>
    meals.map((existing) => (existing.id === meal.id ? meal : existing)),
  );
}

/** Remove every planned meal that points at a recipe (used when deleting a recipe). */
export function removeMealsForRecipe(plans: MealPlan[], recipeId: string): MealPlan[] {
  return plans
    .map((plan) => ({
      ...plan,
      meals: plan.meals.filter((meal) => meal.recipeId !== recipeId),
      updatedAt: new Date().toISOString(),
    }))
    .filter((plan) => plan.meals.length > 0);
}

export function recipeUsageCount(plans: MealPlan[], recipeId: string): number {
  return plans.reduce(
    (count, plan) => count + plan.meals.filter((meal) => meal.recipeId === recipeId).length,
    0,
  );
}

export interface PlannedRecipe {
  recipe: Recipe;
  servings: number;
}

/**
 * Resolve the recipes (and serving counts) for a week's meals. Missing recipes
 * are skipped and reported so the UI can warn about them.
 */
export function resolveWeekRecipes(
  plans: MealPlan[],
  weekStart: string,
  recipes: Recipe[],
): { entries: PlannedRecipe[]; missingRecipeIds: string[] } {
  const byId = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  const entries: PlannedRecipe[] = [];
  const missing = new Set<string>();

  for (const meal of mealsForWeek(plans, weekStart)) {
    const recipe = byId.get(meal.recipeId);
    if (!recipe) {
      missing.add(meal.recipeId);
      continue;
    }
    entries.push({ recipe, servings: meal.servings });
  }

  return { entries, missingRecipeIds: Array.from(missing) };
}

export function mealTimeMinutes(recipe: Recipe | undefined): number {
  if (!recipe) return 0;
  return (recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0);
}

export function recipesForMealSlot(recipes: Recipe[], slot: Meal['slot']): Recipe[] {
  const preferred: Record<Meal['slot'], string[]> = {
    breakfast: ['breakfast', 'brunch', 'quick'],
    lunch: ['lunch', 'salad', 'sandwich', 'quick'],
    dinner: ['dinner', 'main', 'comfort'],
    snack: ['snack', 'sweet', 'baking'],
  };
  return [...recipes].sort((a, b) => {
    const aScore = a.tags.filter((tag) => preferred[slot].includes(tag.toLowerCase())).length;
    const bScore = b.tags.filter((tag) => preferred[slot].includes(tag.toLowerCase())).length;
    if (aScore !== bScore) return bScore - aScore;
    return a.title.localeCompare(b.title);
  });
}
