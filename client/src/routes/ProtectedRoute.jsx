import { Navigate, Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getCurrentUser } from '../api/authApi.js';

export function ProtectedRoute() {
  const query = useQuery({ queryKey: ['current-user'], queryFn: getCurrentUser, retry: false });
  if (query.isPending) return <main className="session-state" role="status">Checking secure session…</main>;
  if (query.isError) return <Navigate to="/login" replace />;
  return <Outlet />;
}
