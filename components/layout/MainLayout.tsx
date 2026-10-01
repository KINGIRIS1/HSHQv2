
import React, { useState } from 'react';
import TopNavigation from '../TopNavigation';
import { Menu, ShieldCheck, UserCircle, LogOut, UserCog, ChevronDown, Settings, HelpCircle, Shield, Headphones, X, UserCheck, Phone, Mail, Clock, CheckCircle2, Database, HardDrive } from 'lucide-react';
import { User, UserRole, RolePermissions, DepartmentPermissions, Employee, RecordFile } from '../../types';
import { isViewAllowedForUser } from '../../config/roleConfig';
import UpdateRequiredModal from '../UpdateRequiredModal';
import AdminBackupWarningBanner from '../AdminBackupWarningBanner';
import { NotificationBell } from '../NotificationBell';

interface MainLayoutProps {
    children: React.ReactNode;
    currentUser: User | null;
    currentView: string;
    setCurrentView: (view: string) => void;
    onLogout: () => void;
    
    // Sidebar specific props
    isMobileMenuOpen: boolean;
    setIsMobileMenuOpen: (open: boolean) => void;
    isGeneratingReport: boolean;
    isUpdateAvailable: boolean;
    latestVersion: string;
    updateUrl: string | null;
    unreadMessages: number;
    warningCount: { overdue: number; approaching: number };
    activeRemindersCount: number;
    records?: RecordFile[];
    onViewRecord?: (record: RecordFile) => void;
    onClearReminder?: (recordId: string) => void;
    onClearAllReminders?: () => void;
    rolePermissions: RolePermissions;
    departmentPermissions: DepartmentPermissions;
    employees: Employee[];
    
    // Connection status
    connectionStatus: 'connected' | 'offline';

    // Update Modal Props
    showUpdateModal?: boolean;
    updateVersion?: string;
    updateDownloadStatus?: 'idle' | 'downloading' | 'ready' | 'error';
    updateProgress?: number;
    updateSpeed?: number; // Prop mới
    onUpdateNow?: () => void;
    onUpdateLater?: () => void;
    onReopenUpdateModal?: () => void;
    onOpenCloudInspector?: () => void;
    onOpenBackupRestore?: () => void;
}

