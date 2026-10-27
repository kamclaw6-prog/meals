import { describe, expect, it } from 'vitest';
import {
  formatAmount,
  formatQuantity,
  inferCategory,
  ingredientKey,
  normalizeName,
  normalizeUnit,
  scaleQuantity,
} from '../shared/units';

describe('normalizeUnit', () => {
  it('maps aliases to canonical short units', () => {
    expect(normalizeUnit('tablespoons')).toBe('tbsp');
    expect(normalizeUnit('  Tsp. ')).toBe('tsp');
    expect(normalizeUnit('Cups')).toBe('cup');
    expect(normalizeUnit('pounds')).toBe('lb');
    expect(normalizeUnit('tin')).toBe('can');
  });

  it('keeps unknown units lowercased and handles empty values', () => {
    expect(normalizeUnit('Handful')).toBe('handful');
    expect(normalizeUnit('pinch')).toBe('pinch');
    expect(normalizeUnit('')).toBe('');
    expect(normalizeUnit(undefined)).toBe('');
    expect(normalizeUnit(null)).toBe('');
  });
});

describe('normalizeName', () => {
  it('strips accents, punctuation and extra whitespace', () => {
    expect(normalizeName('  Crème   Fraîche ')).toBe('creme fraiche');
    expect(normalizeName('Tomatoes (ripe)')).toBe('tomatoes ripe');
  });

  it('singularizes regular and irregular plurals', () => {
    expect(normalizeName('carrots')).toBe('carrot');
    expect(normalizeName('cherries')).toBe('cherry');
    expect(normalizeName('tomatoes')).toBe('tomato');
    expect(normalizeName('loaves')).toBe('loaf');
  });

  it('leaves words that already end in s alone', () => {
    expect(normalizeName('asparagus')).toBe('asparagus');
    expect(normalizeName('hummus')).toBe('hummus');
    expect(normalizeName('glass')).toBe('glass');
  });

  it('handles multi-word names', () => {
    expect(normalizeName('Spring Onions')).toBe('spring onion');
    expect(normalizeName('olive oil')).toBe('olive oil');
  });
});

describe('ingredientKey', () => {
  it('matches the same ingredient across names and unit aliases', () => {
    expect(ingredientKey('Tomatoes', 'cups')).toBe(ingredientKey('tomato', 'cup'));
    expect(ingredientKey('Flour')).toBe('flour|');
    expect(ingredientKey('milk', 'liters')).toBe('milk|l');
  });

  it('keeps different units separate', () => {
    expect(ingredientKey('flour', 'g')).not.toBe(ingredientKey('flour', 'cup'));
  });
});

describe('quantities', () => {
  it('formats fractions and whole numbers', () => {
    expect(formatQuantity(0)).toBe('0');
    expect(formatQuantity(1)).toBe('1');
    expect(formatQuantity(0.5)).toBe('1/2');
    expect(formatQuantity(1.25)).toBe('1 1/4');
    expect(formatQuantity(2 / 3)).toBe('2/3');
    expect(formatQuantity(1.5)).toBe('1 1/2');
    expect(formatQuantity(12)).toBe('12');
  });

  it('falls back to tidy decimals for metric amounts', () => {
    expect(formatQuantity(2.1)).toBe('2.1');
    expect(formatQuantity(0.31)).toBe('0.31');
  });

  it('formats unmeasured ingredients', () => {
    expect(formatAmount(null, 'pinch')).toBe('pinch');
    expect(formatAmount(undefined)).toBe('');
    expect(formatAmount(2, 'tbsp')).toBe('2 tbsp');
    expect(formatAmount(1.5)).toBe('1 1/2');
  });

  it('scales and rounds to two decimals', () => {
    expect(scaleQuantity(3, 1.5)).toBe(4.5);
    expect(scaleQuantity(1, 1 / 3)).toBe(0.33);
    expect(scaleQuantity(null, 2)).toBeNull();
    expect(scaleQuantity(undefined, 2)).toBeNull();
  });
});

describe('inferCategory', () => {
  it('files ingredients by aisle keywords', () => {
    expect(inferCategory('Roma tomatoes')).toBe('produce');
    expect(inferCategory('chicken thighs')).toBe('meat');
    expect(inferCategory('smoked salmon')).toBe('seafood');
    expect(inferCategory('whole milk')).toBe('dairy');
    expect(inferCategory('sourdough loaf')).toBe('bakery');
    expect(inferCategory('olive oil')).toBe('pantry');
    expect(inferCategory('frozen peas')).toBe('frozen');
    expect(inferCategory('orange juice')).toBe('drinks');
    expect(inferCategory('dish soap')).toBe('household');
    expect(inferCategory('mystery ingredient')).toBe('other');
  });
});
