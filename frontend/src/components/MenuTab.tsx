import { useEffect, useMemo, useRef, useState } from 'react';

import { getMenu, MenuItem } from '../api';
import { CartItem } from './CartTab';
import { S, mutedText } from '../theme';

type Category = MenuItem['category'] | 'All';

const CATEGORY_EMOJI: Record<string, string> = {
  All: '🍽️',
  Goat: '🐐',
  Chicken: '🍗',
  Fish: '��',
};

type Props = {
  onAddToCart: (item: MenuItem, qty: number) => void;
  cartCount: number;
  cartTotal: number;
  onGoToCart: () => void;
};

type CustomDraft = {
  meat: 'Goat' | 'Chicken' | 'Fish';
  note: string;
};

export default function MenuTab({ onAddToCart, cartCount, cartTotal, onGoToCart }: Props) {
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Category>('All');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [flash, setFlash] = useState<string | null>(null);
  const flashTimer = useRef<number | null>(null);

  // Custom order state
  const [customOpen, setCustomOpen] = useState(false);
  const [customDraft, setCustomDraft] = useState<CustomDraft>({ meat: 'Chicken', note: '' });

  useEffect(() => {
    getMenu()
      .then((items) => {
        setMenu(items);
        setQuantities(items.reduce<Record<string, number>>((a, i) => ({ ...a, [i.id]: 1 }), {}));
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load the menu.'))
      .finally(() => setLoading(false));
    return () => { if (flashTimer.current) window.clearTimeout(flashTimer.current); };
  }, []);

  const filtered = useMemo(
    () => (filter === 'All' ? menu : menu.filter((i) => i.category === filter)),
    [menu, filter]
  );

  const categories = useMemo<Category[]>(() => {
    const cats = Array.from(new Set(menu.map((i) => i.category))) as Category[];
    return ['All', ...cats];
  }, [menu]);

  const toggleRow = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const changeQty = (id: string, delta: number) => {
    setQuantities((q) => ({ ...q, [id]: Math.max(1, (q[id] ?? 1) + delta) }));
  };

  const addItem = (item: MenuItem) => {
    onAddToCart(item, quantities[item.id] ?? 1);
    setQuantities((q) => ({ ...q, [item.id]: 1 }));
    setExpandedId(null);
    triggerFlash(item.id);
  };

  const addCustom = () => {
    if (!customDraft.note.trim()) return;
    const customItem: MenuItem = {
      id: `custom-${Date.now()}`,
      category: customDraft.meat,
      name: `Custom ${customDraft.meat} Order`,
      price: 0,
      unit: 'custom',
      description: customDraft.note.trim(),
    };
    onAddToCart(customItem, 1);
    setCustomDraft({ meat: 'Chicken', note: '' });
    setCustomOpen(false);
    triggerFlash('custom');
  };

  const triggerFlash = (id: string) => {
    setFlash(id);
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlash(null), 1800);
  };

  if (loading) return <div style={S.card}>Loading menu…</div>;
  if (error)   return <div style={{ ...S.card, ...S.errorBox }}>{error}</div>;

  const rowBase: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.55rem 0.75rem',
    borderBottom: '1px solid #fde68a',
    background: '#fffbeb',
    cursor: 'pointer',
    userSelect: 'none',
  };

  return (
    <div style={{ paddingBottom: cartCount > 0 ? '4.5rem' : 0 }}>
      {/* Category filter pills */}
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => { setFilter(cat); setExpandedId(null); }}
            style={{
              border: `2px solid ${filter === cat ? '#f59e0b' : '#fde68a'}`,
              background: filter === cat ? '#f59e0b' : '#fffbeb',
              color: filter === cat ? '#fff' : '#92400e',
              borderRadius: 999,
              padding: '0.3rem 0.85rem',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {CATEGORY_EMOJI[cat]} {cat}
          </button>
        ))}
      </div>

      {/* Item list */}
      <div style={{ border: '1px solid #fde68a', borderRadius: '0.75rem', overflow: 'hidden', background: '#fffbeb' }}>
        {filtered.map((item, idx) => (
          <div key={item.id}>
            {/* Row */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => toggleRow(item.id)}
              onKeyDown={(e) => e.key === 'Enter' && toggleRow(item.id)}
              style={{
                ...rowBase,
                borderTop: idx === 0 ? 'none' : undefined,
                background: expandedId === item.id ? '#fff9ed' : flash === item.id ? '#ecfdf5' : '#fffbeb',
              }}
            >
              <span style={{ flex: 1, fontWeight: 600, color: '#78350f', fontSize: '0.92rem' }}>{item.name}</span>
              <span style={{ color: '#9ca3af', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>{item.unit}</span>
              <span style={{ fontWeight: 800, color: '#92400e', fontSize: '0.9rem', whiteSpace: 'nowrap', minWidth: 54, textAlign: 'right' }}>
                ${item.price.toFixed(2)}
              </span>
              <span style={{ color: flash === item.id ? '#16a34a' : '#f59e0b', fontWeight: 900, fontSize: '1.1rem', lineHeight: 1, paddingLeft: '0.25rem' }}>
                {flash === item.id ? '✓' : '+'}
              </span>
            </div>

            {/* Expanded qty picker */}
            {expandedId === item.id && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.55rem 0.75rem', background: '#fff9ed', borderTop: '1px dashed #fde68a', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                  <button type="button" onClick={(e) => { e.stopPropagation(); changeQty(item.id, -1); }}
                    style={{ ...S.outlineBtn, padding: '0.3rem 0.7rem', fontSize: '1rem', fontWeight: 900 }}>−</button>
                  <span style={{ fontWeight: 800, color: '#78350f', minWidth: 24, textAlign: 'center', fontSize: '1rem' }}>{quantities[item.id] ?? 1}</span>
                  <button type="button" onClick={(e) => { e.stopPropagation(); changeQty(item.id, 1); }}
                    style={{ ...S.outlineBtn, padding: '0.3rem 0.7rem', fontSize: '1rem', fontWeight: 900 }}>+</button>
                  <span style={{ ...mutedText, fontSize: '0.8rem' }}>
                    = ${((quantities[item.id] ?? 1) * item.price).toFixed(2)}
                  </span>
                </div>
                <button type="button" onClick={(e) => { e.stopPropagation(); addItem(item); }}
                  style={{ ...S.primaryBtn, padding: '0.4rem 1.1rem', fontSize: '0.88rem', whiteSpace: 'nowrap' }}>
                  Add to Cart →
                </button>
              </div>
            )}
          </div>
        ))}

        {/* Custom Order row — always visible */}
        {(filter === 'All') && (
          <div>
            <div
              role="button"
              tabIndex={0}
              onClick={() => setCustomOpen((v) => !v)}
              onKeyDown={(e) => e.key === 'Enter' && setCustomOpen((v) => !v)}
              style={{ ...rowBase, borderTop: filtered.length > 0 ? '2px solid #fde68a' : 'none', background: flash === 'custom' ? '#ecfdf5' : customOpen ? '#fff9ed' : '#fffbeb' }}
            >
              <span style={{ flex: 1, fontWeight: 600, color: '#78350f', fontSize: '0.92rem' }}>✏️ Custom Order</span>
              <span style={{ color: '#9ca3af', fontSize: '0.78rem' }}>Price TBD</span>
              <span style={{ fontWeight: 900, fontSize: '1.1rem', color: flash === 'custom' ? '#16a34a' : '#f59e0b', paddingLeft: '0.5rem' }}>
                {flash === 'custom' ? '✓' : customOpen ? '−' : '+'}
              </span>
            </div>

            {customOpen && (
              <div style={{ padding: '0.75rem', background: '#fff9ed', borderTop: '1px dashed #fde68a', display: 'grid', gap: '0.65rem' }}>
                {/* Meat type selector */}
                <div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#92400e', marginBottom: '0.35rem' }}>Meat Type</div>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    {(['Goat', 'Chicken', 'Fish'] as const).map((meat) => (
                      <button
                        key={meat}
                        type="button"
                        onClick={() => setCustomDraft((d) => ({ ...d, meat }))}
                        style={{
                          border: `2px solid ${customDraft.meat === meat ? '#f59e0b' : '#fde68a'}`,
                          background: customDraft.meat === meat ? '#f59e0b' : '#fffbeb',
                          color: customDraft.meat === meat ? '#fff' : '#92400e',
                          borderRadius: 999, padding: '0.3rem 0.75rem',
                          fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer',
                        }}
                      >
                        {CATEGORY_EMOJI[meat]} {meat}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Details */}
                <div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#92400e', marginBottom: '0.35rem' }}>Order Details *</div>
                  <textarea
                    rows={3}
                    placeholder="Describe the cut, weight, preparation style…"
                    value={customDraft.note}
                    onChange={(e) => setCustomDraft((d) => ({ ...d, note: e.target.value }))}
                    style={{ ...S.inp, resize: 'vertical', fontSize: '0.88rem', fontFamily: 'inherit' }}
                  />
                </div>
                <button
                  type="button"
                  disabled={!customDraft.note.trim()}
                  onClick={addCustom}
                  style={{ ...S.primaryBtn, opacity: customDraft.note.trim() ? 1 : 0.5, justifySelf: 'start' }}
                >
                  Add Custom Order →
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sticky cart bar */}
      {cartCount > 0 && (
        <div
          style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 200,
            background: '#78350f', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0.85rem 1.25rem',
            boxShadow: '0 -2px 12px rgba(120,53,15,0.25)',
          }}
        >
          <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>
            🛒 {cartCount} item{cartCount !== 1 ? 's' : ''}
            <span style={{ fontWeight: 400, margin: '0 0.4rem' }}>·</span>
            ${cartTotal.toFixed(2)}
          </span>
          <button
            type="button"
            onClick={onGoToCart}
            style={{ background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '0.5rem', padding: '0.5rem 1.1rem', fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer' }}
          >
            View Cart →
          </button>
        </div>
      )}
    </div>
  );
}
