import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, KeyRound, LogIn, LogOut, RefreshCw, ShieldAlert } from 'lucide-react';
import type { MetaConnectionStatus, SafeError } from '@shared/types/ipc';
import { StatusBadge } from '../components/StatusBadge';
import { usePagesStore } from '../stores/pagesStore';

const stateLabels: Record<MetaConnectionStatus['state'], string> = {
  disconnected: 'Chưa kết nối',
  connecting: 'Đang kết nối',
  connected: 'Đã kết nối',
  expired: 'Phiên đã hết hạn',
  revoked: 'Quyền truy cập đã bị thu hồi',
  permission_missing: 'Thiếu quyền truy cập',
  error: 'Không thể kiểm tra kết nối'
};

export function Settings(): JSX.Element {
  const [status, setStatus] = useState<MetaConnectionStatus | null>(null);
  const [error, setError] = useState<SafeError | null>(null);
  const [busy, setBusy] = useState(false);
  const [devToken, setDevToken] = useState('');
  const [devSuccessMessage, setDevSuccessMessage] = useState<string | null>(null);

  const isDevModeAvailable = import.meta.env.DEV && typeof window.fsi?.meta?.setDeveloperToken === 'function';

  async function refresh(): Promise<void> {
    const result = await window.fsi.meta.testConnection();
    if (result.success) {
      setStatus(result.data);
      setError(null);
    } else {
      setError(result.error);
    }
  }

  async function connect(): Promise<void> {
    setBusy(true);
    setError(null);
    setDevSuccessMessage(null);
    const result = status?.state === 'disconnected'
      ? await window.fsi.meta.connect()
      : await window.fsi.meta.reconnect();
    if (result.success) setStatus(result.data);
    else setError(result.error);
    setBusy(false);
  }

  async function disconnect(): Promise<void> {
    if (!window.confirm('Ngắt kết nối Meta? Dữ liệu đã đồng bộ trên máy vẫn được giữ lại.')) return;
    setBusy(true);
    setDevSuccessMessage(null);
    const result = await window.fsi.meta.disconnect();
    if (result.success) {
      setStatus(result.data);
      setError(null);
      usePagesStore.setState({ accessiblePages: [], hasLoadedAccessible: false, connectionStatus: result.data });
    } else {
      setError(result.error);
    }
    setBusy(false);
  }

  async function handleSaveDevToken(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!window.fsi.meta.setDeveloperToken) return;

    const trimmed = devToken.trim();
    if (!trimmed) {
      setError({
        code: 'META_TOKEN_INVALID',
        message: 'Vui lòng nhập Access Token trước khi lưu.'
      });
      return;
    }

    setBusy(true);
    setError(null);
    setDevSuccessMessage(null);

    const result = await window.fsi.meta.setDeveloperToken(trimmed);
    if (result.success) {
      setStatus(result.data);
      setDevToken('');
      setDevSuccessMessage(
        result.data.accountName
          ? `Đã kích hoạt thành công Developer Token cho tài khoản: ${result.data.accountName}`
          : 'Đã kích hoạt thành công Developer Token.'
      );
      // Preload accessible pages into store immediately
      void usePagesStore.getState().loadAccessiblePages();
      usePagesStore.setState({ connectionStatus: result.data });
    } else {
      setError(result.error);
    }
    setBusy(false);
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <div className="px-8 py-7">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-950">Cài đặt</h1>
      </header>
      {error && (
        <p role="alert" className="mb-5 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error.message}
        </p>
      )}
      {devSuccessMessage && (
        <div role="status" className="mb-5 flex items-center gap-2 border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 size={16} aria-hidden="true" />
          <span>{devSuccessMessage}</span>
        </div>
      )}

      {/* Production OAuth / Connection Status Section */}
      <section className="border-t border-slate-200 bg-white py-5">
        <h2 className="text-base font-semibold text-slate-950">Kết nối Meta</h2>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <StatusBadge
            label={status ? stateLabels[status.state] : 'Đang kiểm tra'}
            status={!status ? 'loading' : status.connected ? 'ready' : 'warning'}
          />
          {status?.accountName && <span className="text-sm font-medium text-slate-700">{status.accountName}</span>}
        </div>
        {status?.missingPermissions.length ? (
          <p className="mt-3 text-sm text-amber-800">
            Cần cấp thêm quyền: {status.missingPermissions.join(', ')}
          </p>
        ) : null}
        {status && !status.encryptionAvailable && (
          <p className="mt-3 text-sm text-red-700">Thiết bị không hỗ trợ lưu kết nối Meta an toàn.</p>
        )}
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void connect()}
            disabled={busy || !status?.encryptionAvailable}
            className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:bg-slate-400"
          >
            <LogIn size={16} aria-hidden="true" />
            {busy ? 'Đang xử lý...' : status?.state === 'disconnected' ? 'Kết nối Meta (OAuth)' : 'Kết nối lại'}
          </button>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={16} aria-hidden="true" /> Kiểm tra lại
          </button>
          {status && status.state !== 'disconnected' && (
            <button
              type="button"
              onClick={() => void disconnect()}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-md border border-red-200 px-3.5 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              <LogOut size={16} aria-hidden="true" /> Ngắt kết nối
            </button>
          )}
        </div>
        <div className="mt-5 flex flex-wrap gap-4 text-sm font-medium">
          <Link to="/onboarding" className="text-blue-700 hover:underline">
            Thiết lập Trang Facebook (Onboarding)
          </Link>
          <Link to="/pages" className="text-blue-700 hover:underline">
            Quản lý Trang Facebook
          </Link>
        </div>
      </section>

      {/* Meta Developer Mode — Only in Development */}
      {isDevModeAvailable && (
        <section className="mt-8 rounded-lg border border-amber-300 bg-amber-50/50 p-5">
          <div className="flex items-center gap-2 text-amber-900">
            <KeyRound size={18} aria-hidden="true" />
            <h2 className="text-base font-semibold">Meta Developer Mode (Local Test)</h2>
            <span className="rounded bg-amber-200 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-amber-900">
              Dev Only
            </span>
          </div>
          <p className="mt-2 text-sm text-amber-800">
            Khu vực dành riêng cho môi trường development để thử nghiệm dữ liệu Trang thật bằng Meta User Access Token.
            Token được lưu bằng Electron safeStorage cục bộ; không bao giờ lưu trong localStorage, SQLite hay log.
          </p>

          <form onSubmit={(e) => void handleSaveDevToken(e)} className="mt-4 max-w-2xl space-y-3">
            <div>
              <label htmlFor="meta-dev-token" className="block text-xs font-semibold uppercase text-slate-700">
                Meta User Access Token
              </label>
              <div className="mt-1 flex gap-2">
                <input
                  id="meta-dev-token"
                  type="password"
                  value={devToken}
                  onChange={(e) => setDevToken(e.target.value)}
                  placeholder="Dán token bắt đầu bằng EAA..."
                  disabled={busy}
                  autoComplete="off"
                  spellCheck={false}
                  className="flex-1 rounded-md border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-100"
                />
                <button
                  type="submit"
                  disabled={busy || !devToken.trim()}
                  className="inline-flex items-center gap-2 rounded-md bg-amber-700 px-4 py-2 text-sm font-medium text-white shadow hover:bg-amber-800 disabled:bg-slate-300"
                >
                  <KeyRound size={15} aria-hidden="true" />
                  {busy ? 'Đang xác thực...' : 'Lưu & Kiểm tra'}
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <ShieldAlert size={14} aria-hidden="true" />
              <span>
                Cần quyền tối thiểu: <code className="font-mono font-semibold">pages_show_list</code>,{' '}
                <code className="font-mono font-semibold">pages_read_engagement</code>,{' '}
                <code className="font-mono font-semibold">pages_read_user_content</code>.
              </span>
            </div>
            {status?.connected && (
              <div className="mt-3 flex items-center gap-2 text-sm text-slate-700">
                <span>Trạng thái hiện tại:</span>
                <span className="font-semibold text-emerald-700">Đã kích hoạt và sẵn sàng</span>
                <Link
                  to="/pages"
                  className="inline-flex items-center gap-1 font-medium text-blue-700 hover:underline"
                >
                  Chọn và đồng bộ Trang ngay <ArrowRight size={14} />
                </Link>
              </div>
            )}
          </form>
        </section>
      )}
    </div>
  );
}
