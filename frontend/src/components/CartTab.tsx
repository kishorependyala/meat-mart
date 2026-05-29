import { useEffect, useMemo, useState } from 'react';

import { Order, OrderItem, StoreLocation, getLocations, placeOrder, User } from '../api';
import { S, mutedText, sectionTitle } from '../theme';

export type CartItem = OrderItem & {
  unit: string;
  description: string;
};

type Props = {
  user: User | null;
  cartItems: CartItem[];
  onUpdateQty: (itemId: string, nextQty: number) => void;
  onRemoveItem: (itemId: string) => void;
  onOrderPlaced: (order: Order) => void;
  onLoginRequest: () => void;
  prepMinutes?: number;
};

type TimeSlot = { label: string; sublabel: string; value: string };

function roundUpToNextHour(date: Date): Date {
  const result = new Date(date);
  if (result.getMinutes() > 0 || result.getSeconds() > 0) {
    result.setHours(result.getHours() + 1, 0, 0, 0);
  } else {
    result.setMinutes(0, 0, 0);
  }
  return result;
}

function roundUpMinutes(date: Date, step = 15): Date {
  const ms = step * 60 * 1000;
  return new Date(Math.ceil(date.getTime() / ms) * ms);
}

function dayLabel(d: Date): string {
  const today = new Date();
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function slotValue(d: Date): string {
  const dateStr = d.toLocaleDateString('en-CA'); // YYYY-MM-DD
  const timeStr = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return `${dateStr} ${timeStr}`;
}

/** Build next N available quick slots for the given location */
function buildQuickSlots(loc: StoreLocation, prepMins: number, count = 5): TimeSlot[] {
  const isHourly = loc.deliveryMode === 'hourly_delivery';
  const stepMins = isHourly ? 60 : 30;
  const earliest = isHourly
    ? roundUpToNextHour(new Date(Date.now() + prepMins * 60_000))
    : roundUpMinutes(new Date(Date.now() + prepMins * 60_000), 15);

  const slots: TimeSlot[] = [];

  for (let daysAhead = 0; daysAhead < 14 && slots.length < count; daysAhead++) {
    const base = new Date(earliest);
    base.setDate(earliest.getDate() + daysAhead);
    if (daysAhead > 0) {
      base.setHours(0, 0, 0, 0);
    }

    const dayKey = String(base.getDay());
    const dayHours = loc.hours[dayKey];
    if (!dayHours) continue;

    const [openH, openM] = (dayHours as { open: string; close: string }).open.split(':').map(Number);
    const [closeH, closeM] = (dayHours as { open: string; close: string }).close.split(':').map(Number);
    const openTime = new Date(base); openTime.setHours(openH, openM, 0, 0);
    const closeTime = new Date(base); closeTime.setHours(closeH, closeM, 0, 0);

    // Start at the earliest valid moment for this day
    let cursor = daysAhead === 0 ? new Date(base) : new Date(openTime);
    if (cursor < openTime) cursor = new Date(openTime);

    // Snap to grid
    if (isHourly) {
      if (cursor.getMinutes() !== 0) cursor = roundUpToNextHour(cursor);
    } else {
      cursor = roundUpMinutes(cursor, stepMins);
    }

    while (cursor < closeTime && slots.length < count) {
      slots.push({
        label: cursor.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
        sublabel: dayLabel(cursor),
        value: slotValue(cursor),
      });
      cursor = new Date(cursor.getTime() + stepMins * 60_000);
    }
  }
  return slots;
}

type DayOption = { dateStr: string; dayLabel: string; shortLabel: string; isOpen: boolean };
type TimeOption = { label: string; value: string };

/** Build next N day options (starting today) for the custom picker */
function buildCustomDays(loc: StoreLocation | null, count = 10): DayOption[] {
  if (!loc) return [];
  const result: DayOption[] = [];
  const today = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dateStr = d.toLocaleDateString('en-CA');
    const dayKey = String(d.getDay());
    const isOpen = !!loc.hours[dayKey];
    const shortLabel = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-US', { weekday: 'short' });
    const dayLabelStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    result.push({ dateStr, dayLabel: dayLabelStr, shortLabel, isOpen });
  }
  return result;
}

/** Build time slots for a specific date in the custom picker */
function buildCustomTimeSlots(dateStr: string, loc: StoreLocation | null): TimeOption[] {
  if (!loc || !dateStr) return [];
  const selectedDate = new Date(`${dateStr}T12:00:00`);
  const dayKey = String(selectedDate.getDay());
  const dayHours = loc.hours[dayKey] as { open: string; close: string } | null;
  if (!dayHours) return [];
  const [openH, openM] = dayHours.open.split(':').map(Number);
  const [closeH, closeM] = dayHours.close.split(':').map(Number);
  const isHourly = loc.deliveryMode === 'hourly_delivery';
  const result: TimeOption[] = [];
  // Build a cursor starting at open time
  const base = new Date(selectedDate);
  base.setHours(openH, openM, 0, 0);
  const closeMs = new Date(selectedDate);
  closeMs.setHours(closeH, closeM, 0, 0);
  const stepMins = isHourly ? 60 : 30;
  const cursor = new Date(base);
  while (cursor <= closeMs) {
    const label = cursor.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    result.push({ label, value: `${dateStr} ${label}` });
    cursor.setMinutes(cursor.getMinutes() + stepMins);
  }
  return result;
}

