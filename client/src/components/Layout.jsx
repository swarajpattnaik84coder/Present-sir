import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  CalendarCheck,
  Upload,
  Bot,
  CheckCircle2,
  LogOut,
  Menu,
  X,
  GraduationCap,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/today', label: 'Today', icon: CalendarCheck },
  { to: '/import', label: 'Import', icon: Upload, badge: 'Soon' },
  { to: '/agents', label: 'Agents', icon: Bot, badge: 'Soon' },
  { to: '/approvals', label: 'Approvals', icon: CheckCircle2, badge: 'Soon' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const sectionLabel = [
    user?.department,
    user?.semester ? `Sem ${user.semester}` : null,
    user?.section ? `Sec ${user.section}` : null,
  ]
    .filter(Boolean)
    .join(' • ');

  return (
    <div className="min-h-screen bg-[#0B0C10] text-white flex flex-col md:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-[#121418] border-r border-[#1F242D]">
        <div className="flex items-center gap-3 px-6 h-16 border-b border-[#1F242D]">
          <div className="w-8 h-8 rounded-lg bg-[#1E6BFF] flex items-center justify-center shadow-lg shadow-[#1E6BFF]/25">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="font-bold text-lg tracking-tight text-white">
              Present <span className="text-[#1E6BFF]">Sir</span>
            </span>
          </div>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-[#1E6BFF]/15 text-[#1E6BFF] border border-[#1E6BFF]/30'
                      : 'text-[#9CA3AF] hover:text-white hover:bg-white/5 border border-transparent'
                  }`
                }
              >
                <span className="flex items-center gap-3">
                  <Icon className="w-4 h-4" />
                  {item.label}
                </span>
                {item.badge && (
                  <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#1F242D] text-[#9CA3AF]">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4 border-t border-[#1F242D] space-y-3">
          <div className="px-2">
            <p className="text-sm font-semibold text-white truncate">
              {user?.name || 'Student'}
            </p>
            <p className="text-xs text-[#9CA3AF] truncate">
              {sectionLabel || user?.email || 'No section set'}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-[#9CA3AF] hover:text-white bg-[#0B0C10] hover:bg-white/5 border border-[#1F242D] transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            Logout
          </button>
        </div>
      </aside>

      {/* Mobile Top Bar */}
      <header className="md:hidden sticky top-0 z-30 bg-[#121418] border-b border-[#1F242D]">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#1E6BFF] flex items-center justify-center">
              <GraduationCap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-base tracking-tight">
              Present <span className="text-[#1E6BFF]">Sir</span>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-[#9CA3AF] hidden sm:inline">
              {user?.name}
            </span>
            <button
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="p-2 rounded-lg text-[#9CA3AF] hover:text-white hover:bg-white/5 border border-[#1F242D]"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Navigation */}
        {mobileMenuOpen && (
          <div className="px-3 pb-4 pt-2 border-t border-[#1F242D] space-y-1 bg-[#121418]">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium ${
                      isActive
                        ? 'bg-[#1E6BFF]/15 text-[#1E6BFF] border border-[#1E6BFF]/30'
                        : 'text-[#9CA3AF] hover:text-white hover:bg-white/5'
                    }`
                  }
                >
                  <span className="flex items-center gap-3">
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </span>
                  {item.badge && (
                    <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-[#1F242D] text-[#9CA3AF]">
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              );
            })}

            <div className="pt-3 mt-2 border-t border-[#1F242D] flex items-center justify-between px-2">
              <div>
                <p className="text-sm font-medium text-white">{user?.name}</p>
                <p className="text-xs text-[#9CA3AF]">{sectionLabel || user?.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#9CA3AF] hover:text-white border border-[#1F242D] bg-[#0B0C10]"
              >
                <LogOut className="w-3.5 h-3.5" />
                Logout
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 md:pl-64">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
