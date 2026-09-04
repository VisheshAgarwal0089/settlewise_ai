import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { login } from '../api/authApi.js';

export function LoginPage() {
  const navigate = useNavigate(); const queryClient = useQueryClient(); const [error, setError] = useState('');
  const mutation = useMutation({ mutationFn: login, onSuccess: (result) => { queryClient.setQueryData(['current-user'], result); navigate('/'); }, onError: (cause) => setError(cause.message) });
  function submit(event) { event.preventDefault(); setError(''); const data = new FormData(event.currentTarget); mutation.mutate({ email: data.get('email'), password: data.get('password') }); }
  return <main className="login"><section className="login-story"><span className="brand-mark large">S</span><p className="eyebrow">Finance control, with proof</p><h1>Know exactly why every settlement matches.</h1><p>Reconcile Razorpay records with deterministic evidence, measured confidence, and a tamper-evident audit trail.</p></section><form className="login-card" onSubmit={submit}><div><span className="eyebrow">Secure workspace</span><h2>Welcome back</h2><p>Use the configured merchant reviewer account.</p></div><label>Email<input name="email" type="email" required autoFocus autoComplete="username" placeholder="admin@settlewise.local" /></label><label>Password<input name="password" type="password" required autoComplete="current-password" placeholder="Your password" /></label>{error && <div className="banner error" role="alert">{error}</div>}<button disabled={mutation.isPending}>{mutation.isPending ? 'Signing in…' : 'Sign in securely'}</button><small>One configured account · no registration</small></form></main>;
}
