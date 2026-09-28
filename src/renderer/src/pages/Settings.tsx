import { useEffect, useState } from 'react';
import { CheckCircle2, KeyRound, LogOut, PlugZap, Save } from 'lucide-react';
import type { MetaConnectionStatus, SafeError } from '@shared/types/ipc';
import { StatusBadge } from '../components/StatusBadge';
import { formatVietnameseDateTime } from '../services/dateFormat';

export function Settings(): JSX.Element {
  const [token, setToken] = useState('');
  const [status, setStatus] = useState<MetaConnectionStatus | null>(null);
  const [error, setError] = useState<SafeError | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [showSavedMask, setShowSavedMask] = useState(false);

  async function refreshStatus(): Promise<void> {
    const result = await window.fsi.meta.getConnectionStatus();
    if (result.success) {
      setStatus(result.data);
      setShowSavedMask(result.data.connected);
      setError(null);
    } else {
      setError(result.error);
    }
  }

  async function saveToken(): Promise<void> {
    setIsSaving(true);
    const result = await window.fsi.meta.saveDevelopmentToken(token);
    if (result.success) {
      setToken('');
      setStatus(result.data);
      setShowSavedMask(true);
      setError(null);
    } else {
      setError(result.error);
    }
    setIsSaving(false);
  }

  async function testConnection(): Promise<void> {
    setIsTesting(true);
    const result = await window.fsi.meta.testConnection();
    if (result.success) {
      setStatus(result.data);
      setShowSavedMask(result.data.connected);
      setError(null);
    } else {
      setError(result.error);
    }
    setIsTesting(false);
  }

  async function disconnect(): Promise<void> {
    setIsDisconnecting(true);
    const result = await window.fsi.meta.disconnect();
    if (result.success) {
      setStatus(result.data);
      setShowSavedMask(false);
      setToken('');
      setError(null);
    } else {
      setError(result.error);
    }
    setIsDisconnecting(false);
  }

  useEffect(() => {
    void refreshStatus();
  }, []);

  const statusLabel = status?.connected ? 'Đã kết nối' : 'Chưa kết nối';
  const statusType = status?.connected ? 'ready' : 'warning';

  return (
    <div className="px-8 py-7">
      <header className="mb-6">
        <p className="text-sm font-medium text-blue-800">Cấu hình phát triển</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-normal text-slate-950">Cài đặt</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Quản lý kết nối Meta Graph API cho môi trường phát triển. Token được lưu bằng
          Electron safeStorage trong main process.
        </p>
      </header>

      {error && (
        <div className="mb-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error.message}
        </div>
      )}

      <section className="rounded-md border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-950">Kết nối Meta</h2>
          <p className="mt-1 text-sm text-slate-600">Chỉ dành cho môi trường phát triển.</p>
        </div>

        <div className="space-y-5 p-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-slate-700">Trạng thái:</span>
            <StatusBadge label={statusLabel} status={status ? statusType : 'loading'} />
            {status?.checkedAt && (
              <span className="text-xs text-slate-500">
                Kiểm tra lúc {formatVietnameseDateTime(status.checkedAt)}
              </span>
            )}
          </div>

          <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
            Chức năng nhập Access Token hiện chỉ phục vụ phát triển và kiểm thử. Phiên bản
            thương mại sẽ sử dụng quy trình đăng nhập Meta chính thức.
          </div>

          <div>
            <label htmlFor="meta-development-token" className="text-sm font-medium text-slate-700">
              Development Access Token
            </label>
            <div className="mt-2 flex flex-col gap-3 lg:flex-row">
              <div className="relative flex-1">
                <KeyRound
                  aria-hidden="true"
                  size={17}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  id="meta-development-token"
                  value={showSavedMask && token.length === 0 ? '••••••••••••••' : token}
                  onFocus={() => {
                    if (showSavedMask) {
                      setShowSavedMask(false);
                      setToken('');
                    }
                  }}
                  onChange={(event) => {
                    setShowSavedMask(false);
                    setToken(event.target.value);
                  }}
                  type="password"
                  autoComplete="off"
                  placeholder="Dán Access Token phát triển"
                  className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <button
                type="button"
                onClick={() => void saveToken()}
                disabled={isSaving || token.trim().length === 0 || showSavedMask}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-700 px-3.5 py-2 text-sm font-medium text-white outline-none hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-400 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
              >
                <Save aria-hidden="true" size={16} />
                Lưu Token
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void testConnection()}
              disabled={isTesting}
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3.5 py-2 text-sm font-medium text-slate-700 outline-none hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            >
              <PlugZap aria-hidden="true" size={16} />
              Kiểm tra kết nối
            </button>
            <button
              type="button"
              onClick={() => void disconnect()}
              disabled={isDisconnecting || !status?.connected}
              className="inline-flex items-center gap-2 rounded-md border border-red-200 px-3.5 py-2 text-sm font-medium text-red-700 outline-none hover:bg-red-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400 focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2"
            >
              <LogOut aria-hidden="true" size={16} />
              Ngắt kết nối
            </button>
            {status?.connected && (
              <span className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700">
                <CheckCircle2 aria-hidden="true" size={16} />
                Token đã được lưu an toàn
              </span>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
