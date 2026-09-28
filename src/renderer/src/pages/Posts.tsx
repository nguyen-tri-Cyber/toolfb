import { FormEvent, useEffect, useState } from 'react';
import { ExternalLink, Search } from 'lucide-react';
import type { FacebookPageRecord, PostListResult, SafeError } from '@shared/types/ipc';
import { formatVietnameseDateTime } from '../services/dateFormat';

const PAGE_SIZE = 20;

export function Posts(): JSX.Element {
  const [pages, setPages] = useState<FacebookPageRecord[]>([]);
  const [result, setResult] = useState<PostListResult>({ items: [], total: 0 });
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [pageId, setPageId] = useState('');
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<SafeError | null>(null);

  useEffect(() => {
    void window.fsi.pages.list().then((response) => {
      if (response.success) setPages(response.data.pages);
    });
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void window.fsi.posts
      .list({
        ...(pageId ? { pageId: Number(pageId) } : {}),
        ...(search ? { search } : {}),
        limit: PAGE_SIZE,
        offset
      })
      .then((response) => {
        if (!active) return;
        if (response.success) {
          setResult(response.data);
          setError(null);
        } else {
          setError(response.error);
        }
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [pageId, search, offset]);

  function submitSearch(event: FormEvent): void {
    event.preventDefault();
    setOffset(0);
    setSearch(searchDraft.trim());
  }

  return (
    <div className="px-8 py-7">
      <header>
        <p className="text-sm font-medium text-blue-800">Owned Page MVP</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-950">Bài viết</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Xem bài viết đã đồng bộ từ các Trang Facebook bạn sở hữu.
        </p>
      </header>

      <section className="mt-6 rounded-md border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <form className="flex flex-1 gap-2" onSubmit={submitSearch}>
            <label className="flex-1 text-sm font-medium text-slate-700">
              Tìm nội dung
              <div className="mt-1 flex rounded-md border border-slate-300 bg-white focus-within:ring-2 focus-within:ring-blue-600">
                <Search className="ml-3 mt-2.5 text-slate-400" aria-hidden="true" size={17} />
                <input
                  value={searchDraft}
                  onChange={(event) => setSearchDraft(event.target.value)}
                  className="min-w-0 flex-1 rounded-md px-3 py-2 text-sm outline-none"
                  placeholder="Nội dung bài viết hoặc tên Trang"
                />
              </div>
            </label>
            <button className="self-end rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800">
              Tìm
            </button>
          </form>
          <label className="text-sm font-medium text-slate-700">
            Trang Facebook
            <select
              value={pageId}
              onChange={(event) => {
                setPageId(event.target.value);
                setOffset(0);
              }}
              className="mt-1 block min-w-56 rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Tất cả Trang</option>
              {pages.map((page) => (
                <option key={page.id} value={page.id}>{page.name}</option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {error && <div className="mt-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error.message}</div>}

      <section className="mt-5 overflow-hidden rounded-md border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4 text-sm text-slate-600">
          {loading ? 'Đang tải...' : `${result.total.toLocaleString('vi-VN')} bài viết`}
        </div>
        {loading ? (
          <div className="p-5"><div className="h-28 animate-pulse rounded-md bg-slate-100" /></div>
        ) : result.items.length === 0 ? (
          <p className="p-5 text-sm text-slate-600">Chưa có bài viết phù hợp. Hãy đồng bộ Trang Facebook trước.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Bài viết</th>
                  <th className="px-4 py-3">Trang</th>
                  <th className="px-4 py-3">Tương tác</th>
                  <th className="px-4 py-3">Thời gian</th>
                  <th className="px-5 py-3 text-right">Nguồn</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {result.items.map((post) => (
                  <tr key={post.id} className="align-top">
                    <td className="max-w-xl px-5 py-4 text-slate-800">
                      <p className="line-clamp-3">{post.message || '(Bài viết không có nội dung văn bản)'}</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-slate-600">{post.pageName}</td>
                    <td className="whitespace-nowrap px-4 py-4 text-slate-600">
                      {post.reactionsCount} cảm xúc · {post.commentsCount} bình luận · {post.sharesCount} chia sẻ
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-slate-600">
                      {post.createdTime ? formatVietnameseDateTime(post.createdTime) : '—'}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {post.permalinkUrl ? (
                        <button
                          type="button"
                          onClick={() => void window.fsi.system.openExternal(post.permalinkUrl!)}
                          className="inline-flex items-center gap-1 text-sm font-medium text-blue-700 hover:underline"
                        >
                          Mở bài viết <ExternalLink size={14} aria-hidden="true" />
                        </button>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
