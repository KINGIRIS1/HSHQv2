import React, { useState } from 'react';
import { User, UserRole } from '../../types';
import { 
  LayoutDashboard, 
  FileText, 
  MessageSquare, 
  Settings, 
  LogOut, 
  Bell,
  Menu,
  Search,
  Plus,
  ScanBarcode,
  ChevronDown,
  User as UserIcon,
  CalendarDays,
  BarChart3
} from 'lucide-react';

interface MobileLayoutProps {
  currentUser: User;
  currentView: string;
  setCurrentView: (view: string) => void;
  onLogout: () => void;
  children: React.ReactNode;
  unreadMessages: number;
  activeRemindersCount: number;
}

const MobileLayout: React.FC<MobileLayoutProps> = ({
  currentUser,
  currentView,
  setCurrentView,
  onLogout,
  children,
  unreadMessages,
  activeRemindersCount
}) => {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const navItems = [
    { id: 'dashboard', label: 'Tổng quan', icon: LayoutDashboard },
    { id: 'all_records', label: 'Tìm kiếm', icon: Search },
  ];

  // Tab Lịch công tác
  navItems.push({ id: 'work_schedule', label: 'Lịch công tác', icon: CalendarDays });

  // Tab Báo cáo: cho các tài khoản được phân quyền (!isOneDoor)
  if (currentUser.role !== UserRole.ONEDOOR) {
    navItems.push({ id: 'reports', label: 'Báo cáo', icon: BarChart3 });
  }

  navItems.push({ id: 'personal_profile', label: 'Cá nhân', icon: UserIcon });

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden">
      {/* Top Header */}
      <header className="bg-blue-700 text-white px-4 py-3 flex justify-between items-center shadow-md shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
            <FileText size={18} />
          </div>
          <h1 className="font-bold text-lg tracking-tight">QLHS Mobile</h1>
        </div>
        <div className="flex items-center gap-3">
          <button className="relative p-1.5 hover:bg-white/10 rounded-full transition-colors">
            <Bell size={20} />
            {activeRemindersCount > 0 && (
              <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-[10px] flex items-center justify-center rounded-full border-2 border-blue-700">
                {activeRemindersCount}
              </span>
            )}
          </button>
          
          <div className="relative">
            <button 
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center gap-1 hover:bg-white/10 p-1 rounded-lg transition-colors outline-none cursor-pointer"
            >
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center font-bold border border-white/30 text-white shadow-sm">
                {currentUser.name.charAt(0)}
              </div>
              <ChevronDown size={14} className={`text-blue-200 transition-transform duration-200 ${isUserMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {isUserMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsUserMenuOpen(false)}></div>
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200 origin-top-right text-slate-800">
                  <div className="p-3 border-b border-slate-100 bg-slate-50/50">
                    <p className="text-xs font-bold text-slate-800 truncate">{currentUser.name}</p>
                    <div className="mt-1 text-[9px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded inline-block border border-blue-100">
                      {currentUser.role === UserRole.ADMIN ? 'Admin' : currentUser.role === UserRole.SUBADMIN ? 'Phó quản trị' : currentUser.role === UserRole.TEAM_LEADER ? 'Nhóm trưởng' : currentUser.role === UserRole.ONEDOOR ? 'Một cửa' : 'Nhân viên'}
                    </div>
                  </div>
                  <div className="p-1.5 space-y-0.5">
                    <button 
                      onClick={() => {
                        setCurrentView('account_settings');
                        setIsUserMenuOpen(false);
                      }}
                      className="w-full text-left px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700 rounded-lg flex items-center gap-2.5 transition-colors group"
                    >
                      <div className="bg-slate-100 p-1 rounded-md group-hover:bg-blue-100 transition-colors text-slate-500 group-hover:text-blue-600">
                        <Settings size={14} />
                      </div>
                      Cài đặt & Tài khoản
                    </button>
                    <div className="h-px bg-slate-100 my-1 mx-1.5"></div>
                    <button 
                      onClick={() => {
                        onLogout();
                        setIsUserMenuOpen(false);
                      }}
                      className="w-full text-left px-2.5 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-2.5 transition-colors group"
                    >
                      <div className="bg-red-50 p-1 rounded-md group-hover:bg-red-100 transition-colors text-red-500 group-hover:text-red-600">
                        <LogOut size={14} />
                      </div>
                      Đăng xuất
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto pb-20">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around items-center h-16 px-2 shadow-[0_-4px_10px_rgba(0,0,0,0.05)] z-50">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id || (item.id === 'all_records' && ['received_list', 'assigned_list', 'in_progress_list', 'completed_list', 'pending_sign_list', 'signed_list', 'handover_list', 'returned_list'].includes(currentView));
          
          return (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id)}
              className={`flex flex-col items-center justify-center gap-1 flex-1 h-full transition-all ${
                isActive ? 'text-blue-600' : 'text-slate-400'
              }`}
            >
              <div className="relative">
                <Icon size={22} className={isActive ? 'scale-110' : ''} />
              </div>
              <span className={`text-[10px] font-medium ${isActive ? 'text-blue-600' : 'text-slate-500'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
      
      {/* Floating Action Button for quick record creation (if admin/subadmin) */}
      {(currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.SUBADMIN) && currentView === 'all_records' && (
        <button 
          className="fixed bottom-20 right-4 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-blue-700 active:scale-95 transition-all z-40"
          onClick={() => {/* Trigger add record modal */}}
        >
          <Plus size={28} />
        </button>
      )}
    </div>
  );
};

export default MobileLayout;
