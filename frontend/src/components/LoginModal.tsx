import { useAuth0 } from '@auth0/auth0-react';
import { useEffect, useRef, useState } from 'react';

import { checkPhone, loginWithPin, setPinUser, signupUser, User, getLocations } from '../api';
import { S, mutedText } from '../theme';

type AuthStep = 'phone' | 'pin' | 'set-pin' | 'signup-name' | 'signup-pin' | 'forgot';

const SOCIAL_PROVIDERS = [
  { connection: 'google-oauth2', label: 'Google',    icon: '🔵', bg: '#fff',    color: '#3c4043', border: '#dadce0' },
  { connection: 'apple',         label: 'Apple',     icon: '🍎', bg: '#000',    color: '#fff',    border: '#000' },
  { connection: 'facebook',      label: 'Facebook',  icon: '📘', bg: '#1877f2', color: '#fff',    border: '#1877f2' },
  { connection: 'yahoo',         label: 'Yahoo',     icon: '🟣', bg: '#6001d2', color: '#fff',    border: '#6001d2' },
  { connection: 'discord',       label: 'Discord',   icon: '💬', bg: '#5865f2', color: '#fff',    border: '#5865f2' },
  { connection: 'twitter',       label: 'Twitter/X', icon: '🐦', bg: '#000',    color: '#fff',    border: '#333' },
  { connection: 'microsoft',     label: 'Microsoft', icon: '🪟', bg: '#2f2f2f', color: '#fff',    border: '#2f2f2f' },
];

type Props = { onLogin: (user: User) => void; onClose: () => void };

