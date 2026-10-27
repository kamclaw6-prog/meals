import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BookOpen, ChefHat, Plus, Search, SlidersHorizontal, Sparkles } from 'lucide-react';
import type { Recipe } from '../../shared/types';
import { RecipeCard } from '../components/RecipeCard';
import { RecipeForm } from '../components/RecipeForm';
import { AddToPlanDialog } from '../components/AddToPlanDialog';
import { EmptyState, PageHeader, Spinner } from '../components/ui';
import { useApp } from '../state/AppProvider';
import { useToast } from '../state/ToastProvider';
import { useDebouncedValue, useDocumentTitle } from '../lib/hooks';
import { mealTimeMinutes } from '../../shared/plans';
import { cx, plural, tagLabel } from '../lib/utils';

type SortMode = 'recent' | 'title' | 'quick';

export function RecipesPage() {
  const { recipes, firstRunEmpty, commitRecipes, seedStarterData } = useApp();
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [tag, setTag] = useState<string | null>(null);
  const [sort, setSort] = useState<SortMode>('recent');
  const [formOpen, setFormOpen] = useState(false);
  const [planRecipe, setPlanRecipe] = useState<Recipe | null>(null);
  const [seeding, setSeeding] = useState(false);

  useDocumentTitle('Recipes');

  useEffect(() => {
    if (params.get('new') === '1') {
      setFormOpen(true);
      const next = new URLSearchParams(params);
      next.delete('new');
      setParams(next, { replace: true });
    }
  }, [params, setParams]);

  const debouncedSearch = useDebouncedValue(search);

  const tags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const recipe of recipes) {
      for (const value of recipe.tags) counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 12);
  }, [recipes]);

  const filtered = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    const list = recipes.filter((recipe) => {
      if (tag && !recipe.tags.includes(tag)) return false;
      if (!query) return true;
      return (
        recipe.title.toLowerCase().includes(query) ||
        recipe.description?.toLowerCase().includes(query) ||
        recipe.tags.some((value) => value.includes(query)) ||
        recipe.ingredients.some((ingredient) => ingredient.name.toLowerCase().includes(query))
      );
    });

    return list.sort((a, b) => {
      if (sort === 'title') return a.title.localeCompare(b.title);
      if (sort === 'quick') return mealTimeMinutes(a) - mealTimeMinutes(b) || a.title.localeCompare(b.title);
      return b.updatedAt.localeCompare(a.updatedAt) || a.title.localeCompare(b.title);
    });
  }, [recipes, debouncedSearch, tag, sort]);

  const handleSave = (recipe: Recipe) => {
    commitRecipes((current) => {
      const exists = current.some((item) => item.id === recipe.id);
      return exists ? current.map((item) => (item.id === recipe.id ? recipe : item)) : [recipe, ...current];
    });
    toast('Recipe saved to your GitHub recipe box.', 'success');
  };

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await seedStarterData();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not load starter recipes.', 'error');
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="page">
      <PageHeader
        eyebrow={<><BookOpen size={13} /> Recipe box</>}
        title="Recipes"
        description={
          recipes.length === 0
            ? 'The best part of a meal plan: things you actually want to cook.'
            : `${plural(recipes.length, 'recipe')}, ready to plan. Search by ingredient when the fridge is nearly empty.`
        }
        actions={
          <button type="button" className="btn btn--primary" onClick={() => setFormOpen(true)}>
            <Plus size={16} /> New recipe
          </button>
        }
      />

      {recipes.length > 0 && (
        <div className="toolbar">
          <div className="search-field">
            <Search size={16} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search titles, ingredients, tags…"
              aria-label="Search recipes"
            />
            {search && (
              <button type="button" className="search-field__clear" onClick={() => setSearch('')}>
                Clear
              </button>
            )}
          </div>

          <div className="toolbar__right">
            <label className="select-inline">
              <SlidersHorizontal size={14} />
              <span className="visually-hidden">Sort recipes</span>
              <select value={sort} onChange={(event) => setSort(event.target.value as SortMode)}>
                <option value="recent">Recently updated</option>
                <option value="title">A–Z</option>
                <option value="quick">Quickest first</option>
              </select>
            </label>
          </div>
        </div>
      )}

      {tags.length > 0 && (
        <div className="tag-filter tag-filter--page" role="group" aria-label="Filter by tag">
          <button type="button" className={cx('tag-chip', tag === null && 'is-active')} onClick={() => setTag(null)}>
            All recipes
          </button>
          {tags.map(([value, count]) => (
            <button
              key={value}
              type="button"
              className={cx('tag-chip', tag === value && 'is-active')}
              onClick={() => setTag(tag === value ? null : value)}
            >
              {tagLabel(value)} <span className="tag-chip__count">{count}</span>
            </button>
          ))}
        </div>
      )}

      {recipes.length === 0 ? (
        <EmptyState
          className="empty--large"
          icon={<ChefHat size={26} />}
          title="Your recipe box is waiting"
          description={
            firstRunEmpty
              ? 'Start from scratch, or add a starter box of twelve recipes, a week’s plan and a grocery list — saved as commits in your repo.'
              : 'Add the first thing you love cooking. Ingredients and method become the building blocks for plans and lists.'
          }
          action={
            <div className="empty__actions">
              <button type="button" className="btn btn--primary" onClick={() => setFormOpen(true)}>
                <Plus size={16} /> Add a recipe
              </button>
              {firstRunEmpty && (
                <button type="button" className="btn btn--secondary" onClick={() => void handleSeed()} disabled={seeding}>
                  {seeding ? <Spinner size={15} /> : <Sparkles size={15} />}
                  {seeding ? 'Adding…' : 'Load starter recipes'}
                </button>
              )}
            </div>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No recipes matched"
          description="Try a shorter search, another tag, or clear the filters."
          action={
            <button type="button" className="btn btn--secondary" onClick={() => { setSearch(''); setTag(null); }}>
              Clear filters
            </button>
          }
        />
      ) : (
        <>
          <div className="recipe-grid">
            {filtered.map((recipe) => (
              <RecipeCard key={recipe.id} recipe={recipe} onPlan={() => setPlanRecipe(recipe)} />
            ))}
          </div>
          <p className="results-count">
            Showing {filtered.length} of {plural(recipes.length, 'recipe')}
            {tag && <> tagged <strong>{tagLabel(tag)}</strong></>}.
          </p>
        </>
      )}

      <RecipeForm open={formOpen} onClose={() => setFormOpen(false)} onSave={handleSave} />

      {planRecipe && (
        <AddToPlanDialog
          open={Boolean(planRecipe)}
          onClose={() => setPlanRecipe(null)}
          recipe={planRecipe}
        />
      )}

      <button
        type="button"
        className="fab"
        onClick={() => setFormOpen(true)}
        aria-label="New recipe"
        title="New recipe"
      >
        <Plus size={22} />
      </button>
    </div>
  );
}
