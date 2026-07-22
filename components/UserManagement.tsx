
import React, { useState, useEffect, useRef } from 'react';
import { User, UserRole, Employee } from '../types';
import { Plus, Trash2, Edit, Save, X, Shield, User as UserIcon, Lock, Briefcase, Download, FileSpreadsheet, Upload, Search } from 'lucide-react';
import { confirmAction } from '../utils/appHelpers';
import * as XLSX from 'xlsx-js-style';

interface UserManagementProps {
  users: User[];
  employees: Employee[];
  onAddUser: (user: User) => void;
  onUpdateUser: (user: User) => void;
  onDeleteUser: (username: string) => void;
}

const UserManagement: React.FC<UserManagementProps> = ({
  users,
  employees,
  onAddUser,
  onUpdateUser,
  onDeleteUser
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const initialFormState: User = {
    username: '',
    password: '',
    name: '',
    role: UserRole.EMPLOYEE,
    employeeId: ''
  };

  const [formData, setFormData] = useState<User>(initialFormState);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (editingUser) {
      setFormData(editingUser);
    } else {
      setFormData(initialFormState);
    }
  }, [editingUser, isModalOpen]);

  const filteredUsers = users.filter(user => 
    user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.username || !formData.name || !formData.password) {
        alert("Vui lòng điền đầy đủ thông tin bắt buộc.");
        return;
    }

    if (editingUser) {
        onUpdateUser(formData);
    } else {
        // Check existence
        if (users.find(u => u.username === formData.username)) {
            alert("Tên đăng nhập đã tồn tại!");
            return;
        }
        onAddUser(formData);
    }
    setIsModalOpen(false);
    setEditingUser(null);
  };

  const handleDelete = async (username: string) => {
      if (await confirmAction(`Bạn có chắc chắn muốn xóa tài khoản ${username}?`)) {
          onDeleteUser(username);
      }
  };

  // Helper to get employee name
  const getEmployeeName = (empId?: string) => {
      if (!empId) return '---';
      const emp = employees.find(e => e.id === empId);
      return emp ? `${emp.name} (${emp.department})` : empId;
  };

  // --- TÍNH NĂNG IMPORT EXCEL ---

  const handleDownloadSample = () => {
      const headers = ["USERNAME", "PASSWORD", "DISPLAY_NAME", "ROLE", "EMPLOYEE_ID"];
      const data = [
          ["nguyenvana", "123456", "Nguyễn Văn A", "EMPLOYEE", "NV001"],
          ["admin_phu", "123456", "Trần Thị B", "SUBADMIN", ""],
      ];
      
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
      
      // Định dạng độ rộng cột
      ws['!cols'] = [{ wch: 15 }, { wch: 15 }, { wch: 25 }, { wch: 15 }, { wch: 15 }];

      XLSX.utils.book_append_sheet(wb, ws, "Mau_Tai_Khoan");
      XLSX.writeFile(wb, "Mau_Nhap_Tai_Khoan.xlsx");
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const wb = XLSX.read(data, { type: 'array' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

        let successCount = 0;
        let failCount = 0;

        rows.forEach((row: any) => {
           const normalizedRow: Record<string, any> = {};
           // Chuẩn hóa key về chữ hoa để dễ xử lý
           Object.keys(row).forEach(k => normalizedRow[k.trim().toUpperCase()] = row[k]);
           
           const username = String(normalizedRow['USERNAME'] || normalizedRow['TÊN ĐĂNG NHẬP'] || '').trim();
           const password = String(normalizedRow['PASSWORD'] || normalizedRow['MẬT KHẨU'] || '123').trim();
           const name = String(normalizedRow['DISPLAY_NAME'] || normalizedRow['TÊN HIỂN THỊ'] || normalizedRow['HỌ TÊN'] || '').trim();
           
           // Xử lý Role
           let roleStr = String(normalizedRow['ROLE'] || normalizedRow['VAI TRÒ'] || 'EMPLOYEE').toUpperCase().trim();
           let role: UserRole = UserRole.EMPLOYEE;
           
           if (roleStr === 'ADMIN') role = UserRole.ADMIN;
           else if (roleStr === 'SUBADMIN') role = UserRole.SUBADMIN;
           else if (roleStr === 'TEAM_LEADER' || roleStr === 'NHÓM TRƯỞNG') role = UserRole.TEAM_LEADER;
           else if (roleStr === 'ONEDOOR' || roleStr === 'MỘT CỬA') role = UserRole.ONEDOOR;

           const employeeId = String(normalizedRow['EMPLOYEE_ID'] || normalizedRow['MÃ NV'] || '').trim();

           if (username && name) {
               // Kiểm tra trùng lặp
               if (users.find(u => u.username === username)) {
                   failCount++; // Bỏ qua nếu đã tồn tại
               } else {
                   onAddUser({
                       username,
                       password,
                       name,
                       role,
                       employeeId
                   });
                   successCount++;
               }
           }
        });

        alert(`Kết quả nhập liệu:\n- Thành công: ${successCount} tài khoản\n- Bỏ qua (Trùng lặp): ${failCount} tài khoản`);

      } catch (error) {
        console.error(error);
        alert('Lỗi đọc file Excel. Vui lòng kiểm tra định dạng.');
      } finally {
         if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-full overflow-hidden animate-fade-in-up">
        <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gray-50">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2 tracking-tight">
                <Shield className="text-blue-600" size={20} /> Quản Lý Tài Khoản
            </h2>
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input 
                        type="text" 
                        placeholder="Tìm tài khoản..." 
                        className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex gap-2 w-full sm:w-auto overflow-x-auto no-scrollbar pb-1 sm:pb-0">
                    <input 
                        type="file" 
                        ref={fileInputRef}
                        onChange={handleImportExcel}
                        accept=".xlsx, .xls"
                        className="hidden"
                    />
                    <button 
                        onClick={handleDownloadSample}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-1 bg-white text-gray-700 border border-gray-300 px-3 py-2 rounded-xl hover:bg-gray-50 font-medium text-sm shadow-sm transition-colors whitespace-nowrap"
                    >
                        <Download size={14} /> Mẫu
                    </button>
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-1 bg-green-600 text-white px-3 py-2 rounded-xl hover:bg-green-700 font-medium text-sm shadow-sm transition-colors whitespace-nowrap"
                    >
                        <FileSpreadsheet size={14} /> Nhập
                    </button>
                    <button
                        onClick={() => { setEditingUser(null); setIsModalOpen(true); }}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-1 bg-blue-600 text-white px-3 py-2 rounded-xl hover:bg-blue-700 font-medium text-sm shadow-sm transition-colors whitespace-nowrap ml-auto sm:ml-0"
                    >
                        <Plus size={14} /> Thêm
                    </button>
                </div>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto p-0 bg-gray-50/30">
            {/* Desktop Table View */}
            <div className="hidden md:block">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-white sticky top-0 shadow-sm z-10 text-sm font-medium text-gray-600">
                        <tr>
                            <th className="p-4 border-b">Tên đăng nhập</th>
                            <th className="p-4 border-b">Tên hiển thị</th>
                            <th className="p-4 border-b">Vai trò</th>
                            <th className="p-4 border-b">Liên kết nhân viên</th>
                            <th className="p-4 border-b text-center">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
                        {filteredUsers.length > 0 ? (
                            filteredUsers.map(user => (
                                <tr key={user.username} className="hover:bg-blue-50/50 transition-colors bg-white">
                                    <td className="p-4 font-semibold text-gray-900">{user.username}</td>
                                    <td className="p-4 font-medium">{user.name}</td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded-lg text-sm font-medium border ${
                                            user.role === UserRole.ADMIN ? 'bg-red-50 text-red-700 border-red-200' :
                                            user.role === UserRole.SUBADMIN ? 'bg-orange-50 text-orange-700 border-orange-200' :
                                            user.role === UserRole.TEAM_LEADER ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                            user.role === UserRole.ONEDOOR ? 'bg-green-50 text-green-700 border-green-200' :
                                            'bg-blue-50 text-blue-700 border-blue-200'
                                        }`}>
                                            {user.role}
                                        </span>
                                    </td>
                                    <td className="p-4 text-gray-600">
                                        <div className="flex items-center gap-2 font-medium">
                                            <Briefcase size={14} className="text-gray-400" />
                                            {getEmployeeName(user.employeeId)}
                                        </div>
                                    </td>
                                    <td className="p-4 text-center">
                                        <div className="flex justify-center gap-2">
                                            <button
                                                onClick={() => { setEditingUser(user); setIsModalOpen(true); }}
                                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                title="Sửa"
                                            >
                                                <Edit size={16} />
                                            </button>
                                            {user.role !== UserRole.ADMIN && (
                                                <button
                                                    onClick={() => handleDelete(user.username)}
                                                    className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="Xóa"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={5} className="p-8 text-center text-gray-400 italic font-medium">
                                    Không tìm thấy tài khoản nào phù hợp.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden p-4 space-y-4">
                {filteredUsers.length > 0 ? (
                    filteredUsers.map(user => (
                        <div key={user.username} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm space-y-3 relative group">
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-sm font-semibold shrink-0 border border-blue-100">
                                        {user.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <h3 className="text-base font-semibold text-slate-800 tracking-tight">{user.name}</h3>
                                        <p className="text-xs font-semibold text-gray-500">@{user.username}</p>
                                    </div>
                                </div>
                                <span className={`px-2 py-1 rounded-lg text-sm font-medium border ${
                                    user.role === UserRole.ADMIN ? 'bg-red-50 text-red-700 border-red-200' :
                                    user.role === UserRole.SUBADMIN ? 'bg-orange-50 text-orange-700 border-orange-200' :
                                    user.role === UserRole.TEAM_LEADER ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                    user.role === UserRole.ONEDOOR ? 'bg-green-50 text-green-700 border-green-200' :
                                    'bg-blue-50 text-blue-700 border-blue-200'
                                }`}>
                                    {user.role}
                                </span>
                            </div>

                            <div className="pt-2 border-t border-gray-50">
                                <p className="text-sm font-medium text-gray-600 mb-1">Liên kết nhân viên</p>
                                <div className="flex items-center gap-1 text-sm font-semibold text-slate-600">
                                    <Briefcase size={12} className="text-gray-400" />
                                    <span className="truncate">{user.employeeId ? employees.find(e => e.id === user.employeeId)?.name || user.employeeId : '---'}</span>
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-3 border-t border-gray-50">
                                <button
                                    onClick={() => { setEditingUser(user); setIsModalOpen(true); }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-xl font-medium text-sm"
                                >
                                    <Edit size={14} /> Sửa
                                </button>
                                {user.role !== UserRole.ADMIN && (
                                    <button
                                        onClick={() => handleDelete(user.username)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-xl font-medium text-sm"
                                    >
                                        <Trash2 size={14} /> Xóa
                                    </button>
                                )}
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="p-8 text-center text-gray-400 italic font-medium">
                        Không tìm thấy tài khoản nào phù hợp.
                    </div>
                )}
            </div>
        </div>

        {isModalOpen && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] animate-scale-in">
                    <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                        <h3 className="text-xl font-semibold text-slate-800 tracking-tight">
                            {editingUser ? 'Cập nhật tài khoản' : 'Thêm tài khoản mới'}
                        </h3>
                        <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-2 rounded-xl transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                    <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-2">Tên đăng nhập <span className="text-red-500">*</span></label>
                            <div className="relative">
                                <input
                                    type="text"
                                    disabled={!!editingUser}
                                    className={`w-full border rounded-xl px-4 py-3 pl-10 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${editingUser ? 'bg-gray-100 text-gray-500 border-gray-200' : 'border-gray-200'}`}
                                    value={formData.username}
                                    onChange={e => setFormData({...formData, username: e.target.value})}
                                    placeholder="username"
                                />
                                <UserIcon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-2">Mật khẩu <span className="text-red-500">*</span></label>
                            <div className="relative">
                                <input
                                    type="text"
                                    className="w-full border border-gray-200 rounded-xl px-4 py-3 pl-10 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                    value={formData.password}
                                    onChange={e => setFormData({...formData, password: e.target.value})}
                                    placeholder="password"
                                />
                                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-2">Tên hiển thị <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                value={formData.name}
                                onChange={e => setFormData({...formData, name: e.target.value})}
                                placeholder="Nguyễn Văn A"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-2">Vai trò hệ thống</label>
                            <select
                                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all appearance-none bg-white"
                                value={formData.role}
                                onChange={e => setFormData({...formData, role: e.target.value as UserRole})}
                            >
                                <option value={UserRole.EMPLOYEE}>Nhân viên (Employee)</option>
                                <option value={UserRole.TEAM_LEADER}>Nhóm trưởng (Team Leader)</option>
                                <option value={UserRole.ONEDOOR}>Một cửa (One Door)</option>
                                <option value={UserRole.SUBADMIN}>Phó quản trị (Sub Admin)</option>
                                <option value={UserRole.ADMIN}>Quản trị viên (Admin)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-2">Liên kết hồ sơ nhân viên</label>
                            <select
                                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all appearance-none bg-white"
                                value={formData.employeeId || ''}
                                onChange={e => setFormData({...formData, employeeId: e.target.value})}
                            >
                                <option value="">-- Không liên kết --</option>
                                {employees.map(emp => (
                                    <option key={emp.id} value={emp.id}>
                                        {emp.name} - {emp.department}
                                    </option>
                                ))}
                            </select>
                            <p className="text-xs text-gray-400 mt-2 font-medium">Liên kết để sử dụng các tính năng cá nhân hóa (My Tasks).</p>
                        </div>

                        <div className="pt-6 flex flex-col sm:flex-row justify-end gap-3 border-t border-gray-100">
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="w-full sm:w-auto px-6 py-3 text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl font-medium text-sm transition-colors"
                            >
                                Hủy
                            </button>
                            <button
                                type="submit"
                                className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-100 font-medium text-sm transition-all active:scale-95"
                            >
                                <Save size={16} /> Lưu
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        )}
    </div>
  );
};

export default UserManagement;
