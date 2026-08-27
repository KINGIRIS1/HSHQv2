
import React, { useState } from 'react';
import TopNavigation from '../TopNavigation';
import { Menu, ShieldCheck, UserCircle, LogOut, UserCog, ChevronDown, Settings, HelpCircle, Shield, Headphones, X, UserCheck, Phone, Mail, Clock, CheckCircle2 } from 'lucide-react';
import { User, UserRole, RolePermissions, DepartmentPermissions, Employee } from '../../types';
import { isViewAllowedForUser } from '../../config/roleConfig';
import UpdateRequiredModal from '../UpdateRequiredModal';

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
    onReopenUpdateModal
}) => {
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const [showHelpModal, setShowHelpModal] = useState(false);

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
            <header className="h-14 bg-[#1e3a8a] text-white flex items-center justify-between px-4 shadow-md z-50 shrink-0 border-b border-blue-800">
                {/* LEFT: BRAND */}
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-white p-0.5 flex items-center justify-center shrink-0 shadow-sm ring-1 ring-white/30">
                        <img src="./icon.png?v=4" alt="Logo Hớn Quản" className="w-full h-full object-contain rounded-full" />
                    </div>
                    <div className="flex flex-col leading-tight">
                        <h1 className="font-bold text-sm uppercase tracking-wide text-white whitespace-nowrap">
                            Hệ thống tiếp nhận và quản lý hồ sơ
                        </h1>
                        <span className="font-bold text-sm uppercase tracking-wide text-blue-200 whitespace-nowrap">
                            Chi nhánh Hớn Quản
                        </span>
                    </div>
                </div>

                {/* RIGHT: USER INFO */}
                <div className="relative flex items-center gap-3">
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
                                            setShowHelpModal(true);
                                            setIsUserMenuOpen(false);
                                        }}
                                        className="w-full text-left px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-lg flex items-center gap-3 transition-colors group"
                                    >
                                        <div className="bg-blue-50 p-1.5 rounded-md group-hover:bg-blue-100 transition-colors text-blue-600">
                                            <HelpCircle size={16} />
                                        </div>
                                        Trợ giúp & Phân quyền
                                    </button>
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
                    unreadMessagesCount={unreadMessages}
                    warningRecordsCount={warningCount.overdue + warningCount.approaching}
                    reminderCount={activeRemindersCount}
                    rolePermissions={rolePermissions}
                    departmentPermissions={departmentPermissions}
                    employees={employees}
                    connectionStatus={connectionStatus}
                />

                {/* CONTENT */}
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#f0f2f5]">
                    <main className="flex-1 p-4 overflow-hidden relative">
                        {children}
                    </main>
                </div>
            </div>

            {/* MODAL TRỢ GIÚP - CHÍNH SÁCH PHÂN QUYỀN & HỖ TRỢ KỸ THUẬT ON PC */}
            {showHelpModal && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-900 p-4 text-white flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-500/20 rounded-xl border border-blue-400/30 text-blue-300">
                                    <HelpCircle size={22} />
                                </div>
                                <div>
                                    <h2 className="text-base font-bold text-white tracking-wide">
                                        Trung Tâm Trợ Giúp & Quyền Hệ Thống
                                    </h2>
                                    <p className="text-xs text-slate-300">
                                        Thông tin chính sách phân quyền vai trò và kênh hỗ trợ kỹ thuật
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowHelpModal(false)}
                                className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Body - Combined Permissions & Support */}
                        <div className="p-5 overflow-y-auto flex-1 space-y-6 text-sm text-slate-700">
                            {/* SECTION 1: PHÂN QUYỀN VAI TRÒ */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                                    <Shield size={18} className="text-blue-600" />
                                    <h3 className="font-bold text-sm text-slate-800 uppercase tracking-wide">
                                        1. Chính sách phân quyền vai trò
                                    </h3>
                                </div>

                                {/* Current User Banner */}
                                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5 flex items-center gap-3">
                                    <div className="p-2 bg-blue-600 text-white rounded-lg shrink-0">
                                        <UserCheck size={20} />
                                    </div>
                                    <div className="text-xs">
                                        <div className="text-blue-900 font-bold">
                                            Tài khoản đang đăng nhập: <span className="text-blue-700 font-black">{currentUser?.name}</span>
                                        </div>
                                        <div className="text-blue-800">
                                            Vai trò hệ thống: <span className="font-bold uppercase text-blue-900">{currentUser?.role === UserRole.ADMIN ? 'Administrator' : currentUser?.role === UserRole.SUBADMIN ? 'Phó quản trị' : currentUser?.role === UserRole.TEAM_LEADER ? 'Nhóm trưởng' : currentUser?.role === UserRole.ONEDOOR ? 'Một cửa' : 'Nhân viên'}</span>
                                            {linkedEmployee?.department ? ` • Bộ phận: ${linkedEmployee.department}` : ''}
                                        </div>
                                    </div>
                                </div>

                                {/* List of Roles */}
                                <div className="space-y-2.5">
                                    {/* Role 1: Admin */}
                                    <div className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-purple-300 transition-colors shadow-xs">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-bold text-xs">
                                                ADMINISTRATOR (Quản trị viên)
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-600 leading-relaxed">
                                            Toàn quyền truy cập và cấu hình toàn bộ hệ thống. Quản lý danh mục người dùng, phân quyền vai trò, cấu hình bảng giá sản phẩm/dịch vụ, kiểm toán dữ liệu ngày tháng, xem và xuất tất cả báo cáo thống kê.
                                        </p>
                                    </div>

                                    {/* Role 2: SubAdmin */}
                                    <div className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-indigo-300 transition-colors shadow-xs">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 font-bold text-xs">
                                                PHÓ QUẢN TRỊ (SubAdmin)
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-600 leading-relaxed">
                                            Hỗ trợ quản trị dữ liệu hồ sơ, theo dõi tình trạng xử lý trên toàn địa bàn, kiểm tra và chuẩn hóa ngày tháng, truy cập báo cáo tổng hợp và thực hiện các tác vụ quản trị được phân công.
                                        </p>
                                    </div>

                                    {/* Role 3: Team Leader */}
                                    <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/30 hover:border-blue-300 transition-colors shadow-xs">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold text-xs">
                                                NHÓM TRƯỞNG / TỔ TRƯỞNG CHUYÊN MÔN
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-600 leading-relaxed">
                                            Quản lý và phân công hồ sơ cho chuyên viên trong nhóm/tổ, đôn đốc tiến độ hạn xử lý, duyệt hoàn thành công việc, tra cứu tư liệu đất đai trích lục, và theo dõi báo cáo hiệu suất làm việc của tổ chuyên môn.
                                        </p>
                                    </div>

                                    {/* Role 4: OneDoor */}
                                    <div className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-amber-300 transition-colors shadow-xs">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold text-xs">
                                                BỘ PHẬN MỘT CỬA (OneDoor)
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-600 leading-relaxed">
                                            Tiếp nhận và đăng ký hồ sơ đầu vào từ người dân/doanh nghiệp, lập giấy hẹn, thu phí/lệ phí và tiền tạm ứng, xuất danh sách bàn giao hồ sơ sang bộ phận chuyên môn, và thực hiện trả kết quả.
                                        </p>
                                    </div>

                                    {/* Role 5: Employee */}
                                    <div className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-emerald-300 transition-colors shadow-xs">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-xs">
                                                NHÂN VIÊN / CHUYÊN VIÊN
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-600 leading-relaxed">
                                            Thực hiện đo đạc, thẩm định và xử lý nghiệp vụ các hồ sơ được phân công. Cập nhật tiến độ xử lý, đính kèm file bản vẽ/tài liệu kết quả, và báo cáo hoàn tất tác vụ cho Nhóm trưởng.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* SECTION 2: HỖ TRỢ KỸ THUẬT */}
                            <div className="space-y-4 pt-2">
                                <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                                    <Headphones size={18} className="text-emerald-600" />
                                    <h3 className="font-bold text-sm text-slate-800 uppercase tracking-wide">
                                        2. Hỗ trợ kỹ thuật & Liên hệ
                                    </h3>
                                </div>

                                {/* Tech Support Header Banner */}
                                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-xs space-y-2">
                                    <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
                                        <Headphones className="text-emerald-600" size={18} />
                                        Đơn vị Quản trị & Hỗ trợ Kỹ thuật Hệ thống
                                    </div>
                                    <p className="text-emerald-800 leading-relaxed">
                                        Bộ phận Kỹ thuật luôn sẵn sàng hỗ trợ cán bộ giải quyết các sự cố phần mềm, khôi phục dữ liệu, hướng dẫn thao tác hoặc tiếp nhận yêu cầu điều chỉnh phân quyền tài khoản.
                                    </p>
                                </div>

                                {/* Contact Info Cards Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div className="p-3.5 bg-white border border-slate-200 rounded-xl flex items-start gap-3 shadow-xs">
                                        <div className="p-2.5 bg-blue-100 text-blue-700 rounded-lg shrink-0">
                                            <Phone size={18} />
                                        </div>
                                        <div className="text-xs">
                                            <div className="font-bold text-slate-800">Hotline / Zalo Kỹ thuật</div>
                                            <div className="font-mono text-sm font-bold text-blue-600 my-0.5">0976354944</div>
                                            <div className="text-slate-500">Hỗ trợ trực tiếp qua Zalo hoặc Cuộc gọi</div>
                                        </div>
                                    </div>

                                    <div className="p-3.5 bg-white border border-slate-200 rounded-xl flex items-start gap-3 shadow-xs">
                                        <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-lg shrink-0">
                                            <Mail size={18} />
                                        </div>
                                        <div className="text-xs">
                                            <div className="font-bold text-slate-800">Email Tiếp nhận Sự cố</div>
                                            <div className="font-mono text-xs font-bold text-emerald-700 my-0.5">Ngtaitinh@gmail.com</div>
                                            <div className="text-slate-500">Phản hồi trong thời gian sớm nhất</div>
                                        </div>
                                    </div>

                                    <div className="p-3.5 bg-white border border-slate-200 rounded-xl flex items-start gap-3 shadow-xs">
                                        <div className="p-2.5 bg-amber-100 text-amber-700 rounded-lg shrink-0">
                                            <Clock size={18} />
                                        </div>
                                        <div className="text-xs">
                                            <div className="font-bold text-slate-800">Thời gian làm việc</div>
                                            <div className="font-semibold text-slate-700 my-0.5">07:30 - 17:00 (Thứ 2 - Thứ 6)</div>
                                            <div className="text-slate-500">Thứ 7: 08:00 - 11:30</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Notes */}
                                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1.5">
                                    <div className="font-bold text-slate-800 flex items-center gap-1.5">
                                        <CheckCircle2 size={16} className="text-blue-600" /> Lưu ý dành cho Cán bộ:
                                    </div>
                                    <ul className="list-disc list-inside space-y-1 text-slate-600 pl-1">
                                        <li>Tuyệt đối bảo mật mật khẩu tài khoản cán bộ.</li>
                                        <li>Trường hợp cần hỗ trợ khẩn cấp, vui lòng gọi điện trực tiếp hotline 0976354944.</li>
                                    </ul>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-3 bg-slate-100 border-t border-slate-200 flex justify-end shrink-0">
                            <button
                                onClick={() => setShowHelpModal(false)}
                                className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs transition-all shadow-sm cursor-pointer"
                            >
                                Đóng
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MainLayout;
