import { useEffect, useState } from 'react';
import { RefreshCw, Plus, CheckCircle2, Users } from 'lucide-react';
import type { FacebookPageRecord, FacebookPageSummary, SafeError } from '@shared/types/ipc';

export function Pages(): JSX.Element {
  const [localPages, setLocalPages] = useState<FacebookPageRecord[]>([]);
  const [accessiblePages, setAccessiblePages] = useState<FacebookPageSummary[]>([]);
  const [isLoadingLocal, setIsLoadingLocal] = useState(true);
  const [isLoadingAccessible, setIsLoadingAccessible] = useState(false);
  const [importingPageId, setImportingPageId] = useState<string | null>(null);
  const [syncingPageId, setSyncingPageId] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [error, setError] = useState<SafeError | null>(null);

  async function loadLocalPages(): Promise<void> {
    setIsLoadingLocal(true);
    const result = await window.fsi.pages.list();
    if (result.success) {
      setLocalPages(result.data.pages);
      setError(null);
    } else {
      setError(result.error);
    }
    setIsLoadingLocal(false);
  }

  async function loadAccessiblePages(): Promise<void> {
    setIsLoadingAccessible(true);
    const result = await window.fsi.meta.getAccessiblePages();
    if (result.success) {
      setAccessiblePages(result.data.pages);
      setError(null);
    } else {
      setError(result.error);
    }
    setIsLoadingAccessible(false);
  }

  async function importPage(pageId: string): Promise<void> {
    setImportingPageId(pageId);
    const result = await window.fsi.meta.importPage(pageId);
    if (result.success) {
      await loadLocalPages();
      setAccessiblePages((pages) =>
        pages.map((page) => (page.facebookPageId === pageId ? { ...page, imported: true } : page))
      );
      setError(null);
    } else {
      setError(result.error);
    }
    setImportingPageId(null);
  }

  async function syncPage(pageId: string): Promise<void> {
    setSyncingPageId(pageId);
    setSyncMessage(null);
    const result = await window.fsi.meta.syncPage(pageId);

    if (result.success) {
      await loadLocalPages();
      setError(null);
      setSyncMessage(
        `Đã đồng bộ ${result.data.postsProcessed} bài viết, ${result.data.commentsProcessed} bình luận và nhận diện ${result.data.leadsDetected} lead.`
      );
    } else {
      setError(result.error);
    }

    setSyncingPageId(null);
  }

  useEffect(() => {
    void loadLocalPages();
  }, []);

  return (
    <div className="px-8 py-7">
      <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-medium text-blue-800">Owned Page MVP</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-normal text-slate-950">
            Trang Facebook
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Kết nối Trang bạn sở hữu, đồng bộ bài viết và bình luận vào cơ sở dữ liệu cục bộ để nhận diện lead.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadAccessiblePages()}
          disabled={isLoadingAccessible}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-700 px-3.5 py-2 text-sm font-medium text-white outline-none hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-400 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
        >
          <RefreshCw aria-hidden="true" size={16} />
          Kết nối Trang Facebook
        </button>
      </header>

      {error && (
        <div className="mb-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error.message}
        </div>
      )}

      {syncMessage && (
        <div className="mb-5 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {syncMessage}
        </div>
      )}

      <section className="rounded-md border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-950">Trang đã thêm vào hệ thống</h2>
          <p className="mt-1 text-sm text-slate-600">
            Danh sách này được đọc từ SQLite và vẫn hiển thị sau khi mở lại ứng dụng.
          </p>
        </div>
        <div className="p-5">
          {isLoadingLocal ? (
            <div className="h-12 animate-pulse rounded-md bg-slate-100" aria-label="Đang tải Trang Facebook" />
          ) : localPages.length === 0 ? (
            <div className="flex items-center gap-3 rounded-md border border-dashed border-slate-300 p-5 text-sm text-slate-600">
              <Users aria-hidden="true" size={18} />
              Chưa có Trang Facebook nào được kết nối.
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {localPages.map((page) => (
                <PageRow
                  key={page.facebookPageId}
                  page={page}
                  imported
                  action={
                    <button
                      type="button"
                      onClick={() => void syncPage(page.facebookPageId)}
                      disabled={syncingPageId === page.facebookPageId}
                      className="inline-flex items-center gap-2 rounded-md border border-blue-200 px-3 py-2 text-sm font-medium text-blue-700 outline-none hover:bg-blue-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
                    >
                      <RefreshCw aria-hidden="true" size={16} />
                      {syncingPageId === page.facebookPageId ? 'Đang đồng bộ...' : 'Đồng bộ dữ liệu'}
                    </button>
                  }
                />
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="mt-6 rounded-md border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-950">Trang có thể truy cập từ Meta</h2>
          <p className="mt-1 text-sm text-slate-600">
            Dữ liệu được lấy từ endpoint chính thức của Meta bằng Access Token phát triển.
          </p>
        </div>
        <div className="p-5">
          {isLoadingAccessible ? (
            <div className="space-y-3" aria-label="Đang tải Trang từ Meta">
              <div className="h-16 animate-pulse rounded-md bg-slate-100" />
              <div className="h-16 animate-pulse rounded-md bg-slate-100" />
            </div>
          ) : accessiblePages.length === 0 ? (
            <p className="text-sm text-slate-600">
              Nhấn “Kết nối Trang Facebook” để tải danh sách Trang có thể truy cập.
            </p>
          ) : (
            <div className="divide-y divide-slate-200">
              {accessiblePages.map((page) => (
                <PageRow
                  key={page.facebookPageId}
                  page={page}
                  imported={page.imported}
                  action={
                    page.imported ? (
                      <span className="inline-flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
                        <CheckCircle2 aria-hidden="true" size={16} />
                        Đã thêm
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void importPage(page.facebookPageId)}
                        disabled={importingPageId === page.facebookPageId}
                        className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 outline-none hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
                      >
                        <Plus aria-hidden="true" size={16} />
                        Thêm vào hệ thống
                      </button>
                    )
                  }
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

interface PageRowProps {
  page: FacebookPageSummary;
  imported: boolean;
  action?: JSX.Element;
}

function PageRow({ page, imported, action }: PageRowProps): JSX.Element {
  return (
    <div className="flex flex-col gap-4 py-4 md:flex-row md:items-center md:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        {page.pictureUrl ? (
          <img
            src={page.pictureUrl}
            alt=""
            className="h-11 w-11 shrink-0 rounded-md border border-slate-200 object-cover"
          />
        ) : (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500">
            <Users aria-hidden="true" size={18} />
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-950">{page.name}</p>
          <p className="mt-1 text-xs text-slate-500">
            {page.category ? `${page.category} · ` : ''}ID: {page.facebookPageId}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
          {imported ? 'Đã lưu SQLite' : 'Chưa thêm'}
        </span>
        {action}
      </div>
    </div>
  );
}
