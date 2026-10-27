import type {
  GroceryList,
  Ingredient,
  Meal,
  MealPlan,
  MealSlot,
  Recipe,
} from '../shared/types';
import { addDaysISO, formatWeekRange, startOfWeekISO } from '../shared/dates';
import { buildGroceryItems, manualGroceryItem } from '../shared/grocery';
import { CATEGORY_LABEL } from '../shared/types';

let ingredientSeq = 0;

function ing(
  name: string,
  quantity: number | null,
  unit: string | undefined,
  category: Ingredient['category'],
  note?: string,
): Ingredient {
  ingredientSeq += 1;
  return { id: `i${ingredientSeq}`, name, quantity, unit, category, note };
}

function makeRecipe(input: {
  id: string;
  title: string;
  description: string;
  servings: number;
  prepMinutes: number;
  cookMinutes: number;
  tags: string[];
  ingredients: Ingredient[];
  steps: string[];
  notes?: string;
}): Recipe {
  const timestamp = '2026-01-05T09:00:00.000Z';
  return { ...input, createdAt: timestamp, updatedAt: timestamp };
}

export const seedRecipes: Recipe[] = [
  makeRecipe({
    id: 'r_miso_salmon',
    title: 'Miso Butter Salmon',
    description:
      'Caramelized miso butter salmon with blistered bok choy. Twenty-five minutes, one pan, and it tastes like a restaurant night in.',
    servings: 4,
    prepMinutes: 10,
    cookMinutes: 15,
    tags: ['dinner', 'quick', 'high-protein', 'gluten-free'],
    ingredients: [
      ing('Salmon fillets', 4, 'fillet', 'seafood', 'skin on, about 150g each'),
      ing('Unsalted butter', 3, 'tbsp', 'dairy', 'softened'),
      ing('White miso paste', 2, 'tbsp', 'pantry'),
      ing('Honey', 1, 'tbsp', 'pantry'),
      ing('Soy sauce', 1, 'tbsp', 'pantry', 'or tamari for gluten-free'),
      ing('Garlic', 2, 'clove', 'produce', 'finely grated'),
      ing('Baby bok choy', 4, 'head', 'produce', 'halved lengthwise'),
      ing('Scallions', 3, 'stalk', 'produce', 'thinly sliced'),
      ing('Sesame seeds', 1, 'tbsp', 'pantry', 'toasted'),
      ing('Neutral oil', 1, 'tbsp', 'pantry'),
      ing('Salt', null, undefined, 'pantry'),
      ing('Black pepper', null, undefined, 'pantry'),
    ],
    steps: [
      'Heat the oven to 220°C (425°F). Mix the butter, miso, honey, soy sauce and garlic into a smooth paste.',
      'Pat the salmon dry and season lightly with salt. Set it on a lined sheet pan and spread most of the miso butter over the top.',
      'Toss the bok choy with neutral oil, salt and pepper and arrange around the salmon. Dot with the remaining miso butter.',
      'Roast for 12–15 minutes, until the salmon flakes at the thickest point and the bok choy is charred at the edges.',
      'Scatter with scallions and sesame seeds. Spoon the pan juices over everything before serving.',
    ],
    notes: 'Serve with steamed rice or soba noodles. Leftovers are excellent cold over greens the next day.',
  }),
  makeRecipe({
    id: 'r_black_bean_tacos',
    title: 'Smoky Black Bean Tacos',
    description:
      'Crispy-edged sweet potato, cuminky black beans, and a bright lime slaw tucked into warm tortillas. A weeknight vegan staple.',
    servings: 4,
    prepMinutes: 10,
    cookMinutes: 20,
    tags: ['dinner', 'vegan', 'quick', 'weeknight'],
    ingredients: [
      ing('Corn tortillas', 8, 'piece', 'bakery'),
      ing('Black beans', 2, 'can', 'pantry', 'drained and rinsed'),
      ing('Sweet potato', 1, 'piece', 'produce', 'cut into 1cm cubes'),
      ing('Red onion', 1, 'piece', 'produce', 'thinly sliced'),
      ing('Garlic', 3, 'clove', 'produce', 'minced'),
      ing('Smoked paprika', 2, 'tsp', 'pantry'),
      ing('Ground cumin', 1, 'tsp', 'pantry'),
      ing('Lime', 2, 'piece', 'produce'),
      ing('Cilantro', 1, 'bunch', 'produce'),
      ing('Avocado', 1, 'piece', 'produce'),
      ing('Olive oil', 2, 'tbsp', 'pantry'),
      ing('Salt', null, undefined, 'pantry'),
    ],
    steps: [
      'Heat the oven to 220°C (425°F). Toss the sweet potato with olive oil, smoked paprika, cumin and salt; roast for 20 minutes until tender and browned.',
      'Warm the black beans in a small pan with the garlic, a splash of water and a pinch of salt. Mash a few beans against the pan to thicken.',
      'Toss the red onion with the juice of one lime, a pinch of salt and half the cilantro.',
      'Warm the tortillas in a dry pan. Fill with beans, sweet potato, onion, avocado and the remaining cilantro.',
      'Serve with lime wedges and hot sauce.',
    ],
  }),
  makeRecipe({
    id: 'r_roast_chicken',
    title: 'Lemon Herb Roast Chicken & Potatoes',
    description:
      'A Sunday centrepiece: crisp-skinned chicken over lemony potatoes with garlic and thyme. The leftovers carry the week.',
    servings: 4,
    prepMinutes: 20,
    cookMinutes: 70,
    tags: ['dinner', 'comfort', 'sunday', 'gluten-free'],
    ingredients: [
      ing('Whole chicken', 1, 'piece', 'meat', 'about 1.8kg'),
      ing('Lemon', 2, 'piece', 'produce', 'one zested and sliced, one halved'),
      ing('Garlic', 1, 'head', 'produce', 'halved crosswise'),
      ing('Fresh thyme', 6, 'sprig', 'produce'),
      ing('Fresh rosemary', 3, 'sprig', 'produce'),
      ing('Baby potatoes', 1, 'kg', 'produce', 'halved'),
      ing('Olive oil', 3, 'tbsp', 'pantry'),
      ing('Unsalted butter', 2, 'tbsp', 'dairy', 'softened'),
      ing('Salt', null, undefined, 'pantry'),
      ing('Black pepper', null, undefined, 'pantry'),
    ],
    steps: [
      'Heat the oven to 200°C (400°F). Pat the chicken dry and season inside and out generously with salt and pepper.',
      'Mix the butter with lemon zest, half the thyme leaves and a grind of pepper. Rub it under the chicken skin.',
      'Toss the potatoes with olive oil, garlic, rosemary, the remaining thyme and the halved lemon. Arrange in a roasting pan and set the chicken on top.',
      'Roast for 60–70 minutes, basting once, until the juices run clear at the thigh (75°C / 165°F).',
      'Rest for 15 minutes before carving. Squeeze over the roasted lemon and serve with the pan potatoes and a green salad.',
    ],
    notes: 'Save the carcass for stock. Shred any leftover meat for sandwiches or soup.',
  }),
  makeRecipe({
    id: 'r_coconut_curry',
    title: 'Coconut Chickpea Curry',
    description:
      'A pantry-friendly curry that tastes slow-cooked but comes together in half an hour. Creamy coconut, ginger and spinach.',
    servings: 4,
    prepMinutes: 10,
    cookMinutes: 25,
    tags: ['dinner', 'vegan', 'one-pot', 'weeknight'],
    ingredients: [
      ing('Coconut milk', 2, 'can', 'pantry', 'full fat'),
      ing('Chickpeas', 2, 'can', 'pantry', 'drained'),
      ing('Yellow onion', 1, 'piece', 'produce', 'diced'),
      ing('Garlic', 3, 'clove', 'produce', 'minced'),
      ing('Fresh ginger', 30, 'g', 'produce', 'grated'),
      ing('Curry powder', 2, 'tbsp', 'pantry'),
      ing('Diced tomatoes', 1, 'can', 'pantry'),
      ing('Baby spinach', 150, 'g', 'produce'),
      ing('Lime', 1, 'piece', 'produce'),
      ing('Basmati rice', 300, 'g', 'pantry'),
      ing('Neutral oil', 1, 'tbsp', 'pantry'),
      ing('Salt', null, undefined, 'pantry'),
    ],
    steps: [
      'Cook the rice according to the package instructions.',
      'Warm the oil in a deep pan over medium heat. Soften the onion with a pinch of salt for 5 minutes, then add garlic, ginger and curry powder and cook for 1 minute until fragrant.',
      'Add the tomatoes, coconut milk and chickpeas. Simmer for 15 minutes, stirring now and then, until slightly thickened.',
      'Fold in the spinach and cook until wilted. Season with salt and a squeeze of lime.',
      'Serve over rice with extra lime and, if you like, toasted coconut.',
    ],
  }),
  makeRecipe({
    id: 'r_overnight_oats',
    title: 'Overnight Oats with Brown Sugar Apples',
    description:
      'Creamy make-ahead oats topped with buttery brown-sugar apples. Breakfast solves itself for two mornings.',
    servings: 2,
    prepMinutes: 10,
    cookMinutes: 5,
    tags: ['breakfast', 'make-ahead', 'vegetarian'],
    ingredients: [
      ing('Rolled oats', 100, 'g', 'pantry'),
      ing('Milk', 250, 'ml', 'dairy', 'or oat milk'),
      ing('Greek yogurt', 100, 'g', 'dairy'),
      ing('Chia seeds', 1, 'tbsp', 'pantry'),
      ing('Apple', 2, 'piece', 'produce', 'diced'),
      ing('Brown sugar', 2, 'tbsp', 'pantry'),
      ing('Unsalted butter', 1, 'tbsp', 'dairy'),
      ing('Ground cinnamon', 1, 'tsp', 'pantry'),
      ing('Salt', null, undefined, 'pantry', 'a small pinch'),
    ],
    steps: [
      'Stir the oats, milk, yogurt, chia seeds and a pinch of salt together in a jar or bowl. Cover and refrigerate overnight.',
      'In the morning, melt the butter in a small pan. Add the apples, brown sugar and cinnamon and cook for 5 minutes until glossy and tender.',
      'Spoon the warm apples over the chilled oats. Add a splash of milk if the oats are thicker than you like.',
    ],
  }),
  makeRecipe({
    id: 'r_shakshuka',
    title: 'Shakshuka',
    description:
      'Eggs poached in a smoky pepper and tomato sauce, finished with feta and parsley. The best kind of weekend breakfast.',
    servings: 4,
    prepMinutes: 10,
    cookMinutes: 20,
    tags: ['breakfast', 'brunch', 'vegetarian', 'one-pan'],
    ingredients: [
      ing('Eggs', 6, 'piece', 'dairy'),
      ing('Diced tomatoes', 1, 'can', 'pantry'),
      ing('Red bell pepper', 2, 'piece', 'produce', 'sliced'),
      ing('Yellow onion', 1, 'piece', 'produce', 'sliced'),
      ing('Garlic', 3, 'clove', 'produce', 'sliced'),
      ing('Ground cumin', 2, 'tsp', 'pantry'),
      ing('Smoked paprika', 1, 'tsp', 'pantry'),
      ing('Feta', 80, 'g', 'dairy', 'crumbled'),
      ing('Fresh parsley', 1, 'bunch', 'produce', 'chopped'),
      ing('Olive oil', 2, 'tbsp', 'pantry'),
      ing('Sourdough bread', 4, 'slice', 'bakery'),
      ing('Salt', null, undefined, 'pantry'),
    ],
    steps: [
      'Warm the olive oil in a wide pan. Cook the onion and peppers with a pinch of salt for 8 minutes until soft and beginning to colour.',
      'Add the garlic, cumin and paprika and cook for 1 minute. Pour in the tomatoes and simmer for 8 minutes until thick.',
      'Make six wells in the sauce and crack an egg into each. Cover and cook for 5–7 minutes, until the whites are set and the yolks still soft.',
      'Scatter with feta and parsley. Serve straight from the pan with toasted sourdough.',
    ],
  }),
  makeRecipe({
    id: 'r_ginger_noodles',
    title: 'Ginger Scallion Noodles',
    description:
      'A ten-minute cure for a long day: springy noodles tossed in a punchy ginger-scallion oil.',
    servings: 2,
    prepMinutes: 5,
    cookMinutes: 10,
    tags: ['dinner', 'quick', 'vegetarian', 'weeknight'],
    ingredients: [
      ing('Wheat noodles', 200, 'g', 'pantry'),
      ing('Scallions', 6, 'stalk', 'produce', 'thinly sliced'),
      ing('Fresh ginger', 30, 'g', 'produce', 'finely grated'),
      ing('Neutral oil', 3, 'tbsp', 'pantry'),
      ing('Soy sauce', 2, 'tbsp', 'pantry'),
      ing('Rice vinegar', 1, 'tbsp', 'pantry'),
      ing('Toasted sesame oil', 1, 'tsp', 'pantry'),
      ing('Sugar', 1, 'tsp', 'pantry'),
      ing('Cucumber', 1, 'piece', 'produce', 'thinly sliced'),
      ing('Sesame seeds', 1, 'tbsp', 'pantry'),
    ],
    steps: [
      'Cook the noodles in well-salted water until just tender. Drain, reserving a splash of the cooking water.',
      'Heat the neutral oil in a small pan until shimmering. Pour it over the scallions and ginger in a heatproof bowl; it should sizzle loudly.',
      'Stir in the soy sauce, vinegar, sesame oil and sugar.',
      'Toss the noodles with the sauce, adding a little cooking water to loosen. Top with cucumber and sesame seeds.',
    ],
  }),
  makeRecipe({
    id: 'r_halloumi_traybake',
    title: 'Sheet-Pan Halloumi & Harvest Vegetables',
    description:
      'Squeaky halloumi, squash and brussels sprouts roasted until sticky with honey and za’atar. Minimal washing up.',
    servings: 4,
    prepMinutes: 15,
    cookMinutes: 30,
    tags: ['dinner', 'vegetarian', 'sheet-pan', 'weeknight'],
    ingredients: [
      ing('Halloumi', 250, 'g', 'dairy', 'sliced'),
      ing('Butternut squash', 600, 'g', 'produce', 'cut into wedges'),
      ing('Red onion', 2, 'piece', 'produce', 'cut into wedges'),
      ing('Brussels sprouts', 300, 'g', 'produce', 'halved'),
      ing('Olive oil', 3, 'tbsp', 'pantry'),
      ing('Honey', 1, 'tbsp', 'pantry'),
      ing('Za’atar', 1, 'tbsp', 'pantry'),
      ing('Lemon', 1, 'piece', 'produce'),
      ing('Fresh parsley', 1, 'bunch', 'produce'),
      ing('Salt', null, undefined, 'pantry'),
    ],
    steps: [
      'Heat the oven to 220°C (425°F). Toss the squash, onion and sprouts with olive oil, za’atar and salt on a large sheet pan. Roast for 20 minutes.',
      'Turn the vegetables, nestle in the halloumi slices and drizzle everything with honey. Roast for 10 more minutes until the cheese is golden.',
      'Squeeze over the lemon and scatter with parsley. Serve with warm flatbread or couscous.',
    ],
  }),
  makeRecipe({
    id: 'r_turkey_meatballs',
    title: 'Turkey Meatballs in Tomato Sauce',
    description:
      'Tender parmesan turkey meatballs simmered in a simple tomato sauce. Kid-approved, freezer-friendly, and better on day two.',
    servings: 4,
    prepMinutes: 20,
    cookMinutes: 25,
    tags: ['dinner', 'kid-friendly', 'high-protein', 'freezer'],
    ingredients: [
      ing('Ground turkey', 500, 'g', 'meat'),
      ing('Breadcrumbs', 60, 'g', 'pantry'),
      ing('Parmesan', 40, 'g', 'dairy', 'finely grated'),
      ing('Egg', 1, 'piece', 'dairy'),
      ing('Garlic', 2, 'clove', 'produce', 'grated'),
      ing('Fresh parsley', 1, 'bunch', 'produce', 'chopped'),
      ing('Diced tomatoes', 2, 'can', 'pantry'),
      ing('Yellow onion', 1, 'piece', 'produce', 'finely diced'),
      ing('Olive oil', 2, 'tbsp', 'pantry'),
      ing('Spaghetti', 400, 'g', 'pantry'),
      ing('Salt', null, undefined, 'pantry'),
      ing('Black pepper', null, undefined, 'pantry'),
    ],
    steps: [
      'Mix the turkey, breadcrumbs, parmesan, egg, garlic, half the parsley, salt and pepper. Roll into 20 small meatballs.',
      'Brown the meatballs in olive oil in a wide pan, turning, for 5 minutes. Set aside.',
      'Soften the onion in the same pan, add the tomatoes and simmer for 5 minutes. Return the meatballs and simmer gently for 15 minutes.',
      'Cook the spaghetti while the meatballs finish. Serve with the remaining parsley and extra parmesan.',
    ],
  }),
  makeRecipe({
    id: 'r_tofu_bowl',
    title: 'Crispy Tofu Rice Bowls with Peanut Sauce',
    description:
      'Cornstarch-crusted tofu, crisp broccoli and a five-ingredient peanut sauce. The kind of bowl you make on repeat.',
    servings: 4,
    prepMinutes: 20,
    cookMinutes: 25,
    tags: ['dinner', 'vegan', 'high-protein', 'meal-prep'],
    ingredients: [
      ing('Firm tofu', 400, 'g', 'produce', 'pressed and cubed'),
      ing('Cornstarch', 2, 'tbsp', 'pantry'),
      ing('Jasmine rice', 300, 'g', 'pantry'),
      ing('Broccoli', 1, 'head', 'produce', 'cut into florets'),
      ing('Carrot', 2, 'piece', 'produce', 'ribboned'),
      ing('Peanut butter', 3, 'tbsp', 'pantry'),
      ing('Soy sauce', 3, 'tbsp', 'pantry'),
      ing('Rice vinegar', 1, 'tbsp', 'pantry'),
      ing('Maple syrup', 1, 'tbsp', 'pantry'),
      ing('Garlic', 1, 'clove', 'produce', 'grated'),
      ing('Fresh ginger', 15, 'g', 'produce', 'grated'),
      ing('Toasted sesame oil', 1, 'tsp', 'pantry'),
      ing('Scallions', 2, 'stalk', 'produce'),
      ing('Sesame seeds', 1, 'tbsp', 'pantry'),
    ],
    steps: [
      'Cook the rice. Heat the oven to 220°C (425°F). Toss the tofu with cornstarch, a pinch of salt and a tablespoon of oil; spread on a sheet pan and roast for 20 minutes, turning once.',
      'Add the broccoli to the pan for the last 10 minutes of roasting.',
      'Whisk the peanut butter, soy sauce, vinegar, maple syrup, garlic, ginger, sesame oil and 3–4 tablespoons of warm water into a pourable sauce.',
      'Build bowls with rice, tofu, broccoli and carrot. Drizzle generously with peanut sauce and finish with scallions and sesame seeds.',
    ],
    notes: 'Pack components separately for meal prep; the tofu stays crisp for two days in the fridge.',
  }),
  makeRecipe({
    id: 'r_greek_salad',
    title: 'Greek Salad with Chickpeas',
    description:
      'Crunchy cucumber, sweet tomatoes, briny olives and chickpeas in a sharp oregano vinaigrette. Fifteen minutes, no cooking.',
    servings: 2,
    prepMinutes: 15,
    cookMinutes: 0,
    tags: ['lunch', 'quick', 'vegetarian', 'no-cook'],
    ingredients: [
      ing('Cucumber', 1, 'piece', 'produce', 'diced'),
      ing('Cherry tomatoes', 250, 'g', 'produce', 'halved'),
      ing('Chickpeas', 1, 'can', 'pantry', 'drained'),
      ing('Feta', 100, 'g', 'dairy'),
      ing('Red onion', 1, 'piece', 'produce', 'thinly sliced'),
      ing('Kalamata olives', 80, 'g', 'pantry'),
      ing('Olive oil', 3, 'tbsp', 'pantry'),
      ing('Red wine vinegar', 1, 'tbsp', 'pantry'),
      ing('Dried oregano', 1, 'tsp', 'pantry'),
      ing('Fresh parsley', 1, 'bunch', 'produce'),
    ],
    steps: [
      'Soak the sliced onion in cold water for 5 minutes to soften its bite; drain.',
      'Whisk the olive oil, vinegar, oregano, salt and pepper.',
      'Toss the cucumber, tomatoes, chickpeas, onion and olives with the dressing. Top with feta and parsley.',
    ],
  }),
  makeRecipe({
    id: 'r_squash_soup',
    title: 'Butternut Squash Soup',
    description:
      'Silky roasted squash soup with ginger and coconut milk. Freeze half for a night when you have nothing left to give.',
    servings: 4,
    prepMinutes: 15,
    cookMinutes: 35,
    tags: ['dinner', 'vegan', 'freezer', 'soup'],
    ingredients: [
      ing('Butternut squash', 1, 'kg', 'produce', 'peeled and cubed'),
      ing('Yellow onion', 1, 'piece', 'produce', 'diced'),
      ing('Carrot', 2, 'piece', 'produce', 'chopped'),
      ing('Garlic', 3, 'clove', 'produce'),
      ing('Fresh ginger', 20, 'g', 'produce'),
      ing('Vegetable stock', 1, 'l', 'pantry'),
      ing('Coconut milk', 1, 'can', 'pantry'),
      ing('Olive oil', 2, 'tbsp', 'pantry'),
      ing('Ground nutmeg', 1, 'pinch', 'pantry'),
      ing('Pumpkin seeds', 2, 'tbsp', 'pantry', 'toasted'),
      ing('Salt', null, undefined, 'pantry'),
    ],
    steps: [
      'Warm the oil in a large pot. Cook the onion, carrot and garlic with a pinch of salt for 8 minutes.',
      'Add the squash, ginger, stock and nutmeg. Simmer for 25 minutes until the squash falls apart.',
      'Blend until smooth, then stir in the coconut milk and warm through. Season to taste.',
      'Serve with toasted pumpkin seeds and a swirl of coconut milk.',
    ],
  }),
];