const MainLayout: React.FC<MainLayoutProps> = ({
    children,
    currentUser,
    currentView,
    setCurrentView,
    onLogout,
    isMobileMenuOpen,
    setIsMobileMenuOpen,
    isGeneratingReport,
    isUpdateAvailable,
    latestVersion,
    updateUrl,
    unreadMessages,
    warningCount,
    activeRemindersCount,
    records = [],
    onViewRecord = () => {},
    onClearReminder = () => {},
    onClearAllReminders,
    rolePermissions,
    departmentPermissions,
    employees,
    connectionStatus,
    // Update props defaults
    showUpdateModal = false,
    updateVersion = '',
    updateDownloadStatus = 'idle',
    updateProgress = 0,
    updateSpeed = 0, // Default
    onUpdateNow = () => {},
    onUpdateLater = () => {},
    onReopenUpdateModal,
    onOpenCloudInspector,
    onOpenBackupRestore
}) => {
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

    if (!currentUser) return <>{children}</>;

    const linkedEmployee = currentUser.employeeId ? employees.find(e => e.id === currentUser.employeeId) : null;

    return (
        <div className="flex flex-col h-screen bg-slate-50 overflow-hidden font-sans">
            {/* Modal Cập nhật Bắt buộc */}
            <UpdateRequiredModal 
                visible={showUpdateModal}
                version={updateVersion}
                downloadStatus={updateDownloadStatus}
                progress={updateProgress}
                downloadSpeed={updateSpeed}
                onUpdateNow={onUpdateNow}
                onUpdateLater={onUpdateLater}
            />

            {/* HEADER */}
            <header className="h-14 bg-[#1e3a8a] text-white flex items-center justify-between px-2 sm:px-4 shadow-md z-50 shrink-0 border-b border-blue-800">
                {/* LEFT: BRAND */}
                <div className="flex items-center gap-2 sm:gap-3 overflow-hidden">
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white p-0.5 flex items-center justify-center shrink-0 shadow-sm ring-1 ring-white/30">
                        <img src="./icon.png?v=4" alt="Logo Hớn Quản" className="w-full h-full object-contain rounded-full" />
                    </div>
                    <div className="flex flex-col leading-tight truncate">
                        <h1 className="font-bold text-xs sm:text-sm uppercase tracking-wide text-white truncate">
                            Hệ thống tiếp nhận và quản lý hồ sơ
                        </h1>
                        <span className="font-bold text-xs sm:text-sm uppercase tracking-wide text-blue-200 truncate">
                            Chi nhánh Hớn Quản
                        </span>
                    </div>
                </div>

                {/* RIGHT: USER INFO & NOTIFICATION BELL */}
                <div className="relative flex items-center gap-2 sm:gap-3">
                    <NotificationBell 
                        records={records}
                        currentUser={currentUser}
                        onViewRecord={onViewRecord}
                        onClearReminder={onClearReminder}
                        onClearAllReminders={onClearAllReminders}
                    />

                    <button 
                        onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                        className="flex items-center gap-3 group cursor-pointer hover:bg-white/10 p-1.5 rounded-lg transition-colors outline-none focus:ring-2 focus:ring-blue-400/50"
                    >
                        <div className="w-9 h-9 rounded-full bg-blue-700 flex items-center justify-center text-white ring-2 ring-blue-600/50 shadow-sm">
                            <UserCircle size={20} />
                        </div>
                        <div className="hidden md:flex flex-col items-end text-right mr-1">
                            <span className="text-sm font-bold leading-none">{currentUser.name}</span>
                            <span className="text-[10px] text-blue-300 uppercase font-semibold tracking-wider mt-0.5">
                                {currentUser.role === UserRole.ADMIN ? 'Administrator' : currentUser.role === UserRole.SUBADMIN ? 'Phó quản trị' : currentUser.role === UserRole.TEAM_LEADER ? 'Nhóm trưởng' : currentUser.role === UserRole.ONEDOOR ? 'Một cửa' : 'Nhân viên'}
                            </span>
                        </div>
                        <ChevronDown size={16} className={`text-blue-300 transition-transform duration-200 ${isUserMenuOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Dropdown Menu */}
                    {isUserMenuOpen && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setIsUserMenuOpen(false)}></div>
                            <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                                <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                                    <p className="text-sm font-bold text-gray-800 truncate">{currentUser.name}</p>
                                    <p className="text-xs text-gray-500 truncate mt-0.5">@{currentUser.username}</p>
                                    <div className="mt-2 text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-1 rounded inline-block border border-blue-100">
                                        {currentUser.role === UserRole.ADMIN ? 'Administrator' : currentUser.role === UserRole.SUBADMIN ? 'Phó quản trị' : currentUser.role === UserRole.TEAM_LEADER ? 'Nhóm trưởng' : currentUser.role === UserRole.ONEDOOR ? 'Một cửa' : 'Nhân viên'}
                                    </div>
                                </div>
                                <div className="p-2 space-y-1">
                                    <button 
                                        onClick={() => {
                                            setCurrentView('account_settings');
                                            setIsUserMenuOpen(false);
                                        }}
                                        className="w-full text-left px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-lg flex items-center gap-3 transition-colors group"
                                    >
                                        <div className="bg-gray-100 p-1.5 rounded-md group-hover:bg-blue-100 transition-colors text-gray-500 group-hover:text-blue-600">
                                            <UserCog size={16} />
                                        </div>
                                        Cài đặt tài khoản
                                    </button>
                                     {(currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.SUBADMIN || isViewAllowedForUser(currentUser, employees, 'system_dashboard')) && (
                                        <button 
                                            onClick={() => {
                                                setCurrentView('system_dashboard');
                                                setIsUserMenuOpen(false);
                                            }}
                                            className="w-full text-left px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-lg flex items-center gap-3 transition-colors group"
                                        >
                                            <div className="bg-gray-100 p-1.5 rounded-md group-hover:bg-blue-100 transition-colors text-gray-500 group-hover:text-blue-600">
                                                <Settings size={16} />
                                            </div>
                                            Cài đặt hệ thống
                                        </button>
                                    )}
                                    <div className="h-px bg-gray-100 my-1 mx-2"></div>
                                    <button 
                                        onClick={() => {
                                            onLogout();
                                            setIsUserMenuOpen(false);
                                        }}
                                        className="w-full text-left px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-3 transition-colors group"
                                    >
                                        <div className="bg-red-50 p-1.5 rounded-md group-hover:bg-red-100 transition-colors text-red-500 group-hover:text-red-600">
                                            <LogOut size={16} />
                                        </div>
                                        Đăng xuất
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </header>

            {/* MAIN BODY */}
            <div className="flex flex-1 overflow-hidden">
                {/* SIDEBAR */}
                <TopNavigation
                    currentView={currentView}
                    setCurrentView={setCurrentView}
                    currentUser={currentUser}
                    onLogout={onLogout}
                    mobileOpen={isMobileMenuOpen}
                    setMobileOpen={setIsMobileMenuOpen}
                    isGeneratingReport={isGeneratingReport}
                    onOpenAccountSettings={() => setCurrentView('account_settings')}
                    onOpenBackupRestore={onOpenBackupRestore}
                    unreadMessagesCount={unreadMessages}
                    warningRecordsCount={warningCount.overdue + warningCount.approaching}
                    reminderCount={activeRemindersCount}
                    rolePermissions={rolePermissions}
                    departmentPermissions={departmentPermissions}
                    employees={employees}
                    connectionStatus={connectionStatus}
                />

                {/* CONTENT */}
                <div className="flex-1 flex flex-col min-w-0 bg-[#f0f2f5] overflow-hidden">
                    <main className="flex-1 p-3 sm:p-4 flex flex-col min-h-0 overflow-hidden relative">
                        {children}
                    </main>
                </div>
            </div>
        </div>
    );
};

export default MainLayout;
