import { describe, expect, it } from 'vitest';
import {
  listsPayloadSchema,
  normalizeLists,
  normalizePlans,
  normalizeRecipes,
  plansPayloadSchema,
  recipesPayloadSchema,
  repoUseSchema,
} from '../worker/validate';

const now = '2026-10-01T10:00:00.000Z';

function ingredient(id: string, name: string, extra: Record<string, unknown> = {}) {
  return { id, name, ...extra };
}

function validRecipe(overrides: Record<string, unknown> = {}) {
  return {
    id: 'r1',
    title: 'Roast chicken',
    servings: 4,
    tags: ['Dinner', 'dinner', 'Main'],
    ingredients: [ingredient('i1', 'Chicken', { quantity: 1.5, unit: 'kg' })],
    steps: ['Roast it.'],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('recipe payload validation', () => {
  it('accepts a valid recipe and normalizes tags', () => {
    const result = recipesPayloadSchema.parse({ items: [validRecipe()], sha: null });
    expect(result.items[0]?.tags).toEqual(['dinner', 'main']);
  });

  it('rejects duplicate recipe ids', () => {
    const result = recipesPayloadSchema.safeParse({
      items: [validRecipe({ id: 'r1' }), validRecipe({ id: 'r1', title: 'Another' })],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.message.includes('Duplicate recipe IDs'))).toBe(true);
    }
  });

  it('rejects duplicate ingredient ids inside a recipe', () => {
    const result = recipesPayloadSchema.safeParse({
      items: [
        validRecipe({
          ingredients: [ingredient('dup', 'Salt'), ingredient('dup', 'Pepper')],
        }),
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid images and unsafe ids', () => {
    expect(recipesPayloadSchema.safeParse({ items: [validRecipe({ image: 'javascript:alert(1)' })] }).success).toBe(false);
    expect(recipesPayloadSchema.safeParse({ items: [validRecipe({ id: 'has space' })] }).success).toBe(false);
    expect(recipesPayloadSchema.safeParse({ items: [validRecipe({ servings: 0 })] }).success).toBe(false);
  });

  it('rejects negative quantities', () => {
    const result = recipesPayloadSchema.safeParse({
      items: [validRecipe({ ingredients: [ingredient('i1', 'Flour', { quantity: -1 })] })],
    });
    expect(result.success).toBe(false);
  });
});

describe('plan payload validation', () => {
  function meat(date: string, id = 'm1') {
    return { id, date, slot: 'dinner', recipeId: 'r1', servings: 4 };
  }

  it('accepts meals inside the plan week', () => {
    const result = plansPayloadSchema.safeParse({
      items: [{ weekStart: '2026-10-26', meals: [meat('2026-10-27')] }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects a meal outside the week', () => {
    const result = plansPayloadSchema.safeParse({
      items: [{ weekStart: '2026-10-26', meals: [meat('2026-11-02')] }],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('falls outside the week');
    }
  });

  it('rejects two plans normalizing to the same week', () => {
    const result = plansPayloadSchema.safeParse({
      items: [
        { weekStart: '2026-10-26', meals: [] },
        { weekStart: '2026-10-29', meals: [] },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejects duplicate meal ids', () => {
    const result = plansPayloadSchema.safeParse({
      items: [
        {
          weekStart: '2026-10-26',
          meals: [meat('2026-10-26', 'same'), meat('2026-10-27', 'same')],
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown meal slot', () => {
    const result = plansPayloadSchema.safeParse({
      items: [{ weekStart: '2026-10-26', meals: [{ ...meat('2026-10-27'), slot: 'second-breakfast' }] }],
    });
    expect(result.success).toBe(false);
  });
});

describe('grocery list payload validation', () => {
  function item(id: string, overrides: Record<string, unknown> = {}) {
    return {
      id,
      key: 'milk|l',
      name: 'Milk',
      quantity: 1,
      unit: 'l',
      category: 'dairy',
      checked: false,
      source: 'manual',
      ...overrides,
    };
  }

  it('accepts a valid list', () => {
    const result = listsPayloadSchema.safeParse({
      items: [{ id: 'list_1', name: 'Week', items: [item('i1')] }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects duplicate list and item ids', () => {
    expect(
      listsPayloadSchema.safeParse({
        items: [
          { id: 'list_1', name: 'A', items: [] },
          { id: 'list_1', name: 'B', items: [] },
        ],
      }).success,
    ).toBe(false);

    expect(
      listsPayloadSchema.safeParse({
        items: [{ id: 'list_1', name: 'A', items: [item('dup'), item('dup')] }],
      }).success,
    ).toBe(false);
  });

  it('rejects unknown categories', () => {
    expect(
      listsPayloadSchema.safeParse({
        items: [{ id: 'list_1', name: 'A', items: [item('i1', { category: 'butcher' })] }],
      }).success,
    ).toBe(false);
  });
});

describe('repo input validation', () => {
  it('requires owner/name', () => {
    expect(repoUseSchema.safeParse({ fullName: 'owner/repo' }).success).toBe(true);
    expect(repoUseSchema.safeParse({ fullName: 'owner' }).success).toBe(false);
    expect(repoUseSchema.safeParse({ fullName: 'owner/repo/extra' }).success).toBe(false);
  });
});

describe('normalizers', () => {
  it('cleans recipes and fills timestamps', () => {
    const parsed = recipesPayloadSchema.parse({
      items: [
        validRecipe({
          description: '   ',
          notes: '',
          steps: ['Do this', '   ', 'Then that'],
          ingredients: [ingredient('i1', 'Salt', { unit: '  tsp ' })],
          createdAt: undefined,
          updatedAt: undefined,
        }),
      ],
    });
    const [normalized] = normalizeRecipes(parsed.items);
    expect(normalized?.description).toBeUndefined();
    expect(normalized?.notes).toBeUndefined();
    expect(normalized?.steps).toEqual(['Do this', 'Then that']);
    expect(normalized?.ingredients[0]?.unit).toBe('tsp');
    expect(normalized?.createdAt).toBeTruthy();
    expect(normalized?.updatedAt).toBeTruthy();
  });

  it('normalizes plan ids and week starts', () => {
    const parsed = plansPayloadSchema.parse({
      items: [{ weekStart: '2026-10-28', meals: [] }],
    });
    const [normalized] = normalizePlans(parsed.items);
    expect(normalized?.id).toBe('2026-10-26');
    expect(normalized?.weekStart).toBe('2026-10-26');
  });

  it('recomputes grocery keys and cleans optional fields', () => {
    const parsed = listsPayloadSchema.parse({
      items: [
        {
          id: 'list_1',
          name: 'Week',
          items: [
            {
              id: 'i1',
              key: 'stale',
              name: 'Tomatoes',
              quantity: 2,
              unit: 'Pounds',
              category: 'produce',
              checked: true,
              source: 'plan',
              note: '  ',
              recipeIds: ['r1'],
            },
          ],
        },
      ],
    });
    const [normalized] = normalizeLists(parsed.items);
    expect(normalized?.items[0]?.key).toBe('tomato|lb');
    expect(normalized?.items[0]?.unit).toBe('lb');
    expect(normalized?.items[0]?.note).toBeUndefined();
    expect(normalized?.items[0]?.recipeIds).toEqual(['r1']);
    expect(normalized?.items[0]?.checked).toBe(true);
    expect(normalized?.updatedAt).toBeTruthy();
  });
});