function makeMeal(id: string, date: string, slot: MealSlot, recipeId: string, servings: number): Meal {
  return { id, date, slot, recipeId, servings };
}

export function seedPlan(): MealPlan {
  const weekStart = startOfWeekISO();
  const meals: Meal[] = [
    makeMeal('m_mon_dinner', weekStart, 'dinner', 'r_miso_salmon', 4),
    makeMeal('m_tue_dinner', addDaysISO(weekStart, 1), 'dinner', 'r_black_bean_tacos', 4),
    makeMeal('m_wed_breakfast', addDaysISO(weekStart, 2), 'breakfast', 'r_overnight_oats', 2),
    makeMeal('m_wed_dinner', addDaysISO(weekStart, 2), 'dinner', 'r_coconut_curry', 4),
    makeMeal('m_thu_lunch', addDaysISO(weekStart, 3), 'lunch', 'r_greek_salad', 2),
    makeMeal('m_fri_dinner', addDaysISO(weekStart, 4), 'dinner', 'r_ginger_noodles', 2),
    makeMeal('m_sat_breakfast', addDaysISO(weekStart, 5), 'breakfast', 'r_shakshuka', 4),
    makeMeal('m_sat_dinner', addDaysISO(weekStart, 5), 'dinner', 'r_halloumi_traybake', 4),
    makeMeal('m_sun_dinner', addDaysISO(weekStart, 6), 'dinner', 'r_roast_chicken', 4),
  ];
  return { id: weekStart, weekStart, meals, updatedAt: new Date().toISOString() };
}

