
import React, { useState, useEffect } from 'react';
import { User, Employee } from '../types';
import { X, Save, Lock, User as UserIcon, Briefcase, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

interface AccountSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  linkedEmployee: Employee | undefined;
  onUpdate: (data: { name: string; password?: string; department?: string; position?: string }) => Promise<boolean>;
}

const AccountSettingsModal: React.FC<AccountSettingsModalProps> = ({ 
  isOpen, 
  onClose, 
  currentUser, 
  linkedEmployee, 
  onUpdate 
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
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (isOpen) {
      setName(currentUser.name);
      setDepartment(linkedEmployee?.department || '');
      setPosition(linkedEmployee?.position || '');
      // Reset password fields
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setError('');
      setSuccess('');
      setActiveTab('info');
      setIsLoading(false);
    }
  }, [isOpen, currentUser, linkedEmployee]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
        const updateData: { name: string; password?: string; department?: string; position?: string } = {
            name: name.trim()
        };

        // Validate Info
        if (!updateData.name) throw new Error("Tên hiển thị không được để trống.");

        // Handle Department/Position update if linked
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
                ? "Đổi mật khẩu thành công! Vui lòng ghi nhớ mật khẩu mới." 
                : "Cập nhật thông tin cá nhân thành công!";
            
            setSuccess(successMsg);
            
            if (activeTab === 'security') {
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
            }
        } else {
            throw new Error("Không thể kết nối đến máy chủ. Vui lòng thử lại.");
        }

    } catch (err: any) {
        setError(err.message || "Đã xảy ra lỗi không xác định.");
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-fade-in-up flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b bg-gray-50 shrink-0">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <UserIcon size={20} className="text-blue-600" />
            Quản lý tài khoản
          </h2>
          <button onClick={onClose} disabled={isLoading} className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50">
            <X size={24} />
          </button>
        </div>

        <div className="flex border-b border-gray-200 shrink-0">
            <button 
                onClick={() => !isLoading && setActiveTab('info')}
                disabled={isLoading}
                className={`flex-1 py-3 text-sm font-medium text-center transition-colors ${activeTab === 'info' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-gray-600 hover:bg-gray-50'} disabled:opacity-50`}
            >
                Thông tin chung
            </button>
            <button 
                onClick={() => !isLoading && setActiveTab('security')}
                disabled={isLoading}
                className={`flex-1 py-3 text-sm font-medium text-center transition-colors ${activeTab === 'security' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-gray-600 hover:bg-gray-50'} disabled:opacity-50`}
            >
                Đổi mật khẩu
            </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
            {/* Khu vực thông báo - Luôn hiển thị ở trên cùng */}
            {error && (
                <div className="flex items-start gap-2 bg-red-50 text-red-700 p-3 rounded-lg text-sm border border-red-200 animate-fade-in">
                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                    <span>{error}</span>
                </div>
            )}
            {success && (
                <div className="flex items-start gap-2 bg-green-50 text-green-700 p-3 rounded-lg text-sm border border-green-200 animate-fade-in">
                    <CheckCircle size={16} className="mt-0.5 shrink-0" />
                    <span>{success}</span>
                </div>
            )}

            {activeTab === 'info' && (
                <div className="space-y-4 animate-fade-in">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tên đăng nhập</label>
                        <input 
                            type="text" 
                            disabled 
                            value={currentUser.username} 
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-100 text-gray-500 cursor-not-allowed"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tên hiển thị <span className="text-red-500">*</span></label>
                        <div className="relative">
                            <input 
                                type="text" 
                                value={name}
                                disabled={isLoading}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 pl-9 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all disabled:bg-gray-50 disabled:text-gray-400"
                                placeholder="Nhập tên hiển thị..."
                            />
                            <UserIcon size={16} className="absolute left-3 top-3 text-gray-400" />
                        </div>
                    </div>
                    {linkedEmployee ? (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Phòng ban</label>
                                <div className="relative">
                                    <input 
                                        type="text" 
                                        value={department}
                                        disabled={isLoading}
                                        onChange={(e) => setDepartment(e.target.value)}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 pl-9 focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-50 disabled:text-gray-400"
                                        placeholder="Nhập phòng ban..."
                                    />
                                    <Briefcase size={16} className="absolute left-3 top-3 text-gray-400" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Chức vụ</label>
                                <div className="relative">
                                    <input 
                                        type="text" 
                                        value={position}
                                        disabled={isLoading}
                                        onChange={(e) => setPosition(e.target.value)}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 pl-9 focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-50 disabled:text-gray-400"
                                        placeholder="Nhập chức vụ..."
                                    />
                                    <UserIcon size={16} className="absolute left-3 top-3 text-gray-400" />
                                </div>
                            </div>
                            <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                                <CheckCircle size={12} /> Đã liên kết với hồ sơ nhân viên.
                            </p>
                        </>
                    ) : (
                        <div className="bg-orange-50 p-3 rounded-lg border border-orange-200">
                            <p className="text-xs text-orange-700">
                                Tài khoản này chưa liên kết với hồ sơ nhân viên nên không thể chỉnh sửa Phòng ban/Chức vụ tại đây.
                            </p>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'security' && (
                <div className="space-y-4 animate-fade-in">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu hiện tại <span className="text-red-500">*</span></label>
                        <div className="relative">
                            <input 
                                type="password" 
                                value={currentPassword}
                                disabled={isLoading}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 pl-9 focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-50"
                                placeholder="••••••"
                            />
                            <Lock size={16} className="absolute left-3 top-3 text-gray-400" />
                        </div>
                    </div>
                    <div className="border-t border-gray-100 my-2 pt-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu mới</label>
                        <div className="relative">
                            <input 
                                type="password" 
                                value={newPassword}
                                disabled={isLoading}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 pl-9 focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-50"
                                placeholder="••••••"
                            />
                            <Lock size={16} className="absolute left-3 top-3 text-gray-400" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Xác nhận mật khẩu mới</label>
                        <div className="relative">
                            <input 
                                type="password" 
                                value={confirmPassword}
                                disabled={isLoading}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 pl-9 focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-50"
                                placeholder="••••••"
                            />
                            <CheckCircle size={16} className="absolute left-3 top-3 text-gray-400" />
                        </div>
                    </div>
                </div>
            )}

            <div className="pt-2 flex justify-end gap-3 border-t">
                <button 
                    type="button"
                    onClick={onClose}
                    disabled={isLoading}
                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
                >
                    Đóng
                </button>
                <button 
                    type="submit"
                    disabled={isLoading}
                    className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm text-sm font-medium disabled:opacity-70 min-w-[120px] justify-center"
                >
                    {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    {isLoading ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
            </div>
        </form>
      </div>
    </div>
  );
};

export default AccountSettingsModal;
