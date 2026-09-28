import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './layouts/AppLayout';
import { Comments } from './pages/Comments';
import { Dashboard } from './pages/Dashboard';
import { Insights } from './pages/Insights';
import { Leads } from './pages/Leads';
import { Pages } from './pages/Pages';
import { Posts } from './pages/Posts';
import { Reports } from './pages/Reports';
import { Settings } from './pages/Settings';

export default function App(): JSX.Element {
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/pages" element={<Pages />} />
        <Route path="/posts" element={<Posts />} />
        <Route path="/comments" element={<Comments />} />
        <Route path="/leads" element={<Leads />} />
        <Route path="/insights" element={<Insights />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppLayout>
  );
}
