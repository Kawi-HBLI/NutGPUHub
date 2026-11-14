import { useEffect, useState, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { setSessionExpiredHandler } from './api';
import { OperatorWorkspace } from './operator';
import { StudentWorkspace } from './student';
import { Alert, Brand, Button, Card, Input } from './components';
import './styles.css';

type Account = { id: number; username: string; role: 'student' | 'operator' };
const authUrl = '/api/v1/auth';

function App() {
  const [account, setAccount] = useState<Account | null>(null);
  const [phase, setPhase] = useState<'checking' | 'ready' | 'unavailable'>('checking');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [commit, setCommit] = useState<string | null>(null);

  useEffect(() => {
    // A protected request that returns 401 means the one-hour session ended: go back to sign-in.
    setSessionExpiredHandler(() => {
      setAccount(null);
      setError('Your session has ended. Sign in again.');
    });
  }, []);

  useEffect(() => {
    // The running release (commit SHA set by the deploy pipeline); local builds have none.
    const controller = new AbortController();
    fetch('/api/version', { signal: controller.signal })
      .then(response => (response.ok ? response.json() : null))
      .then(body => { if (typeof body?.commit === 'string') setCommit(body.commit); })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    async function restoreSession() {
      try {
        const response = await fetch(`${authUrl}/me`, { signal: controller.signal });
        if (response.ok) setAccount(await response.json());
        else if (response.status !== 401) throw new Error('Session check failed');
        setPhase('ready');
      } catch {
        if (!controller.signal.aborted) setPhase('unavailable');
      }
    }
    void restoreSession();
    return () => controller.abort();
  }, []);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError('');
    try {
      const response = await fetch(`${authUrl}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: form.get('username'), password: form.get('password') }),
      });
      if (response.ok) setAccount(await response.json());
      else if (response.status === 401) setError('Invalid username or password.');
      else if (response.status === 400) setError('Enter a username and password.');
      else setError('Sign-in is unavailable. Try again.');
    } catch {
      setError('Sign-in is unavailable. Try again.');
    } finally {
      setPending(false);
    }
  }

  async function signOut() {
    setPending(true);
    setError('');
    try {
      const response = await fetch(`${authUrl}/logout`, { method: 'POST' });
      if (!response.ok) throw new Error('Sign-out failed');
      setAccount(null);
    } catch {
      setError('Sign-out could not be confirmed. Try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <header className="site-header"><div className="header-inner">
        <Brand />
        <p className="service-note">One machine. One hour.<br />All times in Asia/Bangkok</p>
      </div></header>
      <main id="main-content" className="app-main" tabIndex={-1}>
        {phase === 'checking' && <Card className="connection-card">
          <h1>Checking your session…</h1>
          <Alert tone="loading">Connecting to your workspace.</Alert>
        </Card>}
        {phase === 'unavailable' && <Card className="connection-card">
          <h1>Connection unavailable</h1>
          <Alert tone="error">NutGPUHub could not check your session.</Alert>
          <Button onClick={() => location.reload()}>Try again</Button>
        </Card>}
        {phase === 'ready' && account && <>
          <div className="page-header">
            <div>
              <p className="eyebrow">Your GPU schedule</p>
              <h1>{account.role === 'student' ? 'Student workspace' : 'Operator workspace'}</h1>
              <p className="muted">Signed in as <strong>{account.username}</strong> ({account.role}).</p>
            </div>
            <div className="page-actions">
              <Button variant="secondary" onClick={signOut} disabled={pending} aria-busy={pending}>{pending ? 'Signing out…' : 'Sign out'}</Button>
            </div>
          </div>
          {error && <Alert tone="error">{error}</Alert>}
          {account.role === 'operator' && <OperatorWorkspace />}
          {account.role === 'student' && <StudentWorkspace />}
        </>}
        {phase === 'ready' && !account && <div className="login-layout">
          <div className="login-intro">
            <p className="eyebrow">Shared compute, clearly scheduled</p>
            <p className="login-headline">Reserve your<br />next hour.</p>
            <p>Find a GPU slot, save your reservation, and keep your coursework moving.</p>
            <div className="login-facts"><span>One-hour slots</span><span>Student &amp; operator access</span><span>Bangkok time</span></div>
          </div>
          <Card className="login-card" aria-labelledby="sign-in-heading">
            <div className="card-heading">
              <h1 id="sign-in-heading">Sign in</h1>
              <p>Use your NutGPUHub account to access the university GPU schedule.</p>
            </div>
            <form className="form-stack" onSubmit={signIn}>
              <div className="field"><label htmlFor="username">Username</label>
                <Input id="username" name="username" autoComplete="username" required maxLength={80} /></div>
              <div className="field"><label htmlFor="password">Password</label>
                <Input id="password" name="password" type="password" autoComplete="current-password" required maxLength={256} /></div>
              {error && <Alert tone="error">{error}</Alert>}
              <Button type="submit" disabled={pending} aria-busy={pending}>{pending ? 'Signing in…' : 'Sign in'}</Button>
            </form>
          </Card>
        </div>}
      </main>
      <footer className="site-footer">
        NutGPUHub · University GPU reservations · Asia/Bangkok
        {commit && <> · <a href={`https://github.com/Kawi-HBLI/NutGPUHub/commit/${commit}`} title={commit}>Release {commit.slice(0, 7)}</a></>}
      </footer>
    </>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
