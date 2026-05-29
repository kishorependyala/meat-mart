import { CSSProperties } from 'react';

export const S = {
  page: { minHeight: '100vh', background: '#fffbeb', fontFamily: 'system-ui,sans-serif' },
  card: { background: '#fff', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 2px 12px rgba(120,53,15,0.07)', border: '1px solid #fed7aa', marginBottom: '1rem' },
  primaryBtn: { background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: '#fff', border: 'none', borderRadius: '0.75rem', padding: '0.65rem 1.2rem', fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer' },
  outlineBtn: { background: '#fff', color: '#92400e', border: '1.5px solid #fde68a', borderRadius: '0.75rem', padding: '0.6rem 1.1rem', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer' },
  dangerBtn: { background: '#fff', color: '#dc2626', border: '1.5px solid #fecaca', borderRadius: '0.75rem', padding: '0.6rem 1.1rem', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer' },
  inp: { width: '100%', border: '1.5px solid #fde68a', borderRadius: '0.6rem', padding: '0.65rem 0.8rem', fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box' as const, background: '#fffbeb' },
  label: { display: 'block', fontWeight: 600, fontSize: '0.85rem', color: '#78350f', marginBottom: '0.3rem' },
  errorBox: { background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.6rem', padding: '0.65rem 0.9rem', color: '#dc2626', fontSize: '0.88rem' },
  successBox: { background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '0.6rem', padding: '0.65rem 0.9rem', color: '#166534', fontSize: '0.88rem' },
} satisfies Record<string, CSSProperties>;

export const sectionTitle = { fontSize: '1.25rem', fontWeight: 800, color: '#78350f', margin: 0 } as const;
export const mutedText = { color: '#6b7280', fontSize: '0.88rem', margin: 0 } as const;
