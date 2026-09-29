import { useEffect, useState } from 'react';
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
import { Onboarding } from './pages/Onboarding';

function StartRoute(): JSX.Element {
  const [destination, setDestination] = useState<string | null>(null);
  useEffect(() => {
    if (localStorage.getItem('fsi-onboarding-skipped') === '1') {
      setDestination('/dashboard');
      return;
    }
    void Promise.all([window.fsi.pages.list(), window.fsi.meta.getConnectionStatus()]).then(([pages, status]) => {
      const ready = pages.success && status.success && status.data.connected &&
        pages.data.pages.some((page) => page.lastSyncedAt);
      setDestination(ready ? '/dashboard' : '/onboarding');
    });
  }, []);
  return destination ? <Navigate to={destination} replace /> : <div className="p-8 text-sm text-slate-600">Đang mở ứng dụng...</div>;
}

export default function App(): JSX.Element {
  if (typeof window === 'undefined' || !window.fsi) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12 text-slate-950">
        <div className="w-full max-w-md border-l-4 border-blue-600 pl-6">
          <p className="mb-3 text-sm font-semibold text-blue-700">Facebook Sales Intelligence</p>
          <h1 className="text-2xl font-semibold">Cần mở trong ứng dụng desktop</h1>
          <p className="mt-4 text-sm leading-6 text-slate-600">
            Trình duyệt không có kết nối với dữ liệu cục bộ của ứng dụng. Hãy mở cửa sổ Electron
            đang chạy trên máy. Nếu chưa mở, chạy lệnh sau tại thư mục dự án:
          </p>
          <code className="mt-4 block w-fit rounded bg-slate-900 px-3 py-2 text-sm text-white">
            npm run dev
          </code>
        </div>
      </main>
    );
  }

  return (
    <Routes>
      <Route path="/onboarding" element={<Onboarding />} />
      <Route element={<AppLayout />}>
        <Route path="/" element={<StartRoute />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/pages" element={<Pages />} />
        <Route path="/posts" element={<Posts />} />
        <Route path="/comments" element={<Comments />} />
        <Route path="/leads" element={<Leads />} />
        <Route path="/insights" element={<Insights />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
