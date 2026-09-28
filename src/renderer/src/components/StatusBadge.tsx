import { CheckCircle2, CircleAlert, CircleDashed, XCircle } from 'lucide-react';

interface StatusBadgeProps {
  label: string;
  status: 'ready' | 'warning' | 'loading' | 'error';
}

export function StatusBadge({ label, status }: StatusBadgeProps): JSX.Element {
  const styles = {
    ready: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    warning: 'border-amber-200 bg-amber-50 text-amber-800',
    loading: 'border-slate-200 bg-slate-50 text-slate-600',
    error: 'border-red-200 bg-red-50 text-red-800'
  } satisfies Record<StatusBadgeProps['status'], string>;

  const Icon =
    status === 'ready'
      ? CheckCircle2
      : status === 'warning'
        ? CircleAlert
        : status === 'error'
          ? XCircle
          : CircleDashed;

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-xs font-medium ${styles[status]}`}
    >
      <Icon aria-hidden="true" size={14} />
      {label}
    </span>
  );
}
