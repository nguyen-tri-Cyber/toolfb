import { FormEvent, useEffect, useState } from 'react';
import { ExternalLink, Search } from 'lucide-react';
import type { CommentListResult, FacebookPageRecord, SafeError } from '@shared/types/ipc';
import { formatVietnameseDateTime } from '../services/dateFormat';

const PAGE_SIZE = 20;

export function Comments(): JSX.Element {
  const [pages, setPages] = useState<FacebookPageRecord[]>([]);
  const [result, setResult] = useState<CommentListResult>({ items: [], total: 0 });
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [pageId, setPageId] = useState('');
  const [onlyLeads, setOnlyLeads] = useState(false);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<SafeError | null>(null);

  useEffect(() => {
    void window.fsi.pages.list().then((response) => response.success && setPages(response.data.pages));
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void window.fsi.comments.list({
      ...(pageId ? { pageId: Number(pageId) } : {}),
      ...(search ? { search } : {}),
      onlyLeads,
      limit: PAGE_SIZE,
      offset
    }).then((response) => {
      if (!active) return;
      if (response.success) {
        setResult(response.data);
        setError(null);
      } else setError(response.error);
      setLoading(false);
    });
    return () => { active = false; };
  }, [pageId, search, onlyLeads, offset]);

  function submitSearch(event: FormEvent): void {
    event.preventDefault();
    setOffset(0);
    setSearch(searchDraft.trim());
  }

  return (
    <div className="px-8 py-7">
      <header>
        <p className="text-sm font-medium text-blue-800">Owned Page MVP</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-950">Bình luận</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">Theo dõi bình luận đã đồng bộ và xem bình luận nào được hệ thống nhận diện là lead.</p>
      </header>

      <section className="mt-6 rounded-md border border-slate-200 bg-white p-5">
        <div className="grid gap-3 lg:grid-cols-[1fr_240px_auto] lg:items-end">
          <form className="flex gap-2" onSubmit={submitSearch}>
            <label className="flex-1 text-sm font-medium text-slate-700">
              Tìm bình luận
              <div className="mt-1 flex rounded-md border border-slate-300 focus-within:ring-2 focus-within:ring-blue-600">
                <Search className="ml-3 mt-2.5 text-slate-400" size={17} aria-hidden="true" />
                <input value={searchDraft} onChange={(e) => setSearchDraft(e.target.value)} className="min-w-0 flex-1 rounded-md px-3 py-2 text-sm outline-none" placeholder="Tên khách, nội dung, Trang" />
              </div>
            </label>
            <button className="self-end rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white">Tìm</button>
          </form>
          <label className="text-sm font-medium text-slate-700">
            Trang Facebook
            <select value={pageId} onChange={(e) => { setPageId(e.target.value); setOffset(0); }} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value="">Tất cả Trang</option>
              {pages.map((page) => <option key={page.id} value={page.id}>{page.name}</option>)}
            </select>
          </label>
          <label className="flex h-10 items-center gap-2 rounded-md border border-slate-300 px-3 text-sm text-slate-700">
            <input type="checkbox" checked={onlyLeads} onChange={(e) => { setOnlyLeads(e.target.checked); setOffset(0); }} />
            Chỉ hiện lead
          </label>
        </div>
      </section>

      {error && <div className="mt-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error.message}</div>}

      <section className="mt-5 overflow-hidden rounded-md border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4 text-sm text-slate-600">{loading ? 'Đang tải...' : `${result.total.toLocaleString('vi-VN')} bình luận`}</div>
        {loading ? <div className="p-5"><div className="h-28 animate-pulse rounded-md bg-slate-100" /></div> : result.items.length === 0 ? (
          <p className="p-5 text-sm text-slate-600">Không có bình luận phù hợp.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {result.items.map((comment) => (
              <article key={comment.id} className="px-5 py-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-900">{comment.authorName || 'Người dùng Facebook'}</p>
                      <span className="text-xs text-slate-500">{comment.pageName}</span>
                      {comment.leadId && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">Lead · {comment.leadScore ?? 0} điểm · {comment.leadStatus}</span>}
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{comment.message || '(Không có nội dung văn bản)'}</p>
                    <p className="mt-2 text-xs text-slate-500">{comment.createdTime ? formatVietnameseDateTime(comment.createdTime) : 'Không rõ thời gian'} · {comment.likeCount} lượt thích</p>
                  </div>
                  {comment.postPermalinkUrl && (
                    <button type="button" onClick={() => void window.fsi.system.openExternal(comment.postPermalinkUrl!)} className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-blue-700 hover:underline">
                      Bài viết gốc <ExternalLink size={14} aria-hidden="true" />
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3 text-sm text-slate-600">
          <span>{result.total === 0 ? 0 : offset + 1}–{Math.min(result.total, offset + PAGE_SIZE)} / {result.total}</span>
          <div className="flex gap-2">
            <button type="button" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))} className="rounded-md border px-3 py-1.5 disabled:opacity-40">Trước</button>
            <button type="button" disabled={offset + PAGE_SIZE >= result.total} onClick={() => setOffset(offset + PAGE_SIZE)} className="rounded-md border px-3 py-1.5 disabled:opacity-40">Sau</button>
          </div>
        </div>
      </section>
    </div>
  );
}
