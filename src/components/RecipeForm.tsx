import { useEffect, useId, useState } from 'react';
import type { FormEvent } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { GroceryCategory, Ingredient, Recipe } from '../../shared/types';
import { CATEGORY_LABEL, GROCERY_CATEGORIES } from '../../shared/types';
import { Modal } from './Modal';
import { FieldError } from './ui';
import { cx, newId } from '../lib/utils';

interface IngredientDraft {
  id: string;
  quantity: string;
  unit: string;
  name: string;
  category: GroceryCategory | '';
  note: string;
}

interface Draft {
  title: string;
  description: string;
  servings: string;
  prep: string;
  cook: string;
  tags: string;
  image: string;
  notes: string;
  ingredients: IngredientDraft[];
  steps: string[];
}

function emptyIngredient(): IngredientDraft {
  return { id: newId('ing'), quantity: '', unit: '', name: '', category: '', note: '' };
}

function draftFrom(recipe?: Recipe | null): Draft {
  if (!recipe) {
    return {
      title: '',
      description: '',
      servings: '4',
      prep: '',
      cook: '',
      tags: '',
      image: '',
      notes: '',
      ingredients: [emptyIngredient(), emptyIngredient(), emptyIngredient()],
      steps: [''],
    };
  }

  return {
    title: recipe.title,
    description: recipe.description ?? '',
    servings: String(recipe.servings),
    prep: recipe.prepMinutes ? String(recipe.prepMinutes) : '',
    cook: recipe.cookMinutes ? String(recipe.cookMinutes) : '',
    tags: recipe.tags.join(', '),
    image: recipe.image ?? '',
    notes: recipe.notes ?? '',
    ingredients: recipe.ingredients.map((ingredient) => ({
      id: ingredient.id,
      quantity: ingredient.quantity === null || ingredient.quantity === undefined ? '' : String(ingredient.quantity),
      unit: ingredient.unit ?? '',
      name: ingredient.name,
      category: ingredient.category ?? '',
      note: ingredient.note ?? '',
    })),
    steps: recipe.steps.length > 0 ? recipe.steps : [''],
  };
}

function parseNumber(value: string): number | null {
  const trimmed = value.trim().replace(',', '.');
  if (!trimmed) return null;
  const number = Number(trimmed);
  return Number.isFinite(number) ? number : null;
}

