import { useAuth0 } from '@auth0/auth0-react';
import { useState } from 'react';

import { linkEmail, linkPhone, User } from '../api';
import { S } from '../theme';

type Props = {
  user: User;
  onUpdate: (updated: User) => void;
  onClose: () => void;
};

export default function ProfileModal({ user, onUpdate, onClose }: Props) {
  const { loginWithPopup, user: auth0User } = useAuth0();
  const [name, setName] = useState(user.name);
  const [saved, setSaved] = useState(false);
  const [linkMsg, setLinkMsg] = useState('');
  const [linkLoading, setLinkLoading] = useState('');

  // Linking: social user adds phone
  const [addPhoneStep, setAddPhoneStep] = useState<'idle' | 'phone' | 'pin'>('idle');
  const [linkPhoneVal, setLinkPhoneVal] = useState('');
  const [linkPinVal, setLinkPinVal] = useState('');
  const [linkPinConfirm, setLinkPinConfirm] = useState('');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onUpdate({ ...user, name: name.trim() });
    setSaved(true);
    setTimeout(onClose, 800);
  };

  const handleLinkSocial = async (connection: string) => {
    if (!user.id) { setLinkMsg('Cannot link: no user ID found.'); return; }
    setLinkMsg(''); setLinkLoading(connection);
    try {
      await loginWithPopup({ authorizationParams: { connection } });
      // Auth0 user is now available
      const email = auth0User?.email || '';
      if (!email) { setLinkMsg('Could not get email from provider.'); return; }
      const res = await linkEmail(user.id, email);
      if (res.success && res.user) {
        setLinkMsg(`✓ ${email} linked!`);
        onUpdate({ ...user, emails: res.user.emails });
      } else {
        setLinkMsg(res.message || 'Link failed.');
      }
    } catch { setLinkMsg('Sign-in failed.'); }
    setLinkLoading('');
  };

  const handleLinkPhone = async () => {
    if (!user.id) { setLinkMsg('Cannot link: no user ID found.'); return; }
    const cleanPhone = linkPhoneVal.replace(/\D/g, '').slice(-10);
    if (cleanPhone.length < 10) { setLinkMsg('Enter a valid 10-digit phone number.'); return; }
    if (linkPinVal.length !== 4 || !/^\d{4}$/.test(linkPinVal)) { setLinkMsg('PIN must be 4 digits.'); return; }
    if (linkPinVal !== linkPinConfirm) { setLinkMsg('PINs do not match.'); return; }
    setLinkMsg(''); setLinkLoading('phone');
    const res = await linkPhone(user.id, cleanPhone, linkPinVal);
    setLinkLoading('');
    if (res.success && res.user) {
      setLinkMsg(`✓ Phone ${cleanPhone} linked!`);
      onUpdate({ ...user, phone: cleanPhone });
      setAddPhoneStep('idle');
    } else {
      setLinkMsg(res.message || 'Link failed.');
    }
  };

  const isSocialOnly = user.authMethod === 'social' && !user.phone;
  const isPhoneOnly = user.authMethod === 'phone' && (!user.emails || user.emails.length === 0);

  const SOCIAL_PROVIDERS = [
    { connection: 'google-oauth2', label: 'Google', icon: '🔵' },
    { connection: 'apple',         label: 'Apple',  icon: '🍎' },
    { connection: 'facebook',      label: 'Facebook', icon: '📘' },
    { connection: 'yahoo',         label: 'Yahoo',  icon: '🟣' },
  ];

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: '#fff', borderRadius: '1.2rem', padding: '2rem', width: '100%', maxWidth: 420, boxShadow: '0 8px 40px rgba(120,53,15,0.18)', maxHeight: '92vh', overflowY: 'auto', display: 'grid', gap: '1rem' }}>
        <h2 style={{ margin: 0, color: '#78350f', fontWeight: 900, fontSize: '1.2rem' }}>
          {user.isAdmin ? '🛡️' : '👤'} My Profile
        </h2>

        {saved && <div style={S.successBox}>Profile updated!</div>}
        {linkMsg && <div style={linkMsg.startsWith('✓') ? S.successBox : S.errorBox}>{linkMsg}</div>}

        <form onSubmit={handleSave} style={{ display: 'grid', gap: '0.9rem' }}>
          <div>
            <label style={S.label}>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} style={S.inp} placeholder="Your name" autoFocus />
          </div>

          {/* Phone */}
          {user.phone && user.phone !== user.email && (
            <div>
              <label style={S.label}>📱 Phone</label>
              <div style={{ ...S.inp, background: '#f3f4f6', color: '#6b7280', cursor: 'default' }}>{user.phone}</div>
            </div>
          )}

          {/* Linked emails */}
          {(user.emails ?? (user.email ? [user.email] : [])).length > 0 && (
            <div>
              <label style={S.label}>✉️ Linked Accounts</label>
              {(user.emails ?? (user.email ? [user.email] : [])).map((e) => (
                <div key={e} style={{ ...S.inp, background: '#f3f4f6', color: '#6b7280', cursor: 'default', marginBottom: '0.3rem' }}>{e}</div>
              ))}
            </div>
          )}

          {user.isAdmin && (
            <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '0.6rem', padding: '0.6rem 0.8rem', color: '#92400e', fontSize: '0.85rem', fontWeight: 600 }}>
              🛡️ Admin account
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.25rem' }}>
            <button type="submit" disabled={!name.trim() || saved} style={{ ...S.primaryBtn, flex: 1, opacity: !name.trim() || saved ? 0.6 : 1 }}>Save</button>
            <button type="button" onClick={onClose} style={{ ...S.outlineBtn, flex: 1 }}>Cancel</button>
          </div>
        </form>

        {/* Phone-user: link a social account */}
        {isPhoneOnly && user.id && (
          <div style={{ borderTop: '1px solid #fde68a', paddingTop: '1rem' }}>
            <div style={{ fontWeight: 700, color: '#78350f', fontSize: '0.88rem', marginBottom: '0.5rem' }}>🔗 Link a social account</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4rem' }}>
              {SOCIAL_PROVIDERS.map(({ connection, label, icon }) => (
                <button key={connection} type="button" disabled={!!linkLoading}
                  onClick={() => handleLinkSocial(connection)}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem', padding: '0.5rem 0.25rem', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '0.75rem', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer', opacity: linkLoading ? 0.5 : 1 }}>
                  <span style={{ fontSize: '1.3rem' }}>{linkLoading === connection ? '…' : icon}</span>
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Social-only user: add phone + PIN */}
        {isSocialOnly && user.id && (
          <div style={{ borderTop: '1px solid #fde68a', paddingTop: '1rem' }}>
            <div style={{ fontWeight: 700, color: '#78350f', fontSize: '0.88rem', marginBottom: '0.5rem' }}>📱 Add phone + PIN login</div>
            {addPhoneStep === 'idle' && (
              <button type="button" onClick={() => setAddPhoneStep('phone')} style={{ ...S.outlineBtn, width: '100%' }}>
                + Add Phone Number
              </button>
            )}
            {addPhoneStep === 'phone' && (
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                <input type="tel" inputMode="numeric" placeholder="10-digit phone" value={linkPhoneVal}
                  onChange={(e) => setLinkPhoneVal(e.target.value)} style={S.inp} />
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="button" onClick={() => setAddPhoneStep('pin')} style={{ ...S.primaryBtn, flex: 1 }}>Next →</button>
                  <button type="button" onClick={() => setAddPhoneStep('idle')} style={{ ...S.outlineBtn, flex: 1 }}>Cancel</button>
                </div>
              </div>
            )}
            {addPhoneStep === 'pin' && (
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                <input type="password" inputMode="numeric" maxLength={4} placeholder="Choose 4-digit PIN"
                  value={linkPinVal} onChange={(e) => setLinkPinVal(e.target.value)} style={{ ...S.inp, letterSpacing: '0.5em', textAlign: 'center' as const }} />
                <input type="password" inputMode="numeric" maxLength={4} placeholder="Confirm PIN"
                  value={linkPinConfirm} onChange={(e) => setLinkPinConfirm(e.target.value)} style={{ ...S.inp, letterSpacing: '0.5em', textAlign: 'center' as const }} />
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="button" onClick={handleLinkPhone} disabled={!!linkLoading} style={{ ...S.primaryBtn, flex: 1, opacity: linkLoading ? 0.6 : 1 }}>
                    {linkLoading === 'phone' ? 'Linking…' : '✓ Link Phone'}
                  </button>
                  <button type="button" onClick={() => setAddPhoneStep('idle')} style={{ ...S.outlineBtn, flex: 1 }}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
