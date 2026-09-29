import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Plus, CheckCircle2, Users, Square, AlertCircle, Play, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import type {
  FacebookPageSummary,
  SafeError,
  SyncCheckpoint,
  SyncProgressEvent
} from '@shared/types/ipc';
import { usePagesStore } from '../stores/pagesStore';

export function Pages(): JSX.Element {
  const {
    localPages,
    accessiblePages,
    isLoadingLocal,
    isLoadingAccessible,
    connectionStatus,
    error: storeError,
    loadLocalPages,
    loadAccessiblePages,
    autoLoadAccessibleIfConnected,
    importPage: storeImportPage,
    setError: setStoreError
  } = usePagesStore();

  const [importingPageId, setImportingPageId] = useState<string | null>(null);
  const [syncingPageId, setSyncingPageId] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [localError, setLocalError] = useState<SafeError | null>(null);
  const [progressMap, setProgressMap] = useState<Record<string, SyncProgressEvent>>({});
  const [checkpoints, setCheckpoints] = useState<Record<string, SyncCheckpoint | null>>({});

  const error = localError ?? storeError;

  const loadCheckpointsForPages = useCallback(async (pages = localPages): Promise<void> => {
    const cpMap: Record<string, SyncCheckpoint | null> = {};
    for (const page of pages) {
      const res = await window.fsi.meta.getSyncCheckpoint(page.facebookPageId);
      if (res.success) {
        cpMap[page.facebookPageId] = res.data;
      }
    }
    setCheckpoints(cpMap);
  }, [localPages]);

  async function importPage(pageId: string): Promise<void> {
    setImportingPageId(pageId);
    setLocalError(null);
    await storeImportPage(pageId);
    setImportingPageId(null);
  }

  async function syncPage(pageId: string, resume = true): Promise<void> {
    setSyncingPageId(pageId);
    setSyncMessage(null);
    setLocalError(null);
    setStoreError(null);

    const result = await window.fsi.meta.syncPage(pageId, { resume });

    if (result.success) {
      await loadLocalPages();
      await loadCheckpointsForPages();
      setLocalError(null);
      setSyncMessage(
        `Đã đồng bộ ${result.data.postsProcessed} bài viết, ${result.data.commentsProcessed} bình luận và nhận diện ${result.data.leadsDetected} lead.`
      );
    } else {
      setLocalError(result.error);
      await loadCheckpointsForPages();
    }

    setSyncingPageId(null);
  }

  async function discardCheckpoint(pageId: string): Promise<void> {
    const res = await window.fsi.meta.discardCheckpoint(pageId);
    if (res.success) {
      setCheckpoints((prev) => ({ ...prev, [pageId]: null }));
    }
  }

  async function cancelSync(pageId: string): Promise<void> {
    const result = await window.fsi.meta.cancelSync(pageId);
    if (!result.success) {
      setLocalError(result.error);
    } else {
      await loadCheckpointsForPages();
    }
  }

  useEffect(() => {
    void loadLocalPages();
    void autoLoadAccessibleIfConnected();
  }, [loadLocalPages, autoLoadAccessibleIfConnected]);

  useEffect(() => {
    void loadCheckpointsForPages();
  }, [loadCheckpointsForPages]);

  useEffect(() => {
    const unsubscribe = window.fsi.meta.onSyncProgress((event) => {
      setProgressMap((prev) => ({ ...prev, [event.facebookPageId]: event }));
    });
    return () => unsubscribe();
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
          <RefreshCw aria-hidden="true" size={16} className={isLoadingAccessible ? 'animate-spin' : ''} />
          {isLoadingAccessible ? 'Đang tải...' : accessiblePages.length > 0 ? 'Làm mới Trang từ Meta' : 'Kết nối Trang Facebook'}
        </button>
      </header>

      {connectionStatus && connectionStatus.missingPermissions.length > 0 && !error && (
        <div role="status" className="mb-6 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="flex items-center gap-2 font-semibold">
            <AlertCircle size={16} className="shrink-0 text-amber-700" />
            <span>Tài khoản Meta còn thiếu quyền:</span>
            {connectionStatus.missingPermissions.map((perm) => (
              <code key={perm} className="rounded bg-amber-200/80 px-1.5 py-0.5 font-mono text-xs text-amber-950">
                {perm}
              </code>
            ))}
          </div>
          <p className="mt-2 text-xs leading-5 text-amber-800">
            Trang vẫn có thể hiển thị trong danh sách bên dưới. Tuy nhiên để <strong>Đồng bộ dữ liệu</strong> (bài viết và bình luận), bạn cần cấp thêm quyền{' '}
            <code className="rounded bg-amber-100 px-1 font-mono font-semibold">pages_read_user_content</code> trong{' '}
            <strong>Meta Graph API Explorer</strong> rồi dán lại token tại{' '}
            <Link to="/settings" className="font-semibold text-blue-700 underline">
              Cài đặt → Meta Developer Mode
            </Link>.
          </p>
        </div>
      )}

      {error && (
        <div role="alert" className="mb-6 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0 text-red-600" />
            <p className="font-semibold">{error.message}</p>
          </div>
          {error.code === 'META_PERMISSION_DENIED' && (
            <div className="mt-3 rounded border border-red-200 bg-white/70 p-3 text-xs leading-5 text-red-900">
              <p className="font-semibold">💡 Hướng dẫn xử lý lỗi quyền truy cập Meta:</p>
              <ul className="mt-1.5 list-inside list-disc space-y-1">
                <li>
                  Khi tạo User Access Token trên <strong>Meta Graph API Explorer</strong>, hãy chắc chắn đã tích chọn đủ 3 quyền:{' '}
                  <code className="rounded bg-red-100 px-1 font-mono font-semibold">pages_show_list</code>,{' '}
                  <code className="rounded bg-red-100 px-1 font-mono font-semibold">pages_read_engagement</code>,{' '}
                  <code className="rounded bg-red-100 px-1 font-mono font-semibold">pages_read_user_content</code>.
                </li>
                <li>
                  Tài khoản Meta phải có quyền <strong>Quản trị viên (Admin)</strong> hoặc <strong>Task Access</strong> (Quản lý nội dung/bình luận) trên Trang đó.
                </li>
                <li>
                  Nếu bạn dùng <strong>Page Access Token</strong> (chọn trực tiếp Trang ở dropdown User/Page trong Graph API Explorer), hãy dán token đó vào{' '}
                  <Link to="/settings" className="font-semibold text-blue-700 underline">
                    Cài đặt → Meta Developer Mode
                  </Link>.
                </li>
              </ul>
            </div>
          )}
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
                  isSyncing={syncingPageId === page.facebookPageId}
                  progress={progressMap[page.facebookPageId]}
                  checkpoint={checkpoints[page.facebookPageId]}
                  onSync={(resume) => void syncPage(page.facebookPageId, resume)}
                  onCancel={() => void cancelSync(page.facebookPageId)}
                  onDiscardCheckpoint={() => void discardCheckpoint(page.facebookPageId)}
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
            Danh sách Trang được lấy từ tài khoản Meta đã kết nối.
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
  isSyncing?: boolean;
  progress?: SyncProgressEvent;
  checkpoint?: SyncCheckpoint | null;
  onSync?: (resume?: boolean) => void;
  onCancel?: () => void;
  onDiscardCheckpoint?: () => void;
}

function PageRow({
  page,
  imported,
  action,
  isSyncing,
  progress,
  checkpoint,
  onSync,
  onCancel,
  onDiscardCheckpoint
}: PageRowProps): JSX.Element {
  return (
    <div className="py-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
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
          {action ? (
            action
          ) : isSyncing ? (
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex items-center gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 outline-none hover:bg-red-100 focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2"
            >
              <Square aria-hidden="true" size={16} />
              Hủy đồng bộ
            </button>
          ) : checkpoint ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onSync?.(true)}
                className="inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-amber-700 focus-visible:ring-2 focus-visible:ring-amber-500"
              >
                <Play aria-hidden="true" size={15} />
                Tiếp tục đồng bộ
              </button>
              <button
                type="button"
                onClick={() => onSync?.(false)}
                title="Đồng bộ lại từ đầu"
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <RefreshCw aria-hidden="true" size={15} />
                Đồng bộ lại
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onSync?.(true)}
              className="inline-flex items-center gap-2 rounded-md border border-blue-200 px-3 py-2 text-sm font-medium text-blue-700 outline-none hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            >
              <RefreshCw aria-hidden="true" size={16} />
              Đồng bộ dữ liệu
            </button>
          )}
        </div>
      </div>

      {/* In-progress sync status banner */}
      {isSyncing && (
        <div className="mt-3 rounded-md border border-blue-200 bg-blue-50/80 p-3 text-xs text-blue-900">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <RefreshCw size={14} className="animate-spin text-blue-700 shrink-0" />
              <span className="font-medium text-blue-800">{progress?.message || 'Đang tiến hành đồng bộ dữ liệu...'}</span>
            </div>
            <span className="font-semibold text-blue-900">
              {progress ? `${progress.postsProcessed} bài viết · ${progress.commentsProcessed} bình luận · ${progress.leadsDetected} lead` : ''}
            </span>
          </div>
          {progress?.totalPosts && progress.totalPosts > 0 && (
            <div className="mt-2 h-1.5 w-full rounded-full bg-blue-200/80 overflow-hidden">
              <div
                className="h-full bg-blue-600 transition-all duration-300"
                style={{ width: `${Math.min(100, Math.round(((progress.currentPostIndex ?? 0) / progress.totalPosts) * 100))}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* Checkpoint banner for interrupted jobs */}
      {!isSyncing && checkpoint && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold">⚠️ Lần đồng bộ trước bị gián đoạn:</span>
            <span>Đã xử lý {checkpoint.completedPostIds.length} bài viết, {checkpoint.commentsProcessed} bình luận, {checkpoint.leadsDetected} lead.</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onSync?.(true)}
              className="font-semibold text-blue-700 underline hover:text-blue-900"
            >
              Tiếp tục
            </button>
            <span className="text-slate-400">·</span>
            <button
              type="button"
              onClick={onDiscardCheckpoint}
              className="inline-flex items-center gap-1 text-slate-600 hover:text-red-700"
            >
              <Trash2 size={12} /> Bỏ qua checkpoint
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
