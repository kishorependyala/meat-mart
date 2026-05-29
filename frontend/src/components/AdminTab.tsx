import { useCallback, useEffect, useState } from 'react';

import {
  AdminsData,
  AdminUser,
  AppSettings,
  DataBrowseResult,
  DataEntry,
  DayHours,
  MenuItem,
  StoreLocation,
  addAdmin,
  addLocation,
  addMenuItem,
  adminGetLocations,
  adminGetMenu,
  adminResetPin,
  dataBrowse,
  dataDownloadUrl,
  deleteLocation,
  deleteMenuItem,
  getAdminUsers,
  getAdmins,
  getOrders,
  getSettings,
  Order,
  readDataFile,
  removeAdmin,
  updateLocation,
  updateMenuItem,
  updateOrder,
  updateSettings,
  User,
} from '../api';
import { S, mutedText, sectionTitle } from '../theme';

type AdminSubTab = 'orders' | 'users' | 'menu' | 'hours' | 'data' | 'admins';

type Props = {
  adminUser: User;
  onViewAsUser: (u: User) => void;
};

function statusBadge(status: Order['status']) {
  const map: Record<string, { background: string; color: string }> = {
    pending:   { background: '#fef3c7', color: '#92400e' },
    accepted:  { background: '#dbeafe', color: '#1e40af' },
    ready:     { background: '#dcfce7', color: '#166534' },
    completed: { background: '#e5e7eb', color: '#374151' },
  };
  const colors = map[status.toLowerCase()] ?? map.pending;
  return {
    ...colors,
    borderRadius: 999,
    padding: '0.25rem 0.7rem',
    fontSize: '0.74rem',
    fontWeight: 800,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
  };
}

export default function AdminTab({ adminUser, onViewAsUser }: Props) {
  const [subTab, setSubTab] = useState<AdminSubTab>('orders');

  const subTabs: Array<{ id: AdminSubTab; label: string; emoji: string }> = [
    { id: 'orders', label: 'Orders', emoji: '📋' },
    { id: 'users',  label: 'Users',  emoji: '👥' },
    { id: 'menu',   label: 'Menu',   emoji: '🍖' },
    { id: 'hours',  label: 'Hours',  emoji: '🏪' },
    { id: 'data',   label: 'Data',   emoji: '📁' },
    { id: 'admins', label: 'Admins', emoji: '🛡️' },
  ];

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <section style={S.card}>
        <h2 style={sectionTitle}>🛡️ Admin Panel</h2>
        <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.75rem', borderBottom: '2px solid #fed7aa', paddingBottom: '0' }}>
          {subTabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSubTab(t.id)}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: subTab === t.id ? '3px solid #f59e0b' : '3px solid transparent',
                color: subTab === t.id ? '#92400e' : '#6b7280',
                fontWeight: subTab === t.id ? 800 : 600,
                cursor: 'pointer',
                padding: '0.55rem 0.85rem',
                marginBottom: '-2px',
                fontSize: '0.9rem',
                whiteSpace: 'nowrap',
              }}
            >
              {t.emoji} {t.label}
            </button>
          ))}
        </div>
      </section>

      {subTab === 'orders' && <OrdersPanel adminUser={adminUser} />}
      {subTab === 'users'  && <UsersPanel  adminUser={adminUser} onViewAsUser={onViewAsUser} />}
      {subTab === 'menu'   && <MenuPanel   adminUser={adminUser} />}
      {subTab === 'hours'  && <HoursPanel  adminUser={adminUser} />}
      {subTab === 'data'   && <DataPanel   adminUser={adminUser} />}
      {subTab === 'admins' && <AdminsPanel adminUser={adminUser} />}
    </div>
  );
}

// ── Users Panel ──────────────────────────────────────────────────────────────

