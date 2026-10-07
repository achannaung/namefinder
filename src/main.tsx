import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// SHA-256 of the team passcode (compared in-page; unlock persists per tab)
const PASS_HASH = '8266498d969081c29737b8daeb5b51d60e56d008fff243a39d16c3032d42f6cf';
const STORE_KEY = 'nf_unlocked';

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(false);
    const ok = (await sha256Hex(code)) === PASS_HASH;
    setBusy(false);
    if (ok) {
      sessionStorage.setItem(STORE_KEY, '1');
      onUnlock();
    } else {
      setError(true);
      setCode('');
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#0f1115', padding: 20,
        fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
      }}
    >
      <form
        onSubmit={submit}
        style={{
          width: '100%', maxWidth: 340, background: '#171a21',
          border: '1px solid #262b36', borderRadius: 14, padding: '32px 28px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: 46, height: 46, borderRadius: '50%', margin: '0 auto 18px',
            background: '#e5484d', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#0f1115' }} />
        </div>
        <div style={{ color: '#f4f4f5', fontSize: 17, fontWeight: 600, marginBottom: 6 }}>
          Party-3 Finder
        </div>
        <div style={{ color: '#8b8fa3', fontSize: 13, marginBottom: 20 }}>
          Enter passcode to continue
        </div>
        <input
          type="password"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Passcode"
          autoFocus
          style={{
            width: '100%', padding: '11px 14px', fontSize: 15,
            background: '#0f1115', color: '#f4f4f5',
            border: error ? '1px solid #e5484d' : '1px solid #2e3442',
            borderRadius: 9, outline: 'none', marginBottom: 12,
            textAlign: 'center', letterSpacing: 2,
          }}
        />
        {error && (
          <div style={{ color: '#e5484d', fontSize: 13, marginBottom: 12 }}>
            Wrong passcode, try again.
          </div>
        )}
        <button
          type="submit"
          disabled={busy || code.length === 0}
          style={{
            width: '100%', padding: '11px', fontSize: 15, fontWeight: 600,
            background: code.length === 0 ? '#2a2f3b' : '#e5484d',
            color: '#fff', border: 'none', borderRadius: 9,
            cursor: code.length === 0 ? 'not-allowed' : 'pointer',
          }}
        >
          {busy ? 'Checking…' : 'Unlock'}
        </button>
      </form>
    </div>
  );
}

function Gate() {
  const [unlocked, setUnlocked] = useState(
    () => sessionStorage.getItem(STORE_KEY) === '1',
  );
  if (unlocked) return <App />;
  return <LockScreen onUnlock={() => setUnlocked(true)} />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Gate />
  </StrictMode>,
);
