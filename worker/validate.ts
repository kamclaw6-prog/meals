import { z } from 'zod';
import { isISODate, normalizeWeekStart, weekStartFromDate } from '../shared/dates';
import { GROCERY_CATEGORIES, MEAL_SLOTS } from '../shared/types';
import { ingredientKey, normalizeUnit } from '../shared/units';

const id = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[A-Za-z0-9_.:-]+$/, 'IDs may only contain letters, numbers, dots, colons, dashes and underscores.');

const isoDate = z.string().refine(isISODate, 'Use a calendar date in YYYY-MM-DD format.');

const shortText = (max: number) => z.string().trim().max(max);

const quantity = z
  .number()
  .refine(Number.isFinite, 'Quantity must be a finite number.')
  .min(0)
  .max(100000)
  .nullable()
  .optional();

export const ingredientSchema = z.object({
  id,
  name: z.string().trim().min(1).max(120),
  quantity,
  unit: shortText(24).optional(),
  category: z.enum(GROCERY_CATEGORIES).optional(),
  note: shortText(200).optional(),
});

export const recipeSchema = z.object({
  id,
  title: z.string().trim().min(1).max(120),
  description: shortText(600).optional(),
  servings: z.number().min(0.5).max(100),
  prepMinutes: z.number().int().min(0).max(10000).optional(),
  cookMinutes: z.number().int().min(0).max(10000).optional(),
  tags: z
    .array(z.string().trim().min(1).max(30))
    .max(16)
    .default([])
    .transform((tags) => Array.from(new Set(tags.map((tag) => tag.toLowerCase())))),
  ingredients: z.array(ingredientSchema).max(100).default([]),
  steps: z.array(z.string().trim().max(2000)).max(60).default([]),
  notes: shortText(4000).optional(),
  image: z
    .string()
    .trim()
    .max(2000)
    .refine((value) => /^https?:\/\//i.test(value), 'Image must be an http(s) URL.')
    .optional(),
  createdAt: z.string().datetime({ offset: true }).optional(),
  updatedAt: z.string().datetime({ offset: true }).optional(),
});

export const mealSchema = z.object({
  id,
  date: isoDate,
  slot: z.enum(MEAL_SLOTS),
  recipeId: id,
  servings: z.number().min(0.5).max(100),
  note: shortText(200).optional(),
});

export const mealPlanSchema = z
  .object({
    id: z.string().optional(),
    weekStart: isoDate,
    meals: z.array(mealSchema).max(300).default([]),
    updatedAt: z.string().datetime({ offset: true }).optional(),
  })
  .superRefine((plan, ctx) => {
    const weekStart = normalizeWeekStart(plan.weekStart);
    for (const meal of plan.meals) {
      if (weekStartFromDate(meal.date) !== weekStart) {
        ctx.addIssue({
          code: 'custom',
          path: ['meals'],
          message: `Meal on ${meal.date} falls outside the week beginning ${weekStart}.`,
        });
        break;
      }
    }
  });

export const groceryItemSchema = z.object({
  id,
  key: z.string().min(1).max(200),
  name: z.string().trim().min(1).max(120),
  quantity,
  unit: shortText(24).optional(),
  category: z.enum(GROCERY_CATEGORIES),
  note: shortText(200).optional(),
  checked: z.boolean().default(false),
  source: z.enum(['plan', 'manual']),
  recipeIds: z.array(id).max(100).optional(),
});

export const groceryListSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().trim().min(1).max(120),
  weekStart: isoDate.optional(),
  items: z.array(groceryItemSchema).max(500).default([]),
  createdAt: z.string().datetime({ offset: true }).optional(),
  updatedAt: z.string().datetime({ offset: true }).optional(),
});

function uniqueIds<T extends { id: string }>(items: T[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const item of items) {
    if (seen.has(item.id)) duplicates.add(item.id);
    seen.add(item.id);
  }
  return Array.from(duplicates);
}

