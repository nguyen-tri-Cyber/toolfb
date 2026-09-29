import { NavLink, Outlet } from 'react-router-dom';
import {
  BarChart3,
  FileText,
  Gauge,
  Lightbulb,
  MessageSquareText,
  Newspaper,
  Settings,
  Target,
  Users
} from 'lucide-react';

const navigationItems = [
  { label: 'Tổng quan', to: '/', icon: Gauge },
  { label: 'Trang Facebook', to: '/pages', icon: Users },
  { label: 'Bài viết', to: '/posts', icon: Newspaper },
  { label: 'Bình luận', to: '/comments', icon: MessageSquareText },
  { label: 'Khách hàng tiềm năng', to: '/leads', icon: Target },
  { label: 'Phân tích', to: '/insights', icon: Lightbulb },
  { label: 'Báo cáo', to: '/reports', icon: FileText },
  { label: 'Cài đặt', to: '/settings', icon: Settings }
] as const;

export function AppLayout(): JSX.Element {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <div className="flex min-h-screen">
        <aside className="flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-5 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-blue-700 text-white">
                <BarChart3 aria-hidden="true" size={20} />
              </div>
              <div>
                <p className="text-sm font-semibold leading-5">Facebook Sales</p>
                <p className="text-xs text-slate-500">Intelligence</p>
              </div>
            </div>
          </div>

          <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Primary navigation">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    [
                      'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium outline-none transition-colors',
                      'focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2',
                      isActive
                        ? 'bg-blue-50 text-blue-800'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
                    ].join(' ')
                  }
                >
                  <Icon aria-hidden="true" size={18} />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>

          <div className="border-t border-slate-200 px-5 py-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Owned Page MVP · Local-first
            </p>
          </div>
        </aside>

        <main className="min-w-0 flex-1"><Outlet /></main>
      </div>
    </div>
  );
}
