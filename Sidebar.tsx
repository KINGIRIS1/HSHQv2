
import React from 'react';
import { LayoutDashboard, FileText, ClipboardList, Send, BarChart3, Settings, LogOut, UserCircle, Users, Briefcase, BookOpen, UserPlus, ShieldAlert, X, FolderInput, FileSignature, MessageSquare, Loader2, UserCog, ShieldCheck, PenTool, CalendarDays, Archive, FolderArchive, ScanBarcode } from 'lucide-react';
import { User, UserRole } from './types';
import { APP_VERSION } from './constants';

interface SidebarProps {
  currentView: string;
  setCurrentView: (view: string) => void;
  onOpenSettings: () => void; // Deprecated
  onOpenSystemSettings: () => void;
  currentUser: User;
  onLogout: () => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  isGeneratingReport?: boolean;
  onOpenAccountSettings: () => void;
  unreadMessagesCount: number;
  warningRecordsCount: number;
  reminderCount: number;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  currentView, 
  setCurrentView, 
  onOpenSettings, 
  onOpenSystemSettings, 
  currentUser, 
  onLogout,
  mobileOpen,
  setMobileOpen,
  isGeneratingReport = false,
  onOpenAccountSettings,
  unreadMessagesCount,
  warningRecordsCount,
  reminderCount
}) => {
  const isAdmin = currentUser.role === UserRole.ADMIN;
  const isSubadmin = currentUser.role === UserRole.SUBADMIN;
  const isTeamLeader = currentUser.role === UserRole.TEAM_LEADER;
  const isOneDoor = currentUser.role === UserRole.ONEDOOR;
  const isEmployee = currentUser.role === UserRole.EMPLOYEE;
  const hasManagerRights = isAdmin || isSubadmin || isTeamLeader;

  // Cập nhật danh sách các view được phép (bỏ assign_tasks vì nó giờ là con của all_records)
  const oneDoorAllowedViews = ['dashboard', 'internal_chat', 'receive_record', 'receive_contract', 'all_records', 'personal_profile', 'account_settings', 'utilities', 'handover_list', 'work_schedule', 'archive_records', 'barcode_generator'];
  const teamLeaderAllowedViews = ['dashboard', 'personal_profile', 'all_records', 'excerpt_management', 'reports', 'account_settings', 'internal_chat', 'utilities', 'work_schedule', 'archive_records', 'barcode_generator'];

  const menuItems = [
    { id: 'dashboard', label: 'Tổng quan', icon: LayoutDashboard, visible: true, badge: reminderCount, badgeColor: 'bg-pink-500' },
    { id: 'internal_chat', label: 'Chat nội bộ', icon: MessageSquare, visible: true, badge: unreadMessagesCount, badgeColor: 'bg-blue-500' },
    { id: 'work_schedule', label: 'Lịch công tác', icon: CalendarDays, visible: true }, 
    { id: 'personal_profile', label: 'Hồ sơ cá nhân', icon: Briefcase, visible: true }, 
    { id: 'receive_record', label: 'Tiếp nhận hồ sơ', icon: FolderInput, visible: !isTeamLeader && !isEmployee },
    { id: 'receive_contract', label: 'Tiếp nhận hợp đồng', icon: FileSignature, visible: !isTeamLeader && !isEmployee },
    // Đổi tên thành "Hồ sơ đo đạc"
    { id: 'all_records', label: 'Hồ sơ đo đạc', icon: FileText, visible: true, badge: !isOneDoor ? warningRecordsCount : 0, badgeColor: 'bg-red-600' },
    // Đã xóa menu "Giao hồ sơ" (assign_tasks) để đưa vào làm tab con của "Hồ sơ đo đạc"
    { id: 'archive_records', label: 'Hồ sơ lưu trữ', icon: FolderArchive, visible: true },
    { id: 'excerpt_management', label: 'Số trích lục', icon: BookOpen, visible: false },
    { id: 'barcode_generator', label: 'Tạo mã vạch', icon: ScanBarcode, visible: true },
    { id: 'utilities', label: 'Tiện ích', icon: PenTool, visible: true },
    { id: 'check_list', label: 'DS Ký kiểm tra', icon: ClipboardList, visible: isAdmin || isSubadmin },
    { id: 'handover_list', label: 'DS Giao 1 cửa', icon: Send, visible: isAdmin || isSubadmin || isOneDoor },
    { id: 'reports', label: 'Báo cáo & Thống kê', icon: BarChart3, visible: !isOneDoor },
    { id: 'account_settings', label: 'Cài đặt tài khoản', icon: UserCog, visible: true },
  ];

  const handleMenuClick = (viewId: string) => {
    setCurrentView(viewId);
    setMobileOpen(false); // Luôn đóng sidebar khi click trên mobile
  };

  return (
    <>
      {/* Mobile Overlay */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div className={`
        fixed md:static inset-y-0 left-0 z-50 w-64 shrink-0 bg-[#0f172a] text-white min-h-screen flex flex-col shadow-xl transition-transform duration-300 ease-in-out
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* BRAND HEADER */}
        <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex flex-col gap-3 shrink-0">
          <div className="flex items-start gap-3">
             <div className="bg-blue-600 p-1.5 rounded-lg shadow-blue-500/20 shrink-0 mt-1">
                <ShieldCheck size={20} className="text-white" />
             </div>
             <div className="flex-1">
                 <h1 className="font-bold text-sm text-slate-100 leading-snug">
                    Hệ thống tiếp nhận và quản lý hồ sơ đo đạc
                 </h1>
                 <div className="text-[11px] text-blue-400 font-medium mt-1">
                    Chi nhánh Hớn Quản
                 </div>
             </div>
             <button onClick={() => setMobileOpen(false)} className="md:hidden text-slate-400 hover:text-white"><X size={20} /></button>
          </div>
        </div>

        {/* USER INFO */}
        <div className="px-4 py-4 border-b border-slate-800 bg-[#1e293b]/50 shrink-0">
          <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-blue-300 ring-2 ring-slate-600">
                  <UserCircle size={24} />
              </div>
              <div className="overflow-hidden flex-1">
                  <p className="text-sm font-bold truncate max-w-[120px] text-slate-200">{currentUser.name}</p>
                  <p className="text-[10px] text-slate-400 flex items-center gap-1 uppercase font-semibold tracking-wider">
                      {currentUser.role === UserRole.ADMIN ? 'Administrator' : currentUser.role === UserRole.SUBADMIN ? 'Phó quản trị' : currentUser.role === UserRole.TEAM_LEADER ? 'Nhóm trưởng' : currentUser.role === UserRole.ONEDOOR ? 'Một cửa' : 'Nhân viên'}
                  </p>
              </div>
          </div>
        </div>

        {/* MENU */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto custom-scrollbar">
          {menuItems.filter(item => {
             if (isOneDoor && !oneDoorAllowedViews.includes(item.id)) return false;
             if (isTeamLeader && !teamLeaderAllowedViews.includes(item.id)) return false;
             return item.visible;
          }).map((item) => {
            // Logic Active: Sáng khi ID trùng khớp HOẶC (đang ở tab con 'assign_tasks' thì sáng tab cha 'all_records')
            const isActive = currentView === item.id || (item.id === 'all_records' && currentView === 'assign_tasks');
            
            return (
              <button
                key={item.id}
                onClick={() => handleMenuClick(item.id)}
                className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg transition-all duration-200 group relative ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-900/20 font-semibold'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white font-medium'
                }`}
              >
                <div className="flex items-center gap-3">
                  <item.icon size={18} className={isActive ? 'text-white' : 'text-slate-500 group-hover:text-white transition-colors'} />
                  <span className="text-sm">{item.label}</span>
                </div>
                
                <div className="flex items-center gap-2">
                    {item.id === 'reports' && isGeneratingReport && (
                      <Loader2 size={14} className="animate-spin text-amber-400" />
                    )}
                    {item.badge !== undefined && item.badge > 0 && (
                        <span className={`min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full text-[10px] font-bold text-white shadow-sm animate-pulse ${item.badgeColor || 'bg-red-500'}`}>
                            {item.badge > 99 ? '99+' : item.badge}
                        </span>
                    )}
                </div>
              </button>
            );
          })}
          
          {!isTeamLeader && !isEmployee && (isAdmin || isSubadmin) && (
            <div className="pt-4 mt-4 border-t border-slate-800 space-y-1">
              <div className="px-4 text-[10px] font-bold text-slate-600 uppercase mb-2 tracking-widest">Quản trị hệ thống</div>
              {isAdmin && (
                  <button onClick={() => handleMenuClick('user_management')} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 group ${currentView === 'user_management' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-white'} `}>
                    <Users size={18} className={currentView === 'user_management' ? 'text-white' : 'text-slate-500 group-hover:text-white'} />
                    <span className="font-medium text-sm">Tài khoản</span>
                  </button>
              )}
              <button onClick={() => handleMenuClick('employee_management')} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 group ${currentView === 'employee_management' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-white'} `}>
                <Settings size={18} className={currentView === 'employee_management' ? 'text-white' : 'text-slate-500 group-hover:text-white'} />
                <span className="font-medium text-sm">Nhân sự</span>
              </button>
              {isAdmin && (
                <button onClick={() => { onOpenSystemSettings(); setMobileOpen(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors duration-200 group">
                  <ShieldAlert size={18} className="text-slate-500 group-hover:text-red-400" />
                  <span className="font-medium text-sm group-hover:text-red-400">Cấu hình</span>
                </button>
              )}
            </div>
          )}
        </nav>

        <div className="p-4 border-t border-slate-800 bg-[#0f172a] shrink-0">
          <button onClick={onLogout} className="w-full flex items-center justify-center gap-2 text-red-400 hover:text-white hover:bg-red-600/80 px-4 py-2.5 rounded-lg transition-all text-sm font-bold shadow-sm">
              <LogOut size={16} /> Đăng xuất
          </button>
          <div className="mt-3 text-[10px] text-slate-600 text-center flex flex-col items-center gap-1 font-mono">
              <span>v{APP_VERSION}</span>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
