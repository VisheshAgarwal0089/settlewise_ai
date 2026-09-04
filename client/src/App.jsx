import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout.jsx';
import { ProtectedRoute } from './routes/ProtectedRoute.jsx';
const LoginPage = lazy(() => import('./pages/LoginPage.jsx').then((module) => ({ default: module.LoginPage })));
const DashboardPage = lazy(() => import('./pages/DashboardPage.jsx').then((module) => ({ default: module.DashboardPage })));
const DataSourcePage = lazy(() => import('./pages/DataSourcePage.jsx').then((module) => ({ default: module.DataSourcePage })));
const RecordsPage = lazy(() => import('./pages/RecordsPage.jsx').then((module) => ({ default: module.RecordsPage })));
const ReviewQueuePage = lazy(() => import('./pages/ReviewQueuePage.jsx').then((module) => ({ default: module.ReviewQueuePage })));
const AuditLogPage = lazy(() => import('./pages/AuditLogPage.jsx').then((module) => ({ default: module.AuditLogPage })));

export default function App() { return <Suspense fallback={<main className="session-state" role="status">Loading workspace…</main>}><Routes><Route path="/login" element={<LoginPage />} /><Route element={<ProtectedRoute />}><Route element={<AppLayout />}><Route index element={<DashboardPage />} /><Route path="data-source" element={<DataSourcePage />} /><Route path="records" element={<RecordsPage />} /><Route path="review-queue" element={<ReviewQueuePage />} /><Route path="audit-log" element={<AuditLogPage />} /></Route></Route><Route path="*" element={<Navigate to="/" replace />} /></Routes></Suspense>; }
