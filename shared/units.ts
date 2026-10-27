import type { GroceryCategory } from './types';

/** Unit aliases → canonical short form. */
const UNIT_ALIASES: Record<string, string> = {
  tablespoon: 'tbsp',
  tablespoons: 'tbsp',
  tbs: 'tbsp',
  tbsps: 'tbsp',
  tbl: 'tbsp',
  tsp: 'tsp',
  tsps: 'tsp',
  teaspoon: 'tsp',
  teaspoons: 'tsp',
  cup: 'cup',
  cups: 'cup',
  c: 'cup',
  g: 'g',
  gram: 'g',
  grams: 'g',
  kg: 'kg',
  kilo: 'kg',
  kilos: 'kg',
  kilogram: 'kg',
  kilograms: 'kg',
  ml: 'ml',
  milliliter: 'ml',
  milliliters: 'ml',
  millilitre: 'ml',
  l: 'l',
  liter: 'l',
  liters: 'l',
  litre: 'l',
  litres: 'l',
  oz: 'oz',
  ounce: 'oz',
  ounces: 'oz',
  lb: 'lb',
  lbs: 'lb',
  pound: 'lb',
  pounds: 'lb',
  clove: 'clove',
  cloves: 'clove',
  can: 'can',
  cans: 'can',
  tin: 'can',
  tins: 'can',
  bunch: 'bunch',
  bunches: 'bunch',
  pinch: 'pinch',
  pinches: 'pinch',
  slice: 'slice',
  slices: 'slice',
  sprig: 'sprig',
  sprigs: 'sprig',
  handful: 'handful',
  handfuls: 'handful',
  package: 'pkg',
  packages: 'pkg',
  pkg: 'pkg',
  pkgs: 'pkg',
  jar: 'jar',
  jars: 'jar',
  head: 'head',
  heads: 'head',
  stalk: 'stalk',
  stalks: 'stalk',
  stick: 'stick',
  sticks: 'stick',
  fillet: 'fillet',
  fillets: 'fillet',
  filet: 'fillet',
  filets: 'fillet',
  piece: 'piece',
  pieces: 'piece',
  bag: 'bag',
  bags: 'bag',
  box: 'box',
  boxes: 'box',
  bottle: 'bottle',
  bottles: 'bottle',
  sheet: 'sheet',
  sheets: 'sheet',
};

/** Words ending in "s" that are already singular (or should not be trimmed). */
const SINGULAR_S_WORDS = new Set([
  'asparagus',
  'hummus',
  'couscous',
  'molasses',
  'glass',
  'greens',
  'chives',
  'olives',
  'lentils',
  'oats',
  'rice',
  'quinoa',
  'pasta',
  'salsa',
  'chimichurri',
  'mayonnaise',
  'cheese',
  'cous cous',
]);

const IRREGULAR_PLURALS: Record<string, string> = {
  tomatoes: 'tomato',
  potatoes: 'potato',
  mangoes: 'mango',
  avocados: 'avocado',
  chiles: 'chile',
  chillies: 'chile',
  chilies: 'chile',
  leaves: 'leaf',
  halves: 'half',
  loaves: 'loaf',
  knives: 'knife',
  shelves: 'shelf',
  anchovies: 'anchovy',
  berries: 'berry',
  cherries: 'cherry',
  scallions: 'scallion',
  'spring onions': 'spring onion',
};

export function normalizeUnit(unit?: string | null): string {
  if (!unit) return '';
  const clean = unit.trim().toLowerCase().replace(/\.$/, '');
  if (!clean) return '';
  return UNIT_ALIASES[clean] ?? clean;
}

export function normalizeName(name: string): string {
  const base = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[()]/g, ' ')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!base) return '';
  const direct = IRREGULAR_PLURALS[base];
  if (direct) return direct;
  if (SINGULAR_S_WORDS.has(base)) return base;

  const words = base.split(' ');
  const last = words[words.length - 1] ?? '';
  if (last.length > 3 && last.endsWith('ies')) {
    words[words.length - 1] = `${last.slice(0, -3)}y`;
  } else if (last.length > 3 && /(?:tomato|potato|mango|hero|echo)es$/.test(last)) {
    words[words.length - 1] = last.slice(0, -2);
  } else if (
    last.length > 3 &&
    last.endsWith('s') &&
    !last.endsWith('ss') &&
    !last.endsWith('us') &&
    !last.endsWith('is')
  ) {
    words[words.length - 1] = last.slice(0, -1);
  }
  return words.join(' ');
}

export function ingredientKey(name: string, unit?: string | null): string {
  return `${normalizeName(name)}|${normalizeUnit(unit)}`;
}

