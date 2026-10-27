import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarPlus,
  ChefHat,
  Clock,
  Minus,
  Pencil,
  Plus,
  Printer,
  Trash2,
  Users,
} from 'lucide-react';
import type { Recipe } from '../../shared/types';
import { formatAmount, scaleQuantity } from '../../shared/units';
import { mealTimeMinutes, recipeUsageCount, removeMealsForRecipe } from '../../shared/plans';
import { RecipeArt } from '../components/RecipeArt';
import { RecipeForm } from '../components/RecipeForm';
import { AddToPlanDialog } from '../components/AddToPlanDialog';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/ui';
import { useApp } from '../state/AppProvider';
import { useToast } from '../state/ToastProvider';
import { useDocumentTitle } from '../lib/hooks';
import { cx, formatMinutes, plural, tagLabel } from '../lib/utils';

export function RecipeDetailPage() {
  const { recipeId } = useParams();
  const navigate = useNavigate();
  const { recipes, plans, commitRecipes, commitPlans } = useApp();
  const { toast } = useToast();
  const recipe = recipes.find((item) => item.id === recipeId);

  const [servings, setServings] = useState(recipe?.servings ?? 4);
  const [formOpen, setFormOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useDocumentTitle(recipe?.title);

  useEffect(() => {
    if (recipe) setServings(recipe.servings);
  }, [recipe]);

  const usage = useMemo(
    () => (recipe ? recipeUsageCount(plans, recipe.id) : 0),
    [plans, recipe],
  );

  if (!recipe) {
    return (
      <div className="page">
        <EmptyState
          icon={<ChefHat size={26} />}
          title="Recipe not found"
          description="It may have been deleted from your recipe box."
          action={<Link className="btn btn--primary" to="/recipes">Back to recipes</Link>}
        />
      </div>
    );
  }

  const totalMinutes = mealTimeMinutes(recipe);
  const factor = recipe.servings > 0 ? servings / recipe.servings : 1;

  const handleSave = (next: Recipe) => {
    commitRecipes((current) => current.map((item) => (item.id === next.id ? next : item)));
    toast('Recipe updated.', 'success');
  };

  const handleDelete = () => {
    commitPlans((current) => removeMealsForRecipe(current, recipe.id));
    commitRecipes((current) => current.filter((item) => item.id !== recipe.id));
    toast(`Deleted ${recipe.title}.`, 'success');
    navigate('/recipes');
  };

  return (
    <div className="page recipe-detail">
      <Link to="/recipes" className="back-link">
        <ArrowLeft size={15} /> Recipe box
      </Link>

      <header className="recipe-hero">
        <div className="recipe-hero__text">
          <div className="tag-row">
            {recipe.tags.map((tag) => (
              <span key={tag} className="tag">{tagLabel(tag)}</span>
            ))}
            {usage > 0 && <span className="tag tag--accent">On the plan · {usage}</span>}
          </div>
          <h1 className="recipe-title">{recipe.title}</h1>
          {recipe.description && <p className="recipe-description">{recipe.description}</p>}

          <div className="recipe-meta">
            <span><Users size={15} /> {recipe.servings} servings as written</span>
            {totalMinutes > 0 && <span><Clock size={15} /> {formatMinutes(totalMinutes)} total</span>}
            {recipe.prepMinutes ? <span className="recipe-meta__quiet">Prep {recipe.prepMinutes} min</span> : null}
            {recipe.cookMinutes ? <span className="recipe-meta__quiet">Cook {recipe.cookMinutes} min</span> : null}
          </div>

          <div className="recipe-actions">
            <button type="button" className="btn btn--primary" onClick={() => setPlanOpen(true)}>
              <CalendarPlus size={16} /> Add to plan
            </button>
            <button type="button" className="btn btn--secondary" onClick={() => setFormOpen(true)}>
              <Pencil size={15} /> Edit
            </button>
            <button type="button" className="icon-btn" onClick={() => window.print()} aria-label="Print recipe" title="Print recipe">
              <Printer size={16} />
            </button>
            <button
              type="button"
              className="icon-btn icon-btn--danger"
              onClick={() => setDeleteOpen(true)}
              aria-label="Delete recipe"
              title="Delete recipe"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        <RecipeArt id={recipe.id} title={recipe.title} image={recipe.image} className="recipe-hero__art" />
      </header>

      <div className="recipe-layout">
        <aside className="recipe-panel recipe-panel--ingredients">
          <div className="recipe-panel__head">
            <h2>Ingredients</h2>
            <div className="stepper stepper--small" aria-label="Adjust servings">
              <button
                type="button"
                className="stepper__btn"
                onClick={() => setServings((value) => Math.max(0.5, Math.round((value - 0.5) * 10) / 10))}
                aria-label="Fewer servings"
              >
                <Minus size={13} />
              </button>
              <span className="stepper__value">{servings}</span>
              <button
                type="button"
                className="stepper__btn"
                onClick={() => setServings((value) => Math.min(100, Math.round((value + 0.5) * 10) / 10))}
                aria-label="More servings"
              >
                <Plus size={13} />
              </button>
            </div>
          </div>
          <p className="recipe-panel__hint">
            {factor === 1 ? 'As written' : `Scaled from ${recipe.servings} servings`}
            {factor !== 1 && (
              <button type="button" className="link-btn" onClick={() => setServings(recipe.servings)}>
                reset
              </button>
            )}
          </p>

          <ul className="ingredient-list">
            {recipe.ingredients.map((ingredient) => (
              <li key={ingredient.id} className="ingredient">
                <span className="ingredient__name">
                  {ingredient.name}
                  {ingredient.note && <small>{ingredient.note}</small>}
                </span>
                <span className="ingredient__dots" aria-hidden="true" />
                <span className="ingredient__amount">
                  {formatAmount(scaleQuantity(ingredient.quantity, factor), ingredient.unit) || 'to taste'}
                </span>
              </li>
            ))}
          </ul>
        </aside>

        <section className="recipe-panel recipe-panel--method">
          <div className="recipe-panel__head">
            <h2>Method</h2>
            <span className="recipe-panel__count">{plural(recipe.steps.length, 'step')}</span>
          </div>
          <ol className="method-list">
            {recipe.steps.map((step, index) => (
              <li key={index} className="method-step">
                <span className="method-step__num">{String(index + 1).padStart(2, '0')}</span>
                <p>{step}</p>
              </li>
            ))}
          </ol>
          {recipe.steps.length === 0 && <p className="muted">No method written yet.</p>}
        </section>
      </div>

      {recipe.notes && (
        <section className="notes-card">
          <span className="notes-card__label">Notes from your kitchen</span>
          <p>{recipe.notes}</p>
        </section>
      )}

      <p className="recipe-footnote">
        Saved in <code>data/recipes.json</code> · last edited {new Date(recipe.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
      </p>

      <RecipeForm open={formOpen} onClose={() => setFormOpen(false)} recipe={recipe} onSave={handleSave} />
      <AddToPlanDialog open={planOpen} onClose={() => setPlanOpen(false)} recipe={recipe} />
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete this recipe?"
        message={
          <div>
            <p><strong>{recipe.title}</strong> will be removed from your recipe box.</p>
            {usage > 0 && (
              <p className={cx('confirm-message__warning')}>
                It is on {plural(usage, 'planned meal')}. Those meals will be removed from your plans too.
              </p>
            )}
          </div>
        }
        confirmLabel="Delete recipe"
      />
    </div>
  );
}
