import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Apple,
  Check,
  Croissant,
  CupSoda,
  Drumstick,
  Eraser,
  Fish,
  ListChecks,
  Milk,
  Package,
  Pencil,
  Plus,
  Printer,
  Copy,
  ShoppingBasket,
  Snowflake,
  SprayCan,
  Trash2,
  X,
  Circle,
} from 'lucide-react';
import type { GroceryCategory, GroceryItem } from '../../shared/types';
import { CATEGORY_LABEL, GROCERY_CATEGORIES } from '../../shared/types';
import { startOfWeekISO } from '../../shared/dates';
import {
  groupGroceryItems,
  groceryListAsText,
  groceryStats,
  manualGroceryItem,
} from '../../shared/grocery';
import { formatAmount } from '../../shared/units';
import { GenerateGroceryDialog } from '../components/GenerateGroceryDialog';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Modal } from '../components/Modal';
import { EmptyState, PageHeader, Progress } from '../components/ui';
import { useApp } from '../state/AppProvider';
import { useToast } from '../state/ToastProvider';
import { useCopyToClipboard, useDocumentTitle } from '../lib/hooks';
import { cx, newId, plural } from '../lib/utils';

const CATEGORY_ICONS = {
  produce: Apple,
  meat: Drumstick,
  seafood: Fish,
  dairy: Milk,
  bakery: Croissant,
  pantry: Package,
  frozen: Snowflake,
  drinks: CupSoda,
  household: SprayCan,
  other: Circle,
} satisfies Record<GroceryCategory, typeof Apple>;

