import React, { useState } from 'react';
import { User, UserRole, RecordFile } from '../../types';
import { NotificationBell } from '../NotificationBell';
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
  BarChart3,
  HelpCircle,
  Shield,
  Headphones,
  X,
  Phone,
  Mail,
  Clock,
  UserCheck,
  CheckCircle2
} from 'lucide-react';
import AdminBackupWarningBanner from '../AdminBackupWarningBanner';

interface MobileLayoutProps {
  currentUser: User;
  currentView: string;
  setCurrentView: (view: string) => void;
  onLogout: () => void;
  children: React.ReactNode;
  unreadMessages: number;
  activeRemindersCount: number;
  onOpenRecordModal?: () => void;
  records?: RecordFile[];
  onViewRecord?: (record: RecordFile) => void;
  onClearReminder?: (recordId: string) => void;
  onClearAllReminders?: () => void;
}

const MobileLayout: React.FC<MobileLayoutProps> = ({
  currentUser,
  currentView,
  setCurrentView,
  onLogout,
  children,
  unreadMessages,
  activeRemindersCount,
  onOpenRecordModal,
  records = [],
  onViewRecord,
  onClearReminder,
  onClearAllReminders
}) => {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const navItems = [
    { id: 'dashboard', label: 'Tổng quan', icon: LayoutDashboard },
    { id: 'all_records', label: 'Tìm kiếm', icon: Search },
  ];

  // Tab Lịch công tác
  navItems.push({ id: 'work_schedule', label: 'Lịch công tác', icon: CalendarDays });

  // Tab Báo cáo: Ẩn hoàn toàn trên bản mobile theo yêu cầu của người dùng

  navItems.push({ id: 'personal_profile', label: 'Cá nhân', icon: UserIcon });

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden">
      {/* Top Header */}
      <header className="bg-blue-700 text-white px-3 py-2 sm:px-6 flex justify-between items-center shadow-md shrink-0 z-30 pt-[calc(0.5rem+env(safe-area-inset-top,0px))]">
        <div className="max-w-7xl mx-auto w-full flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-white p-0.5 flex items-center justify-center shrink-0 border border-white/30 shadow-xs">
              <img src="./icon.png?v=4" alt="Logo" className="w-full h-full object-contain rounded-full" />
            </div>
            <h1 className="font-bold text-base sm:text-lg tracking-tight truncate">QLHS Mobile</h1>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <NotificationBell 
              records={records}
              currentUser={currentUser}
              onViewRecord={(r) => {
                if (onViewRecord) {
                  onViewRecord(r);
                }
              }}
              onClearReminder={(id) => {
                if (onClearReminder) {
                  onClearReminder(id);
                }
              }}
              onClearAllReminders={onClearAllReminders}
            />
            
            <div className="relative">
              <button 
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="min-h-[44px] flex items-center gap-1.5 hover:bg-white/10 px-2 py-1 rounded-xl transition-colors outline-none cursor-pointer"
              >
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center font-bold border border-white/30 text-white shadow-sm">
                  {currentUser.name.charAt(0)}
                </div>
                <ChevronDown size={14} className={`text-blue-200 transition-transform duration-200 ${isUserMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {isUserMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsUserMenuOpen(false)}></div>
                  <div className="absolute right-0 mt-2 w-60 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200 origin-top-right text-slate-800">
                    <div className="p-3.5 border-b border-slate-100 bg-slate-50/50">
                      <p className="text-xs font-bold text-slate-800 truncate">{currentUser.name}</p>
                      <div className="mt-1 text-[9px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded inline-block border border-blue-100">
                        {currentUser.role === UserRole.ADMIN ? 'Admin' : currentUser.role === UserRole.SUBADMIN ? 'Phó quản trị' : currentUser.role === UserRole.TEAM_LEADER ? 'Nhóm trưởng' : currentUser.role === UserRole.ONEDOOR ? 'Một cửa' : 'Nhân viên'}
                      </div>
                    </div>
                    <div className="p-1.5 space-y-1">
                      <button 
                        onClick={() => {
                          setCurrentView('account_settings');
                          setIsUserMenuOpen(false);
                        }}
                        className="w-full min-h-[44px] text-left px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700 rounded-xl flex items-center gap-2.5 transition-colors group cursor-pointer"
                      >
                        <div className="bg-slate-100 p-1.5 rounded-lg group-hover:bg-blue-100 transition-colors text-slate-500 group-hover:text-blue-600">
                          <Settings size={16} />
                        </div>
                        Cài đặt & Tài khoản
                      </button>
                      <div className="h-px bg-slate-100 my-1 mx-1.5"></div>
                      <button 
                        onClick={() => {
                          onLogout();
                          setIsUserMenuOpen(false);
                        }}
                        className="w-full min-h-[44px] text-left px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-xl flex items-center gap-2.5 transition-colors group cursor-pointer"
                      >
                        <div className="bg-red-50 p-1.5 rounded-lg group-hover:bg-red-100 transition-colors text-red-500 group-hover:text-red-600">
                          <LogOut size={16} />
                        </div>
                        Đăng xuất
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Admin Backup Warning Banner - Only for ADMIN if path not set */}
      <AdminBackupWarningBanner
        currentUser={currentUser}
        onOpenSettings={() => {
          setCurrentView('system_dashboard');
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('open_system_settings'));
            window.dispatchEvent(new CustomEvent('open_system_settings_tab', { detail: { tab: 'general' } }));
          }, 50);
        }}
      />

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))]">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-[0_-4px_10px_rgba(0,0,0,0.05)] z-40 pb-[env(safe-area-inset-bottom,0px)]">
        <div className="max-w-7xl mx-auto flex justify-around items-center h-16 px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id || (item.id === 'all_records' && ['received_list', 'assigned_list', 'in_progress_list', 'completed_list', 'pending_sign_list', 'signed_list', 'handover_list', 'returned_list'].includes(currentView));
            
            return (
              <button
                key={item.id}
                onClick={() => setCurrentView(item.id)}
                className={`flex flex-col items-center justify-center gap-1 flex-1 min-h-[44px] h-full transition-all cursor-pointer active:scale-95 ${
                  isActive ? 'text-blue-600 font-bold' : 'text-slate-400 font-medium'
                }`}
              >
                <div className="relative">
                  <Icon size={22} className={isActive ? 'scale-110 text-blue-600' : 'text-slate-400'} />
                </div>
                <span className={`text-[10px] sm:text-xs tracking-tight ${isActive ? 'text-blue-600' : 'text-slate-500'}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
      
      {/* Floating Action Button cho phép nhập mới nhanh ở tab tìm kiếm & danh sách hồ sơ */}
      {(currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.SUBADMIN || currentUser.role === UserRole.ONEDOOR || currentUser.role === UserRole.TEAM_LEADER) &&
        ['all_records', 'received_list', 'assigned_list', 'in_progress_list', 'completed_list', 'pending_sign_list', 'signed_list', 'handover_list', 'returned_list'].includes(currentView) && (
        <button 
          className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] right-4 min-w-[56px] min-h-[56px] w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg shadow-blue-500/40 flex items-center justify-center hover:bg-blue-700 active:scale-95 transition-all z-40 cursor-pointer"
          onClick={() => onOpenRecordModal?.()}
          title="Nhập mới hồ sơ"
        >
          <Plus size={28} />
        </button>
      )}
    </div>
  );
};

export default MobileLayout;