export function seedList(): GroceryList {
  const plan = seedPlan();
  const byId = new Map(seedRecipes.map((recipe) => [recipe.id, recipe]));
  const entries = plan.meals.flatMap((meal) => {
    const recipe = byId.get(meal.recipeId);
    return recipe ? [{ recipe, servings: meal.servings }] : [];
  });

  const generated = buildGroceryItems(entries);
  const extras = [
    manualGroceryItem({ name: 'Coffee beans', quantity: 1, unit: 'bag', category: 'pantry' }),
    manualGroceryItem({ name: 'Paper towels', quantity: 1, unit: 'bag', category: 'household' }),
    manualGroceryItem({ name: 'Sourdough loaf', quantity: 1, unit: 'piece', category: 'bakery' }),
  ];

  const items = [...generated, ...extras].map((item, index) => ({
    ...item,
    checked: index < 4,
  }));

  const now = new Date().toISOString();
  return {
    id: 'list_this_week',
    name: `Week of ${formatWeekRange(plan.weekStart)}`,
    weekStart: plan.weekStart,
    items,
    createdAt: now,
    updatedAt: now,
  };
}

export function demoSeed(): { recipes: Recipe[]; plans: MealPlan[]; lists: GroceryList[] } {
  return {
    recipes: seedRecipes,
    plans: [seedPlan()],
    lists: [seedList()],
  };
}