export function formatQuantity(quantity: number): string {
  if (!Number.isFinite(quantity)) return '';
  if (quantity === 0) return '0';
  const whole = Math.floor(quantity + 1e-9);
  const fraction = quantity - whole;
  const fractions: Array<[number, string]> = [
    [0.125, '1/8'],
    [0.25, '1/4'],
    [1 / 3, '1/3'],
    [0.375, '3/8'],
    [0.5, '1/2'],
    [0.625, '5/8'],
    [2 / 3, '2/3'],
    [0.75, '3/4'],
    [0.875, '7/8'],
  ];

  if (fraction > 0.02) {
    const match = fractions.find(([value]) => Math.abs(value - fraction) < 0.02);
    if (match) return whole > 0 ? `${whole} ${match[1]}` : match[1];
    // Fall back to a tidy decimal for metric-style amounts.
    const rounded = Math.round(quantity * 100) / 100;
    return String(rounded);
  }
  return String(whole);
}

export function formatAmount(quantity?: number | null, unit?: string): string {
  if (quantity === null || quantity === undefined || !Number.isFinite(quantity)) {
    return unit ? unit : '';
  }
  const amount = formatQuantity(quantity);
  return unit ? `${amount} ${unit}` : amount;
}

export function scaleQuantity(quantity: number | null | undefined, factor: number): number | null {
  if (quantity === null || quantity === undefined || !Number.isFinite(quantity)) return null;
  return Math.round(quantity * factor * 100) / 100;
}

const CATEGORY_KEYWORDS: Array<[GroceryCategory, string[]]> = [
  [
    'produce',
    [
      'apple', 'avocado', 'banana', 'basil', 'berry', 'broccoli', 'cabbage', 'carrot', 'celery',
      'chile', 'cilantro', 'corn', 'cucumber', 'eggplant', 'garlic', 'ginger', 'herb', 'kale',
      'leek', 'lemon', 'lettuce', 'lime', 'mushroom', 'onion', 'orange', 'parsley', 'peach',
      'pear', 'pepper', 'potato', 'scallion', 'shallot', 'spinach', 'squash', 'tomato', 'zucchini',
      'fruit', 'vegetable', 'salad', 'thyme', 'rosemary', 'mint', 'dill', 'sage', 'chive',
    ],
  ],
  [
    'meat',
    ['chicken', 'beef', 'pork', 'turkey', 'sausage', 'bacon', 'ham', 'lamb', 'steak', 'meatball', 'ground meat'],
  ],
  ['seafood', ['fish', 'salmon', 'shrimp', 'prawn', 'tuna', 'cod', 'halibut', 'sardine', 'anchovy', 'crab', 'scallop']],
  [
    'dairy',
    ['milk', 'butter', 'cheese', 'yogurt', 'yoghurt', 'cream', 'egg', 'feta', 'parmesan', 'mozzarella', 'halloumi', 'ricotta', 'buttermilk'],
  ],
  ['bakery', ['bread', 'tortilla', 'pita', 'bagel', 'bun', 'baguette', 'roll', 'naan', 'sourdough']],
  [
    'pantry',
    [
      'flour', 'sugar', 'salt', 'pepper', 'oil', 'vinegar', 'sauce', 'paste', 'broth', 'stock',
      'bean', 'chickpea', 'lentil', 'rice', 'pasta', 'noodle', 'oat', 'quinoa', 'cereal', 'spice',
      'paprika', 'cumin', 'cinnamon', 'chili powder', 'honey', 'syrup', 'mustard', 'mayonnaise',
      'tahini', 'peanut butter', 'coconut milk', 'tomato paste', 'canned', 'tuna can', 'baking',
      'yeast', 'cornstarch', 'breadcrumb', 'nut', 'seed', 'raisin', 'date', 'chocolate', 'vanilla',
      'coffee', 'tea', 'miso', 'soy sauce', 'hot sauce', 'jam', 'stock cube',
    ],
  ],
  ['frozen', ['frozen', 'ice cream', 'peas', 'edamame']],
  ['drinks', ['juice', 'wine', 'beer', 'soda', 'sparkling water', 'seltzer', 'kombucha']],
  ['household', ['paper towel', 'soap', 'detergent', 'foil', 'plastic wrap', 'trash bag', 'toothpaste', 'sponge']],
];

export function inferCategory(name: string): GroceryCategory {
  const normalized = normalizeName(name);
  // Produce names often double as drink names ("orange juice", "tomato juice"),
  // so settle the drinks case before scanning the produce keywords.
  if (/\b(juice|lemonade|smoothie)\b/.test(normalized)) return 'drinks';
  for (const [category, keywords] of CATEGORY_KEYWORDS) {
    for (const keyword of keywords) {
      if (normalized === keyword || normalized.includes(keyword)) return category;
    }
  }
  return 'other';
}
