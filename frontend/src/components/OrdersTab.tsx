import { useCallback, useEffect, useRef } from 'react';

import { getOrders, Order, User } from '../api';
import { S, mutedText, sectionTitle } from '../theme';

type Props = {
  user: User | null;
  orders: Order[];
  loading: boolean;
  error: string;
  onRefresh: () => void;
  onOrdersUpdate: (orders: Order[]) => void;
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

function sendNotification(title: string, body: string) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/favicon.ico' });
  }
}

export default function OrdersTab({ user, orders, loading, error, onRefresh, onOrdersUpdate }: Props) {
  const prevStatusMap = useRef<Record<string, string>>({});

  const fetchAndNotify = useCallback(async () => {
    if (!user) return;
    try {
      const fresh = await getOrders(user.phone);
      fresh.forEach((order) => {
        const prev = prevStatusMap.current[order.id];
        if (prev && prev !== order.status) {
          if (order.status === 'Accepted') {
            sendNotification(
              '✅ Order Accepted!',
              `Order #${order.id.slice(-8).toUpperCase()} is being prepared. Ready in ~${order.prepMinutes ?? '?'} min.`
            );
          } else if (order.status === 'Ready') {
            sendNotification(
              '🎉 Order Ready for Pickup!',
              `Order #${order.id.slice(-8).toUpperCase()} is ready. Come pick it up at Halal Meat Market!`
            );
          }
        }
        prevStatusMap.current[order.id] = order.status;
      });
      onOrdersUpdate(fresh);
    } catch {
      // silently ignore polling errors
    }
  }, [user, onOrdersUpdate]);

  useEffect(() => {
    if (!user) return;
    fetchAndNotify();
  }, [fetchAndNotify, user]);

  // Poll every 10s when there are active (non-completed) orders
  useEffect(() => {
    if (!user) return;
    const hasActive = orders.some((o) => o.status !== 'Completed');
    if (!hasActive) return;
    const interval = setInterval(fetchAndNotify, 10_000);
    return () => clearInterval(interval);
  }, [user, orders, fetchAndNotify]);

  if (!user) {
    return (
      <div style={S.card}>
        <p style={mutedText}>Sign in to view your orders.</p>
      </div>
    );
  }

  return (
    <div style={S.card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <div>
          <h2 style={sectionTitle}>My Orders</h2>
          <p style={mutedText}>Your pickup orders — updates every 10 seconds.</p>
        </div>
        <button type="button" onClick={onRefresh} style={S.outlineBtn}>Refresh</button>
      </div>

      {loading ? <div>Loading orders…</div> : null}
      {error ? <div style={{ ...S.errorBox, marginBottom: '0.9rem' }}>{error}</div> : null}
      {!loading && !error && !orders.length ? (
        <div style={{ ...S.card, background: '#fffaf0', marginBottom: 0 }}>No orders yet. Place your first pickup order from the cart tab.</div>
      ) : null}

      <div style={{ display: 'grid', gap: '0.9rem' }}>
        {orders.map((order) => (
          <div key={order.id} style={{ border: '1px solid #fed7aa', borderRadius: '0.95rem', padding: '1rem', background: '#fffbeb' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontWeight: 800, color: '#78350f' }}>Order #{order.id.slice(-8).toUpperCase()}</div>
                <p style={mutedText}>{order.customerName}</p>
              </div>
              <span style={statusBadge(order.status)}>{order.status}</span>
            </div>

            {order.status === 'Accepted' && order.prepMinutes ? (
              <div style={{ marginTop: '0.5rem', background: '#dbeafe', borderRadius: '0.6rem', padding: '0.5rem 0.75rem', color: '#1e40af', fontWeight: 700, fontSize: '0.9rem' }}>
                ⏱️ Being prepared — ready in ~{order.prepMinutes} min
              </div>
            ) : null}

            {order.isDelivery && order.confirmedDeliveryTime ? (
              <div style={{ marginTop: '0.5rem', background: '#f0fdf4', borderRadius: '0.6rem', padding: '0.5rem 0.75rem', color: '#16a34a', fontWeight: 700, fontSize: '0.9rem' }}>
                🚗 Delivery confirmed: {order.confirmedDeliveryTime}
              </div>
            ) : order.isDelivery ? (
              <div style={{ marginTop: '0.5rem', background: '#fef3c7', borderRadius: '0.6rem', padding: '0.5rem 0.75rem', color: '#92400e', fontWeight: 700, fontSize: '0.85rem' }}>
                🚗 Delivery order — store will confirm exact delivery time
              </div>
            ) : null}

            {order.status === 'Ready' ? (
              <div style={{ marginTop: '0.5rem', background: '#dcfce7', borderRadius: '0.6rem', padding: '0.5rem 0.75rem', color: '#166534', fontWeight: 700, fontSize: '0.9rem' }}>
                🎉 Your order is ready for pickup!
              </div>
            ) : null}

            <div style={{ marginTop: '0.85rem', display: 'grid', gap: '0.45rem' }}>
              {order.items.map((item) => (
                <div key={`${order.id}-${item.id}`} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', color: '#78350f' }}>
                  <span>{item.name} × {item.qty}</span>
                  <span>${(item.lineTotal ?? item.price * item.qty).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div style={{ marginTop: '0.9rem', display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', color: '#92400e', fontWeight: 600 }}>
              <span>{order.isDelivery ? '🚗 Delivery' : '📍 Pickup'}: {order.pickupTime}{order.locationName ? ` @ ${order.locationName}` : ''}</span>
              <span>Total: ${order.total.toFixed(2)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

