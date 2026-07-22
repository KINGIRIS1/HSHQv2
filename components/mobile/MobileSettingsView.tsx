
import React, { useState } from 'react';
import { User, Employee, UserRole, Holiday } from '../../types';
import AccountSettingsView from '../AccountSettingsView';
import UserManagement from '../UserManagement';
import EmployeeManagement from '../EmployeeManagement';
import SystemSettingsView from '../SystemSettingsView';
import { 
  User as UserIcon, 
  Shield, 
  Users, 
  Settings2, 
  ChevronRight, 
  LogOut,
  ArrowLeft
} from 'lucide-react';

interface MobileSettingsViewProps {
  currentUser: User;
  employees: Employee[];
  users: User[];
  wards: string[];
  onUpdateAccount: (data: any) => Promise<boolean>;
  onAddUser: (user: Omit<User, 'id'>) => void;
  onUpdateUser: (user: User) => void;
  onDeleteUser: (username: string) => void;
  onSaveEmployee: (employee: Employee) => void;
  onDeleteEmployee: (id: string) => void;
  onDeleteAllData: () => Promise<boolean>;
  onHolidaysChanged: () => void;
  notificationEnabled: boolean;
  setNotificationEnabled: (enabled: boolean) => void;
  onLogout: () => void;
}

const MobileSettingsView: React.FC<MobileSettingsViewProps> = (props) => {
  const { currentUser, employees, users, wards, onLogout } = props;
  const [activeSubView, setActiveSubView] = useState<string | null>(null);
  const isAdmin = currentUser.role === UserRole.ADMIN;
  const isSubAdmin = currentUser.role === UserRole.SUBADMIN;

  const menuItems = [
    { id: 'account', label: 'Tài khoản của tôi', icon: UserIcon, color: 'text-blue-600', bg: 'bg-blue-50' },
    ...(isAdmin || isSubAdmin ? [
      { id: 'employees', label: 'Quản lý nhân sự', icon: Users, color: 'text-teal-600', bg: 'bg-teal-50' }
    ] : []),
    ...(isAdmin ? [
      { id: 'users', label: 'Quản lý người dùng', icon: Shield, color: 'text-indigo-600', bg: 'bg-indigo-50' },
      { id: 'system', label: 'Cấu hình hệ thống', icon: Settings2, color: 'text-orange-600', bg: 'bg-orange-50' }
    ] : []),
  ];

  const renderSubView = () => {
    switch (activeSubView) {
      case 'account':
        return (
          <div className="flex flex-col h-full bg-white">
            <div className="p-2 flex items-center gap-3 bg-gray-50 shrink-0">
              <button onClick={() => setActiveSubView(null)} className="p-2 hover:bg-gray-200 rounded-xl flex items-center gap-2 text-sm font-semibold text-gray-600 transition-colors">
                <ArrowLeft size={20} /> Quay lại
              </button>
            </div>
            <div className="flex-1 overflow-hidden flex flex-col p-2 bg-gray-50">
              <AccountSettingsView 
                currentUser={currentUser}
                linkedEmployee={employees.find(e => e.id === currentUser.employeeId)}
                onUpdate={props.onUpdateAccount}
                notificationEnabled={props.notificationEnabled}
                setNotificationEnabled={props.setNotificationEnabled}
              />
            </div>
          </div>
        );
      case 'employees':
        return (
          <div className="flex flex-col h-full bg-white">
            <div className="p-2 flex items-center gap-3 bg-gray-50 shrink-0">
              <button onClick={() => setActiveSubView(null)} className="p-2 hover:bg-gray-200 rounded-xl flex items-center gap-2 text-sm font-semibold text-gray-600 transition-colors">
                <ArrowLeft size={20} /> Quay lại
              </button>
            </div>
            <div className="flex-1 overflow-hidden flex flex-col p-2 bg-gray-50">
              <EmployeeManagement 
                employees={employees}
                onSaveEmployee={props.onSaveEmployee}
                onDeleteEmployee={props.onDeleteEmployee}
                wards={wards}
                currentUser={currentUser}
              />
            </div>
          </div>
        );
      case 'users':
        return (
          <div className="flex flex-col h-full bg-white">
            <div className="p-2 flex items-center gap-3 bg-gray-50 shrink-0">
              <button onClick={() => setActiveSubView(null)} className="p-2 hover:bg-gray-200 rounded-xl flex items-center gap-2 text-sm font-semibold text-gray-600 transition-colors">
                <ArrowLeft size={20} /> Quay lại
              </button>
            </div>
            <div className="flex-1 overflow-hidden flex flex-col p-2 bg-gray-50">
              <UserManagement 
                users={users}
                employees={employees}
                onAddUser={props.onAddUser}
                onUpdateUser={props.onUpdateUser}
                onDeleteUser={props.onDeleteUser}
              />
            </div>
          </div>
        );
      case 'system':
        return (
          <div className="flex flex-col h-full bg-white">
            <div className="p-2 flex items-center gap-3 bg-gray-50 shrink-0">
              <button onClick={() => setActiveSubView(null)} className="p-2 hover:bg-gray-200 rounded-xl flex items-center gap-2 text-sm font-semibold text-gray-600 transition-colors">
                <ArrowLeft size={20} /> Quay lại
              </button>
            </div>
            <div className="flex-1 overflow-hidden flex flex-col p-2 bg-gray-50">
              <SystemSettingsView 
                onDeleteAllData={props.onDeleteAllData}
                onHolidaysChanged={props.onHolidaysChanged}
                employees={props.employees}
              />
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  if (activeSubView) {
    return (
      <div className="fixed inset-0 bg-white z-[60] animate-slide-in-right">
        {renderSubView()}
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full bg-slate-50/50 pb-24">
      {/* Header Profile Section */}
      <div className="bg-white px-6 pt-10 pb-8 rounded-b-[2.5rem] shadow-sm border-b border-slate-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full -mr-16 -mt-16 opacity-50" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-indigo-50 rounded-full -ml-12 -mb-12 opacity-50" />
        
        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="relative">
            <div className="w-24 h-24 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl flex items-center justify-center text-white text-3xl font-semibold shadow-xl shadow-blue-200 border-4 border-white">
              {currentUser.name.charAt(0)}
            </div>
            <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-green-500 border-4 border-white rounded-full shadow-sm" />
          </div>
          
          <div className="mt-4">
            <h2 className="text-2xl font-semibold text-slate-800 tracking-tight">{currentUser.name}</h2>
            <p className="text-slate-400 font-medium text-sm mt-0.5">@{currentUser.username}</p>
          </div>

          <div className="mt-4 flex gap-2">
            <span className="px-3 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded-full uppercase tracking-wider border border-blue-100">
              {currentUser.role}
            </span>
            {currentUser.employeeId && (
              <span className="px-3 py-1 bg-slate-50 text-slate-600 text-xs font-semibold rounded-full uppercase tracking-wider border border-slate-100">
                Nhân viên
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="px-5 mt-8 space-y-6">
        {/* Main Menu */}
        <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-50">
            <h3 className="text-sm font-medium text-slate-500">Cài đặt ứng dụng</h3>
          </div>
          <div className="divide-y divide-slate-50">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSubView(item.id)}
                  className="w-full flex items-center justify-between p-5 hover:bg-slate-50 active:bg-slate-50/80 transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 ${item.bg} ${item.color} rounded-2xl flex items-center justify-center shadow-sm group-active:scale-90 transition-transform`}>
                      <Icon size={22} />
                    </div>
                    <div className="text-left">
                      <span className="block font-semibold text-slate-700 text-[15px]">{item.label}</span>
                      <span className="text-xs text-slate-400 font-medium">Tùy chỉnh & Quản lý</span>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-slate-300 group-hover:text-slate-400 transition-colors" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Action Menu */}
        <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-between p-5 hover:bg-red-50 active:bg-red-50/80 transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center shadow-sm group-active:scale-90 transition-transform">
                <LogOut size={22} />
              </div>
              <div className="text-left">
                <span className="block font-semibold text-red-600 text-[15px]">Đăng xuất</span>
                <span className="text-xs text-red-400 font-medium">Kết thúc phiên làm việc</span>
              </div>
            </div>
          </button>
        </div>

        {/* Footer Info */}
        <div className="pt-4 pb-8 text-center">
          <p className="text-slate-300 text-xs font-semibold uppercase tracking-wider">
            Phiên bản 2.1.0 • QLHS Mobile
          </p>
        </div>
      </div>
    </div>
  );
};

export default MobileSettingsView;
