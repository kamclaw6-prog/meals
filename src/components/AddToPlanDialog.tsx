import { useEffect, useState } from 'react';
import { CalendarPlus, Minus, Plus } from 'lucide-react';
import type { Meal, MealSlot, Recipe } from '../../shared/types';
import { MEAL_SLOTS, MEAL_SLOT_LABEL } from '../../shared/types';
import { eachDay, formatDayNumber, formatDayShort, formatLongDate, isToday, todayISO, weekStartFromDate } from '../../shared/dates';
import { addMeal } from '../../shared/plans';
import { formatQuantity } from '../../shared/units';
import { Modal } from './Modal';
import { useApp } from '../state/AppProvider';
import { useToast } from '../state/ToastProvider';
import { cx, newId } from '../lib/utils';

export function AddToPlanDialog({
  open,
  onClose,
  recipe,
}: {
  open: boolean;
  onClose: () => void;
  recipe: Recipe;
}) {
  const { commitPlans } = useApp();
  const { toast } = useToast();
  const [date, setDate] = useState(todayISO());
  const [slot, setSlot] = useState<MealSlot>('dinner');
  const [servings, setServings] = useState(recipe.servings);

  useEffect(() => {
    if (!open) return;
    setDate(todayISO());
    setSlot('dinner');
    setServings(recipe.servings);
  }, [open, recipe]);

  const days = eachDay(todayISO(), 14);

  const handleSubmit = () => {
    const meal: Meal = {
      id: newId('meal'),
      date,
      slot,
      recipeId: recipe.id,
      servings,
    };
    commitPlans((plans) => addMeal(plans, weekStartFromDate(date), meal));
    toast(`Added ${recipe.title} to ${formatDayShort(date).toLowerCase()} ${MEAL_SLOT_LABEL[slot].toLowerCase()}.`, 'success');
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add to meal plan"
      description={`${recipe.title} · ${recipe.servings} servings as written`}
      size="md"
      footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn--primary" onClick={handleSubmit}>
            <CalendarPlus size={16} /> Add to plan
          </button>
        </>
      }
    >
      <div className="plan-form">
        <div className="plan-form__summary">
          <span className="plan-form__summary-icon" aria-hidden="true">
            <CalendarPlus size={17} />
          </span>
          <span>
            <strong>{formatLongDate(date)}</strong>
            <small>{MEAL_SLOT_LABEL[slot]} · {formatQuantity(servings)} servings</small>
          </span>
        </div>

        <div className="field">
          <span className="field__label">Day</span>
          <div className="day-picker" role="group" aria-label="Choose a day">
            {days.map((day) => (
              <button
                key={day}
                type="button"
                className={cx('day-chip', date === day && 'is-active', isToday(day) && 'is-today')}
                onClick={() => setDate(day)}
              >
                <span>{formatDayShort(day)}</span>
                <strong>{formatDayNumber(day)}</strong>
                {isToday(day) && <em>today</em>}
              </button>
            ))}
          </div>
        </div>

        <div className="form-row form-row--2">
          <div className="field">
            <span className="field__label">Meal</span>
            <div className="segmented segmented--wrap" role="group" aria-label="Meal of the day">
              {MEAL_SLOTS.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={cx('segmented__item', slot === value && 'is-active')}
                  onClick={() => setSlot(value)}
                >
                  {MEAL_SLOT_LABEL[value]}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <span className="field__label">Servings</span>
            <div className="stepper">
              <button
                type="button"
                className="stepper__btn"
                onClick={() => setServings((value) => Math.max(0.5, Math.round((value - 0.5) * 10) / 10))}
                aria-label="Fewer servings"
              >
                <Minus size={14} />
              </button>
              <span className="stepper__value">{formatQuantity(servings)}</span>
              <button
                type="button"
                className="stepper__btn"
                onClick={() => setServings((value) => Math.min(100, Math.round((value + 0.5) * 10) / 10))}
                aria-label="More servings"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
