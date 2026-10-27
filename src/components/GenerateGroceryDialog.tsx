import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, ShoppingBasket, Sparkles } from 'lucide-react';
import type { GroceryList } from '../../shared/types';
import { addDaysISO, formatWeekRange, startOfWeekISO } from '../../shared/dates';
import { buildGroceryItems, groceryItemLabel, mergeGroceryItems, newGroceryList } from '../../shared/grocery';
import { resolveWeekRecipes } from '../../shared/plans';
import { Modal } from './Modal';
import { useApp } from '../state/AppProvider';
import { useToast } from '../state/ToastProvider';
import { cx, plural } from '../lib/utils';

export function GenerateGroceryDialog({
  open,
  onClose,
  initialWeekStart,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  initialWeekStart: string;
  onDone: (listId: string) => void;
}) {
  const { recipes, plans, lists, commitLists } = useApp();
  const { toast } = useToast();
  const [weekStart, setWeekStart] = useState(initialWeekStart);
  const [targetId, setTargetId] = useState<string>('new');
  const [name, setName] = useState('');
  const nameTouched = useRef(false);

  const defaultName = `Week of ${formatWeekRange(weekStart)}`;
  const effectiveName = name.trim() || defaultName;

  useEffect(() => {
    if (!open) return;
    setWeekStart(initialWeekStart);
    setTargetId('new');
    setName('');
    nameTouched.current = false;
  }, [open, initialWeekStart]);

  const { entries, missingRecipeIds } = useMemo(
    () => resolveWeekRecipes(plans, weekStart, recipes),
    [plans, weekStart, recipes],
  );
  const generated = useMemo(() => buildGroceryItems(entries), [entries]);
  const sortedLists = useMemo(
    () => [...lists].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [lists],
  );

  const changeWeek = (delta: number) => {
    const next = addDaysISO(weekStart, delta * 7);
    setWeekStart(next);
    if (!nameTouched.current) setName('');
  };

  const handleGenerate = () => {
    if (generated.length === 0) return;
    const now = new Date().toISOString();
    let list: GroceryList;

    if (targetId === 'new') {
      list = newGroceryList({ name: effectiveName, weekStart, items: generated, now });
      commitLists((current) => [...current, list]);
    } else {
      const existing = lists.find((item) => item.id === targetId);
      if (!existing) return;
      list = {
        ...existing,
        items: mergeGroceryItems(existing.items, generated),
        weekStart: existing.weekStart ?? weekStart,
        updatedAt: now,
      };
      commitLists((current) => current.map((item) => (item.id === list.id ? list : item)));
    }

    toast(`${plural(generated.length, 'item')} ready in ${list.name}.`, 'success');
    onDone(list.id);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Generate grocery list"
      description="Ingredients from the week’s meals, merged and grouped by aisle."
      size="lg"
      footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn--primary" onClick={handleGenerate} disabled={generated.length === 0}>
            <Sparkles size={16} />
            {targetId === 'new' ? 'Create list' : 'Update list'}
            {generated.length > 0 && ` · ${generated.length}`}
          </button>
        </>
      }
    >
      <div className="generate">
        <div className="generate__week">
          <button type="button" className="icon-btn" onClick={() => changeWeek(-1)} aria-label="Previous week">
            <ChevronLeft size={17} />
          </button>
          <div className="generate__week-label">
            <span className="field__label">Week</span>
            <strong>{formatWeekRange(weekStart)}</strong>
          </div>
          <button type="button" className="icon-btn" onClick={() => changeWeek(1)} aria-label="Next week">
            <ChevronRight size={17} />
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => {
              const current = startOfWeekISO();
              setWeekStart(current);
              if (!nameTouched.current) setName('');
            }}
          >
            This week
          </button>
        </div>

        {entries.length === 0 ? (
          <div className="generate__empty">
            <ShoppingBasket size={22} />
            <div>
              <strong>Nothing planned for this week yet</strong>
              <span>Add a meal to the week board first, then generate the list.</span>
            </div>
          </div>
        ) : (
          <>
            <div className="form-row form-row--2 generate__targets">
              <label className="field">
                <span className="field__label">Add to</span>
                <select value={targetId} onChange={(event) => setTargetId(event.target.value)}>
                  <option value="new">New list</option>
                  {sortedLists.map((list) => (
                    <option key={list.id} value={list.id}>
                      {list.name} ({list.items.length} items)
                    </option>
                  ))}
                </select>
              </label>

              {targetId === 'new' ? (
                <label className="field">
                  <span className="field__label">List name</span>
                  <input
                    value={name}
                    onChange={(event) => {
                      nameTouched.current = true;
                      setName(event.target.value);
                    }}
                    placeholder={defaultName}
                  />
                </label>
              ) : (
                <div className="field">
                  <span className="field__label">Merge behaviour</span>
                  <p className="field__hint">
                    Quantities update for planned items. Checked items and manual additions stay put.
                  </p>
                </div>
              )}
            </div>

            <div className="generate__preview">
              <div className="generate__preview-head">
                <span>
                  <strong>{plural(generated.length, 'item')}</strong> from {plural(entries.length, 'planned meal')}
                </span>
                {missingRecipeIds.length > 0 && (
                  <span className="generate__warning">
                    <AlertTriangle size={13} /> {plural(missingRecipeIds.length, 'meal')} skipped — recipe missing
                  </span>
                )}
              </div>
              <ul className="generate__items">
                {generated.slice(0, 8).map((item) => (
                  <li key={item.key} className={cx('generate__item', `generate__item--${item.category}`)}>
                    <span className="generate__item-dot" />
                    <span className="generate__item-name">{groceryItemLabel(item)}</span>
                  </li>
                ))}
                {generated.length > 8 && (
                  <li className="generate__more">+ {generated.length - 8} more, grouped by aisle</li>
                )}
              </ul>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