export default function LoginModal({ onLogin, onClose }: Props) {
  const { loginWithPopup, user: auth0User, isAuthenticated } = useAuth0();

  const [step, setStep] = useState<AuthStep>('phone');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [storePhone, setStorePhone] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, [step]);
  useEffect(() => {
    getLocations().then((locs) => { if (locs[0]?.phone) setStorePhone(locs[0].phone); }).catch(() => {});
  }, []);

  if (isAuthenticated && auth0User) { onClose(); return null; }

  const cleanPhone = (raw: string) => { const d = raw.replace(/\D/g, ''); return d.length > 10 ? d.slice(-10) : d; };
  const goBack = (to: AuthStep) => { setStep(to); setError(''); setPin(''); setPinConfirm(''); };

  const handlePhoneContinue = async () => {
    const p = cleanPhone(phone);
    if (p.length < 10) { setError('Enter a valid 10-digit phone number.'); return; }
    setError(''); setLoading('phone');
    try {
      const res = await checkPhone(p);
      setPhone(p);
      if (!res.exists) setStep('signup-name');
      else if (!res.hasPin) setStep('set-pin');
      else setStep('pin');
    } catch { setError('Could not reach server. Please try again.'); }
    setLoading(null);
  };

  const handlePinLogin = async () => {
    if (pin.length !== 4) { setError('PIN must be 4 digits.'); return; }
    setError(''); setLoading('pin');
    try {
      const res = await loginWithPin(phone, pin);
      if (res.success && res.user) onLogin({ ...res.user, authMethod: 'phone' });
      else setError(res.message || 'Incorrect PIN.');
    } catch { setError('Could not reach server.'); }
    setLoading(null);
  };

  const handleSetPin = async () => {
    if (pin.length !== 4) { setError('PIN must be 4 digits.'); return; }
    if (pin !== pinConfirm) { setError('PINs do not match.'); return; }
    setError(''); setLoading('set-pin');
    try {
      const res = await setPinUser(phone, pin);
      if (res.success && res.user) onLogin({ ...res.user, authMethod: 'phone' });
      else setError(res.message || 'Could not set PIN.');
    } catch { setError('Could not reach server.'); }
    setLoading(null);
  };

  const handleSignup = async () => {
    if (pin.length !== 4) { setError('PIN must be 4 digits.'); return; }
    if (pin !== pinConfirm) { setError('PINs do not match.'); return; }
    setError(''); setLoading('signup');
    try {
      const res = await signupUser(phone, name, pin);
      if (res.success && res.user) onLogin({ ...res.user, authMethod: 'phone' });
      else setError(res.message || 'Signup failed.');
    } catch { setError('Could not reach server.'); }
    setLoading(null);
  };

  const handleSocial = async (connection: string) => {
    setError(''); setLoading(connection);
    try { await loginWithPopup({ authorizationParams: { connection } }); }
    catch (e: any) { if (e?.error !== 'popup_closed_by_user') setError('Sign-in failed. Please try again.'); }
    setLoading(null);
  };

  const pinField = (value: string, onChange: (v: string) => void, onEnter: (() => void) | undefined, label: string) => (
    <div>
      <label style={S.label}>{label}</label>
      <input
        ref={inputRef}
        type="password"
        inputMode="numeric"
        maxLength={4}
        placeholder="••••"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
        onKeyDown={(e) => e.key === 'Enter' && onEnter?.()}
        style={{ ...S.inp, letterSpacing: '0.4em', fontSize: '1.4rem', textAlign: 'center' }}
      />
    </div>
  );

  const backLink = (to: AuthStep, label = '← Back') => (
    <div style={{ textAlign: 'center' }}>
      <button type="button" onClick={() => goBack(to)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '0.85rem', textDecoration: 'underline' }}>
        {label}
      </button>
    </div>
  );

  const stepLabel: Record<AuthStep, string> = {
    'phone':       'Sign in or create an account',
    'pin':         'Welcome back! Enter your PIN.',
    'set-pin':     'Set a PIN for future logins.',
    'signup-name': 'Create your account',
    'signup-pin':  'Choose a 4-digit PIN',
    'forgot':      'Reset your PIN',
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: '#fff', borderRadius: '1.25rem', padding: '2rem', width: '100%', maxWidth: 380, boxShadow: '0 8px 40px rgba(120,53,15,0.18)', maxHeight: '92vh', overflowY: 'auto', display: 'grid', gap: '1rem' }}>

        {/* Header */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2.4rem', marginBottom: '0.2rem' }}>🥩</div>
          <h2 style={{ margin: 0, color: '#78350f', fontWeight: 900, fontSize: '1.25rem' }}>Halal Meat Market</h2>
          <p style={{ ...mutedText, marginTop: '0.25rem' }}>{stepLabel[step]}</p>
        </div>

        {error && <div style={S.errorBox}>{error}</div>}

        {/* Phone entry */}
        {step === 'phone' && (<>
          <div>
            <label style={S.label}>Phone Number</label>
            <input
              ref={inputRef} type="tel" inputMode="numeric" placeholder="10-digit number"
              value={phone} onChange={(e) => { setPhone(e.target.value); setError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && handlePhoneContinue()}
              style={S.inp} autoComplete="tel"
            />
          </div>
          <button onClick={handlePhoneContinue} style={S.primaryBtn} disabled={loading !== null}>
            {loading === 'phone' ? 'Checking…' : 'Continue →'}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ flex: 1, height: 1, background: '#fde68a' }} />
            <span style={{ color: '#92400e', fontSize: '0.78rem', fontWeight: 600, whiteSpace: 'nowrap' }}>or sign in with</span>
            <div style={{ flex: 1, height: 1, background: '#fde68a' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4rem' }}>
            {SOCIAL_PROVIDERS.map(({ connection, label, icon, bg, color, border }) => (
              <button key={connection} type="button" disabled={loading !== null} onClick={() => handleSocial(connection)}
                title={label}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.2rem', background: bg, color, border: `1.5px solid ${border}`, borderRadius: '0.75rem', padding: '0.5rem 0.25rem', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer', opacity: loading !== null && loading !== connection ? 0.5 : 1, minWidth: 0 }}>
                <span style={{ fontSize: '1.3rem', lineHeight: 1 }}>{loading === connection ? '…' : icon}</span>
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%', padding: '0 2px' }}>{label}</span>
              </button>
            ))}
          </div>

          <button type="button" onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '0.82rem', textAlign: 'center' }}>
            Cancel
          </button>
        </>)}

        {/* PIN login */}
        {step === 'pin' && (<>
          <p style={{ ...mutedText, textAlign: 'center', margin: 0 }}>📱 {phone}</p>
          {pinField(pin, setPin, handlePinLogin, 'PIN')}
          <button onClick={handlePinLogin} style={S.primaryBtn} disabled={loading !== null}>
            {loading === 'pin' ? 'Verifying…' : 'Log In →'}
          </button>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            {backLink('phone', '← Change number')}
            <button type="button" onClick={() => goBack('forgot')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f59e0b', fontSize: '0.82rem', textDecoration: 'underline' }}>
              Forgot PIN?
            </button>
          </div>
        </>)}

        {/* Set PIN for existing user without one */}
        {step === 'set-pin' && (<>
          <p style={{ ...mutedText, textAlign: 'center', margin: 0 }}>Welcome back! Set a PIN for next time.</p>
          {pinField(pin, setPin, undefined, 'New PIN')}
          {pinField(pinConfirm, setPinConfirm, handleSetPin, 'Confirm PIN')}
          <button onClick={handleSetPin} style={S.primaryBtn} disabled={loading !== null}>
            {loading === 'set-pin' ? 'Saving…' : 'Set PIN & Continue →'}
          </button>
          {backLink('phone')}
        </>)}

        {/* Signup: name */}
        {step === 'signup-name' && (<>
          <div>
            <label style={S.label}>Your Name</label>
            <input ref={inputRef} type="text" placeholder="Full name" value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) { setError(''); setStep('signup-pin'); }}}
              style={S.inp} autoComplete="name" />
          </div>
          <button onClick={() => { if (!name.trim()) { setError('Name is required.'); return; } setError(''); setStep('signup-pin'); }} style={S.primaryBtn}>
            Next →
          </button>
          {backLink('phone')}
        </>)}

        {/* Signup: PIN */}
        {step === 'signup-pin' && (<>
          {pinField(pin, setPin, undefined, 'Choose a PIN')}
          {pinField(pinConfirm, setPinConfirm, handleSignup, 'Confirm PIN')}
          <button onClick={handleSignup} style={S.primaryBtn} disabled={loading !== null}>
            {loading === 'signup' ? 'Creating account…' : 'Create Account →'}
          </button>
          {backLink('signup-name')}
        </>)}

        {/* Forgot PIN */}
        {step === 'forgot' && (<>
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '0.75rem', padding: '1rem', display: 'grid', gap: '0.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem' }}>📞</div>
            <p style={{ margin: 0, fontWeight: 700, color: '#78350f' }}>Call the store to reset your PIN</p>
            {storePhone && (
              <a href={`tel:${storePhone.replace(/\D/g, '')}`} style={{ color: '#d97706', fontWeight: 800, fontSize: '1.05rem' }}>{storePhone}</a>
            )}
            <p style={{ ...mutedText, fontSize: '0.78rem', margin: 0 }}>
              The store admin can clear your PIN so you can set a new one on next sign-in.
            </p>
          </div>
          {backLink('pin')}
        </>)}

      </div>
    </div>
  );
}
