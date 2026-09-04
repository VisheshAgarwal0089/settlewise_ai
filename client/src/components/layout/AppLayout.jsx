import { NavLink, Outlet } from 'react-router-dom';

const links = [['/', 'Dashboard'], ['/data-source', 'Upload / Generate'], ['/records', 'Records'], ['/review-queue', 'Review Queue'], ['/audit-log', 'Audit Log']];
export function AppLayout() {
  return <div className="shell"><aside><h1>SettleWise AI</h1><nav>{links.map(([to, label]) => <NavLink key={to} to={to}>{label}</NavLink>)}</nav></aside><section><Outlet /></section></div>;
}

