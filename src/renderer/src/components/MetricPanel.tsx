import type { LucideIcon } from 'lucide-react';

interface MetricPanelProps {
  label: string;
  value: number | null;
  icon: LucideIcon;
  isLoading: boolean;
}

export function MetricPanel({ label, value, icon: Icon, isLoading }: MetricPanelProps): JSX.Element {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-slate-600">{label}</h2>
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-slate-600">
          <Icon aria-hidden="true" size={17} />
        </div>
      </div>
      <div className="mt-4">
        {isLoading ? (
          <div className="h-8 w-16 animate-pulse rounded bg-slate-200" aria-label={`Loading ${label}`} />
        ) : (
          <p className="text-3xl font-semibold tracking-normal text-slate-950">{value ?? 0}</p>
        )}
      </div>
    </section>
  );
}
