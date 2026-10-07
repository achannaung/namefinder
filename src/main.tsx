import { StrictMode, useState, useRef, useEffect, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// SHA-256 of the team passcode (compared in-page; unlock persists per tab)
const PASS_HASH = '8266498d969081c29737b8daeb5b51d60e56d008fff243a39d16c3032d42f6cf';
const STORE_KEY = 'nf_unlocked';
const GREEN = '#00ff41';

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function MatrixRain() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);
    const chars = 'アイウエオカキクケコサシスセソ01ABCDEF$#%&';
    const fs = 16;
    let drops: number[] = [];
    const reset = () => {
      const cols = Math.ceil(canvas.width / fs);
      drops = Array.from({ length: cols }, () => Math.random() * -60);
    };
    reset();
    const tick = () => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = GREEN;
      ctx.font = fs + 'px monospace';
      for (let i = 0; i < drops.length; i++) {
        const ch = chars[(Math.random() * chars.length) | 0];
        ctx.fillText(ch, i * fs, drops[i] * fs);
        if (drops[i] * fs > canvas.height && Math.random() > 0.976) drops[i] = 0;
        drops[i]++;
      }
    };
    const id = window.setInterval(tick, 55);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('resize', resize);
    };
  }, []);
  return (
    <canvas
      ref={ref}
      style={{ position: 'fixed', inset: 0, width: '100%', height: '100%' }}
    />
  );
}

const mono = '"Courier New", ui-monospace, monospace';

function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
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
        position: 'fixed', inset: 0, zIndex: 9999, background: '#000',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20, fontFamily: mono, overflow: 'hidden',
      }}
    >
      <MatrixRain />
      <form
        onSubmit={submit}
        style={{
          position: 'relative', width: '100%', maxWidth: 360,
          background: 'rgba(0, 12, 0, 0.88)',
          border: `1px solid ${GREEN}`, borderRadius: 6, padding: '34px 30px',
          textAlign: 'center', boxShadow: `0 0 28px rgba(0,255,65,0.35), inset 0 0 24px rgba(0,255,65,0.06)`,
        }}
      >
        <div
          style={{
            color: GREEN, fontSize: 22, fontWeight: 700, letterSpacing: 3,
            marginBottom: 8, textShadow: `0 0 12px ${GREEN}`,
          }}
        >
          P3 Name list
        </div>
        <div style={{ color: GREEN, opacity: 0.75, fontSize: 13, marginBottom: 22 }}>
          {'>'} ENTER PASSCODE_
          <span style={{ animation: 'blink 1s steps(1) infinite' }}>▌</span>
        </div>
        <style>{'@keyframes blink { 50% { opacity: 0; } }'}</style>
        <input
          type="password"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="••••"
          autoFocus
          style={{
            width: '100%', padding: '12px 14px', fontSize: 17,
            fontFamily: mono, background: '#000', color: GREEN,
            border: error ? '1px solid #ff3131' : `1px solid ${GREEN}`,
            borderRadius: 4, outline: 'none', marginBottom: 12,
            textAlign: 'center', letterSpacing: 6,
            boxShadow: error ? '0 0 10px rgba(255,49,49,.5)' : `0 0 10px rgba(0,255,65,.25)`,
          }}
        />
        {error && (
          <div style={{ color: '#ff3131', fontSize: 13, marginBottom: 12 }}>
            [!] ACCESS DENIED — TRY AGAIN
          </div>
        )}
        <button
          type="submit"
          disabled={busy || code.length === 0}
          style={{
            width: '100%', padding: '12px', fontSize: 15, fontWeight: 700,
            fontFamily: mono, letterSpacing: 2,
            background: code.length === 0 ? '#031003' : GREEN,
            color: code.length === 0 ? '#1a5c2a' : '#000',
            border: `1px solid ${GREEN}`, borderRadius: 4,
            cursor: code.length === 0 ? 'not-allowed' : 'pointer',
            boxShadow: code.length === 0 ? 'none' : `0 0 16px rgba(0,255,65,.55)`,
          }}
        >
          {busy ? 'DECRYPTING…' : '[ UNLOCK ]'}
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
