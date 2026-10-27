import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Plus, Search, Users } from 'lucide-react';
import type { MealSlot, Recipe } from '../../shared/types';
import { MEAL_SLOT_LABEL } from '../../shared/types';
import { formatLongDate } from '../../shared/dates';
import { mealTimeMinutes, recipesForMealSlot } from '../../shared/plans';
import { Modal } from './Modal';
import { RecipeArt } from './RecipeArt';
import { EmptyState } from './ui';
import { useApp } from '../state/AppProvider';
import { cx, formatMinutes, tagLabel } from '../lib/utils';

export function RecipePicker({
  open,
  onClose,
  onPick,
  date,
  slot,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (recipe: Recipe) => void;
  date: string | null;
  slot: MealSlot;
}) {
  const { recipes } = useApp();
  const [search, setSearch] = useState('');
  const [tag, setTag] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSearch('');
    setTag(null);
  }, [open, date, slot]);

  const tags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const recipe of recipes) {
      for (const recipeTag of recipe.tags) counts.set(recipeTag, (counts.get(recipeTag) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 8)
      .map(([value]) => value);
  }, [recipes]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return recipesForMealSlot(recipes, slot).filter((recipe) => {
      if (tag && !recipe.tags.includes(tag)) return false;
      if (!query) return true;
      return (
        recipe.title.toLowerCase().includes(query) ||
        recipe.description?.toLowerCase().includes(query) ||
        recipe.tags.some((recipeTag) => recipeTag.includes(query)) ||
        recipe.ingredients.some((ingredient) => ingredient.name.toLowerCase().includes(query))
      );
    });
  }, [recipes, search, tag, slot]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={date ? `Add to ${formatLongDate(date)} ${MEAL_SLOT_LABEL[slot].toLowerCase()}` : 'Choose a recipe'}
      description="Pick something from your recipe box. You can adjust servings later."
      bodyClassName="picker"
    >
      <div className="picker__search">
        <Search size={16} />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search recipes, ingredients, tags…"
          autoFocus
          aria-label="Search recipes"
        />
        {search && (
          <button type="button" className="picker__clear" onClick={() => setSearch('')}>
            Clear
          </button>
        )}
      </div>

      {tags.length > 0 && (
        <div className="tag-filter" role="group" aria-label="Filter by tag">
          <button type="button" className={cx('tag-chip', tag === null && 'is-active')} onClick={() => setTag(null)}>
            All
          </button>
          {tags.map((value) => (
            <button
              key={value}
              type="button"
              className={cx('tag-chip', tag === value && 'is-active')}
              onClick={() => setTag(tag === value ? null : value)}
            >
              {tagLabel(value)}
            </button>
          ))}
        </div>
      )}

      {recipes.length === 0 ? (
        <EmptyState
          title="Your recipe box is empty"
          description="Add a recipe first, then come back to plan it."
          action={
            <Link className="btn btn--primary" to="/recipes?new=1" onClick={onClose}>
              <Plus size={16} /> Create a recipe
            </Link>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Nothing matched"
          description="Try a different ingredient, tag, or clear the filters."
          action={
            <button type="button" className="btn btn--secondary" onClick={() => { setSearch(''); setTag(null); }}>
              Clear filters
            </button>
          }
        />
      ) : (
        <ul className="picker-list">
          {filtered.map((recipe) => {
            const minutes = mealTimeMinutes(recipe);
            return (
              <li key={recipe.id}>
                <button
                  type="button"
                  className="picker-row"
                  onClick={() => {
                    onPick(recipe);
                    onClose();
                  }}
                >
                  <RecipeArt id={recipe.id} title={recipe.title} image={recipe.image} className="picker-row__art" />
                  <span className="picker-row__text">
                    <span className="picker-row__title">{recipe.title}</span>
                    <span className="picker-row__meta">
                      <span><Users size={11} /> {recipe.servings}</span>
                      {minutes > 0 && <span><Clock size={11} /> {formatMinutes(minutes)}</span>}
                      {recipe.tags.slice(0, 2).map((value) => (
                        <span key={value} className="picker-row__tag">{tagLabel(value)}</span>
                      ))}
                    </span>
                  </span>
                  <span className="picker-row__add"><Plus size={15} /> Add</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="picker__footer">
        <span>Your recipes live in GitHub, so they travel with you.</span>
        <Link className="btn btn--ghost btn--sm" to="/recipes?new=1" onClick={onClose}>
          <Plus size={14} /> New recipe
        </Link>
      </div>
    </Modal>
  );
}
