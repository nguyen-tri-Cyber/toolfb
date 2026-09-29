import { FormEvent, useEffect, useState } from 'react';
import { Download, ExternalLink, Search, History, CheckSquare, Square, Tag } from 'lucide-react';
import { Link } from 'react-router-dom';
import type {
  FacebookPageRecord,
  LeadHistoryItem,
  LeadListItem,
  LeadListResult,
  LeadStatus,
  SafeError
} from '@shared/types/ipc';
import { formatVietnameseDateTime } from '../services/dateFormat';

const PAGE_SIZE = 20;
const STATUS_OPTIONS: Array<{ value: LeadStatus; label: string }> = [
  { value: 'NEW', label: 'Mới' },
  { value: 'CONTACTED', label: 'Đã liên hệ' },
  { value: 'QUALIFIED', label: 'Tiềm năng' },
  { value: 'WON', label: 'Đã chốt' },
  { value: 'LOST', label: 'Không phù hợp' }
];

const STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: 'Mới',
  CONTACTED: 'Đã liên hệ',
  QUALIFIED: 'Tiềm năng',
  WON: 'Đã chốt',
  LOST: 'Không phù hợp'
};

export function Leads(): JSX.Element {
  const [pages, setPages] = useState<FacebookPageRecord[]>([]);
  const [result, setResult] = useState<LeadListResult>({ items: [], total: 0 });
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [pageId, setPageId] = useState('');
  const [status, setStatus] = useState('');
  const [minScore, setMinScore] = useState('');
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<SafeError | null>(null);

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<LeadStatus>('CONTACTED');
  const [bulkTagInput, setBulkTagInput] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);

  useEffect(() => {
    void window.fsi.pages.list().then((response) => response.success && setPages(response.data.pages));
  }, []);

  function queryFor(currentOffset = offset) {
    return {
      ...(pageId ? { pageId: Number(pageId) } : {}),
      ...(search ? { search } : {}),
      ...(status ? { status: status as LeadStatus } : {}),
      ...(minScore ? { minScore: Number(minScore) } : {}),
      limit: PAGE_SIZE,
      offset: currentOffset
    };
  }

  async function loadLeads(): Promise<void> {
    setLoading(true);
    const response = await window.fsi.leads.list(queryFor());
    if (response.success) {
      setResult(response.data);
      setError(null);
    } else setError(response.error);
    setLoading(false);
  }

  useEffect(() => {
    void loadLeads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId, search, status, minScore, offset]);

  function submitSearch(event: FormEvent): void {
    event.preventDefault();
    setOffset(0);
    setSearch(searchDraft.trim());
  }

  async function exportCsv(): Promise<void> {
    setExporting(true);
    setMessage(null);
    const response = await window.fsi.leads.exportCsv({
      ...(pageId ? { pageId: Number(pageId) } : {}),
      ...(search ? { search } : {}),
      ...(status ? { status: status as LeadStatus } : {}),
      ...(minScore ? { minScore: Number(minScore) } : {})
    });
    if (response.success) {
      if (!response.data.canceled) {
        const dest = response.data.filePath ? ` (${response.data.filePath})` : '';
        setMessage(
          `Đã xuất ${response.data.exported.toLocaleString('vi-VN')} lead${
            response.data.truncated ? ' (giới hạn 50.000 bản ghi)' : ''
          }${dest}.`
        );
      }
      setError(null);
    } else setError(response.error);
    setExporting(false);
  }

  function toggleSelect(id: number): void {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allOnPageSelected =
    result.items.length > 0 && result.items.every((item) => selectedIds.has(item.id));

  function toggleSelectAllOnPage(): void {
    if (allOnPageSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        result.items.forEach((item) => next.delete(item.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        result.items.forEach((item) => next.add(item.id));
        return next;
      });
    }
  }

  async function handleBulkUpdateStatus(): Promise<void> {
    if (selectedIds.size === 0) return;
    setBulkBusy(true);
    setError(null);
    setMessage(null);
    const res = await window.fsi.leads.bulkUpdateStatus(Array.from(selectedIds), bulkStatus);
    if (res.success) {
      setMessage(`Đã cập nhật trạng thái "${STATUS_LABELS[bulkStatus]}" cho ${res.data.updated} khách hàng.`);
      setSelectedIds(new Set());
      await loadLeads();
    } else {
      setError(res.error);
    }
    setBulkBusy(false);
  }

  async function handleBulkAddTags(): Promise<void> {
    if (selectedIds.size === 0) return;
    const tags = bulkTagInput.split(',').map((t) => t.trim()).filter(Boolean);
    if (tags.length === 0) return;
    setBulkBusy(true);
    setError(null);
    setMessage(null);
    const res = await window.fsi.leads.bulkAddTags(Array.from(selectedIds), tags);
    if (res.success) {
      setMessage(`Đã thêm nhãn cho ${res.data.updated} khách hàng.`);
      setBulkTagInput('');
      await loadLeads();
    } else {
      setError(res.error);
    }
    setBulkBusy(false);
  }

  return (
    <div className="px-8 py-7">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-medium text-blue-800">Owned Page MVP</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-950">Khách hàng tiềm năng</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Inbox làm việc với lead được phát hiện từ bình luận trên Trang bạn sở hữu.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void exportCsv()}
          disabled={exporting || loading || result.total === 0}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white disabled:bg-slate-400"
        >
          <Download size={16} aria-hidden="true" /> {exporting ? 'Đang xuất...' : 'Xuất Excel / CSV'}
        </button>
      </header>

      <section className="mt-6 rounded-md border border-slate-200 bg-white p-5">
        <div className="grid gap-3 xl:grid-cols-[1fr_220px_180px_150px] xl:items-end">
          <form className="flex gap-2" onSubmit={submitSearch}>
            <label className="flex-1 text-sm font-medium text-slate-700">
              Tìm lead
              <div className="mt-1 flex rounded-md border border-slate-300 focus-within:ring-2 focus-within:ring-blue-600">
                <Search className="ml-3 mt-2.5 text-slate-400" size={17} aria-hidden="true" />
                <input
                  value={searchDraft}
                  onChange={(event) => setSearchDraft(event.target.value)}
                  className="min-w-0 flex-1 rounded-md px-3 py-2 text-sm outline-none"
                  placeholder="Tên khách hoặc nội dung bình luận"
                />
              </div>
            </label>
            <button className="self-end rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white">Tìm</button>
          </form>
          <FilterSelect
            label="Trang"
            value={pageId}
            onChange={(value) => {
              setPageId(value);
              setOffset(0);
            }}
            options={pages.map((page) => ({ value: String(page.id), label: page.name }))}
          />
          <FilterSelect
            label="Trạng thái"
            value={status}
            onChange={(value) => {
              setStatus(value);
              setOffset(0);
            }}
            options={STATUS_OPTIONS}
          />
          <label className="text-sm font-medium text-slate-700">
            Điểm tối thiểu
            <input
              type="number"
              min="0"
              max="100"
              value={minScore}
              onChange={(event) => {
                setMinScore(event.target.value);
                setOffset(0);
              }}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="0–100"
            />
          </label>
        </div>
      </section>

      {error && <div className="mt-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error.message}</div>}
      {message && <div className="mt-5 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div>}

      {/* Floating Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <section aria-label="Thao tác hàng loạt" className="sticky top-4 z-20 mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blue-300 bg-blue-50/95 p-3.5 shadow-md backdrop-blur">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-blue-950">
              Đã chọn {selectedIds.size} khách hàng
            </span>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="text-xs font-medium text-blue-700 underline hover:text-blue-900"
            >
              Bỏ chọn tất cả
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <select
                value={bulkStatus}
                onChange={(e) => setBulkStatus(e.target.value as LeadStatus)}
                className="rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800"
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={bulkBusy}
                onClick={() => void handleBulkUpdateStatus()}
                className="rounded bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
              >
                {bulkBusy ? 'Đang lưu...' : 'Đổi trạng thái'}
              </button>
            </div>

            <div className="h-4 w-px bg-blue-200" />

            <div className="flex items-center gap-1.5">
              <input
                value={bulkTagInput}
                onChange={(e) => setBulkTagInput(e.target.value)}
                placeholder="Nhãn (cách nhau bởi dấu phẩy)"
                className="w-48 rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
              />
              <button
                type="button"
                disabled={bulkBusy || !bulkTagInput.trim()}
                onClick={() => void handleBulkAddTags()}
                className="inline-flex items-center gap-1 rounded border border-blue-400 bg-white px-3 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-100 disabled:opacity-50"
              >
                <Tag size={12} /> Thêm nhãn
              </button>
            </div>
          </div>
        </section>
      )}

      <section className="mt-5 rounded-md border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 text-sm text-slate-600">
          <div className="flex items-center gap-3">
            {result.items.length > 0 && (
              <button
                type="button"
                onClick={toggleSelectAllOnPage}
                title="Chọn tất cả trên trang này"
                className="flex items-center gap-1.5 text-xs font-medium text-slate-700 hover:text-slate-950"
              >
                {allOnPageSelected ? (
                  <CheckSquare size={16} className="text-blue-700" />
                ) : (
                  <Square size={16} className="text-slate-400" />
                )}
                <span>Chọn tất cả trên trang</span>
              </button>
            )}
            <span>{loading ? 'Đang tải...' : `${result.total.toLocaleString('vi-VN')} lead`}</span>
          </div>
        </div>

        {loading ? (
          <div className="p-5"><div className="h-40 animate-pulse rounded-md bg-slate-100" /></div>
        ) : result.items.length === 0 ? (
          <p className="p-5 text-sm text-slate-600">
            Chưa có lead phù hợp. <Link to="/comments" className="font-medium text-blue-700 underline">Xem tất cả bình luận</Link>.
          </p>
        ) : (
          <div className="divide-y divide-slate-200">
            {result.items.map((lead) => (
              <LeadCard
                key={lead.id}
                lead={lead}
                selected={selectedIds.has(lead.id)}
                onToggleSelect={() => toggleSelect(lead.id)}
                onChanged={loadLeads}
              />
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

function FilterSelect({
  label,
  value,
  onChange,
  options
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}): JSX.Element {
  return (
    <label className="text-sm font-medium text-slate-700">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
        <option value="">Tất cả</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

function LeadCard({
  lead,
  selected,
  onToggleSelect,
  onChanged
}: {
  lead: LeadListItem;
  selected: boolean;
  onToggleSelect: () => void;
  onChanged: () => Promise<void>;
}): JSX.Element {
  const [note, setNote] = useState(lead.note ?? '');
  const [tags, setTags] = useState(lead.tags.join(', '));
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // History state
  const [showHistory, setShowHistory] = useState(false);
  const [historyItems, setHistoryItems] = useState<LeadHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  async function updateStatus(nextStatus: LeadStatus): Promise<void> {
    const response = await window.fsi.leads.updateStatus(lead.id, nextStatus);
    if (response.success) {
      setLocalError(null);
      await onChanged();
      if (showHistory) void loadHistory();
    } else setLocalError(response.error.message);
  }

  async function saveDetails(): Promise<void> {
    setSaving(true);
    const parsedTags = tags.split(',').map((tag) => tag.trim()).filter(Boolean).slice(0, 10);
    const response = await window.fsi.leads.updateDetails(lead.id, note.trim() || null, parsedTags);
    if (response.success) {
      setLocalError(null);
      await onChanged();
      if (showHistory) void loadHistory();
    } else setLocalError(response.error.message);
    setSaving(false);
  }

  async function loadHistory(): Promise<void> {
    setLoadingHistory(true);
    const res = await window.fsi.leads.getHistory(lead.id);
    if (res.success) {
      setHistoryItems(res.data.items);
    }
    setLoadingHistory(false);
  }

  function toggleHistory(): void {
    if (!showHistory) {
      void loadHistory();
    }
    setShowHistory((prev) => !prev);
  }

  function formatActionLabel(item: LeadHistoryItem): string {
    switch (item.action) {
      case 'STATUS_CHANGED':
      case 'BULK_STATUS_CHANGED':
        return `Đổi trạng thái: ${STATUS_LABELS[item.oldValue as LeadStatus] || item.oldValue || 'Chưa có'} → ${STATUS_LABELS[item.newValue as LeadStatus] || item.newValue}`;
      case 'NOTE_UPDATED':
        return item.newValue ? `Cập nhật ghi chú: "${item.newValue}"` : 'Đã xóa ghi chú';
      case 'TAGS_UPDATED':
      case 'BULK_TAGS_ADDED':
        return `Nhãn: ${item.newValue || '[]'}`;
      default:
        return item.action;
    }
  }

  return (
    <article className={`p-5 transition-colors ${selected ? 'bg-blue-50/40' : ''}`}>
      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onToggleSelect}
              className="mr-1 text-slate-500 hover:text-blue-700"
              title={selected ? 'Bỏ chọn' : 'Chọn lead này'}
            >
              {selected ? (
                <CheckSquare size={18} className="text-blue-700" />
              ) : (
                <Square size={18} className="text-slate-400" />
              )}
            </button>
            <h2 className="font-semibold text-slate-950">{lead.authorName || 'Người dùng Facebook'}</h2>
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-800">{lead.score} điểm</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{lead.intentType || 'GENERAL'}</span>
            <span className="text-xs text-slate-500">{lead.pageName}</span>
          </div>

          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{lead.commentMessage || '(Không có nội dung bình luận)'}</p>
          {lead.summary && <p className="mt-2 text-sm text-slate-500">Nhận diện: {lead.summary}</p>}

          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span>{lead.commentCreatedTime ? formatVietnameseDateTime(lead.commentCreatedTime) : 'Không rõ thời gian'}</span>
            {lead.postPermalinkUrl && (
              <button type="button" onClick={() => void window.fsi.system.openExternal(lead.postPermalinkUrl!)} className="inline-flex items-center gap-1 font-medium text-blue-700 hover:underline">
                Mở bài viết <ExternalLink size={13} aria-hidden="true" />
              </button>
            )}
            <button
              type="button"
              onClick={toggleHistory}
              className="inline-flex items-center gap-1 font-medium text-slate-600 hover:text-blue-700"
            >
              <History size={13} aria-hidden="true" />
              {showHistory ? 'Ẩn lịch sử' : 'Lịch sử thay đổi'}
            </button>
          </div>

          {/* History Timeline */}
          {showHistory && (
            <div className="mt-3 rounded-md border border-slate-200 bg-slate-50/80 p-3 text-xs">
              <p className="font-semibold text-slate-800">Lịch sử cập nhật lead</p>
              {loadingHistory ? (
                <p className="mt-1 text-slate-500">Đang tải lịch sử...</p>
              ) : historyItems.length === 0 ? (
                <p className="mt-1 text-slate-500">Chưa có thay đổi nào được ghi nhận.</p>
              ) : (
                <ul className="mt-2 space-y-1.5 border-l border-slate-300 pl-3">
                  {historyItems.map((item) => (
                    <li key={item.id} className="relative">
                      <span className="absolute -left-[17px] top-1 h-1.5 w-1.5 rounded-full bg-blue-600" />
                      <div className="flex flex-wrap items-center justify-between gap-1 text-slate-700">
                        <span>{formatActionLabel(item)}</span>
                        <span className="text-[11px] text-slate-400">
                          {formatVietnameseDateTime(item.createdAt)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <label className="block text-sm font-medium text-slate-700">
            Trạng thái
            <select value={lead.status} onChange={(event) => void updateStatus(event.target.value as LeadStatus)} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Ghi chú
            <textarea value={note} maxLength={2000} onChange={(event) => setNote(event.target.value)} rows={2} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Ví dụ: Gọi lại lúc 15:00" />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Nhãn <span className="font-normal text-slate-400">(cách nhau bằng dấu phẩy)</span>
            <input value={tags} onChange={(event) => setTags(event.target.value)} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="VIP, cần gọi lại" />
          </label>
          {localError && <p className="text-xs text-red-700">{localError}</p>}
          <button type="button" onClick={() => void saveDetails()} disabled={saving} className="rounded-md border border-blue-200 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50">
            {saving ? 'Đang lưu...' : 'Lưu ghi chú & nhãn'}
          </button>
        </div>
      </div>
    </article>
  );
}
