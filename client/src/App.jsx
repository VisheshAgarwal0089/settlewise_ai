import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout.jsx';
import { ProtectedRoute } from './routes/ProtectedRoute.jsx';
import { LoginPage } from './pages/LoginPage.jsx';
import { DashboardPage } from './pages/DashboardPage.jsx';
import { DataSourcePage } from './pages/DataSourcePage.jsx';
import { RecordsPage } from './pages/RecordsPage.jsx';
import { ReviewQueuePage } from './pages/ReviewQueuePage.jsx';
import { AuditLogPage } from './pages/AuditLogPage.jsx';

export default function App() { return <Routes><Route path="/login" element={<LoginPage />} /><Route element={<ProtectedRoute />}><Route element={<AppLayout />}><Route index element={<DashboardPage />} /><Route path="data-source" element={<DataSourcePage />} /><Route path="records" element={<RecordsPage />} /><Route path="review-queue" element={<ReviewQueuePage />} /><Route path="audit-log" element={<AuditLogPage />} /></Route></Route><Route path="*" element={<Navigate to="/" replace />} /></Routes>; }

