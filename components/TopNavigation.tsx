import React, { useState, useRef, useEffect } from 'react';
import { LayoutDashboard, FileText, ClipboardList, Send, BarChart3, Settings, LogOut, UserCircle, Users, Briefcase, BookOpen, UserPlus, ShieldAlert, X, FolderInput, FileSignature, MessageSquare, Loader2, UserCog, ShieldCheck, PenTool, CalendarDays, Archive, FolderArchive, ChevronDown, Bell, FilePlus, Ruler, ChevronRight, User, Shield, Settings2, Layers } from 'lucide-react';
import { User as UserType, UserRole, RolePermissions, DepartmentPermissions, Employee, DEFAULT_ROLE_PERMISSIONS } from '../types';
import { matchDepartmentKey } from '../utils/appHelpers';
import { isViewAllowedForUser } from '../config/roleConfig';

interface TopNavigationProps {
  currentView: string;
  setCurrentView: (view: string) => void;
  currentUser: UserType;
  onLogout: () => void;
  isGeneratingReport?: boolean;
  onOpenAccountSettings: () => void;
  unreadMessagesCount: number;
  warningRecordsCount: number;
  reminderCount: number;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  rolePermissions: RolePermissions;
  departmentPermissions: DepartmentPermissions;
  employees: Employee[];
  connectionStatus: 'connected' | 'offline';
}

