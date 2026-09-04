import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { logout } from '../../api/authApi.js';

const links = [['/', 'Dashboard'], ['/data-source', 'Upload / Generate'], ['/records', 'Records'], ['/review-queue', 'Review Queue'], ['/audit-log', 'Audit Log']];
export function AppLayout() {
  const [open, setOpen] = useState(false); const queryClient = useQueryClient(); const navigate = useNavigate();
  async function signOut() { await logout(); queryClient.clear(); navigate('/login'); }
  return <div className="shell"><aside className={open ? 'open' : ''}><div className="brand"><span className="brand-mark">S</span><div><h1>SettleWise</h1><small>Verification console</small></div><button className="menu" aria-label="Toggle navigation" aria-expanded={open} onClick={() => setOpen(!open)}>☰</button></div><nav>{links.map(([to, label]) => <NavLink key={to} to={to} onClick={() => setOpen(false)}>{label}</NavLink>)}</nav><button className="signout secondary" onClick={signOut}>Sign out</button></aside><section className="workspace"><Outlet /></section></div>;
}
