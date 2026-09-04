import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../api/authApi.js';

export function LoginPage() {
  const navigate = useNavigate(); const [error, setError] = useState('');
  async function submit(event) { event.preventDefault(); const data = new FormData(event.currentTarget); try { await login({ email: data.get('email'), password: data.get('password') }); navigate('/'); } catch (cause) { setError(cause.message); } }
  return <main className="login"><form onSubmit={submit}><h1>SettleWise AI</h1><p>Sign in to the merchant reconciliation workspace.</p><label>Email<input name="email" type="email" required autoComplete="username" /></label><label>Password<input name="password" type="password" required autoComplete="current-password" /></label>{error && <p role="alert">{error}</p>}<button>Sign in</button></form></main>;
}

