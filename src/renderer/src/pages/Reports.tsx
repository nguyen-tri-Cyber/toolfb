import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import type { ReportSummary, SafeError } from '@shared/types/ipc';

const STATUS_LABELS = {
  NEW: 'Mới',
  CONTACTED: 'Đã liên hệ',
  QUALIFIED: 'Tiềm năng',
  WON: 'Đã chốt',
  LOST: 'Không phù hợp'
} as const;

export function Reports(): JSX.Element {
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [error, setError] = useState<SafeError | null>(null);

  useEffect(() => {
    void window.fsi.reports.getSummary().then((response) => {
      if (response.success) {
        setSummary(response.data);
        setError(null);
      } else setError(response.error);
    });
  }, []);

  return (
    <div className="px-8 py-7">
      <header>
        <p className="text-sm font-medium text-blue-800">Owned Page MVP</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-950">Báo cáo</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">Tổng hợp toàn bộ lead hiện có trong cơ sở dữ liệu cục bộ.</p>
      </header>

      {error && <div className="mt-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error.message}</div>}

      {!summary ? (
        <div className="mt-6 h-36 animate-pulse rounded-md bg-slate-200" />
      ) : (
        <>
          <section className="mt-6 grid gap-4 md:grid-cols-3">
            <Metric label="Tổng lead" value={summary.totalLeads.toLocaleString('vi-VN')} />
            <Metric label="Đã chốt" value={summary.wonLeads.toLocaleString('vi-VN')} />
            <Metric label="Tỷ lệ chốt" value={`${summary.conversionRate.toLocaleString('vi-VN')}%`} />
          </section>

          <section className="mt-5 grid gap-5 xl:grid-cols-[360px_1fr]">
            <div className="rounded-md border border-slate-200 bg-white p-5">
              <h2 className="font-semibold text-slate-950">Phễu trạng thái</h2>
              <div className="mt-4 space-y-3">
                {Object.entries(summary.statusCounts).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between border-b border-slate-100 pb-3 text-sm last:border-0">
                    <span className="text-slate-600">{STATUS_LABELS[status as keyof typeof STATUS_LABELS]}</span>
                    <strong className="text-slate-950">{count.toLocaleString('vi-VN')}</strong>
                  </div>
                ))}
              </div>
            </div>

            <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
              <div className="border-b border-slate-200 px-5 py-4">
                <h2 className="font-semibold text-slate-950">Bài viết tạo nhiều lead nhất</h2>
              </div>
              {summary.topPosts.length === 0 ? (
                <p className="p-5 text-sm text-slate-600">Chưa có dữ liệu lead để xếp hạng bài viết.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {summary.topPosts.map((post, index) => (
                    <div key={post.postId} className="flex items-start gap-4 px-5 py-4">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700">{index + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm font-medium text-slate-900">{post.message || '(Bài viết không có nội dung văn bản)'}</p>
                        <p className="mt-1 text-xs text-slate-500">{post.pageName} · {post.leadCount} lead · {post.wonCount} đã chốt</p>
                      </div>
                      {post.permalinkUrl && (
                        <button type="button" onClick={() => void window.fsi.system.openExternal(post.permalinkUrl!)} className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-blue-700 hover:underline">
                          Mở <ExternalLink size={14} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}
