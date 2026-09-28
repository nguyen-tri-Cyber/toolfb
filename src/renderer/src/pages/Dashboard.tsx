import { useEffect } from 'react';
import { MessageSquareText, Newspaper, Target, Users } from 'lucide-react';
import { MetricPanel } from '../components/MetricPanel';
import { StatusBadge } from '../components/StatusBadge';
import { useDashboardStats } from '../hooks/useDashboardStats';
import { useHealthStore } from '../stores/healthStore';

export function Dashboard(): JSX.Element {
  const { stats, isLoading: statsLoading, error: statsError } = useDashboardStats();
  const { health, isLoading: healthLoading, error: healthError, refreshHealth } = useHealthStore();

  useEffect(() => {
    void refreshHealth();
  }, [refreshHealth]);

  const metrics = [
    { label: 'Trang Facebook', value: stats?.pages ?? null, icon: Users },
    { label: 'Bài viết', value: stats?.posts ?? null, icon: Newspaper },
    { label: 'Bình luận', value: stats?.comments ?? null, icon: MessageSquareText },
    { label: 'Khách hàng tiềm năng', value: stats?.leads ?? null, icon: Target }
  ];

  const metaStatus =
    health?.meta === 'CONNECTED' ? 'ready' : health?.meta === 'ERROR' ? 'error' : 'warning';
  const metaLabel =
    health?.meta === 'CONNECTED' ? 'Đã kết nối' : health?.meta === 'ERROR' ? 'Có lỗi' : 'Chưa kết nối';

  return (
    <div className="px-8 py-7">
      <header className="mb-7">
        <p className="text-sm font-medium text-blue-800">Kiểm thử Meta Graph API</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-normal text-slate-950">Tổng quan</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Trạng thái ứng dụng desktop và các chỉ số được truy vấn trực tiếp từ cơ sở dữ liệu cục bộ.
        </p>
      </header>

      {(statsError || healthError) && (
        <div className="mb-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {statsError?.message ?? healthError?.message}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <MetricPanel
            key={metric.label}
            label={metric.label}
            value={metric.value}
            icon={metric.icon}
            isLoading={statsLoading}
          />
        ))}
      </div>

      <section className="mt-6 rounded-md border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-950">Trạng thái hệ thống</h2>
          <p className="mt-1 text-sm text-slate-600">
            Kiểm tra trạng thái runtime của ứng dụng, cơ sở dữ liệu và kết nối Meta.
          </p>
        </div>
        <div className="grid gap-4 p-5 md:grid-cols-3">
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Ứng dụng Desktop</p>
            <StatusBadge
              label={health?.desktop ? 'Sẵn sàng' : 'Đang kiểm tra'}
              status={healthLoading ? 'loading' : health?.desktop ? 'ready' : 'warning'}
            />
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Cơ sở dữ liệu</p>
            <StatusBadge
              label={health?.database ? 'Đã kết nối' : 'Có lỗi'}
              status={healthLoading ? 'loading' : health?.database ? 'ready' : 'warning'}
            />
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Kết nối Meta</p>
            <StatusBadge label={metaLabel} status={healthLoading ? 'loading' : metaStatus} />
          </div>
        </div>
      </section>
    </div>
  );
}
