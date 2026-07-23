
import React from 'react';
import { LayoutDashboard, FileText, ClipboardList, Send, BarChart3, Settings, LogOut, UserCircle, Users, Briefcase, BookOpen, UserPlus, ShieldAlert, X, FolderInput, FileSignature, MessageSquare, Loader2, UserCog, ShieldCheck, PenTool, CalendarDays, Archive, FolderArchive } from 'lucide-react';
import { User, UserRole } from '../types';
import { APP_VERSION } from '../constants';

interface SidebarProps {
  currentView: string;
  setCurrentView: (view: string) => void;
  onOpenSettings: () => void; // Deprecated
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

  // Cập nhật danh sách các view được phép
  const oneDoorAllowedViews = ['dashboard', 'internal_chat', 'receive_record', 'receive_contract', 'all_records', 'registration_records', 'archive_records', 'congvan_records', 'personal_profile', 'account_settings', 'utilities', 'handover_list', 'work_schedule'];
  const teamLeaderAllowedViews = ['dashboard', 'personal_profile', 'all_records', 'registration_records', 'archive_records', 'congvan_records', 'excerpt_management', 'reports', 'account_settings', 'internal_chat', 'utilities', 'work_schedule'];

  const menuItems = [
    { id: 'dashboard', label: 'Tổng quan', icon: LayoutDashboard, visible: true, badge: reminderCount, badgeColor: 'bg-pink-500' },
    { id: 'internal_chat', label: 'Chat nội bộ', icon: MessageSquare, visible: true, badge: unreadMessagesCount, badgeColor: 'bg-blue-500' },
    { id: 'work_schedule', label: 'Lịch công tác', icon: CalendarDays, visible: true }, 
    { id: 'personal_profile', label: 'Hồ sơ cá nhân', icon: Briefcase, visible: true }, 
    { id: 'receive_record', label: 'Tiếp nhận hồ sơ', icon: FolderInput, visible: !isTeamLeader && !isEmployee },
    { id: 'receive_contract', label: 'Tiếp nhận hợp đồng', icon: FileSignature, visible: !isTeamLeader && !isEmployee },
    // Đổi tên thành "Hồ sơ đo đạc"
    { id: 'all_records', label: 'Hồ sơ đo đạc', icon: FileText, visible: true, badge: !isOneDoor ? warningRecordsCount : 0, badgeColor: 'bg-red-600' },
    { id: 'registration_records', label: 'Hồ sơ đăng ký', icon: FileSignature, visible: true },
    { id: 'archive_records', label: 'Hồ sơ lưu trữ', icon: FolderArchive, visible: true },
    { id: 'congvan_records', label: 'Công văn', icon: Send, visible: false },
    { id: 'excerpt_management', label: 'Số TL/TĐ', icon: BookOpen, visible: false },
    { id: 'utilities', label: 'Tiện ích', icon: PenTool, visible: true },
    // Đã xóa menu "DS Ký kiểm tra" và "DS Giao 1 cửa" để đưa vào làm tab con của "Hồ sơ đo đạc"
    { id: 'reports', label: 'Báo cáo & Thống kê', icon: BarChart3, visible: !isOneDoor },
    { id: 'account_settings', label: 'Cài đặt tài khoản', icon: UserCog, visible: true },
  ];

  const handleMenuClick = (viewId: string) => {
    setCurrentView(viewId);
    setMobileOpen(false); // Luôn đóng sidebar khi click trên mobile
  };

  const [hoveredItem, setHoveredItem] = React.useState<{ 
    top: number; 
    label: string; 
    badge?: number; 
    badgeColor?: string;
    subItems?: { label: string; icon: React.ElementType; onClick: () => void; active?: boolean }[]
  } | null>(null);

