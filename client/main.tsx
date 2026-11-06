import { useEffect, useState, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

type Account = { id: number; username: string; role: 'student' | 'operator' };
const authUrl = '/api/v1/auth';

function App() {
  const [account, setAccount] = useState<Account | null>(null);
  const [phase, setPhase] = useState<'checking' | 'ready' | 'unavailable'>('checking');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

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
    <main>
      <p className="brand">NutGPUHub</p>
      <section className="panel" aria-labelledby="page-heading">
        {phase === 'checking' && <h1 id="page-heading">Checking your session…</h1>}
        {phase === 'unavailable' && <>
          <h1 id="page-heading">Connection unavailable</h1>
          <p>NutGPUHub could not check your session.</p>
          <button onClick={() => location.reload()}>Try again</button>
        </>}
        {phase === 'ready' && account && <>
          <h1 id="page-heading">{account.role === 'student' ? 'Student workspace' : 'Operator workspace'}</h1>
          <p>Signed in as <strong>{account.username}</strong> ({account.role}).</p>
          {error && <p className="error" role="alert">{error}</p>}
          <button onClick={signOut} disabled={pending}>{pending ? 'Signing out…' : 'Sign out'}</button>
        </>}
        {phase === 'ready' && !account && <>
          <h1 id="page-heading">Sign in</h1>
          <p>Use your NutGPUHub account to access the university GPU schedule.</p>
          <form onSubmit={signIn}>
            <label htmlFor="username">Username</label>
            <input id="username" name="username" autoComplete="username" required maxLength={80} />
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" autoComplete="current-password" required maxLength={256} />
            {error && <p className="error" role="alert">{error}</p>}
            <button disabled={pending}>{pending ? 'Signing in…' : 'Sign in'}</button>
          </form>
        </>}
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