export function RecipeForm({
  open,
  onClose,
  recipe,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  recipe?: Recipe | null;
  onSave: (recipe: Recipe) => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => draftFrom(recipe));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const formId = useId();

  useEffect(() => {
    if (!open) return;
    setDraft(draftFrom(recipe));
    setErrors({});
  }, [open, recipe]);

  const update = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const updateIngredient = (id: string, patch: Partial<IngredientDraft>) => {
    setDraft((current) => ({
      ...current,
      ingredients: current.ingredients.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));
  };

  const removeIngredient = (id: string) => {
    setDraft((current) => ({ ...current, ingredients: current.ingredients.filter((item) => item.id !== id) }));
  };

  const addIngredient = () => {
    setDraft((current) => ({ ...current, ingredients: [...current.ingredients, emptyIngredient()] }));
  };

  const updateStep = (index: number, value: string) => {
    setDraft((current) => ({
      ...current,
      steps: current.steps.map((step, stepIndex) => (stepIndex === index ? value : step)),
    }));
  };

  const addStep = () => {
    setDraft((current) => ({ ...current, steps: [...current.steps, ''] }));
  };

  const removeStep = (index: number) => {
    setDraft((current) => ({
      ...current,
      steps: current.steps.length === 1 ? [''] : current.steps.filter((_, stepIndex) => stepIndex !== index),
    }));
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    const title = draft.title.trim();
    const servings = parseNumber(draft.servings);

    if (!title) nextErrors.title = 'Give the recipe a title.';
    if (!servings || servings <= 0) nextErrors.servings = 'Servings must be greater than zero.';
    if (draft.image.trim() && !/^https?:\/\//i.test(draft.image.trim())) {
      nextErrors.image = 'Use a full http(s) image URL, or leave it blank.';
    }

    const ingredients: Ingredient[] = draft.ingredients
      .filter((item) => item.name.trim())
      .map((item) => {
        const quantity = parseNumber(item.quantity);
        return {
          id: item.id,
          name: item.name.trim(),
          quantity,
          unit: item.unit.trim() || undefined,
          category: item.category || undefined,
          note: item.note.trim() || undefined,
        };
      });

    if (ingredients.length === 0) {
      nextErrors.ingredients = 'Add at least one ingredient.';
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const now = new Date().toISOString();
    const tags = Array.from(
      new Set(
        draft.tags
          .split(/[,\n]/)
          .map((tag) => tag.trim().toLowerCase())
          .filter(Boolean)
          .slice(0, 16),
      ),
    );

    const result: Recipe = {
      id: recipe?.id ?? newId('r'),
      title,
      description: draft.description.trim() || undefined,
      servings: servings ?? 4,
      prepMinutes: parseNumber(draft.prep) ?? undefined,
      cookMinutes: parseNumber(draft.cook) ?? undefined,
      tags,
      ingredients,
      steps: draft.steps.map((step) => step.trim()).filter(Boolean),
      notes: draft.notes.trim() || undefined,
      image: draft.image.trim() || undefined,
      createdAt: recipe?.createdAt ?? now,
      updatedAt: now,
    };

    onSave(result);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={recipe ? 'Edit recipe' : 'New recipe'}
      description={recipe ? 'Changes are committed to your GitHub recipe box.' : 'A new page for your recipe box.'}
      size="xl"
      bodyClassName="recipe-form-body"
      footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={onClose}>Cancel</button>
          <button type="submit" form={formId} className="btn btn--primary">
            {recipe ? 'Save changes' : 'Add recipe'}
          </button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="recipe-form">
        <section className="form-section">
          <div className="form-section__head">
            <h3>The basics</h3>
            <span>Name it the way you would say it out loud.</span>
          </div>

          <label className="field">
            <span className="field__label">Title</span>
            <input
              value={draft.title}
              onChange={(event) => update('title', event.target.value)}
              placeholder="Miso butter salmon"
              maxLength={120}
              autoFocus
            />
            <FieldError>{errors.title}</FieldError>
          </label>

          <label className="field">
            <span className="field__label">Description <span className="field__optional">optional</span></span>
            <textarea
              value={draft.description}
              onChange={(event) => update('description', event.target.value)}
              placeholder="What makes this one worth cooking again?"
              rows={2}
              maxLength={600}
            />
          </label>

          <div className="form-row form-row--4">
            <label className="field">
              <span className="field__label">Servings</span>
              <input
                type="number"
                min={0.5}
                max={100}
                step={0.5}
                value={draft.servings}
                onChange={(event) => update('servings', event.target.value)}
              />
              <FieldError>{errors.servings}</FieldError>
            </label>
            <label className="field">
              <span className="field__label">Prep (min)</span>
              <input
                type="number"
                min={0}
                step={5}
                value={draft.prep}
                onChange={(event) => update('prep', event.target.value)}
                placeholder="10"
              />
            </label>
            <label className="field">
              <span className="field__label">Cook (min)</span>
              <input
                type="number"
                min={0}
                step={5}
                value={draft.cook}
                onChange={(event) => update('cook', event.target.value)}
                placeholder="25"
              />
            </label>
            <label className="field">
              <span className="field__label">Tags</span>
              <input
                value={draft.tags}
                onChange={(event) => update('tags', event.target.value)}
                placeholder="dinner, quick, vegan"
                maxLength={300}
              />
            </label>
          </div>
          <p className="field__hint">Separate tags with commas. They power the filters and the planner.</p>

          <label className="field">
            <span className="field__label">Image URL <span className="field__optional">optional</span></span>
            <input
              value={draft.image}
              onChange={(event) => update('image', event.target.value)}
              placeholder="https://images.example.com/salmon.jpg"
              inputMode="url"
            />
            <FieldError>{errors.image}</FieldError>
          </label>
        </section>

        <section className="form-section">
          <div className="form-section__head">
            <h3>Ingredients</h3>
            <span>Leave the amount blank for “to taste”.</span>
          </div>

          <div className="ingredient-table" role="group" aria-label="Ingredients">
            {draft.ingredients.map((ingredient, index) => (
              <div className="ingredient-edit" key={ingredient.id}>
                <div className="ingredient-edit__row">
                  <input
                    className="ingredient-edit__qty"
                    type="number"
                    min={0}
                    step="any"
                    value={ingredient.quantity}
                    onChange={(event) => updateIngredient(ingredient.id, { quantity: event.target.value })}
                    placeholder="2"
                    aria-label={`Amount for ingredient ${index + 1}`}
                  />
                  <input
                    className="ingredient-edit__unit"
                    value={ingredient.unit}
                    onChange={(event) => updateIngredient(ingredient.id, { unit: event.target.value })}
                    placeholder="tbsp"
                    list="unit-suggestions"
                    aria-label={`Unit for ingredient ${index + 1}`}
                  />
                  <input
                    className="ingredient-edit__name"
                    value={ingredient.name}
                    onChange={(event) => updateIngredient(ingredient.id, { name: event.target.value })}
                    placeholder="Olive oil"
                    aria-label={`Ingredient ${index + 1}`}
                  />
                  <select
                    className="ingredient-edit__category"
                    value={ingredient.category}
                    onChange={(event) =>
                      updateIngredient(ingredient.id, { category: event.target.value as GroceryCategory | '' })
                    }
                    aria-label={`Category for ingredient ${index + 1}`}
                  >
                    <option value="">Auto aisle</option>
                    {GROCERY_CATEGORIES.map((category) => (
                      <option key={category} value={category}>{CATEGORY_LABEL[category]}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="icon-btn icon-btn--sm ingredient-edit__remove"
                    onClick={() => removeIngredient(ingredient.id)}
                    aria-label={`Remove ingredient ${index + 1}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <input
                  className="ingredient-edit__note"
                  value={ingredient.note}
                  onChange={(event) => updateIngredient(ingredient.id, { note: event.target.value })}
                  placeholder="Note (optional) — finely grated, or tamari for gluten-free"
                  aria-label={`Note for ingredient ${index + 1}`}
                />
              </div>
            ))}
          </div>

          <datalist id="unit-suggestions">
            {['tbsp', 'tsp', 'cup', 'g', 'kg', 'ml', 'l', 'oz', 'lb', 'clove', 'can', 'bunch', 'piece', 'slice', 'pinch'].map((unit) => (
              <option key={unit} value={unit} />
            ))}
          </datalist>

          <FieldError>{errors.ingredients}</FieldError>

          <button type="button" className="btn btn--secondary btn--sm" onClick={addIngredient}>
            <Plus size={14} /> Add ingredient
          </button>
        </section>

        <section className="form-section">
          <div className="form-section__head">
            <h3>Method</h3>
            <span>One step per box. Keep it human.</span>
          </div>

          <div className="steps-edit">
            {draft.steps.map((step, index) => (
              <div className="step-edit" key={index}>
                <span className="step-edit__num">{index + 1}</span>
                <textarea
                  value={step}
                  onChange={(event) => updateStep(index, event.target.value)}
                  rows={2}
                  placeholder={index === 0 ? 'Heat the oven to 220°C and line a sheet pan…' : 'Next step…'}
                  aria-label={`Step ${index + 1}`}
                />
                <button
                  type="button"
                  className="icon-btn icon-btn--sm"
                  onClick={() => removeStep(index)}
                  aria-label={`Remove step ${index + 1}`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          <button type="button" className="btn btn--secondary btn--sm" onClick={addStep}>
            <Plus size={14} /> Add step
          </button>
        </section>

        <section className="form-section">
          <div className="form-section__head">
            <h3>Notes</h3>
            <span>Substitutions, make-ahead tips, the thing you always forget.</span>
          </div>
          <label className="field">
            <span className="field__label visually-hidden">Notes</span>
            <textarea
              value={draft.notes}
              onChange={(event) => update('notes', event.target.value)}
              rows={3}
              maxLength={4000}
              placeholder="Serve with rice. Leftovers keep for two days."
            />
          </label>
        </section>

        <div className={cx('recipe-form__end')}>
          <span>Saved as a commit in <code>data/recipes.json</code>.</span>
        </div>
      </form>
    </Modal>
  );
}
