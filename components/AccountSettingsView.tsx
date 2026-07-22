
import React, { useState, useEffect, useRef } from 'react';
import { User, Employee } from '../types';
import { Save, Lock, User as UserIcon, Briefcase, CheckCircle, AlertCircle, Loader2, ShieldCheck, Bell } from 'lucide-react';

interface AccountSettingsViewProps {
  currentUser: User;
  linkedEmployee: Employee | undefined;
  onUpdate: (data: { name: string; password?: string; department?: string; position?: string }) => Promise<boolean>;
  notificationEnabled: boolean; // Prop mới
  setNotificationEnabled: (enabled: boolean) => void; // Prop mới
}

const AccountSettingsView: React.FC<AccountSettingsViewProps> = ({ 
  currentUser, 
  linkedEmployee, 
  onUpdate,
  notificationEnabled,
  setNotificationEnabled
}) => {
  const [activeTab, setActiveTab] = useState<'info' | 'security'>('info');
  const [isLoading, setIsLoading] = useState(false);
  
  // Form State
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('');
  const [position, setPosition] = useState('');
  
  // Password State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Notification State
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  // Ref để cuộn lên đầu trang
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load dữ liệu khi component được mount
    setName(currentUser.name);
    setDepartment(linkedEmployee?.department || '');
    setPosition(linkedEmployee?.position || '');
  }, [currentUser, linkedEmployee]);

  // Cuộn lên đầu khi có thông báo mới (Không tự động tắt nữa)
  useEffect(() => {
    if (notification) {
      topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [notification]);

  const handleTabChange = (tab: 'info' | 'security') => {
      setActiveTab(tab);
      setNotification(null); // Xóa thông báo khi chuyển tab
  };

  const handleNotificationToggle = () => {
      setNotificationEnabled(!notificationEnabled);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotification(null);
    setIsLoading(true);

    try {
        const updateData: { name: string; password?: string; department?: string; position?: string } = {
            name: name.trim()
        };

        // Validate Info
        if (!updateData.name) throw new Error("Tên hiển thị không được để trống.");

        // Handle Department update if linked
        if (linkedEmployee) {
            updateData.department = department.trim();
            updateData.position = position.trim();
        }

        // Handle Password Change
        if (activeTab === 'security') {
            if (!currentPassword) throw new Error("Vui lòng nhập mật khẩu hiện tại để xác thực.");
            
            // Check old password (Verify against currentUser prop locally first)
            if (currentPassword !== currentUser.password) {
                throw new Error("Mật khẩu hiện tại không chính xác.");
            }

            if (newPassword) {
                if (newPassword.length < 3) throw new Error("Mật khẩu mới quá ngắn (tối thiểu 3 ký tự).");
                if (newPassword !== confirmPassword) throw new Error("Xác nhận mật khẩu không khớp.");
                updateData.password = newPassword;
            } else {
                 throw new Error("Vui lòng nhập mật khẩu mới.");
            }
        }

        const result = await onUpdate(updateData);
        
        if (result) {
            const successMsg = activeTab === 'security' 
                ? "Đổi mật khẩu thành công! Vui lòng sử dụng mật khẩu mới cho lần đăng nhập sau." 
                : "Cập nhật thông tin cá nhân thành công!";
            
            setNotification({ type: 'success', message: successMsg });
            
            if (activeTab === 'security') {
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
            }
        } else {
            throw new Error("Không thể kết nối đến máy chủ. Vui lòng thử lại.");
        }

    } catch (err: any) {
        setNotification({ type: 'error', message: err.message || "Đã xảy ra lỗi không xác định." });
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-full overflow-hidden animate-fade-in-up">
        {/* Header Section */}
        <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gray-50 shrink-0">
            <div>
                <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2 tracking-tight">
                    <UserIcon className="text-blue-600" size={20} />
                    Cài đặt tài khoản
                </h2>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-1">Quản lý thông tin cá nhân và bảo mật tài khoản.</p>
            </div>
        </div>

        {/* Content Section */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row min-h-0 bg-gray-50/30">
            {/* Sidebar Tabs / Mobile Tabs */}
            <div className="w-full md:w-64 bg-gray-50 border-b md:border-b-0 md:border-r border-gray-200 p-2 md:p-4 flex md:flex-col gap-2 shrink-0 overflow-x-auto no-scrollbar">
                <button 
                    onClick={() => handleTabChange('info')}
                    className={`flex-1 md:flex-none flex items-center justify-center md:justify-start gap-3 px-4 py-3 rounded-lg font-semibold text-sm transition-all whitespace-nowrap ${
                        activeTab === 'info' 
                        ? 'bg-blue-600 text-white shadow-md' 
                        : 'text-gray-600 hover:bg-gray-200'
                    }`}
                >
                    <UserIcon size={18} /> <span className="hidden xs:inline">Thông tin chung</span><span className="xs:hidden">Thông tin</span>
                </button>
                <button 
                    onClick={() => handleTabChange('security')}
                    className={`flex-1 md:flex-none flex items-center justify-center md:justify-start gap-3 px-4 py-3 rounded-lg font-semibold text-sm transition-all whitespace-nowrap ${
                        activeTab === 'security' 
                        ? 'bg-blue-600 text-white shadow-md' 
                        : 'text-gray-600 hover:bg-gray-200'
                    }`}
                >
                    <Lock size={18} /> <span className="hidden xs:inline">Bảo mật & Mật khẩu</span><span className="xs:hidden">Bảo mật</span>
                </button>
            </div>

            {/* Form Area */}
            <div className="flex-1 p-4 md:p-8 overflow-y-auto">
                <div className="max-w-2xl mx-auto">
                    {/* Anchor để cuộn lên */}
                    <div ref={topRef} />

                    {/* Notification Area - Hiển thị tĩnh */}
                    {notification && (
                        <div className={`mb-6 p-4 rounded-xl border flex items-start gap-3 shadow-sm animate-fade-in ${
                            notification.type === 'success' 
                            ? 'bg-green-50 border-green-200 text-green-800' 
                            : 'bg-red-50 border-red-200 text-red-800'
                        }`}>
                            {notification.type === 'success' ? (
                                <CheckCircle className="shrink-0 text-green-600" size={24} />
                            ) : (
                                <AlertCircle className="shrink-0 text-red-600" size={24} />
                            )}
                            <div>
                                <h4 className="font-semibold text-base md:text-lg tracking-tight">{notification.type === 'success' ? 'Thành công!' : 'Có lỗi xảy ra!'}</h4>
                                <p className="text-sm opacity-90">{notification.message}</p>
                            </div>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6 pb-10">
                        {activeTab === 'info' && (
                            <div className="space-y-6 animate-fade-in">
                                <h3 className="text-lg md:text-xl font-semibold text-gray-800 border-b pb-2 tracking-tight">Thông tin cá nhân</h3>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-600 mb-2">Tên đăng nhập</label>
                                        <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-500 cursor-not-allowed">
                                            <ShieldCheck size={18} />
                                            <span className="font-semibold">{currentUser.username}</span>
                                        </div>
                                        <p className="text-xs text-gray-400 mt-1.5 italic font-medium">* Tên đăng nhập không thể thay đổi.</p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-600 mb-2">Vai trò hệ thống</label>
                                        <div className="px-4 py-3 bg-blue-50 border border-blue-100 text-blue-700 rounded-xl font-semibold text-sm uppercase tracking-wider">
                                            {currentUser.role}
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-600 mb-2">Tên hiển thị <span className="text-red-500">*</span></label>
                                    <div className="relative">
                                        <input 
                                            type="text" 
                                            value={name}
                                            disabled={isLoading}
                                            onChange={(e) => setName(e.target.value)}
                                            className="w-full border border-gray-200 rounded-xl px-4 py-3 pl-11 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all disabled:bg-gray-50 font-medium text-slate-700"
                                            placeholder="Nhập tên hiển thị của bạn..."
                                        />
                                        <UserIcon size={18} className="absolute left-4 top-3.5 text-gray-400" />
                                    </div>
                                </div>

                                {linkedEmployee ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-600 mb-2">Phòng ban</label>
                                            <div className="relative">
                                                <input 
                                                    type="text" 
                                                    value={department}
                                                    disabled={isLoading}
                                                    onChange={(e) => setDepartment(e.target.value)}
                                                    className="w-full border border-gray-200 rounded-xl px-4 py-3 pl-11 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all disabled:bg-gray-50 font-medium text-slate-700"
                                                    placeholder="Nhập phòng ban..."
                                                />
                                                <Briefcase size={18} className="absolute left-4 top-3.5 text-gray-400" />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-600 mb-2">Chức vụ</label>
                                            <div className="relative">
                                                <input 
                                                    type="text" 
                                                    value={position}
                                                    disabled={isLoading}
                                                    onChange={(e) => setPosition(e.target.value)}
                                                    className="w-full border border-gray-200 rounded-xl px-4 py-3 pl-11 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all disabled:bg-gray-50 font-medium text-slate-700"
                                                    placeholder="Nhập chức vụ..."
                                                />
                                                <UserIcon size={18} className="absolute left-4 top-3.5 text-gray-400" />
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 flex items-start gap-3">
                                        <AlertCircle className="text-orange-600 shrink-0" size={20} />
                                        <div>
                                            <p className="text-sm text-orange-800 font-semibold uppercase tracking-tight">Chưa liên kết hồ sơ nhân viên</p>
                                            <p className="text-xs text-orange-700 mt-1 font-medium leading-relaxed">
                                                Vui lòng liên hệ Quản trị viên để liên kết tài khoản này với một hồ sơ nhân viên trong hệ thống.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* --- SETTING NOTIFICATION TOGGLE --- */}
                                <div className="mt-4 pt-6 border-t border-gray-100">
                                    <h4 className="text-sm font-medium text-gray-600 mb-4 flex items-center gap-2">
                                        <Bell size={16} className="text-purple-600"/> Cài đặt thông báo
                                    </h4>
                                    <div className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                        <div className="pr-4">
                                            <span className="text-sm font-medium text-slate-700">Thông báo tin nhắn nội bộ</span>
                                            <p className="text-[11px] text-slate-400 mt-0.5 font-medium leading-tight">Hiển thị thông báo ở góc màn hình khi có tin nhắn mới.</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer shrink-0">
                                            <input 
                                                type="checkbox" 
                                                className="sr-only peer"
                                                checked={notificationEnabled}
                                                onChange={handleNotificationToggle}
                                            />
                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'security' && (
                            <div className="space-y-6 animate-fade-in">
                                <h3 className="text-lg md:text-xl font-semibold text-gray-800 border-b pb-2 tracking-tight">Đổi mật khẩu</h3>
                                <div className="bg-blue-50 p-4 rounded-xl text-sm text-blue-800 mb-4 border border-blue-100 font-medium leading-relaxed">
                                    <p>Để bảo mật, vui lòng nhập mật khẩu hiện tại trước khi thay đổi mật khẩu mới.</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-600 mb-2">Mật khẩu hiện tại <span className="text-red-500">*</span></label>
                                    <div className="relative">
                                        <input 
                                            type="password" 
                                            value={currentPassword}
                                            disabled={isLoading}
                                            onChange={(e) => setCurrentPassword(e.target.value)}
                                            className="w-full border border-gray-200 rounded-xl px-4 py-3 pl-11 focus:ring-2 focus:ring-blue-500 outline-none transition-all disabled:bg-gray-50 font-medium text-slate-700"
                                            placeholder="••••••"
                                        />
                                        <Lock size={18} className="absolute left-4 top-3.5 text-gray-400" />
                                    </div>
                                </div>

                                <div className="pt-6 border-t border-gray-100 space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-600 mb-2">Mật khẩu mới</label>
                                        <div className="relative">
                                            <input 
                                                type="password" 
                                                value={newPassword}
                                                disabled={isLoading}
                                                onChange={(e) => setNewPassword(e.target.value)}
                                                className="w-full border border-gray-200 rounded-xl px-4 py-3 pl-11 focus:ring-2 focus:ring-blue-500 outline-none transition-all disabled:bg-gray-50 font-medium text-slate-700"
                                                placeholder="Mật khẩu mới (Tối thiểu 3 ký tự)"
                                            />
                                            <Lock size={18} className="absolute left-4 top-3.5 text-gray-400" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-600 mb-2">Xác nhận mật khẩu mới</label>
                                        <div className="relative">
                                            <input 
                                                type="password" 
                                                value={confirmPassword}
                                                disabled={isLoading}
                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                                className="w-full border border-gray-200 rounded-xl px-4 py-3 pl-11 focus:ring-2 focus:ring-blue-500 outline-none transition-all disabled:bg-gray-50 font-medium text-slate-700"
                                                placeholder="Nhập lại mật khẩu mới"
                                            />
                                            <CheckCircle size={18} className="absolute left-4 top-3.5 text-gray-400" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="pt-8 border-t border-gray-100">
                            <button 
                                type="submit"
                                disabled={isLoading}
                                className="w-full md:w-auto flex items-center justify-center gap-2 px-10 py-4 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 hover:shadow-xl font-semibold text-base md:text-lg disabled:opacity-70 disabled:cursor-not-allowed md:ml-auto"
                            >
                                {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                                {isLoading ? 'Đang lưu...' : 'Lưu Thay Đổi'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    </div>
  );
};

export default AccountSettingsView;