const TopNavigation: React.FC<TopNavigationProps> = ({ 
  currentView, 
  setCurrentView, 
  currentUser, 
  onLogout,
  isGeneratingReport = false,
  unreadMessagesCount,
  warningRecordsCount,
  reminderCount,
  mobileOpen,
  setMobileOpen,
  rolePermissions,
  departmentPermissions,
  employees,
  connectionStatus
}) => {
  const isAdmin = currentUser.role === UserRole.ADMIN;
  const isSubadmin = currentUser.role === UserRole.SUBADMIN;
  const isTeamLeader = currentUser.role === UserRole.TEAM_LEADER;
  const isOneDoor = currentUser.role === UserRole.ONEDOOR;
  const isEmployee = currentUser.role === UserRole.EMPLOYEE;

  const hasPermission = (permissionId: string) => {
    if (isAdmin || isSubadmin) return true;
    
    // Đối với vai trò Một cửa, luôn cho phép các quyền mặc định của Một cửa
    if (currentUser.role === UserRole.ONEDOOR) {
        const defaultOneDoor = DEFAULT_ROLE_PERMISSIONS[UserRole.ONEDOOR] || [];
        if (defaultOneDoor.includes(permissionId)) return true;
    }

    if (currentUser.employeeId && employees) {
        const emp = employees.find(e => e.id === currentUser.employeeId);
        if (emp && emp.department) {
            const compositeKey = `${emp.department}_${currentUser.role}`;
            if (departmentPermissions && departmentPermissions[compositeKey]) {
                const deptRolePerms = departmentPermissions[compositeKey] || [];
                return deptRolePerms.includes('*') || deptRolePerms.includes(permissionId);
            }

            const matchingKey = Object.keys(departmentPermissions || {}).find(k => matchDepartmentKey(k, emp.department));
            if (matchingKey && departmentPermissions[matchingKey]) {
                const deptPerms = departmentPermissions[matchingKey] || [];
                return deptPerms.includes('*') || deptPerms.includes(permissionId);
            }
        }
    }

    const rolePerms = (rolePermissions && rolePermissions[currentUser.role]) || DEFAULT_ROLE_PERMISSIONS[currentUser.role] || [];
    return rolePerms.includes('*') || rolePerms.includes(permissionId);
  };

  // Cập nhật danh sách các view được phép
  const oneDoorAllowedViews = ['dashboard', 'receive_record', 'receive_contract', 'all_records', 'registration_records', 'personal_profile', 'account_settings', 'utilities', 'handover_list', 'work_schedule', 'archive_records', 'receive_group', 'records_group', 'reports', 'tools_group'];
  const teamLeaderAllowedViews = ['dashboard', 'personal_profile', 'all_records', 'registration_records', 'excerpt_management', 'reports', 'account_settings', 'utilities', 'work_schedule', 'archive_records', 'records_group', 'tools_group'];

  // Define menu structure
  const menuItems = [
    { id: 'dashboard', label: 'Tổng quan', icon: LayoutDashboard, visible: true, badge: reminderCount, badgeColor: 'bg-pink-500' },
    
    // "Tiếp nhận" tab group
    {
      id: 'receive_group',
      label: 'Tiếp nhận',
      icon: FolderInput,
      visible: true,
      isDropdown: false,
      isTabGroup: true,
      subItems: [
        { id: 'receive_record', label: 'Hồ sơ', icon: FilePlus, visible: true },
        { id: 'receive_contract', label: 'Hợp đồng', icon: FileSignature, visible: true },
      ]
    },

    // "Hồ sơ" tab group
    { 
      id: 'records_group', 
      label: 'Hồ sơ', 
      icon: FileText, 
      visible: true,
      isDropdown: false,
      isTabGroup: true,
      subItems: [
        { id: 'all_records', label: 'Đo đạc', icon: Ruler, visible: true },
        { id: 'archive_records', label: 'Lưu trữ', icon: FolderArchive, visible: true },
      ]
    },

    // "Quản lý" tab group
    {
      id: 'management_group',
      label: 'Quản lý',
      icon: Briefcase,
      visible: true,
      isDropdown: false,
      isTabGroup: true,
      subItems: [
        { id: 'work_schedule', label: 'Lịch công tác', icon: CalendarDays, visible: true },
        { id: 'personal_profile', label: 'Hồ sơ cá nhân', icon: UserCircle, visible: true },
      ]
    },

    // "Công cụ" tab group
    {
      id: 'tools_group',
      label: 'Công cụ',
      icon: PenTool,
      visible: true,
      isDropdown: false,
      isTabGroup: true,
      subItems: [
        { id: 'excerpt_management', label: 'Số TL/TĐ', icon: BookOpen, visible: true },
        { id: 'utilities', label: 'Tiện ích', icon: PenTool, visible: true },
        { id: 'reports', label: 'Báo cáo', icon: BarChart3, visible: true },
      ]
    }
  ];

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['system_group']));

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) newSet.delete(groupId);
      else newSet.add(groupId);
      return newSet;
    });
  };

  const handleMenuClick = (viewId: string) => {
    setCurrentView(viewId);
    setMobileOpen(false);
  };

  return (
    <>
      {/* Mobile Overlay */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <div className={`
        fixed inset-y-0 left-0 z-40 w-[90px] bg-[#1e3a8a] text-white shadow-xl transform transition-transform duration-300 ease-in-out flex flex-col pt-14 md:pt-0
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
        md:relative md:translate-x-0
      `}>
        
        {/* NAVIGATION */}
        <nav className="flex-1 overflow-y-auto py-2 px-1 space-y-1 custom-scrollbar">
          {menuItems.map((item) => {
            // Kiểm tra quyền hiển thị menu (RBAC) cho item đơn lẻ
            if (!item.isDropdown && !(item as any).isTabGroup) {
              const isAllowed = isViewAllowedForUser(currentUser, employees || [], item.id, rolePermissions, departmentPermissions);
              if (!isAllowed) return null;
            }
            if (!item.visible) return null;

            // Check if any sub-item is active
            const isGroupActive = item.subItems?.some(sub => currentView === sub.id) || currentView === item.id;
            const isActive = currentView === item.id;

            // Render Tab Group (Section Header + Items)
            if ((item as any).isTabGroup) {
              // Check if group has visible & allowed items for current user
              const hasVisibleItems = item.subItems?.some(sub => {
                 const isAllowed = isViewAllowedForUser(currentUser, employees || [], sub.id, rolePermissions, departmentPermissions);
                 return sub.visible && isAllowed;
              });
              
              if (!hasVisibleItems) return null;

              return (
                <div key={item.id} className="mb-3 pb-3 border-b border-blue-500/30 last:border-0">
                  <div className="px-1 mb-2 text-[11px] font-extrabold text-blue-200 uppercase tracking-wider text-center flex flex-col items-center justify-center shadow-sm">
                    <span>{item.label}</span>
                  </div>
                  <div className="space-y-2">
                    {item.subItems?.map(sub => {
                       const isAllowed = isViewAllowedForUser(currentUser, employees || [], sub.id, rolePermissions, departmentPermissions);
                       if (!isAllowed) return null;
                       if (!sub.visible) return null;
    
                       const isSubActive = currentView === sub.id;
                       return (
                        <button
                          id={`nav-item-${sub.id}`}
                          key={sub.id}
                          onClick={() => handleMenuClick(sub.id)}
                          className={`
                            w-full flex flex-col items-center justify-center gap-1.5 p-2 rounded-xl transition-all relative group
                            ${isSubActive ? 'bg-white text-blue-900 shadow-lg ring-1 ring-blue-900/10 scale-105 z-10' : 'text-blue-100 hover:bg-white/10 hover:text-white hover:scale-105'}
                          `}
                          title={sub.label}
                        >
                          <sub.icon size={22} strokeWidth={isSubActive ? 2.5 : 2} />
                          <span className={`text-[10px] text-center leading-tight line-clamp-2 w-full ${isSubActive ? 'font-bold' : 'font-medium'}`}>{sub.label}</span>
                          {(sub as any).badge !== undefined && (sub as any).badge > 0 && (
                            <span className={`absolute top-0 right-0 -mt-1 -mr-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold text-white ${(sub as any).badgeColor || 'bg-red-500'} shadow-sm z-20 border border-[#1e3a8a]`}>
                              {(sub as any).badge > 99 ? '99+' : (sub as any).badge}
                            </span>
                          )}
                        </button>
                       );
                    })}
                  </div>
                </div>
              );
            }

            // Render Dropdown (Collapsible) - For "Hệ thống"
            if (item.isDropdown) {
              const isExpanded = expandedGroups.has(item.id);
              
              // Check if group has visible & allowed items for current user
              const hasVisibleItems = item.subItems?.some(sub => {
                 const isAllowed = isViewAllowedForUser(currentUser, employees || [], sub.id, rolePermissions, departmentPermissions);
                 return sub.visible && isAllowed;
              });
              
              if (!hasVisibleItems) return null;

              return (
                <div key={item.id} className="mb-3 pb-3 border-b border-blue-500/30 last:border-0">
                   <button
                    onClick={() => toggleGroup(item.id)}
                    className={`
                      w-full flex flex-col items-center justify-center gap-1 p-2 rounded-xl transition-colors relative
                      ${isGroupActive ? 'text-white bg-white/10 shadow-inner' : 'text-blue-100 hover:bg-white/5 hover:text-white'}
                    `}
                  >
                    <item.icon size={22} />
                    <span className="text-[11px] font-extrabold text-center leading-tight uppercase tracking-wide">{item.label}</span>
                    <ChevronDown size={14} className={`transition-transform duration-200 absolute bottom-1 right-1 opacity-70 ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {isExpanded && (
                    <div className="mt-2 space-y-2 animate-in slide-in-from-top-2 duration-200 bg-black/20 rounded-xl p-1.5 shadow-inner">
                      {item.subItems?.map(sub => {
                         const isAllowed = isViewAllowedForUser(currentUser, employees || [], sub.id, rolePermissions, departmentPermissions);
                         if (!isAllowed) return null;
                         if (!sub.visible) return null;
   
                         return (
                          <button
                            id={`nav-item-${sub.id}`}
                            key={sub.id}
                            onClick={() => handleMenuClick(sub.id)}
                            className={`
                              w-full flex flex-col items-center justify-center gap-1 p-1.5 rounded-lg transition-all
                              ${currentView === sub.id ? 'text-blue-900 bg-white font-bold shadow-md scale-105' : 'text-blue-200 hover:text-white hover:bg-white/10'}
                            `}
                            title={sub.label}
                          >
                            <sub.icon size={18} strokeWidth={currentView === sub.id ? 2.5 : 2} />
                            <span className="text-[10px] text-center leading-tight">{sub.label}</span>
                            {(sub as any).badge !== undefined && (sub as any).badge > 0 && (
                              <span className={`absolute top-0 right-0 w-2 h-2 rounded-full ${(sub as any).badgeColor || 'bg-red-500'} ring-1 ring-white`}></span>
                            )}
                          </button>
                         );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            // Render Standard Item
            if (item.id === 'dashboard') {
               return (
                 <div key={item.id} className="mb-4 pb-4 border-b-2 border-blue-400/20 mx-1">
                   <button
                     id="nav-item-dashboard"
                     onClick={() => handleMenuClick(item.id)}
                     className={`
                       w-full flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl transition-all relative duration-300 group
                       ${isActive 
                         ? 'bg-white text-blue-900 shadow-[0_0_15px_rgba(255,255,255,0.3)] scale-105 font-extrabold z-20 ring-2 ring-blue-400' 
                         : 'bg-blue-800/30 text-blue-100 hover:bg-blue-700 hover:text-white hover:scale-105 hover:shadow-lg border border-blue-700/30'}
                     `}
                   >
                     <item.icon size={28} strokeWidth={isActive ? 2.5 : 1.5} className={isActive ? "drop-shadow-sm" : "group-hover:drop-shadow-md"} />
                     <span className="text-[11px] uppercase tracking-widest text-center leading-tight">{item.label}</span>
                     {(item as any).badge !== undefined && (item as any).badge > 0 && (
                       <span className={`absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold text-white ${(item as any).badgeColor || 'bg-red-500'} shadow-sm border border-white`}>
                         {(item as any).badge > 99 ? '99+' : (item as any).badge}
                       </span>
                     )}
                   </button>
                 </div>
               );
            }

            return (
              <button
                id={`nav-item-${item.id}`}
                key={item.id}
                onClick={() => handleMenuClick(item.id)}
                className={`
                  w-full flex flex-col items-center justify-center gap-1 p-2 rounded-lg transition-colors relative mb-1
                  ${isActive ? 'bg-white text-blue-900 shadow-md' : 'text-blue-100 hover:bg-white/10 hover:text-white'}
                `}
              >
                <item.icon size={20} />
                <span className="text-[10px] font-medium text-center leading-tight line-clamp-2 w-full">{item.label}</span>
                {item.id === 'reports' && isGeneratingReport && (
                  <Loader2 size={12} className="animate-spin text-amber-400 absolute top-1 right-1" />
                )}
                {(item as any).badge !== undefined && (item as any).badge > 0 && (
                  <span className={`absolute top-0 right-0 -mt-1 -mr-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold text-white ${(item as any).badgeColor || 'bg-red-500'} shadow-sm`}>
                    {(item as any).badge > 99 ? '99+' : (item as any).badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </>
  );
};

export default TopNavigation;