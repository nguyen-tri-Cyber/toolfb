import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, RefreshCw } from 'lucide-react';
import type { FacebookPageSummary, MetaConnectionStatus, SafeError } from '@shared/types/ipc';

const steps = ['Bắt đầu', 'Kết nối Meta', 'Chọn Trang', 'Đồng bộ'] as const;

export function Onboarding(): JSX.Element {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState<MetaConnectionStatus | null>(null);
  const [pages, setPages] = useState<FacebookPageSummary[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [imported, setImported] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<SafeError | null>(null);
  const [syncSummary, setSyncSummary] = useState<string | null>(null);

  async function loadPages(): Promise<void> {
    setBusy(true);
    const result = await window.fsi.meta.getAccessiblePages();
    if (result.success) {
      setPages(result.data.pages);
      setError(null);
    } else setError(result.error);
    setBusy(false);
  }

  useEffect(() => {
    void Promise.all([window.fsi.meta.testConnection(), window.fsi.pages.list()]).then(([connection, savedPages]) => {
      if (connection.success) {
        setStatus(connection.data);
        if (connection.data.connected) {
          const unsynced = savedPages.success ? savedPages.data.pages.find((page) => !page.lastSyncedAt) : null;
          if (unsynced) {
            setSelectedPageId(unsynced.facebookPageId);
            setImported(true);
            setStep(3);
          }
        }
      }
    });
  }, []);

  async function connect(): Promise<void> {
    setBusy(true);
    setError(null);
    const result = status?.state === 'disconnected'
      ? await window.fsi.meta.connect()
      : await window.fsi.meta.reconnect();
    if (result.success) {
      setStatus(result.data);
      if (result.data.connected) {
        setStep(2);
        await loadPages();
      }
    } else setError(result.error);
    setBusy(false);
  }

  async function advance(): Promise<void> {
    if (status?.connected) {
      setStep(2);
      await loadPages();
    } else setStep(1);
  }

  async function choosePage(page: FacebookPageSummary): Promise<void> {
    setBusy(true);
    setError(null);
    if (!page.imported) {
      const result = await window.fsi.meta.importPage(page.facebookPageId);
      if (!result.success) {
        setError(result.error);
        setBusy(false);
        return;
      }
    }
    setSelectedPageId(page.facebookPageId);
    setImported(true);
    setStep(3);
    setBusy(false);
  }

  async function sync(): Promise<void> {
    if (!selectedPageId) return;
    setBusy(true);
    setError(null);
    const result = await window.fsi.meta.syncPage(selectedPageId);
    if (result.success) {
      setSyncSummary(`Đã đồng bộ ${result.data.postsProcessed} bài viết, ${result.data.commentsProcessed} bình luận và phát hiện ${result.data.leadsDetected} lead.`);
      localStorage.setItem('fsi-onboarding-complete', '1');
    } else setError(result.error);
    setBusy(false);
  }

  function skip(): void {
    localStorage.setItem('fsi-onboarding-skipped', '1');
    navigate('/dashboard');
  }

  return (
    <div className="min-h-screen bg-slate-50 px-5 py-10 text-slate-950">
      <div className="mx-auto max-w-3xl">
        <header className="flex items-center justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <p className="text-sm font-semibold text-blue-800">Facebook Sales Intelligence</p>
            <h1 className="mt-1 text-2xl font-semibold">Thiết lập Trang Facebook</h1>
          </div>
          <button type="button" onClick={skip} className="text-sm font-medium text-slate-600 hover:text-slate-950">Bỏ qua</button>
        </header>
        <ol className="mt-6 grid grid-cols-4 gap-2" aria-label="Các bước thiết lập">
          {steps.map((label, index) => (
            <li key={label} className={`border-t-2 pt-2 text-xs font-medium ${index <= step ? 'border-blue-700 text-blue-800' : 'border-slate-200 text-slate-500'}`}>
              {index + 1}. {label}
            </li>
          ))}
        </ol>
        {error && <p role="alert" className="mt-6 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error.message}</p>}
        <main className="mt-8">
          {step === 0 && <section>
            <h2 className="text-xl font-semibold">Bắt đầu với Trang của bạn</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">Kết nối tài khoản Meta, chọn Trang và đồng bộ bài viết cùng bình luận để tìm khách hàng tiềm năng.</p>
            <button type="button" onClick={() => void advance()} className="mt-6 inline-flex items-center gap-2 rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800">
              Tiếp tục <ArrowRight size={16} aria-hidden="true" />
            </button>
          </section>}
          {step === 1 && <section>
            <h2 className="text-xl font-semibold">Kết nối Meta</h2>
            <p className="mt-2 text-sm text-slate-600">Cửa sổ trình duyệt sẽ mở để bạn đăng nhập và cấp quyền truy cập Trang.</p>
            {status?.state === 'permission_missing' && <p className="mt-3 text-sm text-amber-800">Cần cấp thêm quyền: {status.missingPermissions.join(', ')}</p>}
            {status && !status.encryptionAvailable && <p className="mt-3 text-sm text-red-700">Thiết bị không hỗ trợ lưu kết nối Meta an toàn.</p>}
            <button type="button" onClick={() => void connect()} disabled={busy || !status?.encryptionAvailable} className="mt-6 rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:bg-slate-400">
              {busy ? 'Đang chờ đăng nhập...' : 'Đăng nhập với Meta'}
            </button>
            {import.meta.env.DEV && (
              <p className="mt-4 text-xs text-slate-500">
                Môi trường development:{' '}
                <button
                  type="button"
                  onClick={() => navigate('/settings')}
                  className="font-medium text-amber-700 hover:underline"
                >
                  Nhập Developer Token trong Cài đặt
                </button>
              </p>
            )}
          </section>}
          {step === 2 && <section>
            <h2 className="text-xl font-semibold">Chọn Trang Facebook</h2>
            <div className="mt-5 divide-y divide-slate-200 border-y border-slate-200">
              {pages.map((page) => <button type="button" key={page.facebookPageId} onClick={() => void choosePage(page)} disabled={busy}
                className="flex w-full items-center justify-between gap-4 py-4 text-left hover:bg-white disabled:opacity-50">
                <span><span className="block text-sm font-semibold">{page.name}</span><span className="text-xs text-slate-500">{page.category ?? 'Trang Facebook'}</span></span>
                <ArrowRight size={18} aria-hidden="true" />
              </button>)}
              {pages.length === 0 && !busy && <p className="py-5 text-sm text-slate-600">Không có Trang nào khả dụng. Hãy kiểm tra quyền của tài khoản Meta.</p>}
            </div>
            <div className="mt-5 flex gap-4">
              <button type="button" onClick={() => void loadPages()} disabled={busy} className="inline-flex items-center gap-2 text-sm font-medium text-blue-700"><RefreshCw size={16} aria-hidden="true" /> Tải lại</button>
              <button type="button" onClick={() => setStep(1)} className="inline-flex items-center gap-2 text-sm text-slate-600"><ArrowLeft size={16} aria-hidden="true" /> Đổi tài khoản</button>
            </div>
          </section>}
          {step === 3 && <section>
            <h2 className="text-xl font-semibold">Đồng bộ lần đầu</h2>
            <p className="mt-2 text-sm text-slate-600">Trang đã được thêm. Dữ liệu sẽ được lưu trên máy này.</p>
            {syncSummary ? <div className="mt-5 border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><Check size={16} className="mr-2 inline" aria-hidden="true" />{syncSummary}</div> : null}
            <button type="button" onClick={() => syncSummary ? navigate('/dashboard') : void sync()} disabled={busy || !imported} className="mt-6 rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:bg-slate-400">
              {busy ? 'Đang đồng bộ...' : syncSummary ? 'Vào ứng dụng' : 'Bắt đầu đồng bộ'}
            </button>
          </section>}
        </main>
      </div>
    </div>
  );
}