export function GroceryPage() {
  const { listId } = useParams();
  const { lists, recipes, commitLists } = useApp();
  const { toast } = useToast();
  const navigate = useNavigate();
  const copy = useCopyToClipboard();

  const sortedLists = useMemo(
    () => [...lists].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [lists],
  );
  const selected = lists.find((list) => list.id === listId) ?? sortedLists[0];

  const stats = groceryStats(selected);
  const recipeNames = useMemo(() => new Map(recipes.map((recipe) => [recipe.id, recipe.title])), [recipes]);

  const [generateOpen, setGenerateOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [hideChecked, setHideChecked] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [clearOpen, setClearOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const [addName, setAddName] = useState('');
  const [addQty, setAddQty] = useState('');
  const [addUnit, setAddUnit] = useState('');
  const [addCategory, setAddCategory] = useState<GroceryCategory | ''>('');

  useDocumentTitle(selected ? selected.name : 'Grocery');

  const visibleItems = selected
    ? selected.items.filter((item) => !hideChecked || !item.checked)
    : [];
  const groups = groupGroceryItems(visibleItems);

  const patchList = (updater: (items: GroceryItem[]) => GroceryItem[]) => {
    if (!selected) return;
    commitLists((current) =>
      current.map((list) =>
        list.id === selected.id
          ? { ...list, items: updater(list.items), updatedAt: new Date().toISOString() }
          : list,
      ),
    );
  };

  const toggleItem = (item: GroceryItem) => {
    patchList((items) => items.map((entry) => (entry.id === item.id ? { ...entry, checked: !entry.checked } : entry)));
  };

  const removeItem = (item: GroceryItem) => {
    patchList((items) => items.filter((entry) => entry.id !== item.id));
  };

  const handleAdd = (event: FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    const name = addName.trim();
    if (!name) return;

    const quantity = addQty.trim() ? Number(addQty) : null;
    if (quantity !== null && (!Number.isFinite(quantity) || quantity < 0)) {
      toast('Enter a valid amount.', 'error');
      return;
    }

    const item = manualGroceryItem({
      name,
      quantity,
      unit: addUnit.trim() || undefined,
      category: addCategory || undefined,
    });

    const existing = selected.items.find((entry) => entry.key === item.key);
    if (existing) {
      patchList((items) =>
        items.map((entry) =>
          entry.id === existing.id
            ? {
                ...entry,
                quantity:
                  entry.quantity !== null && entry.quantity !== undefined && item.quantity !== null && item.quantity !== undefined
                    ? Math.round((entry.quantity + item.quantity) * 100) / 100
                    : (item.quantity ?? entry.quantity ?? null),
                checked: false,
              }
            : entry,
        ),
      );
      toast('Merged into the existing item.', 'success');
    } else {
      patchList((items) => [...items, item]);
      toast(`${name} added to ${selected.name}.`, 'success');
    }

    setAddName('');
    setAddQty('');
  };

  const startRename = () => {
    if (!selected) return;
    setDraftName(selected.name);
    setRenaming(true);
  };

  const commitRename = () => {
    if (!selected || !renaming) return;
    const name = draftName.trim();
    setRenaming(false);
    if (!name || name === selected.name) return;
    commitLists((current) =>
      current.map((list) => (list.id === selected.id ? { ...list, name, updatedAt: new Date().toISOString() } : list)),
    );
    toast('List renamed.', 'success');
  };

  const handleCopy = async () => {
    if (!selected) return;
    const ok = await copy(groceryListAsText(selected, recipes));
    toast(ok ? 'List copied — paste it anywhere.' : 'Could not access the clipboard.', ok ? 'success' : 'error');
  };

  const handleCreateList = () => {
    const name = newName.trim();
    if (!name) return;
    const now = new Date().toISOString();
    const id = newId('list');
    commitLists((current) => [
      ...current,
      {
        id,
        name,
        items: [],
        createdAt: now,
        updatedAt: now,
      },
    ]);
    setNewOpen(false);
    setNewName('');
    navigate(`/grocery/${id}`);
    toast(`Created ${name}.`, 'success');
  };

  const handleClearChecked = () => {
    if (!selected) return;
    patchList((items) => items.filter((item) => !item.checked));
    toast(`Cleared ${plural(stats.checked, 'item')}.`, 'success');
  };

  const handleDeleteList = () => {
    if (!selected) return;
    commitLists((current) => current.filter((list) => list.id !== selected.id));
    toast(`Deleted ${selected.name}.`, 'success');
    navigate('/grocery');
  };

  return (
    <div className="page page--grocery">
      <PageHeader
        eyebrow={<><ShoppingBasket size={13} /> Grocery</>}
        title={selected ? selected.name : 'Grocery'}
        description={
          selected
            ? `${stats.checked} of ${plural(stats.total, 'item')} in the basket · ${plural(stats.remaining, 'item')} to go.`
            : 'Turn the week’s plan into one tidy shop, grouped by aisle.'
        }
        actions={
          <>
            {selected && (
              <>
                <button type="button" className="icon-btn" onClick={() => void handleCopy()} aria-label="Copy list" title="Copy as text">
                  <Copy size={16} />
                </button>
                <button type="button" className="icon-btn" onClick={() => window.print()} aria-label="Print list" title="Print list">
                  <Printer size={16} />
                </button>
              </>
            )}
            <button type="button" className="btn btn--primary" onClick={() => setGenerateOpen(true)}>
              <ListChecks size={16} /> Generate from week
            </button>
          </>
        }
      />

      {sortedLists.length === 0 ? (
        <EmptyState
          className="empty--large"
          icon={<ShoppingBasket size={26} />}
          title="No grocery lists yet"
          description="Generate one from this week’s meal plan, or start with a blank list and add items as you go."
          action={
            <div className="empty__actions">
              <button type="button" className="btn btn--primary" onClick={() => setGenerateOpen(true)}>
                <ListChecks size={16} /> Generate from this week
              </button>
              <button type="button" className="btn btn--secondary" onClick={() => setNewOpen(true)}>
                <Plus size={16} /> Blank list
              </button>
            </div>
          }
        />
      ) : (
        <div className="grocery-layout">
          <aside className="grocery-rail" aria-label="Grocery lists">
            <div className="grocery-rail__head">
              <span>Lists</span>
              <button type="button" className="icon-btn icon-btn--sm" onClick={() => setNewOpen(true)} aria-label="New blank list">
                <Plus size={15} />
              </button>
            </div>
            <nav className="grocery-rail__list">
              {sortedLists.map((list) => {
                const listStats = groceryStats(list);
                return (
                  <Link
                    key={list.id}
                    to={`/grocery/${list.id}`}
                    className={cx('grocery-rail__item', selected?.id === list.id && 'is-active')}
                  >
                    <span className="grocery-rail__name">{list.name}</span>
                    <span className="grocery-rail__meta">
                      {listStats.checked}/{listStats.total} items
                    </span>
                    <span className="grocery-rail__bar" aria-hidden="true">
                      <span style={{ width: `${listStats.percent}%` }} />
                    </span>
                  </Link>
                );
              })}
            </nav>
            <button type="button" className="btn btn--ghost btn--sm btn--wide" onClick={() => setNewOpen(true)}>
              <Plus size={14} /> New list
            </button>
          </aside>

          {selected && (
            <section className="grocery-panel">
              <header className="grocery-panel__head">
                <div className="grocery-panel__title-row">
                  {renaming ? (
                    <input
                      className="grocery-panel__rename"
                      value={draftName}
                      onChange={(event) => setDraftName(event.target.value)}
                      onBlur={commitRename}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          commitRename();
                        }
                        if (event.key === 'Escape') setRenaming(false);
                      }}
                      autoFocus
                      aria-label="List name"
                    />
                  ) : (
                    <button type="button" className="grocery-panel__name" onClick={startRename} title="Rename list">
                      {selected.name} <Pencil size={13} />
                    </button>
                  )}
                  <div className="grocery-panel__title-actions">
                    <button
                      type="button"
                      className={cx('btn btn--ghost btn--sm', hideChecked && 'is-active')}
                      onClick={() => setHideChecked((value) => !value)}
                    >
                      {hideChecked ? 'Show checked' : 'Hide checked'}
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() => setClearOpen(true)}
                      disabled={stats.checked === 0}
                    >
                      <Eraser size={14} /> Clear checked
                    </button>
                    <button
                      type="button"
                      className="icon-btn icon-btn--sm icon-btn--danger"
                      onClick={() => setDeleteOpen(true)}
                      aria-label="Delete list"
                      title="Delete list"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                <div className="grocery-progress">
                  <div className="grocery-progress__text">
                    <strong>{stats.percent}%</strong>
                    <span>{stats.checked} of {stats.total} packed</span>
                  </div>
                  <Progress value={stats.percent} label="Grocery list progress" />
                </div>
              </header>

              {selected.items.length === 0 ? (
                <EmptyState
                  className="empty--inline"
                  icon={<ShoppingBasket size={22} />}
                  title="This list is empty"
                  description="Add an item below, or generate the list from a week’s meal plan."
                  action={
                    <button type="button" className="btn btn--secondary btn--sm" onClick={() => setGenerateOpen(true)}>
                      <ListChecks size={14} /> Generate from week
                    </button>
                  }
                />
              ) : groups.length === 0 ? (
                <EmptyState
                  className="empty--inline"
                  icon={<Check size={22} />}
                  title="Everything is in the basket"
                  description="Nice work. Clear the checked items, or show them again."
                  action={
                    <button type="button" className="btn btn--secondary btn--sm" onClick={() => setHideChecked(false)}>
                      Show checked items
                    </button>
                  }
                />
              ) : (
                <div className="checklist">
                  {groups.map((group) => {
                    const Icon = CATEGORY_ICONS[group.category];
                    const groupChecked = group.items.filter((item) => item.checked).length;
                    return (
                      <section key={group.category} className={cx('checklist__group', `checklist__group--${group.category}`)}>
                        <header className="checklist__head">
                          <span className="checklist__icon"><Icon size={15} /></span>
                          <h3>{group.label}</h3>
                          <span className="checklist__count">{groupChecked}/{group.items.length}</span>
                        </header>
                        <ul>
                          {group.items.map((item) => {
                            const sources = (item.recipeIds ?? [])
                              .map((id) => recipeNames.get(id))
                              .filter((name): name is string => Boolean(name));
                            const amount = formatAmount(item.quantity, item.unit);
                            return (
                              <li key={item.id} className={cx('grocery-item', item.checked && 'is-checked')}>
                                <button
                                  type="button"
                                  role="checkbox"
                                  aria-checked={item.checked}
                                  className="grocery-item__check"
                                  onClick={() => toggleItem(item)}
                                  aria-label={`${item.checked ? 'Uncheck' : 'Check'} ${item.name}`}
                                >
                                  {item.checked && <Check size={13} strokeWidth={3} />}
                                </button>
                                <div className="grocery-item__body">
                                  <span className="grocery-item__name">{item.name}</span>
                                  {item.note && <span className="grocery-item__note">{item.note}</span>}
                                  {sources.length > 0 && (
                                    <span className="grocery-item__source" title={sources.join(', ')}>
                                      {sources.length === 1 ? sources[0] : `${sources.length} recipes`}
                                    </span>
                                  )}
                                </div>
                                {amount && <span className="grocery-item__amount">{amount}</span>}
                                <button
                                  type="button"
                                  className="grocery-item__remove"
                                  onClick={() => removeItem(item)}
                                  aria-label={`Remove ${item.name}`}
                                >
                                  <X size={13} />
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </section>
                    );
                  })}
                </div>
              )}

              <form className="item-add" onSubmit={handleAdd}>
                <span className="item-add__label"><Plus size={14} /> Add item</span>
                <input
                  className="item-add__qty"
                  value={addQty}
                  onChange={(event) => setAddQty(event.target.value)}
                  placeholder="2"
                  inputMode="decimal"
                  aria-label="Amount"
                />
                <input
                  className="item-add__unit"
                  value={addUnit}
                  onChange={(event) => setAddUnit(event.target.value)}
                  placeholder="unit"
                  aria-label="Unit"
                />
                <input
                  className="item-add__name"
                  value={addName}
                  onChange={(event) => setAddName(event.target.value)}
                  placeholder="Add milk, basil, dish soap…"
                  aria-label="Item name"
                />
                <select
                  className="item-add__category"
                  value={addCategory}
                  onChange={(event) => setAddCategory(event.target.value as GroceryCategory | '')}
                  aria-label="Category"
                >
                  <option value="">Auto aisle</option>
                  {GROCERY_CATEGORIES.map((category) => (
                    <option key={category} value={category}>{CATEGORY_LABEL[category]}</option>
                  ))}
                </select>
                <button type="submit" className="btn btn--secondary btn--sm" disabled={!addName.trim()}>
                  Add
                </button>
              </form>
            </section>
          )}
        </div>
      )}

      <GenerateGroceryDialog
        open={generateOpen}
        onClose={() => setGenerateOpen(false)}
        initialWeekStart={selected?.weekStart ?? startOfWeekISO()}
        onDone={(id) => navigate(`/grocery/${id}`)}
      />

      <Modal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        title="New grocery list"
        description="Start blank and add items as you think of them."
        size="sm"
        footer={
          <>
            <button type="button" className="btn btn--secondary" onClick={() => setNewOpen(false)}>Cancel</button>
            <button type="button" className="btn btn--primary" onClick={handleCreateList} disabled={!newName.trim()}>
              Create list
            </button>
          </>
        }
      >
        <label className="field">
          <span className="field__label">List name</span>
          <input
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder="Saturday market"
            autoFocus
            onKeyDown={(event) => {
              if (event.key === 'Enter') handleCreateList();
            }}
          />
        </label>
      </Modal>

      <ConfirmDialog
        open={clearOpen}
        onClose={() => setClearOpen(false)}
        onConfirm={handleClearChecked}
        title="Clear checked items?"
        message={<p>{plural(stats.checked, 'checked item')} will be removed from <strong>{selected?.name}</strong>. Your meal plan is untouched.</p>}
        confirmLabel="Clear items"
      />

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDeleteList}
        title="Delete this grocery list?"
        message={<p><strong>{selected?.name}</strong> and its {plural(selected?.items.length ?? 0, 'item')} will be removed. This is committed to your GitHub repo, so it can be recovered from history.</p>}
        confirmLabel="Delete list"
      />
    </div>
  );
}
