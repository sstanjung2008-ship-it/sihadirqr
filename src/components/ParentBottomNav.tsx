import React from 'react';
import { Home, CalendarDays, FileText, MessageSquare, UserCircle } from 'lucide-react';

interface ParentBottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  unreadLeavesCount?: number;
}

export const ParentBottomNav: React.FC<ParentBottomNavProps> = React.memo(({
  activeTab,
  onTabChange,
  unreadLeavesCount = 0,
}) => {
  const navItems = [
    {
      id: 'dashboard',
      label: 'Beranda',
      icon: Home,
      glowColor: 'from-emerald-500 to-teal-600',
    },
    {
      id: 'schedule',
      label: 'Jadwal',
      icon: CalendarDays,
      glowColor: 'from-indigo-500 to-blue-600',
    },
    {
      id: 'leaves',
      label: 'Izin',
      icon: FileText,
      badge: unreadLeavesCount,
      glowColor: 'from-amber-500 to-orange-600',
    },
    {
      id: 'chat',
      label: 'Chat',
      icon: MessageSquare,
      glowColor: 'from-sky-500 to-cyan-600',
    },
    {
      id: 'account',
      label: 'Akun',
      icon: UserCircle,
      glowColor: 'from-purple-500 to-pink-600',
    },
  ];

  return (
    <nav
      aria-label="Navigasi Bawah Orang Tua"
      className="lg:hidden fixed bottom-3 inset-x-3 z-40 max-w-md mx-auto pointer-events-auto"
    >
      <div className="relative rounded-3xl p-1.5 bg-slate-900/90 backdrop-blur-2xl border border-white/20 shadow-[0_12px_40px_rgba(0,0,0,0.45)] ring-1 ring-black/10">
        <div className="flex items-center justify-around gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onTabChange(item.id)}
                className={`relative flex-1 flex flex-col items-center justify-center py-2 px-1 rounded-2xl transition-transform duration-100 touch-manipulation select-none active:scale-95 cursor-pointer min-h-[52px] group ${
                  isActive
                    ? 'bg-gradient-to-b from-white/15 to-white/5 text-white shadow-inner border border-white/25'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                {/* Active Indicator Glow */}
                {isActive && (
                  <span className="absolute -top-1 w-6 h-1 rounded-full bg-gradient-to-r from-emerald-400 via-teal-300 to-indigo-400 shadow-[0_0_12px_rgba(52,211,153,0.8)] animate-pulse" />
                )}

                {/* Icon Wrapper */}
                <div className="relative">
                  <div
                    className={`p-1.5 rounded-xl transition-all duration-150 ${
                      isActive
                        ? `bg-gradient-to-tr ${item.glowColor} text-white shadow-md shadow-emerald-500/20 scale-105`
                        : 'text-slate-400 group-hover:text-slate-200'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>

                  {/* Badge */}
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] px-1 bg-rose-500 text-white text-[9px] font-extrabold rounded-full flex items-center justify-center border-2 border-slate-900 shadow-sm animate-pulse">
                      {item.badge}
                    </span>
                  )}
                </div>

                {/* Label */}
                <span
                  className={`text-[10px] mt-1 font-semibold tracking-tight transition-colors ${
                    isActive
                      ? 'text-white font-extrabold'
                      : 'text-slate-400 group-hover:text-slate-200'
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
});
