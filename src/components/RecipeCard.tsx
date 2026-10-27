import { Link } from 'react-router-dom';
import { CalendarPlus, Clock, Users } from 'lucide-react';
import type { Recipe } from '../../shared/types';
import { mealTimeMinutes } from '../../shared/plans';
import { RecipeArt } from './RecipeArt';
import { formatMinutes, tagLabel } from '../lib/utils';

export function RecipeCard({ recipe, onPlan }: { recipe: Recipe; onPlan: () => void }) {
  const minutes = mealTimeMinutes(recipe);

  return (
    <article className="recipe-card">
      <Link to={`/recipes/${recipe.id}`} className="recipe-card__link">
        <RecipeArt id={recipe.id} title={recipe.title} image={recipe.image} className="recipe-card__art" />
        <div className="recipe-card__body">
          <h3 className="recipe-card__title">{recipe.title}</h3>
          {recipe.description && <p className="recipe-card__desc">{recipe.description}</p>}
          <div className="recipe-card__meta">
            <span><Users size={13} /> {recipe.servings} servings</span>
            {minutes > 0 && <span><Clock size={13} /> {formatMinutes(minutes)}</span>}
          </div>
          {recipe.tags.length > 0 && (
            <div className="tag-row">
              {recipe.tags.slice(0, 3).map((tag) => (
                <span key={tag} className="tag">{tagLabel(tag)}</span>
              ))}
              {recipe.tags.length > 3 && <span className="tag tag--muted">+{recipe.tags.length - 3}</span>}
            </div>
          )}
        </div>
      </Link>
      <div className="recipe-card__actions">
        <button type="button" className="btn btn--ghost btn--sm" onClick={onPlan}>
          <CalendarPlus size={14} /> Add to plan
        </button>
        <Link to={`/recipes/${recipe.id}`} className="btn btn--ghost btn--sm recipe-card__open">
          Open
        </Link>
      </div>
    </article>
  );
}
