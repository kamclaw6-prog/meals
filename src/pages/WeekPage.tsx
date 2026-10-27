import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  ChefHat,
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  ShoppingBasket,
  Sparkles,
  Utensils,
} from 'lucide-react';
import type { Meal, MealSlot, Recipe } from '../../shared/types';
import { addDaysISO, formatWeekRange, startOfWeekISO, todayISO, weekStartFromDate } from '../../shared/dates';
import { addMeal, mealsForWeek, mealTimeMinutes, removeMeal } from '../../shared/plans';
import { WeekBoard } from '../components/WeekBoard';
import { RecipePicker } from '../components/RecipePicker';
import { GenerateGroceryDialog } from '../components/GenerateGroceryDialog';
import { PageHeader, Spinner, Stat } from '../components/ui';
import { useApp } from '../state/AppProvider';
import { useToast } from '../state/ToastProvider';
import { useDocumentTitle } from '../lib/hooks';
import { formatMinutes, newId, plural } from '../lib/utils';

export function WeekPage() {
  const { recipes, plans, commitPlans, firstRunEmpty, seedStarterData } = useApp();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [weekStart, setWeekStart] = useState(startOfWeekISO());
  const [picker, setPicker] = useState<{ date: string; slot: MealSlot } | null>(null);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const isCurrentWeek = weekStart === startOfWeekISO();
  const meals = mealsForWeek(plans, weekStart);
  const recipesById = useMemo(() => new Map(recipes.map((recipe) => [recipe.id, recipe])), [recipes]);

  const usedRecipes = useMemo(() => {
    const seen = new Set<string>();
    for (const meal of meals) {
      if (recipesById.has(meal.recipeId)) seen.add(meal.recipeId);
    }
    return Array.from(seen)
      .map((id) => recipesById.get(id))
      .filter((recipe): recipe is Recipe => Boolean(recipe));
  }, [meals, recipesById]);

  const totalMinutes = meals.reduce((sum, meal) => sum + mealTimeMinutes(recipesById.get(meal.recipeId)), 0);
  const openSlots = Math.max(0, 21 - meals.length);

  const title = isCurrentWeek ? 'This week' : `Week of ${formatWeekRange(weekStart).split(' – ')[0]}`;
  useDocumentTitle(isCurrentWeek ? 'This week' : title);

  const description =
    meals.length === 0
      ? 'A blank page. Add a meal, or start from something in your recipe box.'
      : `${plural(meals.length, 'meal')} planned from ${plural(usedRecipes.length, 'recipe')} · about ${formatMinutes(totalMinutes)} at the stove.`;

  const addRecipeToSlot = (recipe: Recipe) => {
    if (!picker) return;
    const meal: Meal = {
      id: newId('meal'),
      date: picker.date,
      slot: picker.slot,
      recipeId: recipe.id,
      servings: recipe.servings,
    };
    commitPlans((current) => addMeal(current, weekStartFromDate(picker.date), meal));
    toast(`${recipe.title} added to the plan.`, 'success');
  };

  const removeMealFromPlan = (meal: Meal) => {
    const recipe = recipesById.get(meal.recipeId);
    commitPlans((current) => removeMeal(current, weekStart, meal.id));
    toast(`Removed ${recipe?.title ?? 'meal'} from ${meal.date}.`);
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

  const openPickerForToday = () => {
    const date = isCurrentWeek ? todayISO() : weekStart;
    setPicker({ date, slot: 'dinner' });
  };

  return (
    <div className="page">
      <PageHeader
        eyebrow={<><CalendarDays size={13} /> Meal plan</>}
        title={title}
        description={description}
        actions={
          <>
            <button type="button" className="btn btn--secondary" onClick={() => setGenerateOpen(true)}>
              <ShoppingBasket size={16} /> Grocery list
            </button>
            <button type="button" className="btn btn--primary" onClick={openPickerForToday}>
              <Plus size={16} /> Add a meal
            </button>
          </>
        }
      />

      <div className="week-toolbar">
        <div className="week-nav">
          <button
            type="button"
            className="icon-btn"
            onClick={() => setWeekStart(addDaysISO(weekStart, -7))}
            aria-label="Previous week"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="week-nav__label">
            <span>Week of</span>
            <strong>{formatWeekRange(weekStart)}</strong>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={() => setWeekStart(addDaysISO(weekStart, 7))}
            aria-label="Next week"
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => setWeekStart(startOfWeekISO())}
          disabled={isCurrentWeek}
        >
          Jump to today
        </button>
        <div className="week-toolbar__spacer" />
        <span className="week-toolbar__note">
          {isCurrentWeek ? <><span className="live-dot" /> Live plan</> : 'Planning ahead'}
        </span>
      </div>

      <div className="stat-row">
        <Stat label="Meals planned" value={meals.length} hint={meals.length === 1 ? 'one good meal' : 'breakfast to dinner'} />
        <Stat label="Recipes used" value={usedRecipes.length} hint="from your box" />
        <Stat label="Kitchen time" value={formatMinutes(totalMinutes)} hint="prep + cook" />
        <Stat label="Open slots" value={openSlots} hint={openSlots === 0 ? 'fully planned' : 'room to play'} />
      </div>

      {recipes.length === 0 && firstRunEmpty && (
        <div className="starter-card">
          <span className="starter-card__icon"><ChefHat size={20} /></span>
          <div>
            <strong>New kitchen? Load a starter recipe box.</strong>
            <p>Twelve recipes, a plan for this week, and a grocery list — all saved as commits you own.</p>
          </div>
          <button type="button" className="btn btn--primary btn--sm" onClick={() => void handleSeed()} disabled={seeding}>
            {seeding ? <Spinner size={14} /> : <Sparkles size={14} />}
            {seeding ? 'Adding…' : 'Add starter recipes'}
          </button>
        </div>
      )}

      <WeekBoard
        weekStart={weekStart}
        meals={meals}
        recipes={recipes}
        onAdd={(date, slot) => setPicker({ date, slot })}
        onRemove={removeMealFromPlan}
        onOpenRecipe={(recipeId) => navigate(`/recipes/${recipeId}`)}
      />

      {meals.length === 0 && (
        <div className="week-footnote">
          <Utensils size={15} />
          <span>
            Tip: plan dinners first, then use the leftovers for lunch.{' '}
            <button type="button" className="link-btn" onClick={openPickerForToday}>
              Add your first meal
            </button>
          </span>
          <span className="week-footnote__spacer" />
          <span><Clock size={13} /> Plans save straight to GitHub</span>
        </div>
      )}

      <RecipePicker
        open={picker !== null}
        onClose={() => setPicker(null)}
        onPick={addRecipeToSlot}
        date={picker?.date ?? null}
        slot={picker?.slot ?? 'dinner'}
      />

      <GenerateGroceryDialog
        open={generateOpen}
        onClose={() => setGenerateOpen(false)}
        initialWeekStart={weekStart}
        onDone={(listId) => navigate(`/grocery/${listId}`)}
      />
    </div>
  );
}