export const recipesPayloadSchema = z
  .object({
    items: z.array(recipeSchema).max(1000),
    sha: z.string().min(1).max(200).nullable().optional(),
  })
  .superRefine((payload, ctx) => {
    const duplicates = uniqueIds(payload.items);
    if (duplicates.length > 0) {
      ctx.addIssue({ code: 'custom', path: ['items'], message: `Duplicate recipe IDs: ${duplicates.join(', ')}` });
    }
    for (const recipe of payload.items) {
      const ingredientIds = uniqueIds(recipe.ingredients);
      if (ingredientIds.length > 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['items'],
          message: `Recipe "${recipe.title}" has duplicate ingredient IDs.`,
        });
        break;
      }
    }
  });

export const plansPayloadSchema = z
  .object({
    items: z.array(mealPlanSchema).max(500),
    sha: z.string().min(1).max(200).nullable().optional(),
  })
  .superRefine((payload, ctx) => {
    const seen = new Set<string>();
    for (const plan of payload.items) {
      const weekStart = normalizeWeekStart(plan.weekStart);
      if (seen.has(weekStart)) {
        ctx.addIssue({ code: 'custom', path: ['items'], message: `Multiple plans for the week of ${weekStart}.` });
        break;
      }
      seen.add(weekStart);
      const mealIds = uniqueIds(plan.meals);
      if (mealIds.length > 0) {
        ctx.addIssue({ code: 'custom', path: ['items'], message: `Duplicate meal IDs in week ${weekStart}.` });
        break;
      }
    }
  });

export const listsPayloadSchema = z
  .object({
    items: z.array(groceryListSchema).max(200),
    sha: z.string().min(1).max(200).nullable().optional(),
  })
  .superRefine((payload, ctx) => {
    const duplicates = uniqueIds(payload.items);
    if (duplicates.length > 0) {
      ctx.addIssue({ code: 'custom', path: ['items'], message: `Duplicate grocery list IDs: ${duplicates.join(', ')}` });
    }
    for (const list of payload.items) {
      const itemIds = uniqueIds(list.items);
      if (itemIds.length > 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['items'],
          message: `Grocery list "${list.name}" has duplicate item IDs.`,
        });
        break;
      }
    }
  });

export const repoUseSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(3)
    .max(200)
    .regex(/^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/, 'Use the owner/name format.'),
});

export const repoInitSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(/^[A-Za-z0-9._-]+$/, 'Use letters, numbers, dots, dashes or underscores.')
    .optional(),
  private: z.boolean().optional(),
});

export type RecipeInput = z.infer<typeof recipeSchema>;
export type MealPlanInput = z.infer<typeof mealPlanSchema>;
export type GroceryListInput = z.infer<typeof groceryListSchema>;

export function normalizeRecipes(items: RecipeInput[]) {
  return items.map((recipe) => {
    const now = new Date().toISOString();
    return {
      ...recipe,
      description: recipe.description || undefined,
      notes: recipe.notes || undefined,
      image: recipe.image || undefined,
      ingredients: recipe.ingredients.map((ingredient) => ({
        ...ingredient,
        unit: normalizeUnit(ingredient.unit) || undefined,
        note: ingredient.note?.trim() || undefined,
      })),
      steps: recipe.steps.filter((step) => step.trim().length > 0),
      createdAt: recipe.createdAt ?? now,
      updatedAt: recipe.updatedAt ?? now,
    };
  });
}

export function normalizePlans(items: MealPlanInput[]) {
  const now = new Date().toISOString();
  return items.map((plan) => {
    const weekStart = normalizeWeekStart(plan.weekStart);
    return {
      id: weekStart,
      weekStart,
      meals: plan.meals,
      updatedAt: now,
    };
  });
}

export function normalizeLists(items: GroceryListInput[]) {
  const now = new Date().toISOString();
  return items.map((list) => ({
    ...list,
    weekStart: list.weekStart,
    items: list.items.map((item) => ({
      ...item,
      key: ingredientKey(item.name, item.unit),
      unit: normalizeUnit(item.unit) || undefined,
      note: item.note?.trim() || undefined,
      recipeIds: item.recipeIds?.filter(Boolean),
    })),
    createdAt: list.createdAt ?? now,
    updatedAt: now,
  }));
}
