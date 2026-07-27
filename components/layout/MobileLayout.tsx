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
  const [showHelpModal, setShowHelpModal] = useState(false);

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
      <header className="bg-blue-700 text-white px-3 py-2.5 flex justify-between items-center shadow-md shrink-0 z-30">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-white p-0.5 flex items-center justify-center shrink-0 border border-white/30 shadow-xs">
            <img src="/icon.png?v=4" alt="Logo" className="w-full h-full object-contain rounded-full" />
          </div>
          <h1 className="font-bold text-base tracking-tight truncate">QLHS Mobile</h1>
        </div>
        <div className="flex items-center gap-2">
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
                        setShowHelpModal(true);
                        setIsUserMenuOpen(false);
                      }}
                      className="w-full text-left px-2.5 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50 rounded-lg flex items-center gap-2.5 transition-colors group"
                    >
                      <div className="bg-blue-100 p-1 rounded-md text-blue-600">
                        <HelpCircle size={14} />
                      </div>
                      Chính sách & Hỗ trợ kỹ thuật
                    </button>
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
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around items-center h-16 px-2 shadow-[0_-4px_10px_rgba(0,0,0,0.05)] z-40">
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

      {/* MODAL TRỢ GIÚP - CHÍNH SÁCH PHÂN QUYỀN & HỖ TRỢ KỸ THUẬT ON MOBILE */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-900 p-3.5 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-blue-500/20 rounded-lg border border-blue-400/30 text-blue-300">
                  <HelpCircle size={18} />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white tracking-wide">
                    Trung Tâm Trợ Giúp & Quyền Hệ Thống
                  </h2>
                  <p className="text-[10px] text-slate-300">
                    Phân quyền vai trò & Hỗ trợ kỹ thuật
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowHelpModal(false)}
                className="p-1 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body - Combined Permissions & Support */}
            <div className="p-4 overflow-y-auto flex-1 space-y-5 text-xs text-slate-700">
              {/* SECTION 1: PHÂN QUYỀN VAI TRÒ */}
              <div className="space-y-3">
                <div className="flex items-center gap-1.5 pb-1.5 border-b border-slate-200">
                  <Shield size={16} className="text-blue-600" />
                  <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wide">
                    1. Phân quyền vai trò
                  </h3>
                </div>

                {/* Current User Banner */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-2.5 flex items-center gap-2">
                  <div className="p-1.5 bg-blue-600 text-white rounded-lg shrink-0">
                    <UserCheck size={16} />
                  </div>
                  <div className="text-[11px]">
                    <div className="text-blue-900 font-bold">
                      Đăng nhập: <span className="text-blue-700 font-black">{currentUser?.name}</span>
                    </div>
                    <div className="text-blue-800">
                      Vai trò: <span className="font-bold uppercase text-blue-900">{currentUser?.role === UserRole.ADMIN ? 'Administrator' : currentUser?.role === UserRole.SUBADMIN ? 'Phó quản trị' : currentUser?.role === UserRole.TEAM_LEADER ? 'Nhóm trưởng' : currentUser?.role === UserRole.ONEDOOR ? 'Một cửa' : 'Nhân viên'}</span>
                    </div>
                  </div>
                </div>

                {/* List of Roles */}
                <div className="space-y-2">
                  {/* Role 1: Admin */}
                  <div className="p-2.5 rounded-xl border border-slate-200 bg-white shadow-xs">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-bold text-[10px]">
                        ADMINISTRATOR (Quản trị viên)
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Toàn quyền truy cập, quản lý người dùng, phân quyền vai trò, cấu hình bảng giá, kiểm toán dữ liệu, xem và xuất tất cả báo cáo.
                    </p>
                  </div>

                  {/* Role 2: SubAdmin */}
                  <div className="p-2.5 rounded-xl border border-slate-200 bg-white shadow-xs">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 font-bold text-[10px]">
                        PHÓ QUẢN TRỊ (SubAdmin)
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Hỗ trợ quản trị dữ liệu hồ sơ, kiểm tra chuẩn hóa ngày tháng, theo dõi tình trạng xử lý và báo cáo tổng hợp.
                    </p>
                  </div>

                  {/* Role 3: Team Leader */}
                  <div className="p-2.5 rounded-xl border border-blue-200 bg-blue-50/40 shadow-xs">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold text-[10px]">
                        NHÓM TRƯỞNG / TỔ TRƯỞNG CHUYÊN MÔN
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Quản lý phân công hồ sơ cho chuyên viên trong nhóm/tổ, đôn đốc tiến độ hạn xử lý, duyệt hoàn thành công việc, tra cứu tư liệu trích lục.
                    </p>
                  </div>

                  {/* Role 4: OneDoor */}
                  <div className="p-2.5 rounded-xl border border-slate-200 bg-white shadow-xs">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold text-[10px]">
                        BỘ PHẬN MỘT CỬA (OneDoor)
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Tiếp nhận đăng ký hồ sơ đầu vào, lập giấy hẹn, thu phí lệ phí, xuất bàn giao sang bộ phận chuyên môn và trả kết quả.
                    </p>
                  </div>

                  {/* Role 5: Employee */}
                  <div className="p-2.5 rounded-xl border border-slate-200 bg-white shadow-xs">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                        NHÂN VIÊN / CHUYÊN VIÊN
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Thực hiện đo đạc, thẩm định và xử lý hồ sơ được phân công, cập nhật tiến độ, tải lên bản vẽ và báo cáo hoàn tất cho Nhóm trưởng.
                    </p>
                  </div>
                </div>
              </div>

              {/* SECTION 2: HỖ TRỢ KỸ THUẬT */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-1.5 pb-1.5 border-b border-slate-200">
                  <Headphones size={16} className="text-emerald-600" />
                  <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wide">
                    2. Hỗ trợ kỹ thuật & Liên hệ
                  </h3>
                </div>

                {/* Tech Support Header Banner */}
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 space-y-1">
                  <div className="flex items-center gap-1.5 text-emerald-900 font-bold text-xs">
                    <Headphones className="text-emerald-600" size={15} />
                    Đơn vị Quản trị & Hỗ trợ Kỹ thuật System
                  </div>
                  <p className="text-emerald-800 leading-relaxed text-[11px]">
                    Sẵn sàng hỗ trợ cán bộ xử lý sự cố phần mềm, khôi phục dữ liệu, hướng dẫn thao tác và cập nhật phân quyền tài khoản.
                  </p>
                </div>

                {/* Contact Info Cards */}
                <div className="space-y-2">
                  <div className="p-2.5 bg-white border border-slate-200 rounded-xl flex items-start gap-2.5 shadow-xs">
                    <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg shrink-0">
                      <Phone size={15} />
                    </div>
                    <div className="text-[11px]">
                      <div className="font-bold text-slate-800">Hotline / Zalo Kỹ thuật</div>
                      <div className="font-mono text-xs font-bold text-blue-600 my-0.5">0976354944</div>
                      <div className="text-slate-500">Hỗ trợ trực tiếp qua Zalo hoặc Cuộc gọi</div>
                    </div>
                  </div>

                  <div className="p-2.5 bg-white border border-slate-200 rounded-xl flex items-start gap-2.5 shadow-xs">
                    <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg shrink-0">
                      <Mail size={15} />
                    </div>
                    <div className="text-[11px]">
                      <div className="font-bold text-slate-800">Email Tiếp nhận Sự cố</div>
                      <div className="font-mono text-xs font-bold text-emerald-700 my-0.5">Ngtaitinh@gmail.com</div>
                      <div className="text-slate-500">Phản hồi trong thời gian sớm nhất</div>
                    </div>
                  </div>

                  <div className="p-2.5 bg-white border border-slate-200 rounded-xl flex items-start gap-2.5 shadow-xs">
                    <div className="p-1.5 bg-amber-100 text-amber-700 rounded-lg shrink-0">
                      <Clock size={15} />
                    </div>
                    <div className="text-[11px]">
                      <div className="font-bold text-slate-800">Thời gian làm việc</div>
                      <div className="font-semibold text-slate-700 my-0.5">07:30 - 17:00 (Thứ 2 - Thứ 6)</div>
                      <div className="text-slate-500">Thứ 7: 08:00 - 11:30</div>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-[11px] text-slate-600 space-y-1">
                  <div className="font-bold text-slate-800 flex items-center gap-1">
                    <CheckCircle2 size={13} className="text-blue-600" /> Lưu ý dành cho Cán bộ:
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 text-slate-600 pl-1">
                    <li>Tuyệt đối bảo mật mật khẩu tài khoản cán bộ.</li>
                    <li>Trường hợp cần hỗ trợ khẩn cấp, vui lòng gọi điện trực tiếp hotline 0976354944.</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-2.5 bg-slate-100 border-t border-slate-200 flex justify-end shrink-0">
              <button
                onClick={() => setShowHelpModal(false)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs transition-all shadow-sm cursor-pointer"
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

export default MobileLayout;