function UsersPanel({ adminUser, onViewAsUser }: { adminUser: User; onViewAsUser: (u: User) => void }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedPhone, setExpandedPhone] = useState<string | null>(null);
  const [userOrders, setUserOrders] = useState<Record<string, Order[]>>({});
  const [ordersLoading, setOrdersLoading] = useState<Record<string, boolean>>({});
  const [pinResetMsg, setPinResetMsg] = useState<Record<string, string>>({});
  const [pinResetting, setPinResetting] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setLoading(true); setError('');
    getAdminUsers(adminUser)
      .then(setUsers)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load users.'))
      .finally(() => setLoading(false));
  }, [adminUser]);

  const toggleUser = async (phone: string) => {
    if (expandedPhone === phone) { setExpandedPhone(null); return; }
    setExpandedPhone(phone);
    if (userOrders[phone]) return;
    setOrdersLoading((o) => ({ ...o, [phone]: true }));
    try {
      const orders = await getOrders(phone);
      setUserOrders((o) => ({ ...o, [phone]: orders }));
    } catch { setUserOrders((o) => ({ ...o, [phone]: [] })); }
    finally { setOrdersLoading((o) => ({ ...o, [phone]: false })); }
  };

  const fmtDate = (iso: string) => {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
    catch { return iso.slice(0, 10); }
  };

  if (loading) return <div style={S.card}>Loading users…</div>;
  if (error)   return <div style={{ ...S.card, ...S.errorBox }}>{error}</div>;
  if (!users.length) return <div style={{ ...S.card, background: '#fffaf0' }}>No users yet.</div>;

  return (
    <div style={{ display: 'grid', gap: '0.5rem' }}>
      <p style={mutedText}>{users.length} customer{users.length !== 1 ? 's' : ''} found.</p>

      {/* Header */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 56px 88px 20px', gap: '0.5rem', padding: '0.4rem 0.75rem', background: '#fef3c7', borderRadius: '0.5rem', fontSize: '0.73rem', fontWeight: 800, color: '#92400e', textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>
        <span>Name</span><span>Phone</span><span style={{ textAlign: 'center' as const }}>Orders</span><span style={{ textAlign: 'right' as const }}>Spent</span><span />
      </div>

      {users.map((u) => (
        <div key={u.phone} style={{ border: '1px solid #fed7aa', borderRadius: '0.75rem', background: '#fffbeb', overflow: 'hidden' }}>
          <button
            type="button"
            onClick={() => toggleUser(u.phone)}
            style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '0.6rem 0.75rem', display: 'grid', gridTemplateColumns: '1fr 130px 56px 88px 20px', gap: '0.5rem', alignItems: 'center', textAlign: 'left' as const }}
          >
            <span style={{ fontWeight: 700, color: '#78350f', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{u.name}</span>
            <span style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: '#374151' }}>{u.phone}</span>
            <span style={{ textAlign: 'center' as const, fontSize: '0.82rem', color: '#6b7280' }}>{u.orderCount}</span>
            <span style={{ textAlign: 'right' as const, fontSize: '0.82rem', fontWeight: 700, color: '#16a34a' }}>${u.totalSpent.toFixed(2)}</span>
            <span style={{ color: '#9ca3af', fontSize: '0.7rem' }}>{expandedPhone === u.phone ? '▲' : '▼'}</span>
          </button>

          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', padding: '0.4rem 0.75rem', justifyContent: 'flex-end', borderTop: '1px solid #fde68a', background: '#fffef5', flexWrap: 'wrap' as const }}>
            <button
              type="button"
              onClick={() => onViewAsUser({ name: u.name, phone: u.phone, isAdmin: false })}
              style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 999, padding: '0.3rem 0.85rem', fontSize: '0.78rem', fontWeight: 700, color: '#92400e', cursor: 'pointer' }}
            >
              👁 View as this user
            </button>
            <button
              type="button"
              disabled={pinResetting[u.phone]}
              onClick={async () => {
                if (!window.confirm(`Clear PIN for ${u.name} (${u.phone})? They will set a new one on next login.`)) return;
                setPinResetting((s) => ({ ...s, [u.phone]: true }));
                try {
                  const res = await adminResetPin(u.phone, adminUser as unknown as AdminUser);
                  setPinResetMsg((s) => ({ ...s, [u.phone]: res.success ? '✓ PIN cleared' : (res.message ?? 'Error') }));
                } catch { setPinResetMsg((s) => ({ ...s, [u.phone]: 'Error' })); }
                setPinResetting((s) => ({ ...s, [u.phone]: false }));
                setTimeout(() => setPinResetMsg((s) => { const n = { ...s }; delete n[u.phone]; return n; }), 3000);
              }}
              style={{ background: '#fff', border: '1px solid #fecaca', borderRadius: 999, padding: '0.3rem 0.85rem', fontSize: '0.78rem', fontWeight: 700, color: '#dc2626', cursor: 'pointer' }}
            >
              {pinResetting[u.phone] ? '…' : '🔑 Reset PIN'}
            </button>
            {pinResetMsg[u.phone] && (
              <span style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 700 }}>{pinResetMsg[u.phone]}</span>
            )}
          </div>

          {expandedPhone === u.phone && (
            <div style={{ borderTop: '1px solid #fde68a', padding: '0.6rem 0.75rem', background: '#fffef5' }}>
              <p style={{ ...mutedText, fontSize: '0.75rem', marginBottom: '0.5rem', marginTop: 0 }}>Last order: {fmtDate(u.lastOrderAt)}</p>
              {ordersLoading[u.phone] ? (
                <span style={mutedText}>Loading orders…</span>
              ) : !userOrders[u.phone]?.length ? (
                <span style={mutedText}>No orders found.</span>
              ) : (
                <div style={{ display: 'grid', gap: '0.4rem' }}>
                  {userOrders[u.phone].map((order) => (
                    <div key={order.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.6rem', background: '#fff', border: '1px solid #fde68a', borderRadius: '0.5rem', flexWrap: 'wrap' as const }}>
                      <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' as const }}>
                        <span style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#78350f', fontWeight: 700 }}>#{order.id.slice(-6).toUpperCase()}</span>
                        <span style={{ fontSize: '0.78rem', color: '#6b7280' }}>{fmtDate(order.createdAt)}</span>
                        <span style={{ fontSize: '0.78rem', color: '#374151' }}>{order.items.map((i) => `${i.name} ×${i.qty}`).join(', ')}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0 }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#16a34a' }}>${order.total.toFixed(2)}</span>
                        <span style={{
                          background: order.status === 'Completed' ? '#e5e7eb' : order.status === 'Ready' ? '#dcfce7' : order.status === 'Accepted' ? '#dbeafe' : '#fef3c7',
                          color: order.status === 'Completed' ? '#374151' : order.status === 'Ready' ? '#166534' : order.status === 'Accepted' ? '#1e40af' : '#92400e',
                          borderRadius: 999, padding: '0.15rem 0.5rem', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase' as const,
                        }}>{order.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Hours / Locations Panel ───────────────────────────────────────────────────

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function HoursPanel({ adminUser }: { adminUser: User }) {
  const [locations, setLocations] = useState<StoreLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Record<string, StoreLocation>>({});
  const [addingNew, setAddingNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newPhone, setNewPhone] = useState('');

  useEffect(() => {
    setLoading(true);
    adminGetLocations(adminUser)
      .then((locs) => { setLocations(locs); })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load locations.'))
      .finally(() => setLoading(false));
  }, [adminUser]);

  const openEditor = (loc: StoreLocation) => {
    if (expandedId === loc.id) { setExpandedId(null); return; }
    setExpandedId(loc.id);
    setEditDraft((d) => ({ ...d, [loc.id]: JSON.parse(JSON.stringify(loc)) }));
  };

  const setDraftField = (locId: string, field: keyof StoreLocation, value: string) => {
    setEditDraft((d) => ({ ...d, [locId]: { ...d[locId], [field]: value } }));
  };

  const toggleDeliveryMode = (locId: string) => {
    setEditDraft((d) => {
      const current = d[locId]?.deliveryMode ?? 'pickup';
      return { ...d, [locId]: { ...d[locId], deliveryMode: current === 'pickup' ? 'hourly_delivery' : 'pickup' } };
    });
  };

  const setDraftHours = (locId: string, dayIdx: number, field: 'open' | 'close', value: string) => {
    setEditDraft((d) => {
      const loc = { ...d[locId] };
      const hours = { ...loc.hours };
      const existing = hours[String(dayIdx)] ?? { open: '10:00', close: '20:00' };
      hours[String(dayIdx)] = { ...(existing as { open: string; close: string }), [field]: value };
      return { ...d, [locId]: { ...loc, hours } };
    });
  };

  const toggleDayClosed = (locId: string, dayIdx: number) => {
    setEditDraft((d) => {
      const loc = { ...d[locId] };
      const hours = { ...loc.hours };
      hours[String(dayIdx)] = hours[String(dayIdx)] ? null : { open: '10:00', close: '20:00' };
      return { ...d, [locId]: { ...loc, hours } };
    });
  };

  const saveLocation = async (locId: string) => {
    const draft = editDraft[locId];
    if (!draft) return;
    setSaving(locId);
    try {
      const updated = await updateLocation(locId, { name: draft.name, address: draft.address, phone: draft.phone, hours: draft.hours, deliveryMode: draft.deliveryMode ?? 'pickup' }, adminUser);
      setLocations((ls) => ls.map((l) => l.id === locId ? updated : l));
      setExpandedId(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save.');
    } finally {
      setSaving(null);
    }
  };

  const handleDeleteLocation = async (locId: string) => {
    if (!window.confirm('Delete this location?')) return;
    try {
      await deleteLocation(locId, adminUser);
      setLocations((ls) => ls.filter((l) => l.id !== locId));
      if (expandedId === locId) setExpandedId(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete.');
    }
  };

  const handleAddLocation = async () => {
    if (!newName.trim()) return;
    try {
      const loc = await addLocation({ name: newName.trim(), address: newAddress.trim(), phone: newPhone.trim(), hours: { '0': { open: '10:00', close: '18:00' }, '1': { open: '10:00', close: '20:00' }, '2': { open: '10:00', close: '20:00' }, '3': { open: '10:00', close: '20:00' }, '4': { open: '10:00', close: '20:00' }, '5': { open: '10:00', close: '20:00' }, '6': { open: '10:00', close: '20:00' } } }, adminUser);
      setLocations((ls) => [...ls, loc]);
      setNewName(''); setNewAddress(''); setNewPhone(''); setAddingNew(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to add location.');
    }
  };

  if (loading) return <div style={S.card}>Loading locations…</div>;
  if (error) return <div style={{ ...S.card, ...S.errorBox }}>{error}</div>;

  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      <p style={mutedText}>{locations.length} location{locations.length !== 1 ? 's' : ''}. Click a location to edit hours.</p>

      {locations.map((loc) => {
        const draft = editDraft[loc.id] ?? loc;
        const isOpen = expandedId === loc.id;
        return (
          <div key={loc.id} style={{ border: '1px solid #fed7aa', borderRadius: '0.75rem', background: '#fffbeb', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 0.75rem' }}>
              <button type="button" onClick={() => openEditor(loc)} style={{ flex: 1, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span style={{ fontWeight: 800, color: '#78350f' }}>{loc.name}</span>
                <span style={{ fontSize: '0.75rem', background: loc.deliveryMode === 'hourly_delivery' ? '#dcfce7' : '#e5e7eb', color: loc.deliveryMode === 'hourly_delivery' ? '#16a34a' : '#6b7280', borderRadius: 999, padding: '0.1rem 0.5rem', fontWeight: 700, flexShrink: 0 }}>
                  {loc.deliveryMode === 'hourly_delivery' ? '🚗 Delivery' : '🏪 Pickup'}
                </span>
                <span style={{ fontSize: '0.8rem', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{loc.address}</span>
                <span style={{ color: '#9ca3af', fontSize: '0.7rem', marginLeft: 'auto' }}>{isOpen ? '▲' : '▼'}</span>
              </button>
              <button type="button" onClick={() => handleDeleteLocation(loc.id)} style={{ ...S.dangerBtn, padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}>✕</button>
            </div>

            {isOpen && (
              <div style={{ borderTop: '1px solid #fde68a', padding: '0.75rem', background: '#fffef5', display: 'grid', gap: '0.75rem' }}>
                <div style={{ display: 'grid', gap: '0.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                  <div>
                    <label style={S.label}>Name</label>
                    <input value={draft.name} onChange={(e) => setDraftField(loc.id, 'name', e.target.value)} style={S.inp} />
                  </div>
                  <div>
                    <label style={S.label}>Phone</label>
                    <input value={draft.phone} onChange={(e) => setDraftField(loc.id, 'phone', e.target.value)} style={S.inp} placeholder="(609) 555-0000" />
                  </div>
                </div>
                <div>
                  <label style={S.label}>Address</label>
                  <input value={draft.address} onChange={(e) => setDraftField(loc.id, 'address', e.target.value)} style={S.inp} />
                </div>

                {/* Delivery mode toggle */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 0.75rem', background: '#fef3c7', borderRadius: '0.6rem' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color: '#78350f', fontSize: '0.88rem' }}>
                      {draft.deliveryMode === 'hourly_delivery' ? '🚗 Hourly Delivery' : '🏪 Pickup Only'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#92400e' }}>
                      {draft.deliveryMode === 'hourly_delivery'
                        ? 'Customers select next hourly slot — admin confirms exact time'
                        : 'Customers schedule their own pickup time'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleDeliveryMode(loc.id)}
                    style={{ background: draft.deliveryMode === 'hourly_delivery' ? '#16a34a' : '#6b7280', color: '#fff', border: 'none', borderRadius: 999, padding: '0.35rem 0.9rem', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' as const }}
                  >
                    {draft.deliveryMode === 'hourly_delivery' ? 'Switch to Pickup' : 'Enable Delivery'}
                  </button>
                </div>

                <div>
                  <p style={{ ...S.label, marginBottom: '0.4rem' }}>Hours</p>
                  <div style={{ display: 'grid', gap: '0.35rem' }}>
                    {DAYS.map((dayName, idx) => {
                      const dayHours = draft.hours[String(idx)] as DayHours;
                      const closed = !dayHours;
                      return (
                        <div key={idx} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.85rem' }}>
                          <span style={{ width: 36, fontWeight: 700, color: '#78350f' }}>{dayName}</span>
                          <button
                            type="button"
                            onClick={() => toggleDayClosed(loc.id, idx)}
                            style={{ background: closed ? '#fee2e2' : '#dcfce7', color: closed ? '#dc2626' : '#16a34a', border: 'none', borderRadius: 999, padding: '0.15rem 0.6rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', minWidth: 56 }}
                          >
                            {closed ? 'Closed' : 'Open'}
                          </button>
                          {!closed && (
                            <>
                              <input
                                type="time"
                                value={(dayHours as { open: string; close: string }).open}
                                onChange={(e) => setDraftHours(loc.id, idx, 'open', e.target.value)}
                                style={{ ...S.inp, padding: '0.2rem 0.4rem', fontSize: '0.82rem', width: 96 }}
                              />
                              <span style={{ color: '#6b7280' }}>–</span>
                              <input
                                type="time"
                                value={(dayHours as { open: string; close: string }).close}
                                onChange={(e) => setDraftHours(loc.id, idx, 'close', e.target.value)}
                                style={{ ...S.inp, padding: '0.2rem 0.4rem', fontSize: '0.82rem', width: 96 }}
                              />
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="button" onClick={() => saveLocation(loc.id)} disabled={saving === loc.id} style={{ ...S.primaryBtn, fontSize: '0.85rem' }}>
                    {saving === loc.id ? 'Saving…' : '💾 Save'}
                  </button>
                  <button type="button" onClick={() => setExpandedId(null)} style={{ ...S.outlineBtn, fontSize: '0.85rem' }}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Add new location */}
      {addingNew ? (
        <div style={{ ...S.card, background: '#f0fdf4', border: '1px solid #86efac' }}>
          <p style={{ ...sectionTitle, marginBottom: '0.75rem' }}>New Location</p>
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} style={S.inp} placeholder="Location name *" />
            <input value={newAddress} onChange={(e) => setNewAddress(e.target.value)} style={S.inp} placeholder="Address" />
            <input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} style={S.inp} placeholder="Phone" />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="button" onClick={handleAddLocation} style={S.primaryBtn}>Add Location</button>
              <button type="button" onClick={() => setAddingNew(false)} style={S.outlineBtn}>Cancel</button>
            </div>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setAddingNew(true)} style={{ ...S.outlineBtn, width: '100%', padding: '0.65rem' }}>
          + Add Location
        </button>
      )}
    </div>
  );
}

// ── Orders Panel ─────────────────────────────────────────────────────────────

function OrdersPanel({ adminUser }: { adminUser: User }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [prepEdits, setPrepEdits] = useState<Record<string, string>>({});
  const [deliveryTimeEdits, setDeliveryTimeEdits] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const all = await getOrders();
      setOrders(all);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load orders.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 15_000);
    return () => clearInterval(interval);
  }, [loadOrders]);

  const patchOrder = async (id: string, updates: { status?: Order['status']; prepMinutes?: number; confirmedDeliveryTime?: string | null }) => {
    setBusy((b) => ({ ...b, [id]: true }));
    try {
      const updated = await updateOrder(id, updates, adminUser);
      setOrders((current) => current.map((o) => (o.id === id ? updated : o)));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Update failed.');
    } finally {
      setBusy((b) => ({ ...b, [id]: false }));
    }
  };

  const savePrepTime = (order: Order) => {
    const raw = prepEdits[order.id];
    const val = parseInt(raw ?? '', 10);
    if (!raw || isNaN(val) || val < 1) return;
    patchOrder(order.id, { prepMinutes: val });
    setPrepEdits((e) => { const next = { ...e }; delete next[order.id]; return next; });
  };

  const saveDeliveryTime = (order: Order) => {
    const raw = deliveryTimeEdits[order.id]?.trim();
    if (!raw) return;
    patchOrder(order.id, { confirmedDeliveryTime: raw });
    setDeliveryTimeEdits((e) => { const next = { ...e }; delete next[order.id]; return next; });
  };

  const activeOrders = orders.filter((o) => o.status !== 'Completed');
  const completedOrders = orders.filter((o) => o.status === 'Completed');

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={mutedText}>Accept orders, set prep time, and mark ready for pickup.</p>
        <button type="button" onClick={loadOrders} style={S.outlineBtn}>Refresh</button>
      </div>

      {loading && !orders.length ? <div style={S.card}>Loading orders…</div> : null}
      {error ? <div style={{ ...S.card, ...S.errorBox }}>{error}</div> : null}
      {!loading && !error && !orders.length ? (
        <div style={{ ...S.card, background: '#fffaf0' }}>No orders yet.</div>
      ) : null}

      {activeOrders.map((order) => (
        <OrderCard
          key={order.id}
          order={order}
          isBusy={!!busy[order.id]}
          prepEdit={prepEdits[order.id] ?? ''}
          deliveryTimeEdit={deliveryTimeEdits[order.id] ?? ''}
          onPrepEditChange={(v) => setPrepEdits((e) => ({ ...e, [order.id]: v }))}
          onDeliveryTimeChange={(v) => setDeliveryTimeEdits((e) => ({ ...e, [order.id]: v }))}
          onSavePrepTime={() => savePrepTime(order)}
          onSaveDeliveryTime={() => saveDeliveryTime(order)}
          onAccept={() => patchOrder(order.id, { status: 'Accepted' })}
          onMarkReady={() => patchOrder(order.id, { status: 'Ready' })}
          onComplete={() => patchOrder(order.id, { status: 'Completed' })}
        />
      ))}

      {completedOrders.length > 0 && (
        <details style={S.card}>
          <summary style={{ cursor: 'pointer', fontWeight: 700, color: '#78350f' }}>
            Completed Orders ({completedOrders.length})
          </summary>
          <div style={{ display: 'grid', gap: '0.75rem', marginTop: '0.75rem' }}>
            {completedOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                isBusy={!!busy[order.id]}
                prepEdit={prepEdits[order.id] ?? ''}
                deliveryTimeEdit={deliveryTimeEdits[order.id] ?? ''}
                onPrepEditChange={(v) => setPrepEdits((e) => ({ ...e, [order.id]: v }))}
                onDeliveryTimeChange={(v) => setDeliveryTimeEdits((e) => ({ ...e, [order.id]: v }))}
                onSavePrepTime={() => savePrepTime(order)}
                onSaveDeliveryTime={() => saveDeliveryTime(order)}
                onAccept={() => patchOrder(order.id, { status: 'Accepted' })}
                onMarkReady={() => patchOrder(order.id, { status: 'Ready' })}
                onComplete={() => patchOrder(order.id, { status: 'Completed' })}
              />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

type CardProps = {
  order: Order;
  isBusy: boolean;
  prepEdit: string;
  deliveryTimeEdit: string;
  onPrepEditChange: (v: string) => void;
  onDeliveryTimeChange: (v: string) => void;
  onSavePrepTime: () => void;
  onSaveDeliveryTime: () => void;
  onAccept: () => void;
  onMarkReady: () => void;
  onComplete: () => void;
};

function OrderCard({ order, isBusy, prepEdit, deliveryTimeEdit, onPrepEditChange, onDeliveryTimeChange, onSavePrepTime, onSaveDeliveryTime, onAccept, onMarkReady, onComplete }: CardProps) {
  const displayPrep = prepEdit !== '' ? prepEdit : String(order.prepMinutes ?? '');
  const isDelivery = order.isDelivery;

  return (
    <div style={{ border: '1px solid #fed7aa', borderRadius: '0.95rem', padding: '1rem', background: '#fffbeb' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontWeight: 800, color: '#78350f', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            Order #{order.id.slice(-8).toUpperCase()}
            {isDelivery && <span style={{ background: '#dcfce7', color: '#16a34a', borderRadius: 999, padding: '0.1rem 0.5rem', fontSize: '0.72rem', fontWeight: 700 }}>🚗 Delivery</span>}
          </div>
          <p style={mutedText}>{order.customerName} · {order.phone}</p>
          <p style={{ ...mutedText, marginTop: '0.2rem' }}>
            {isDelivery ? '📦 Requested:' : '📍 Pickup:'} {order.pickupTime}
            {order.locationName ? <span style={{ marginLeft: '0.4rem', color: '#78350f' }}>@ {order.locationName}</span> : null}
          </p>
          {isDelivery && order.confirmedDeliveryTime && (
            <p style={{ ...mutedText, marginTop: '0.2rem', color: '#16a34a', fontWeight: 700 }}>
              ✅ Confirmed delivery: {order.confirmedDeliveryTime}
            </p>
          )}
        </div>
        <span style={statusBadge(order.status)}>{order.status}</span>
      </div>

      {/* Delivery time confirmation — show for delivery orders */}
      {isDelivery && (
        <div style={{ marginTop: '0.75rem', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '0.6rem', padding: '0.6rem 0.75rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' as const }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#16a34a', flexShrink: 0 }}>🚗 Confirm delivery time:</span>
          <input
            type="text"
            value={deliveryTimeEdit !== '' ? deliveryTimeEdit : (order.confirmedDeliveryTime ?? '')}
            onChange={(e) => onDeliveryTimeChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSaveDeliveryTime()}
            placeholder="e.g. 3:00 PM today"
            style={{ ...S.inp, flex: 1, minWidth: 150, padding: '0.3rem 0.5rem', fontSize: '0.82rem' }}
          />
          <button type="button" onClick={onSaveDeliveryTime} disabled={isBusy} style={{ ...S.primaryBtn, background: '#16a34a', fontSize: '0.82rem', padding: '0.35rem 0.75rem', opacity: isBusy ? 0.6 : 1, flexShrink: 0 }}>
            Confirm
          </button>
        </div>
      )}

      <div style={{ marginTop: '0.75rem', display: 'grid', gap: '0.35rem' }}>
        {order.items.map((item) => (
          <div key={`${order.id}-${item.id}`} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', color: '#78350f' }}>
            <span>{item.name} × {item.qty}</span>
            <span>${(item.lineTotal ?? item.price * item.qty).toFixed(2)}</span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: '0.85rem', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flex: '1 1 180px' }}>
          <label style={{ ...S.label, margin: 0, whiteSpace: 'nowrap' }}>Prep (min):</label>
          <input
            type="number"
            min={1}
            value={displayPrep}
            onChange={(e) => onPrepEditChange(e.target.value)}
            onBlur={onSavePrepTime}
            onKeyDown={(e) => e.key === 'Enter' && onSavePrepTime()}
            style={{ ...S.inp, width: 70, padding: '0.35rem 0.5rem' }}
          />
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {order.status === 'Pending' && (
            <button type="button" onClick={onAccept} disabled={isBusy} style={{ ...S.primaryBtn, opacity: isBusy ? 0.6 : 1 }}>
              ✅ Accept
            </button>
          )}
          {order.status === 'Accepted' && (
            <button type="button" onClick={onMarkReady} disabled={isBusy} style={{ ...S.primaryBtn, opacity: isBusy ? 0.6 : 1, background: '#16a34a' }}>
              🔔 Mark Ready
            </button>
          )}
          {order.status === 'Ready' && (
            <button type="button" onClick={onComplete} disabled={isBusy} style={{ ...S.outlineBtn, opacity: isBusy ? 0.6 : 1 }}>
              ✔ Complete
            </button>
          )}
        </div>
      </div>

      <div style={{ marginTop: '0.5rem', color: '#92400e', fontWeight: 700, fontSize: '0.9rem' }}>
        Total: ${order.total.toFixed(2)}
      </div>
    </div>
  );
}

// ── Menu Management Panel ─────────────────────────────────────────────────────

const CATEGORIES: MenuItem['category'][] = ['Goat', 'Chicken', 'Fish'];

type NewItemDraft = { name: string; category: MenuItem['category']; price: string; unit: string; description: string };
const emptyDraft = (): NewItemDraft => ({ name: '', category: 'Chicken', price: '', unit: 'per lb', description: '' });

function MenuPanel({ adminUser }: { adminUser: User }) {
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<MenuItem>>({});
  const [busy, setBusy] = useState(false);

  const [priceEdits, setPriceEdits] = useState<Record<string, string>>({});
  const [priceBusy, setPriceBusy] = useState<Record<string, boolean>>({});

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletePin, setDeletePin] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);

  const [showAdd, setShowAdd] = useState(false);
  const [newDraft, setNewDraft] = useState<NewItemDraft>(emptyDraft());
  const [addBusy, setAddBusy] = useState(false);

  const [settingsDraft, setSettingsDraft] = useState<Partial<AppSettings>>({});
  const [settingsBusy, setSettingsBusy] = useState(false);

  useEffect(() => {
    setLoading(true); setError('');
    Promise.all([adminGetMenu(adminUser), getSettings(adminUser)])
      .then(([menuData, settingsData]) => {
        setMenu(menuData);
        setSettings(settingsData);
        setSettingsDraft({ chickenPrepMinutes: settingsData.chickenPrepMinutes, goatPrepMinutes: settingsData.goatPrepMinutes, deletePin: settingsData.deletePin });
      })      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load menu.'))
      .finally(() => setLoading(false));
  }, [adminUser]);

  const startEdit = (item: MenuItem) => {
    setEditingId(item.id); setDeletingId(null);
    setDraft({ name: item.name, price: item.price, unit: item.unit, description: item.description, category: item.category });
    setMsg('');
  };
  const cancelEdit = () => { setEditingId(null); setDraft({}); };
  const saveItem = async (itemId: string) => {
    setBusy(true); setMsg('');
    try {
      const updated = await updateMenuItem(itemId, draft, adminUser);
      setMenu((m) => m.map((i) => (i.id === itemId ? updated : i)));
      setEditingId(null); setDraft({});
      setMsg('Item saved.');
    } catch (err) { setMsg(err instanceof Error ? err.message : 'Save failed.'); }
    finally { setBusy(false); }
  };

  const savePrice = async (item: MenuItem) => {
    const raw = priceEdits[item.id];
    const val = parseFloat(raw ?? '');
    if (raw === undefined || isNaN(val) || val < 0) return;
    setPriceBusy((b) => ({ ...b, [item.id]: true }));
    try {
      const updated = await updateMenuItem(item.id, { price: val }, adminUser);
      setMenu((m) => m.map((i) => (i.id === item.id ? updated : i)));
      setPriceEdits((e) => { const n = { ...e }; delete n[item.id]; return n; });
      setMsg('Price updated.');
    } catch (err) { setMsg(err instanceof Error ? err.message : 'Price update failed.'); }
    finally { setPriceBusy((b) => ({ ...b, [item.id]: false })); }
  };

  const startDelete = (item: MenuItem) => {
    setDeletingId(item.id); setDeletePin(''); setEditingId(null); setMsg('');
  };
  const confirmDelete = async (itemId: string) => {
    if (deletePin !== (settings?.deletePin ?? '1234567')) { setMsg('Incorrect PIN.'); return; }
    setDeleteBusy(true); setMsg('');
    try {
      await deleteMenuItem(itemId, adminUser);
      setMenu((m) => m.filter((i) => i.id !== itemId));
      setDeletingId(null); setDeletePin('');
      setMsg('Item deleted.');
    } catch (err) { setMsg(err instanceof Error ? err.message : 'Delete failed.'); }
    finally { setDeleteBusy(false); }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const price = parseFloat(newDraft.price);
    if (!newDraft.name.trim() || isNaN(price) || price < 0) {
      setMsg('Name and a valid price are required.'); return;
    }
    setAddBusy(true); setMsg('');
    try {
      const created = await addMenuItem({ ...newDraft, price }, adminUser);
      setMenu((m) => [...m, created]);
      setNewDraft(emptyDraft()); setShowAdd(false);
      setMsg('Item added.');
    } catch (err) { setMsg(err instanceof Error ? err.message : 'Add failed.'); }
    finally { setAddBusy(false); }
  };

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault(); setSettingsBusy(true); setMsg('');
    try {
      const updated = await updateSettings(settingsDraft, adminUser);
      setSettings(updated);
      setSettingsDraft({ chickenPrepMinutes: updated.chickenPrepMinutes, goatPrepMinutes: updated.goatPrepMinutes, deletePin: updated.deletePin });
      setMsg('Settings saved.');
    } catch (err) { setMsg(err instanceof Error ? err.message : 'Failed to save settings.'); }
    finally { setSettingsBusy(false); }
  };

  if (loading) return <div style={S.card}>Loading menu…</div>;
  if (error)   return <div style={{ ...S.card, ...S.errorBox }}>{error}</div>;

  const categories = Array.from(new Set(menu.map((i) => i.category)));

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {msg && (
        <div style={{ ...S.card, ...(msg.toLowerCase().includes('fail') || msg.toLowerCase().includes('incorrect') || msg.toLowerCase().includes('error') ? S.errorBox : S.successBox) }}>
          {msg}
        </div>
      )}

      {categories.map((cat) => (
        <div key={cat} style={S.card}>
          <h3 style={{ margin: '0 0 0.75rem', color: '#78350f', fontSize: '0.95rem', fontWeight: 800 }}>
            {cat === 'Goat' ? '🐐' : cat === 'Chicken' ? '🍗' : '🍟'} {cat}
          </h3>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {menu.filter((i) => i.category === cat).map((item) => {
              const priceVal = priceEdits[item.id] !== undefined ? priceEdits[item.id] : item.price.toFixed(2);
              const isPriceDirty = priceEdits[item.id] !== undefined && priceEdits[item.id] !== item.price.toFixed(2);
              return (
                <div key={item.id} style={{ border: '1px solid #fde68a', borderRadius: '0.7rem', padding: '0.75rem', background: '#fffbeb' }}>

                  {editingId === item.id ? (
                    <div style={{ display: 'grid', gap: '0.55rem' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <div style={{ flex: '2 1 160px' }}>
                          <label style={S.label}>Name</label>
                          <input style={S.inp} value={draft.name ?? ''} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
                        </div>
                        <div style={{ flex: '1 1 100px' }}>
                          <label style={S.label}>Unit</label>
                          <input style={S.inp} value={draft.unit ?? ''} onChange={(e) => setDraft((d) => ({ ...d, unit: e.target.value }))} />
                        </div>
                        <div style={{ flex: '1 1 110px' }}>
                          <label style={S.label}>Category</label>
                          <select style={S.inp} value={draft.category ?? item.category} onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value as MenuItem['category'] }))}>
                            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                          </select>
                        </div>
                      </div>
                      <div>
                        <label style={S.label}>Description</label>
                        <input style={S.inp} value={draft.description ?? ''} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} />
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button type="button" onClick={() => saveItem(item.id)} disabled={busy} style={{ ...S.primaryBtn, opacity: busy ? 0.6 : 1 }}>
                          {busy ? 'Saving…' : '💾 Save'}
                        </button>
                        <button type="button" onClick={cancelEdit} disabled={busy} style={S.outlineBtn}>Cancel</button>
                      </div>
                    </div>

                  ) : deletingId === item.id ? (
                    <div style={{ display: 'grid', gap: '0.5rem' }}>
                      <div style={{ fontWeight: 700, color: '#b91c1c' }}>🗑️ Delete "{item.name}"?</div>
                      <p style={{ ...mutedText, margin: 0 }}>Enter PIN to confirm deletion.</p>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <input
                          type="password" placeholder="PIN" maxLength={10}
                          value={deletePin}
                          onChange={(e) => setDeletePin(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && confirmDelete(item.id)}
                          style={{ ...S.inp, width: 110 }}
                          autoFocus
                        />
                        <button type="button" onClick={() => confirmDelete(item.id)} disabled={deleteBusy}
                          style={{ ...S.dangerBtn, opacity: deleteBusy ? 0.6 : 1 }}>
                          {deleteBusy ? 'Deleting…' : 'Confirm Delete'}
                        </button>
                        <button type="button" onClick={() => setDeletingId(null)} disabled={deleteBusy} style={S.outlineBtn}>Cancel</button>
                      </div>
                    </div>

                  ) : (
                    <div style={{ display: 'grid', gap: '0.45rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <div>
                          <span style={{ fontWeight: 700, color: '#78350f' }}>{item.name}</span>
                          <span style={{ ...mutedText, marginLeft: '0.5rem', fontSize: '0.8rem' }}>{item.unit}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <button type="button" onClick={() => startEdit(item)} style={{ ...S.outlineBtn, fontSize: '0.78rem', padding: '0.25rem 0.6rem' }}>✏️ Edit</button>
                          <button type="button" onClick={() => startDelete(item)} style={{ ...S.dangerBtn, fontSize: '0.78rem', padding: '0.25rem 0.6rem' }}>🗑️</button>
                        </div>
                      </div>
                      {item.description && <div style={{ ...mutedText, fontSize: '0.82rem' }}>{item.description}</div>}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.1rem' }}>
                        <span style={{ fontSize: '0.82rem', color: '#6b7280', whiteSpace: 'nowrap' }}>Price $</span>
                        <input
                          type="number" min={0} step={0.01}
                          value={priceVal}
                          onChange={(e) => setPriceEdits((p) => ({ ...p, [item.id]: e.target.value }))}
                          onBlur={() => savePrice(item)}
                          onKeyDown={(e) => e.key === 'Enter' && savePrice(item)}
                          style={{ ...S.inp, width: 80, padding: '0.3rem 0.45rem', fontWeight: 700, color: '#16a34a' }}
                        />
                        {isPriceDirty && (
                          <button type="button" onClick={() => savePrice(item)} disabled={!!priceBusy[item.id]}
                            style={{ ...S.primaryBtn, fontSize: '0.78rem', padding: '0.28rem 0.65rem', opacity: priceBusy[item.id] ? 0.6 : 1 }}>
                            {priceBusy[item.id] ? '…' : '💾'}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <div style={S.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showAdd ? '0.75rem' : 0 }}>
          <h3 style={{ margin: 0, color: '#78350f', fontSize: '0.95rem', fontWeight: 800 }}>➕ Add New Item</h3>
          <button type="button" onClick={() => { setShowAdd((v) => !v); setNewDraft(emptyDraft()); }}
            style={{ ...S.outlineBtn, fontSize: '0.82rem', padding: '0.3rem 0.75rem' }}>
            {showAdd ? 'Cancel' : '+ Add'}
          </button>
        </div>
        {showAdd && (
          <form onSubmit={handleAdd} style={{ display: 'grid', gap: '0.65rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <div style={{ flex: '2 1 160px' }}>
                <label style={S.label}>Name *</label>
                <input required style={S.inp} value={newDraft.name}
                  onChange={(e) => setNewDraft((d) => ({ ...d, name: e.target.value }))} placeholder="e.g. Goat Ribs" />
              </div>
              <div style={{ flex: '1 1 110px' }}>
                <label style={S.label}>Category *</label>
                <select required style={S.inp} value={newDraft.category}
                  onChange={(e) => setNewDraft((d) => ({ ...d, category: e.target.value as MenuItem['category'] }))}>
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 90px' }}>
                <label style={S.label}>Price ($) *</label>
                <input required type="number" min={0} step={0.01} style={S.inp} value={newDraft.price}
                  onChange={(e) => setNewDraft((d) => ({ ...d, price: e.target.value }))} placeholder="0.00" />
              </div>
              <div style={{ flex: '1 1 110px' }}>
                <label style={S.label}>Unit</label>
                <input style={S.inp} value={newDraft.unit}
                  onChange={(e) => setNewDraft((d) => ({ ...d, unit: e.target.value }))} placeholder="per lb" />
              </div>
            </div>
            <div>
              <label style={S.label}>Description</label>
              <input style={S.inp} value={newDraft.description}
                onChange={(e) => setNewDraft((d) => ({ ...d, description: e.target.value }))} placeholder="Short description…" />
            </div>
            <button type="submit" disabled={addBusy} style={{ ...S.primaryBtn, opacity: addBusy ? 0.6 : 1, justifySelf: 'start' }}>
              {addBusy ? 'Adding…' : '➕ Add Item'}
            </button>
          </form>
        )}
      </div>

      <div style={S.card}>
        <h3 style={{ margin: '0 0 0.75rem', color: '#78350f', fontSize: '0.95rem', fontWeight: 800 }}>⏱️ Default Prep Times</h3>
        <p style={{ ...mutedText, marginBottom: '0.75rem' }}>Used when estimating prep time for new orders.</p>
        <form onSubmit={saveSettings} style={{ display: 'grid', gap: '0.75rem' }}>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 140px' }}>
              <label style={S.label}>🍗 Chicken (minutes)</label>
              <input type="number" min={1} style={S.inp} value={settingsDraft.chickenPrepMinutes ?? ''}
                onChange={(e) => setSettingsDraft((s) => ({ ...s, chickenPrepMinutes: parseInt(e.target.value, 10) || 0 }))} />
            </div>
            <div style={{ flex: '1 1 140px' }}>
              <label style={S.label}>🐐 Goat (minutes)</label>
              <input type="number" min={1} style={S.inp} value={settingsDraft.goatPrepMinutes ?? ''}
                onChange={(e) => setSettingsDraft((s) => ({ ...s, goatPrepMinutes: parseInt(e.target.value, 10) || 0 }))} />
            </div>
            <div style={{ flex: '1 1 140px' }}>
              <label style={S.label}>🔐 Delete PIN</label>
              <input type="text" maxLength={20} style={S.inp} value={settingsDraft.deletePin ?? ''}
                onChange={(e) => setSettingsDraft((s) => ({ ...s, deletePin: e.target.value }))} />
            </div>
          </div>
          <button type="submit" disabled={settingsBusy} style={{ ...S.primaryBtn, opacity: settingsBusy ? 0.6 : 1, justifySelf: 'start' }}>
            {settingsBusy ? 'Saving…' : '💾 Save Settings'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Data Browser Panel ────────────────────────────────────────────────────────

function DataPanel({ adminUser }: { adminUser: User }) {
  const [data, setData] = useState<DataBrowseResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [filePath, setFilePath] = useState('');
  const [fileLoading, setFileLoading] = useState(false);
  const [fileError, setFileError] = useState('');
  const [copied, setCopied] = useState(false);

  const smallBtn = { background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '0.5rem', padding: '0.35rem 0.7rem', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' as const };
  const smallOutlineBtn = { background: '#fff', color: '#78350f', border: '1px solid #fed7aa', borderRadius: '0.5rem', padding: '0.35rem 0.7rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' as const };
  const linkBtn = { background: 'none', border: 'none', padding: 0, cursor: 'pointer', textDecoration: 'underline', fontSize: '0.88rem' } as const;

  const load = async (path: string) => {
    setLoading(true); setError(''); setFileContent(null); setFilePath('');
    try {
      const res = await dataBrowse(adminUser as unknown as AdminUser, path);
      if (!res.success) setError(res.message || 'Could not browse.');
      else setData(res);
    } catch (e) { setError(e instanceof Error ? e.message : 'Error'); }
    setLoading(false);
  };

  useEffect(() => { load(''); }, []);

  const openFile = async (entry: DataEntry) => {
    setFileLoading(true); setFileError(''); setFileContent(null); setFilePath(entry.path); setCopied(false);
    try {
      const res = await readDataFile(entry.path, adminUser as unknown as AdminUser);
      setFileContent(res.content);
    } catch (e) { setFileError(e instanceof Error ? e.message : 'Error reading file.'); }
    setFileLoading(false);
  };

  const handleCopy = () => {
    if (!fileContent) return;
    navigator.clipboard.writeText(fileContent).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  };

  const segments = data?.currentPath ? data.currentPath.split('/').filter(Boolean) : [];
  const crumbPaths = segments.map((_, i) => segments.slice(0, i + 1).join('/'));

  const fmtSize = (bytes: number | null) => {
    if (bytes === null) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1_048_576).toFixed(2)} MB`;
  };

  return (
    <div style={{ display: 'grid', gap: '0.9rem' }}>
      {/* Dark data dir banner */}
      <div style={{ background: '#1e293b', borderRadius: '0.75rem', padding: '0.65rem 1rem', display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 700, whiteSpace: 'nowrap', letterSpacing: '0.05em' }}>DATA DIR</span>
        <code style={{ color: '#a3e635', fontSize: '0.82rem', wordBreak: 'break-all', flex: 1 }}>{data?.dataDir ?? '…'}</code>
        <a
          href={dataDownloadUrl(adminUser as unknown as AdminUser)}
          download="halalcart-data.zip"
          style={{ ...smallBtn, textDecoration: 'none' }}
        >⬇ Download all</a>
      </div>

      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexWrap: 'wrap', fontSize: '0.88rem' }}>
        <button style={{ ...linkBtn, fontWeight: 700, color: '#f59e0b' }} onClick={() => load('')}>root</button>
        {segments.map((seg, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <span style={{ color: '#d1d5db' }}>/</span>
            <button
              style={{ ...linkBtn, color: i === segments.length - 1 ? '#78350f' : '#f59e0b', fontWeight: i === segments.length - 1 ? 700 : 400 }}
              onClick={() => load(crumbPaths[i])}
            >{seg}</button>
          </span>
        ))}
      </div>

      {error && <div style={S.errorBox}>{error}</div>}

      {/* File / directory listing table */}
      <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <p style={{ ...mutedText, padding: '1rem' }}>Loading…</p>
        ) : !data || data.entries.length === 0 ? (
          <p style={{ ...mutedText, padding: '1rem' }}>Empty directory.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
            <thead>
              <tr style={{ background: '#fffbeb', borderBottom: '2px solid #fde68a' }}>
                <th style={{ textAlign: 'left', padding: '0.55rem 1rem', color: '#92400e', fontWeight: 700 }}>Name</th>
                <th style={{ textAlign: 'right', padding: '0.55rem 0.75rem', color: '#92400e', fontWeight: 700, whiteSpace: 'nowrap' }}>Size</th>
                <th style={{ textAlign: 'right', padding: '0.55rem 1rem', color: '#92400e', fontWeight: 700, whiteSpace: 'nowrap' }}>Modified</th>
              </tr>
            </thead>
            <tbody>
              {/* Parent dir (..) */}
              {data.currentPath && (
                <tr
                  style={{ borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }}
                  onClick={() => load(crumbPaths.length > 1 ? crumbPaths[crumbPaths.length - 2] : '')}
                >
                  <td style={{ padding: '0.5rem 1rem', color: '#f59e0b', fontWeight: 600 }}>📁 ..</td>
                  <td /><td />
                </tr>
              )}
              {data.entries.map((entry, i) => (
                <tr
                  key={entry.path}
                  style={{ borderBottom: '1px solid #f3f4f6', background: i % 2 === 0 ? '#fff' : '#fffbeb', cursor: 'pointer' }}
                  onClick={() => entry.type === 'dir' ? load(entry.path) : openFile(entry)}
                >
                  <td style={{ padding: '0.5rem 1rem', color: entry.type === 'dir' ? '#2563eb' : '#374151' }}>
                    {entry.type === 'dir' ? '📁 ' : '📄 '}{entry.name}
                  </td>
                  <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', ...mutedText }}>{fmtSize(entry.size)}</td>
                  <td style={{ padding: '0.5rem 1rem', textAlign: 'right', ...mutedText, fontSize: '0.76rem' }}>
                    {new Date(entry.modified * 1000).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* File viewer */}
      {(filePath || fileLoading) && (
        <div style={{ ...S.card, display: 'grid', gap: '0.65rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h3 style={{ margin: 0, fontWeight: 700, color: '#78350f', fontSize: '0.95rem' }}>📄 {filePath.split('/').pop()}</h3>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {fileContent !== null && (
                <button style={smallBtn} onClick={handleCopy}>{copied ? '✓ Copied!' : '📋 Copy'}</button>
              )}
              <button style={smallOutlineBtn} onClick={() => { setFileContent(null); setFilePath(''); }}>✕ Close</button>
            </div>
          </div>
          <code style={{ ...mutedText, fontSize: '0.7rem' }}>{filePath}</code>
          {fileLoading && <p style={mutedText}>Loading…</p>}
          {fileError && <div style={S.errorBox}>{fileError}</div>}
          {fileContent !== null && (
            <pre style={{ background: '#0f172a', color: '#a3e635', borderRadius: '0.75rem', padding: '1rem', fontSize: '0.78rem', overflowX: 'auto', maxHeight: 500, overflowY: 'auto', margin: 0, lineHeight: 1.5 }}>
              {fileContent}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}


// ── Admins Manager Panel ──────────────────────────────────────────────────────

function AdminsPanel({ adminUser }: { adminUser: User }) {
  const [data, setData] = useState<AdminsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const loadAdmins = useCallback(async () => {
    setLoading(true); setError('');
    try { setData(await getAdmins(adminUser)); }
    catch (err) { setError(err instanceof Error ? err.message : 'Failed to load admins.'); }
    finally { setLoading(false); }
  }, [adminUser]);

  useEffect(() => { loadAdmins(); }, [loadAdmins]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPhone.trim() && !newEmail.trim()) return;
    setBusy(true); setMsg('');
    try {
      const entry: { phone?: string; email?: string } = {};
      if (newPhone.trim()) entry.phone = newPhone.trim();
      if (newEmail.trim()) entry.email = newEmail.trim();
      const res = await addAdmin(entry, adminUser);
      setData((d) => d ? { ...d, phones: res.phones, emails: res.emails } : d);
      setNewPhone(''); setNewEmail('');
      setMsg('Admin added.');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Failed to add admin.');
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (type: 'phone' | 'email', value: string) => {
    if (!window.confirm(`Remove ${type} "${value}" from admins?`)) return;
    setBusy(true); setMsg('');
    try {
      const res = await removeAdmin(type === 'phone' ? { phone: value } : { email: value }, adminUser);
      setData((d) => d ? { ...d, phones: res.phones, emails: res.emails } : d);
      setMsg('Admin removed.');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Failed to remove admin.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div style={S.card}>Loading admins…</div>;
  if (error)   return <div style={{ ...S.card, ...S.errorBox }}>{error}</div>;
  if (!data)   return null;

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {msg && <div style={{ ...S.card, ...(msg.includes('ailed') ? S.errorBox : S.successBox) }}>{msg}</div>}

      {/* Built-in phones */}
      <div style={S.card}>
        <h3 style={{ margin: '0 0 0.75rem', color: '#78350f', fontSize: '0.95rem', fontWeight: 800 }}>🔒 Built-in Admin Phones</h3>
        <p style={{ ...mutedText, marginBottom: '0.65rem' }}>These cannot be removed.</p>
        {data.builtinPhones.map((ph) => (
          <div key={ph} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.45rem 0', borderBottom: '1px solid #fde68a' }}>
            <span style={{ flex: 1, fontFamily: 'monospace', color: '#78350f' }}>📱 {ph}</span>
            <span style={{ fontSize: '0.75rem', color: '#9ca3af', background: '#f3f4f6', borderRadius: 999, padding: '0.15rem 0.5rem' }}>built-in</span>
          </div>
        ))}
      </div>

      {/* Dynamic phones */}
      <div style={S.card}>
        <h3 style={{ margin: '0 0 0.75rem', color: '#78350f', fontSize: '0.95rem', fontWeight: 800 }}>📱 Admin Phones</h3>
        {data.phones.length === 0
          ? <p style={mutedText}>No additional admin phones.</p>
          : data.phones.map((ph) => (
            <div key={ph} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.45rem 0', borderBottom: '1px solid #fde68a' }}>
              <span style={{ flex: 1, fontFamily: 'monospace', color: '#78350f' }}>{ph}</span>
              <button type="button" disabled={busy} onClick={() => handleRemove('phone', ph)} style={{ ...S.dangerBtn, fontSize: '0.78rem', padding: '0.25rem 0.6rem' }}>
                Remove
              </button>
            </div>
          ))
        }
      </div>

      {/* Dynamic emails */}
      <div style={S.card}>
        <h3 style={{ margin: '0 0 0.75rem', color: '#78350f', fontSize: '0.95rem', fontWeight: 800 }}>✉️ Admin Emails</h3>
        {data.emails.length === 0
          ? <p style={mutedText}>No admin emails configured.</p>
          : data.emails.map((em) => (
            <div key={em} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.45rem 0', borderBottom: '1px solid #fde68a' }}>
              <span style={{ flex: 1, color: '#78350f' }}>{em}</span>
              <button type="button" disabled={busy} onClick={() => handleRemove('email', em)} style={{ ...S.dangerBtn, fontSize: '0.78rem', padding: '0.25rem 0.6rem' }}>
                Remove
              </button>
            </div>
          ))
        }
      </div>

      {/* Add form */}
      <div style={S.card}>
        <h3 style={{ margin: '0 0 0.75rem', color: '#78350f', fontSize: '0.95rem', fontWeight: 800 }}>➕ Add Admin</h3>
        <form onSubmit={handleAdd} style={{ display: 'grid', gap: '0.75rem' }}>
          <div>
            <label style={S.label}>Phone Number</label>
            <input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} style={S.inp} placeholder="e.g. 9179419406" type="tel" />
          </div>
          <div>
            <label style={S.label}>— or — Email</label>
            <input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} style={S.inp} placeholder="admin@example.com" type="email" />
          </div>
          <button type="submit" disabled={busy || (!newPhone.trim() && !newEmail.trim())} style={{ ...S.primaryBtn, opacity: busy || (!newPhone.trim() && !newEmail.trim()) ? 0.6 : 1 }}>
            {busy ? 'Saving…' : 'Add Admin'}
          </button>
        </form>
      </div>
    </div>
  );
}

