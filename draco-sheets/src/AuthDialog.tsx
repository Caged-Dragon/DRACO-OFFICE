import { useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import Dialog from './Dialog';
import { supabase, cloudEnabled } from './supabase';

export default function AuthDialog({ session, onClose }: { session: Session | null; onClose: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  if (!cloudEnabled || !supabase) {
    return (
      <Dialog title="Cloud sync" onClose={onClose}>
        <p>Cloud sync is not configured. Copy <code>.env.example</code> to <code>.env</code>, add your Supabase URL and publishable key, run the migration in <code>supabase/migrations</code>, then rebuild.</p>
        <p>Everything still works offline: workbooks are saved on this device.</p>
      </Dialog>
    );
  }
  const sb = supabase;

  if (session) {
    return (
      <Dialog title="Account" onClose={onClose}>
        <p>Signed in as <b>{session.user.email}</b></p>
        <button className="primary" onClick={async () => { await sb.auth.signOut(); onClose(); }}>Sign out</button>
      </Dialog>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg('');
    const { error } =
      mode === 'in'
        ? await sb.auth.signInWithPassword({ email, password })
        : await sb.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
    setBusy(false);
    if (error) setMsg(error.message);
    else if (mode === 'up') setMsg('Check your email to confirm your account, then sign in.');
    else onClose();
  };

  return (
    <Dialog title={mode === 'in' ? 'Sign in' : 'Create account'} onClose={onClose}>
      <form onSubmit={submit} className="stack">
        <label>Email<input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label>Password<input type="password" required minLength={6} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        <button className="primary" disabled={busy}>{mode === 'in' ? 'Sign in' : 'Sign up'}</button>
        <button type="button" onClick={() => sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })}>Continue with Google</button>
        {msg && <p className="msg">{msg}</p>}
        <button type="button" className="link" onClick={() => setMode(mode === 'in' ? 'up' : 'in')}>
          {mode === 'in' ? 'No account? Create one' : 'Have an account? Sign in'}
        </button>
      </form>
    </Dialog>
  );
}