  const hoverTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);

  const handleMouseEnter = (e: React.MouseEvent, label: string, badge?: number, badgeColor?: string, subItems?: any[]) => {
    if (mobileOpen) return;
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    
    const rect = e.currentTarget.getBoundingClientRect();
    setHoveredItem({
      top: rect.top,
      label,
      badge,
      badgeColor,
      subItems
    });
  };

  const handleMouseLeave = () => {
    if (mobileOpen) return;
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredItem(null);
    }, 100);
  };

  const handleTooltipEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
  };

  const settingsSubItems = [
    ...(isAdmin ? [{
      label: 'Tài khoản',
      icon: Users,
      onClick: () => handleMenuClick('user_management'),
      active: currentView === 'user_management'
    }] : []),
    {
      label: 'Nhân sự',
      icon: UserCog,
      onClick: () => handleMenuClick('employee_management'),
      active: currentView === 'employee_management'
    },
    ...(isAdmin ? [{
      label: 'Cấu hình',
      icon: ShieldAlert,
      onClick: () => handleMenuClick('system_settings'),
      active: currentView === 'system_settings'
    }] : [])
  ];

  const isSettingsActive = currentView === 'user_management' || currentView === 'employee_management' || currentView === 'system_settings';

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
        fixed md:static inset-y-0 left-0 z-50 
        w-64 md:w-20 
        shrink-0 bg-[#0f172a] text-white min-h-screen flex flex-col shadow-xl 
        transition-all duration-300 ease-in-out overflow-visible
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* BRAND HEADER */}
        <div className="h-14 flex items-center justify-center border-b border-slate-800 bg-slate-900/50 shrink-0 relative group">
             <div className="bg-blue-600 p-2 rounded-lg shadow-blue-500/20 shrink-0 cursor-pointer">
                <ShieldCheck size={20} className="text-white" />
             </div>
             {/* Hover Tooltip for Brand */}
             <div className="absolute left-full top-2 ml-2 bg-slate-800 text-white px-3 py-2 rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50 border border-slate-700">
                 <h1 className="font-bold text-sm">Hệ thống quản lý</h1>
                 <div className="text-[10px] text-blue-400">Chi nhánh Hớn Quản</div>
             </div>
             <button onClick={() => setMobileOpen(false)} className="md:hidden absolute right-4 text-slate-400 hover:text-white"><X size={20} /></button>
        </div>

        {/* USER INFO */}
        <div className="h-14 flex items-center justify-center border-b border-slate-800 bg-[#1e293b]/50 shrink-0 relative group">
              <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center text-blue-300 ring-2 ring-slate-600 shrink-0 cursor-pointer">
                  <UserCircle size={20} />
              </div>
              {/* Hover Tooltip for User */}
              <div className="absolute left-full top-2 ml-2 bg-slate-800 text-white px-3 py-2 rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50 border border-slate-700">
                  <p className="text-sm font-bold">{currentUser.name}</p>
                  <p className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider">
                      {currentUser.role === UserRole.ADMIN ? 'Administrator' : currentUser.role === UserRole.SUBADMIN ? 'Phó quản trị' : currentUser.role === UserRole.TEAM_LEADER ? 'Nhóm trưởng' : currentUser.role === UserRole.ONEDOOR ? 'Một cửa' : 'Nhân viên'}
                  </p>
              </div>
        </div>

        {/* MENU */}
        <nav className="flex-1 py-2 space-y-1 overflow-y-auto custom-scrollbar overflow-x-visible">
          {menuItems.filter(item => {
             if (isOneDoor && !oneDoorAllowedViews.includes(item.id)) return false;
             if (isTeamLeader && !teamLeaderAllowedViews.includes(item.id)) return false;
             return item.visible;
          }).map((item) => {
            // Logic Active
            const isActive = currentView === item.id || 
                             (item.id === 'all_records' && ['assign_tasks', 'check_list', 'handover_list'].includes(currentView));
            
            return (
              <button
                key={item.id}
                onClick={() => handleMenuClick(item.id)}
                onMouseEnter={(e) => handleMouseEnter(e, item.label, item.badge, item.badgeColor)}
                onMouseLeave={handleMouseLeave}
                className="group relative w-full h-9 flex items-center justify-center"
              >
                 {/* Button Background */}
                 <div className={`
                    absolute left-1/2 -translate-x-1/2 md:left-5 md:translate-x-0
                    h-8 rounded-lg transition-all duration-200 ease-out
                    flex items-center overflow-hidden shadow-sm
                    ${isActive ? 'bg-blue-600' : 'group-hover:bg-slate-700'}
                    ${mobileOpen ? 'w-[90%] left-1/2' : 'w-10'}
                    z-10
                 `}>
                    {/* Spacer/Icon Container */}
                    <div className="min-w-[40px] h-full shrink-0"></div>

                    {/* Text Label (Only visible on Mobile) */}
                    <div className={`flex-1 flex items-center justify-between pr-3 overflow-hidden ${mobileOpen ? 'opacity-100' : 'hidden'}`}>
                        <span className="text-sm font-medium text-white whitespace-nowrap pl-2">
                          {item.label}
                        </span>

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
                    </div>
                 </div>

                 {/* Icon */}
                 <item.icon size={18} className={`z-20 relative pointer-events-none ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-white transition-colors'}`} />
                 
                 {/* Badge dot for collapsed state */}
                 {!mobileOpen && item.badge !== undefined && item.badge > 0 && (
                    <div className="absolute top-2 right-5 w-1.5 h-1.5 rounded-full bg-red-500 z-30 pointer-events-none"></div>
                 )}
              </button>
            );
          })}
          
          {!isTeamLeader && !isEmployee && (isAdmin || isSubadmin) && (
            <div className="pt-2 mt-2 border-t border-slate-800 space-y-1">
              <div className="text-[10px] font-bold text-slate-600 uppercase text-center mb-1">SYS</div>
              
              {/* Settings Group Button */}
              <div className="relative">
                <button 
                  onClick={() => mobileOpen ? setIsSettingsOpen(!isSettingsOpen) : undefined}
                  onMouseEnter={(e) => handleMouseEnter(e, 'Cài đặt', undefined, undefined, settingsSubItems)}
                  onMouseLeave={handleMouseLeave}
                  className="group relative w-full h-9 flex items-center justify-center"
                >
                  <div className={`absolute left-1/2 -translate-x-1/2 md:left-5 md:translate-x-0 h-8 rounded-lg transition-all duration-200 ease-out flex items-center overflow-hidden shadow-sm ${isSettingsActive ? 'bg-blue-600' : 'group-hover:bg-slate-700'} ${mobileOpen ? 'w-[90%] left-1/2' : 'w-10'} z-10`}>
                      <div className="min-w-[40px] h-full shrink-0"></div>
                      <span className={`text-sm font-medium text-white whitespace-nowrap pl-2 ${mobileOpen ? 'opacity-100' : 'hidden'}`}>Cài đặt</span>
                  </div>
                  <Settings size={18} className={`z-20 relative pointer-events-none ${isSettingsActive ? 'text-white' : 'text-slate-500 group-hover:text-white'}`} />
                </button>

                {/* Mobile Accordion */}
                {mobileOpen && isSettingsOpen && (
                  <div className="bg-slate-900/50 mt-1 py-1 space-y-1">
                    {settingsSubItems.map((sub, idx) => (
                      <button
                        key={idx}
                        onClick={sub.onClick}
                        className={`w-full flex items-center gap-3 px-8 py-2 text-sm ${sub.active ? 'text-blue-400 font-medium' : 'text-slate-400 hover:text-white'}`}
                      >
                        <sub.icon size={16} />
                        <span>{sub.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </nav>

        <div className="p-2 border-t border-slate-800 bg-[#0f172a] shrink-0 flex justify-center">
          <button 
            onClick={onLogout} 
            onMouseEnter={(e) => handleMouseEnter(e, 'Đăng xuất')}
            onMouseLeave={handleMouseLeave}
            className="group relative w-full h-9 flex items-center justify-center"
          >
               <div className={`absolute left-1/2 -translate-x-1/2 md:left-1 md:translate-x-0 h-8 rounded-lg transition-all duration-200 ease-out flex items-center overflow-hidden shadow-sm group-hover:bg-red-600/90 ${mobileOpen ? 'w-full' : 'w-10'} z-10`}>
                    <div className="min-w-[40px] h-full shrink-0"></div>
                    <span className={`text-sm font-bold text-white whitespace-nowrap pl-2 ${mobileOpen ? 'opacity-100' : 'hidden'}`}>Đăng xuất</span>
               </div>
              <LogOut size={18} className="z-20 relative pointer-events-none text-red-400 group-hover:text-white" />
          </button>
        </div>
      </div>

      {/* Floating Tooltip / Flyout Menu */}
      {hoveredItem && !mobileOpen && (
        <div 
            className={`fixed left-20 z-[60] bg-slate-800 text-white rounded-r-lg shadow-xl animate-in fade-in slide-in-from-left-1 duration-150 border-y border-r border-slate-700/50 ${hoveredItem.subItems ? 'pointer-events-auto' : 'pointer-events-none'}`}
            style={{ top: hoveredItem.top, minHeight: '36px' }}
            onMouseEnter={handleTooltipEnter}
            onMouseLeave={handleMouseLeave}
        >
            {hoveredItem.subItems ? (
                <div className="flex flex-col py-1 min-w-[160px]">
                    <div className="px-3 py-2 text-xs font-bold text-slate-400 uppercase border-b border-slate-700/50 mb-1 tracking-wider">{hoveredItem.label}</div>
                    {hoveredItem.subItems.map((sub, idx) => (
                        <button 
                            key={idx}
                            onClick={(e) => {
                                e.stopPropagation();
                                sub.onClick();
                                setHoveredItem(null);
                            }}
                            className={`flex items-center gap-3 px-3 py-2 text-sm hover:bg-slate-700/80 transition-colors text-left ${sub.active ? 'text-blue-400 font-medium bg-slate-700/30' : 'text-slate-300'}`}
                        >
                            <sub.icon size={16} className={sub.active ? 'text-blue-400' : 'text-slate-500'} />
                            <span>{sub.label}</span>
                        </button>
                    ))}
                </div>
            ) : (
                <div className="flex items-center gap-3 px-4 h-9">
                    <span className="text-sm font-medium whitespace-nowrap">{hoveredItem.label}</span>
                    {hoveredItem.badge !== undefined && hoveredItem.badge > 0 && (
                        <span className={`min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full text-[10px] font-bold text-white shadow-sm ${hoveredItem.badgeColor || 'bg-red-500'}`}>
                            {hoveredItem.badge > 99 ? '99+' : hoveredItem.badge}
                        </span>
                    )}
                </div>
            )}
        </div>
      )}
    </>
  );
};

export default Sidebar;