export default function CartTab({ user, cartItems, onUpdateQty, onRemoveItem, onOrderPlaced, onLoginRequest, prepMinutes = 20 }: Props) {
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedTimeValue, setSelectedTimeValue] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [customDate, setCustomDate] = useState('');
  const [customTime, setCustomTime] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [locations, setLocations] = useState<StoreLocation[]>([]);
  const [selectedLocId, setSelectedLocId] = useState<string>('');

  useEffect(() => {
    getLocations().then((locs) => {
      setLocations(locs);
      if (locs.length > 0 && !selectedLocId) setSelectedLocId(locs[0].id);
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (user) { setCustomerName(user.name); setPhone(user.phone); }
  }, [user]);

  // Reset time selection when location changes
  useEffect(() => {
    setSelectedTimeValue('');
    setShowCustom(false);
    setCustomDate('');
    setCustomTime('');
  }, [selectedLocId]);

  const selectedLoc = useMemo(() => locations.find((l) => l.id === selectedLocId) ?? null, [locations, selectedLocId]);
  const isDelivery = selectedLoc?.deliveryMode === 'hourly_delivery';
  const subtotal = useMemo(() => cartItems.reduce((sum, item) => sum + item.price * item.qty, 0), [cartItems]);

  const quickSlots = useMemo(
    () => selectedLoc ? buildQuickSlots(selectedLoc, prepMinutes, 5) : [],
    [selectedLoc, prepMinutes]
  );

  const customDays = useMemo(() => buildCustomDays(selectedLoc, 10), [selectedLoc]);
  const customTimeSlots = useMemo(() => buildCustomTimeSlots(customDate, selectedLoc), [customDate, selectedLoc]);

  // When custom date/time both filled, update selectedTimeValue
  useEffect(() => {
    if (showCustom && customDate && customTime) {
      // selectedTimeValue already set by pill click; this handles edge case of date change
      setSelectedTimeValue(`${customDate} ${customTime}`);
    }
  }, [showCustom, customDate, customTime]);

  const selectQuickSlot = (slot: TimeSlot) => {
    setSelectedTimeValue(slot.value);
    setShowCustom(false);
    setCustomDate('');
    setCustomTime('');
  };

  const submitOrder = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(''); setSuccess('');
    if (!cartItems.length) { setError('Add at least one item before placing an order.'); return; }
    if (!customerName.trim() || !phone.trim() || !selectedTimeValue) {
      setError(`Please select a ${isDelivery ? 'delivery' : 'pickup'} time before placing your order.`); return;
    }
    setSubmitting(true);
    try {
      const order = await placeOrder({
        customerName: customerName.trim(),
        phone: phone.trim(),
        pickupTime: selectedTimeValue,
        locationId: selectedLocId,
        locationName: selectedLoc?.name ?? '',
        isDelivery,
        items: cartItems.map(({ id, name, qty, price }) => ({ id, name, qty, price })),
      });
      onOrderPlaced(order);
      setSelectedTimeValue(''); setCustomDate(''); setCustomTime(''); setShowCustom(false);
      setSuccess(`Order placed! Confirmation #${order.id.slice(-8).toUpperCase()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to place the order.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {/* Cart items */}
      <section style={S.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <h2 style={sectionTitle}>Your Cart</h2>
            <p style={mutedText}>Pickup only · choose your location below.</p>
          </div>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#78350f' }}>Subtotal: ${subtotal.toFixed(2)}</div>
        </div>

        {!cartItems.length ? (
          <div style={{ ...S.card, marginTop: '1rem', background: '#fffaf0' }}>Your cart is empty. Add items from the menu tab.</div>
        ) : (
          <div style={{ display: 'grid', gap: '0.85rem', marginTop: '1rem' }}>
            {cartItems.map((item) => (
              <div key={item.id} style={{ border: '1px solid #fed7aa', borderRadius: '0.85rem', padding: '0.9rem', background: '#fffbeb' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 700, color: '#78350f' }}>{item.name}</div>
                    <p style={{ ...mutedText, marginBottom: '0.4rem' }}>{item.description}</p>
                    <div style={{ color: '#92400e', fontWeight: 600 }}>${item.price.toFixed(2)} / {item.unit}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <button type="button" onClick={() => onUpdateQty(item.id, item.qty - 1)} style={{ ...S.outlineBtn, padding: '0.45rem 0.8rem' }}>−</button>
                    <div style={{ minWidth: 32, textAlign: 'center', fontWeight: 700 }}>{item.qty}</div>
                    <button type="button" onClick={() => onUpdateQty(item.id, item.qty + 1)} style={{ ...S.outlineBtn, padding: '0.45rem 0.8rem' }}>+</button>
                    <button type="button" onClick={() => onRemoveItem(item.id)} style={S.dangerBtn}>Remove</button>
                  </div>
                </div>
                <div style={{ marginTop: '0.75rem', fontWeight: 700, color: '#78350f' }}>
                  Line total: ${(item.price * item.qty).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={S.card}>
        <h2 style={sectionTitle}>Place Order</h2>

        {/* Location selector */}
        {locations.length > 0 && (
          <div style={{ marginBottom: '1.1rem' }}>
            <p style={{ ...S.label, marginBottom: '0.5rem' }}>📍 {isDelivery ? 'Delivery' : 'Pickup'} Location</p>
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {locations.map((loc) => {
                const selected = selectedLocId === loc.id;
                const dayKey = String(new Date().getDay());
                const todayHours = loc.hours[dayKey];
                const hoursLabel = todayHours
                  ? `${loc.deliveryMode === 'hourly_delivery' ? '🚗 Delivery' : '🏪 Pickup'} · Today ${
                      new Date().setHours(...((todayHours as { open: string }).open.split(':').map(Number) as [number, number]), 0, 0) &&
                      new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
                    } – ${
                      (() => { const d = new Date(); const [h, m] = (todayHours as { close: string }).close.split(':').map(Number); d.setHours(h, m, 0, 0); return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); })()
                    }`
                  : 'Closed today';
                return (
                  <button
                    key={loc.id}
                    type="button"
                    onClick={() => setSelectedLocId(loc.id)}
                    style={{
                      background: selected ? '#fef3c7' : '#fff',
                      border: `2px solid ${selected ? '#f59e0b' : '#e5e7eb'}`,
                      borderRadius: '0.75rem',
                      padding: '0.65rem 0.9rem',
                      cursor: 'pointer',
                      textAlign: 'left',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '0.5rem',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 800, color: '#78350f', fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        {loc.name}
                        {loc.deliveryMode === 'hourly_delivery' && <span style={{ background: '#dcfce7', color: '#16a34a', borderRadius: 999, padding: '0.1rem 0.4rem', fontSize: '0.7rem', fontWeight: 700 }}>🚗 Delivery</span>}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: '0.1rem' }}>{loc.address}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      {selected && <div style={{ color: '#f59e0b', fontWeight: 800, fontSize: '0.8rem' }}>✓ Selected</div>}
                      <div style={{ fontSize: '0.74rem', color: '#6b7280', marginTop: '0.15rem' }}>{hoursLabel}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Time slot picker */}
        {selectedLoc && (
          <div style={{ marginBottom: '1.1rem' }}>
            <p style={{ ...S.label, marginBottom: '0.5rem' }}>
              {isDelivery ? '🚗 Delivery Slot' : '⏱ Pickup Time'}
              {selectedTimeValue && !showCustom && (
                <span style={{ marginLeft: '0.5rem', color: '#16a34a', fontWeight: 700, fontSize: '0.82rem' }}>✓ Selected</span>
              )}
            </p>

            {/* Quick slot pills */}
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
              {quickSlots.map((slot) => {
                const active = selectedTimeValue === slot.value && !showCustom;
                return (
                  <button
                    key={slot.value}
                    type="button"
                    onClick={() => selectQuickSlot(slot)}
                    style={{
                      background: active ? '#f59e0b' : '#fff',
                      color: active ? '#fff' : '#78350f',
                      border: `2px solid ${active ? '#f59e0b' : '#fed7aa'}`,
                      borderRadius: '0.65rem',
                      padding: '0.45rem 0.75rem',
                      cursor: 'pointer',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      textAlign: 'center',
                      lineHeight: 1.3,
                      transition: 'all 0.1s',
                    }}
                  >
                    <div>{slot.label}</div>
                    <div style={{ fontSize: '0.72rem', fontWeight: 600, opacity: active ? 0.9 : 0.7 }}>{slot.sublabel}</div>
                  </button>
                );
              })}

              {/* Custom time toggle */}
              <button
                type="button"
                onClick={() => { setShowCustom((v) => !v); if (!showCustom) setSelectedTimeValue(''); }}
                style={{
                  background: showCustom ? '#fef3c7' : '#f9fafb',
                  color: '#374151',
                  border: `2px solid ${showCustom ? '#f59e0b' : '#e5e7eb'}`,
                  borderRadius: '0.65rem',
                  padding: '0.45rem 0.75rem',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                }}
              >
                📅 Custom
              </button>
            </div>

            {/* Custom date + time picker — pill-based */}
            {showCustom && (
              <div style={{ background: '#fffbeb', border: '1px solid #fed7aa', borderRadius: '0.75rem', padding: '0.75rem', display: 'grid', gap: '0.6rem' }}>
                {/* Day pills */}
                <div>
                  <p style={{ ...S.label, marginBottom: '0.35rem' }}>Choose a day</p>
                  <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                    {customDays.map((day) => {
                      const active = customDate === day.dateStr;
                      return (
                        <button
                          key={day.dateStr}
                          type="button"
                          disabled={!day.isOpen}
                          onClick={() => { setCustomDate(day.dateStr); setCustomTime(''); }}
                          style={{
                            background: active ? '#f59e0b' : day.isOpen ? '#fff' : '#f3f4f6',
                            color: active ? '#fff' : day.isOpen ? '#78350f' : '#9ca3af',
                            border: `2px solid ${active ? '#f59e0b' : day.isOpen ? '#fed7aa' : '#e5e7eb'}`,
                            borderRadius: '0.6rem',
                            padding: '0.35rem 0.65rem',
                            cursor: day.isOpen ? 'pointer' : 'not-allowed',
                            fontWeight: 700,
                            fontSize: '0.82rem',
                            lineHeight: 1.3,
                            textAlign: 'center',
                            textDecoration: day.isOpen ? 'none' : 'line-through',
                          }}
                        >
                          <div>{day.shortLabel}</div>
                          <div style={{ fontSize: '0.7rem', fontWeight: 600, opacity: 0.8 }}>{day.dayLabel}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Time pills */}
                {customDate && (
                  <div>
                    <p style={{ ...S.label, marginBottom: '0.35rem' }}>Choose a time</p>
                    {customTimeSlots.length === 0 ? (
                      <p style={{ ...mutedText, fontSize: '0.78rem' }}>Closed on this day — pick another date.</p>
                    ) : (
                      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                        {customTimeSlots.map((slot) => {
                          const active = selectedTimeValue === slot.value;
                          return (
                            <button
                              key={slot.value}
                              type="button"
                              onClick={() => { setCustomTime(slot.label); setSelectedTimeValue(slot.value); }}
                              style={{
                                background: active ? '#f59e0b' : '#fff',
                                color: active ? '#fff' : '#78350f',
                                border: `2px solid ${active ? '#f59e0b' : '#fed7aa'}`,
                                borderRadius: '0.6rem',
                                padding: '0.35rem 0.65rem',
                                cursor: 'pointer',
                                fontWeight: 700,
                                fontSize: '0.82rem',
                              }}
                            >
                              {slot.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Delivery note */}
            {isDelivery && selectedTimeValue && (
              <p style={{ fontSize: '0.78rem', color: '#16a34a', fontWeight: 600, marginTop: '0.4rem' }}>
                🚗 Hourly slot — store will confirm exact delivery time after accepting
              </p>
            )}
          </div>
        )}

        {!user ? (
          <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
            <p style={{ ...mutedText, marginBottom: '1rem' }}>Sign in to place an order and receive pickup notifications.</p>
            <button type="button" onClick={onLoginRequest} style={S.primaryBtn}>🔑 Sign In to Order</button>
          </div>
        ) : (
          <>
            {error ? <div style={{ ...S.errorBox, marginBottom: '0.9rem' }}>{error}</div> : null}
            {success ? <div style={{ ...S.successBox, marginBottom: '0.9rem' }}>{success}</div> : null}

            <form onSubmit={submitOrder} style={{ display: 'grid', gap: '0.9rem' }}>
              <div>
                <label htmlFor="customerName" style={S.label}>Customer Name</label>
                <input id="customerName" value={customerName} onChange={(e) => setCustomerName(e.target.value)} style={S.inp} placeholder="Your full name" />
              </div>
              <div>
                <label htmlFor="phone" style={S.label}>Phone</label>
                <input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} style={{ ...S.inp, background: '#f9fafb' }} readOnly />
              </div>

              {/* Selected time summary */}
              {selectedTimeValue && (
                <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '0.6rem', padding: '0.55rem 0.9rem', fontWeight: 700, color: '#78350f', fontSize: '0.9rem' }}>
                  {isDelivery ? '🚗' : '📍'} {isDelivery ? 'Delivery' : 'Pickup'}: {selectedTimeValue}
                  {selectedLoc?.name ? ` @ ${selectedLoc.name}` : ''}
                </div>
              )}

              <button type="submit" disabled={submitting} style={{ ...S.primaryBtn, opacity: submitting ? 0.7 : 1 }}>
                {submitting ? 'Placing Order...' : isDelivery ? '🚗 Place Delivery Order' : 'Place Order'}
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
