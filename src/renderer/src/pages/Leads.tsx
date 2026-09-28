import { FormEvent, useEffect, useState } from 'react';
import { Download, ExternalLink, Search } from 'lucide-react';
import type {
  FacebookPageRecord,
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
        setMessage(
          `Đã xuất ${response.data.exported.toLocaleString('vi-VN')} lead${
            response.data.truncated ? ' (giới hạn 50.000 bản ghi).' : '.'
          }`
        );
      }
      setError(null);
    } else setError(response.error);
    setExporting(false);
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
          disabled={exporting}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white disabled:bg-slate-400"
        >
          <Download size={16} aria-hidden="true" /> {exporting ? 'Đang xuất...' : 'Xuất CSV'}
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

      <section className="mt-5 rounded-md border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4 text-sm text-slate-600">
          {loading ? 'Đang tải...' : `${result.total.toLocaleString('vi-VN')} lead`}
        </div>
        {loading ? (
          <div className="p-5"><div className="h-40 animate-pulse rounded-md bg-slate-100" /></div>
        ) : result.items.length === 0 ? (
          <p className="p-5 text-sm text-slate-600">
            Chưa có lead phù hợp. Sau khi đồng bộ, hệ thống sẽ tự nhận diện bình luận có ý định mua hàng.
          </p>
        ) : (
          <div className="divide-y divide-slate-200">
            {result.items.map((lead) => <LeadCard key={lead.id} lead={lead} onChanged={loadLeads} />)}
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

function LeadCard({ lead, onChanged }: { lead: LeadListItem; onChanged: () => Promise<void> }): JSX.Element {
  const [note, setNote] = useState(lead.note ?? '');
  const [tags, setTags] = useState(lead.tags.join(', '));
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  async function updateStatus(nextStatus: LeadStatus): Promise<void> {
    const response = await window.fsi.leads.updateStatus(lead.id, nextStatus);
    if (response.success) {
      setLocalError(null);
      await onChanged();
    } else setLocalError(response.error.message);
  }

  async function saveDetails(): Promise<void> {
    setSaving(true);
    const parsedTags = tags.split(',').map((tag) => tag.trim()).filter(Boolean).slice(0, 10);
    const response = await window.fsi.leads.updateDetails(lead.id, note.trim() || null, parsedTags);
    if (response.success) {
      setLocalError(null);
      await onChanged();
    } else setLocalError(response.error.message);
    setSaving(false);
  }

  return (
    <article className="p-5">
      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
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
          </div>
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