export function repoReadme(): string {
  const categoryLines = Object.entries(CATEGORY_LABEL)
    .map(([key, label]) => `| \`${key}\` | ${label} |`)
    .join('\n');

  return `# Mise data

This repository stores the recipes, meal plans and grocery lists for [Mise](https://github.com/). The app reads and writes these files through the GitHub API — every change is a commit, so you get history, diffs and an easy backup for free.

## Files

| File | Contents |
| --- | --- |
| \`data/recipes.json\` | The recipe box. |
| \`data/plans.json\` | One meal plan per week, keyed by the Monday of that week. |
| \`data/lists.json\` | Grocery lists, including checked state. |

The shape is versioned (\`"version": 1\`) and validated by the app on every save. You can edit by hand in GitHub — the app will pick up changes on the next load.

## Grocery categories

| Key | Label |
| --- | --- |
${categoryLines}

## Notes

- Dates are local calendar dates in \`YYYY-MM-DD\` format.
- Meal plans reference recipes by \`recipeId\`. Removing a recipe the app uses is blocked until the planned meals are removed.
- Quantities are numbers; \`null\` means an unmeasured amount ("salt, to taste").
- Grocery items carry a \`key\` (normalized name + unit) so regenerating a list preserves checked state.

Created by Mise. Make it yours.
`;
}
