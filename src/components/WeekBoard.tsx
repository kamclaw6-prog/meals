import { AlertTriangle, Clock, Plus, Users, X } from 'lucide-react';
import type { Meal, MealSlot, Recipe } from '../../shared/types';
import { MEAL_SLOTS, MEAL_SLOT_LABEL } from '../../shared/types';
import { formatDayNumber, formatDayShort, isToday, weekDates } from '../../shared/dates';
import { mealTimeMinutes } from '../../shared/plans';
import { cx, formatMinutes } from '../lib/utils';

const PRIMARY_SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner'];

export function WeekBoard({
  weekStart,
  meals,
  recipes,
  onAdd,
  onRemove,
  onOpenRecipe,
}: {
  weekStart: string;
  meals: Meal[];
  recipes: Recipe[];
  onAdd: (date: string, slot: MealSlot) => void;
  onRemove: (meal: Meal) => void;
  onOpenRecipe: (recipeId: string) => void;
}) {
  const recipesById = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  const dates = weekDates(weekStart);

  return (
    <div className="week-board">
      {dates.map((date) => {
        const today = isToday(date);
        const dayMeals = meals.filter((meal) => meal.date === date);
        const slots = MEAL_SLOTS.filter(
          (slot) => PRIMARY_SLOTS.includes(slot) || dayMeals.some((meal) => meal.slot === slot),
        );

        return (
          <section key={date} className={cx('week-day', today && 'is-today')} aria-label={`${formatDayShort(date)} ${formatDayNumber(date)}`}>
            <header className="day-head">
              <div className="day-head__date">
                <span className="day-name">{formatDayShort(date)}</span>
                <span className="day-date">{formatDayNumber(date)}</span>
              </div>
              {today && <span className="today-pill">Today</span>}
            </header>

            <div className="day-slots">
              {slots.map((slot) => {
                const slotMeals = dayMeals.filter((meal) => meal.slot === slot);
                return (
                  <div key={slot} className="slot" data-slot={slot}>
                    <div className="slot__label">
                      <span>{MEAL_SLOT_LABEL[slot]}</span>
                    </div>

                    {slotMeals.map((meal) => {
                      const recipe = recipesById.get(meal.recipeId);
                      const minutes = mealTimeMinutes(recipe);
                      return (
                        <div key={meal.id} className="meal">
                          <button
                            type="button"
                            className="meal__main"
                            onClick={() => recipe && onOpenRecipe(recipe.id)}
                            disabled={!recipe}
                            title={recipe ? `Open ${recipe.title}` : 'Recipe no longer exists'}
                          >
                            <span className="meal__title">
                              {recipe?.title ?? 'Recipe unavailable'}
                              {!recipe && <AlertTriangle size={12} className="meal__warn" />}
                            </span>
                            <span className="meal__meta">
                              <span><Users size={10} /> {meal.servings}</span>
                              {minutes > 0 && <span><Clock size={10} /> {formatMinutes(minutes)}</span>}
                            </span>
                          </button>
                          <button
                            type="button"
                            className="meal__remove"
                            onClick={() => onRemove(meal)}
                            aria-label={`Remove ${recipe?.title ?? 'meal'} from ${MEAL_SLOT_LABEL[slot].toLowerCase()}`}
                          >
                            <X size={12} />
                          </button>
                        </div>
                      );
                    })}

                    <button type="button" className="slot-add" onClick={() => onAdd(date, slot)}>
                      <Plus size={12} />
                      <span>{slotMeals.length > 0 ? 'Add another' : `Add ${slot}`}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
