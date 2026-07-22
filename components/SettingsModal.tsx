
import React, { useState, useRef, useEffect } from 'react';
import { Employee, User, UserRole } from '../types';
import { X, Plus, Trash2, Save, User as UserIcon, FileSpreadsheet, Upload, Download, List, Edit2, CheckSquare } from 'lucide-react';
import * as XLSX from 'xlsx-js-style';
import { confirmAction } from '../utils/appHelpers';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  onSaveEmployee: (employee: Employee) => void;
  onDeleteEmployee: (id: string) => void;
  wards: string[]; 
  currentUser: User | null; 
  onDeleteAllData: () => void; 
}

const SettingsModal: React.FC<SettingsModalProps> = ({ 
  isOpen, 
  onClose, 
  employees, 
  onSaveEmployee,
  onDeleteEmployee,
  wards, 
  currentUser
}) => {
  // Thay đổi: Dùng Tab
  const [activeTab, setActiveTab] = useState<'list' | 'detail'>('list');
  const [editingEmployee, setEditingEmployee] = useState<Partial<Employee>>({ id: '', name: '', department: '', position: '', managedWards: [] });
  const [isNew, setIsNew] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Khi mở modal, mặc định vào Tab List và reset form
  useEffect(() => {
      if(isOpen) {
          setActiveTab('list');
          setEditingEmployee({ id: '', name: '', department: '', position: '', managedWards: [] });
          setIsNew(true);
      }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDelete = async (id: string) => {
    if (await confirmAction('Bạn có chắc chắn muốn xóa nhân viên này?')) {
      onDeleteEmployee(id);
      // Nếu đang sửa nhân viên bị xóa, quay về list
      if (editingEmployee.id === id) {
          setActiveTab('list');
      }
    }
  };

  const handleEditClick = (emp: Employee) => {
      setEditingEmployee({ ...emp });
      setIsNew(false);
      setActiveTab('detail');
  };

  const handleAddNewClick = () => {
      setEditingEmployee({ 
          id: `NV${Math.floor(Math.random()*1000)}`, 
          name: '', 
          department: '',
          position: '',
          managedWards: [] 
      });
      setIsNew(true);
      setActiveTab('detail');
  };

  const handleSave = () => {
    if (!editingEmployee.name || !editingEmployee.id) {
        alert('Vui lòng nhập tên và mã nhân viên');
        return;
    }
    const newEmp = editingEmployee as Employee;
    onSaveEmployee(newEmp);
    alert(isNew ? 'Đã thêm nhân viên mới!' : 'Đã cập nhật thông tin!');
    setActiveTab('list');
  };

  const toggleWard = (ward: string) => {
    setEditingEmployee(prev => {
        const currentWards = prev.managedWards || [];
        if (currentWards.includes(ward)) {
            return { ...prev, managedWards: currentWards.filter(w => w !== ward) };
        } else {
            return { ...prev, managedWards: [...currentWards, ward] };
        }
    });
  };

  const handleChange = (field: keyof Employee, value: string) => {
      setEditingEmployee(prev => ({ ...prev, [field]: value }));
  };

  // --- IMPORT EXCEL LOGIC ---
  const handleDownloadSample = () => {
      const headers = ["MÃ NV", "HỌ TÊN", "PHÒNG BAN", "CHỨC VỤ", "PHỤ TRÁCH"];
      const data = [
          ["NV001", "Trần Văn B", "Kỹ thuật", "Trưởng phòng", "Tân Quan, Minh Đức"],
          ["NV002", "Lê Thị C", "Văn phòng", "Nhân viên", ""],
      ];
      const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Nhan_Su_Mau");
      XLSX.writeFile(wb, "Nhan_Su_Mau.xlsx");
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

        let count = 0;
        rows.forEach((row: any) => {
           const normalizedRow: Record<string, any> = {};
           Object.keys(row).forEach(k => normalizedRow[k.trim().toUpperCase()] = row[k]);
           
           const id = String(normalizedRow['MÃ NHÂN VIÊN'] || normalizedRow['MÃ NV'] || normalizedRow['ID'] || '');
           const name = String(normalizedRow['HỌ TÊN'] || normalizedRow['TÊN'] || normalizedRow['NAME'] || '');
           const department = String(normalizedRow['PHÒNG BAN'] || normalizedRow['DEPARTMENT'] || '');
           const position = String(normalizedRow['CHỨC VỤ'] || normalizedRow['POSITION'] || '');
           const wardsRaw = String(normalizedRow['PHỤ TRÁCH'] || normalizedRow['XÃ PHƯỜNG'] || normalizedRow['KHU VỰC'] || '');

           if (id && name) {
               const managedWards = wardsRaw.split(',').map(w => w.trim()).filter(w => w);
               onSaveEmployee({ id, name, department, position, managedWards });
               count++;
           }
        });
        alert(`Đã nhập thành công ${count} nhân viên.`);
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-fade-in-up">
        {/* HEADER */}
        <div className="flex justify-between items-center p-5 border-b bg-gray-50 shrink-0">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <UserIcon className="text-blue-600" />
            Quản Lý Nhân Sự
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-red-600 transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* TABS HEADER */}
        <div className="flex border-b border-gray-200 bg-white px-4 pt-2 shrink-0">
            <button 
                onClick={() => setActiveTab('list')}
                className={`px-4 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'list' ? 'border-blue-600 text-blue-700 bg-blue-50/50 rounded-t-lg' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
            >
                <List size={16} /> Danh sách nhân viên
            </button>
            <button 
                onClick={() => setActiveTab('detail')}
                className={`px-4 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'detail' ? 'border-blue-600 text-blue-700 bg-blue-50/50 rounded-t-lg' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
            >
                {isNew ? <Plus size={16} /> : <Edit2 size={16} />}
                {isNew ? 'Thêm mới' : 'Chi tiết / Chỉnh sửa'}
            </button>
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-hidden p-0 bg-gray-50">
            
            {/* TAB 1: DANH SÁCH */}
            {activeTab === 'list' && (
                <div className="h-full flex flex-col">
                    <div className="p-4 bg-white border-b border-gray-200 flex justify-between items-center shrink-0">
                        <div className="flex gap-2">
                            <input 
                                type="file" 
                                ref={fileInputRef}
                                onChange={handleImportExcel}
                                accept=".xlsx, .xls"
                                className="hidden"
                            />
                            <button onClick={handleDownloadSample} className="px-3 py-1.5 bg-white border border-gray-300 rounded-md text-xs font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-1">
                                <Download size={14} /> Mẫu Excel
                            </button>
                            <button onClick={() => fileInputRef.current?.click()} className="px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-md text-xs font-medium hover:bg-green-100 flex items-center gap-1">
                                <FileSpreadsheet size={14} /> Nhập Excel
                            </button>
                        </div>
                        <button onClick={handleAddNewClick} className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-bold hover:bg-blue-700 flex items-center gap-1 shadow-sm">
                            <Plus size={16} /> Thêm nhân viên
                        </button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-4">
                        {employees.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {employees.map(emp => (
                                    <div 
                                        key={emp.id} 
                                        className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-all cursor-pointer group relative"
                                        onClick={() => handleEditClick(emp)}
                                    >
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h3 className="font-bold text-gray-800 text-base">{emp.name}</h3>
                                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded border">{emp.id}</span>
                                                    {emp.position && <span className="text-xs text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded border border-blue-100">{emp.position}</span>}
                                                    <span className="text-xs text-gray-500 font-medium">{emp.department}</span>
                                                </div>
                                            </div>
                                            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold shrink-0">
                                                {emp.name.charAt(0).toUpperCase()}
                                            </div>
                                        </div>
                                        
                                        {emp.managedWards.length > 0 && (
                                            <div className="mt-3 pt-3 border-t border-gray-100">
                                                <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">Phụ trách:</p>
                                                <div className="flex flex-wrap gap-1">
                                                    {emp.managedWards.map(w => (
                                                        <span key={w} className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-100">{w}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        <button 
                                            onClick={(e) => { e.stopPropagation(); handleDelete(emp.id); }}
                                            className="absolute top-2 right-2 p-1.5 bg-white text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full border border-transparent hover:border-red-100 opacity-0 group-hover:opacity-100 transition-all shadow-sm"
                                            title="Xóa nhân viên"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400">
                                <UserIcon size={48} className="mb-2 opacity-50"/>
                                <p>Chưa có nhân viên nào.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* TAB 2: CHI TIẾT */}
            {activeTab === 'detail' && (
                <div className="h-full flex flex-col bg-white">
                    <div className="flex-1 overflow-y-auto p-6 md:p-8">
                        <div className="max-w-2xl mx-auto space-y-6">
                            <div className="flex justify-between items-center border-b pb-4">
                                <h3 className="text-lg font-bold text-gray-800">
                                    {isNew ? 'Thêm nhân viên mới' : `Chỉnh sửa: ${editingEmployee.name}`}
                                </h3>
                                {!isNew && (
                                    <button 
                                        onClick={handleAddNewClick} 
                                        className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                                    >
                                        <Plus size={14} /> Tạo mới
                                    </button>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Mã nhân viên <span className="text-red-500">*</span></label>
                                    <input 
                                        type="text" 
                                        value={editingEmployee.id || ''}
                                        onChange={(e) => handleChange('id', e.target.value)}
                                        className="w-full border border-gray-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                                        placeholder="Ví dụ: NV001"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Họ và tên <span className="text-red-500">*</span></label>
                                    <input 
                                        type="text" 
                                        value={editingEmployee.name || ''}
                                        onChange={(e) => handleChange('name', e.target.value)}
                                        className="w-full border border-gray-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                                        placeholder="Ví dụ: Nguyễn Văn A"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Phòng ban</label>
                                    <input 
                                        type="text" 
                                        value={editingEmployee.department || ''}
                                        onChange={(e) => handleChange('department', e.target.value)}
                                        className="w-full border border-gray-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                                        placeholder="Ví dụ: Phòng Kỹ Thuật"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Chức vụ</label>
                                    <input 
                                        type="text" 
                                        value={editingEmployee.position || ''}
                                        onChange={(e) => handleChange('position', e.target.value)}
                                        className="w-full border border-gray-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                                        placeholder="Ví dụ: Trưởng phòng"
                                    />
                                </div>
                            </div>

                            <div className="bg-blue-50 p-5 rounded-xl border border-blue-100">
                                <label className="block text-sm font-bold text-blue-800 mb-3 flex items-center gap-2">
                                    <CheckSquare size={16} /> Địa bàn phụ trách (Ưu tiên)
                                </label>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                                    {wards.map(ward => (
                                        <label key={ward} className="flex items-center gap-2 cursor-pointer bg-white p-2 rounded border border-blue-200 hover:border-blue-400 transition-colors select-none">
                                            <input 
                                                type="checkbox"
                                                checked={editingEmployee.managedWards?.includes(ward) || false}
                                                onChange={() => toggleWard(ward)}
                                                className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                                            />
                                            <span className="text-sm text-gray-700">{ward}</span>
                                        </label>
                                    ))}
                                </div>
                                <p className="text-xs text-blue-600 mt-2 italic">
                                    * Nhân viên phụ trách địa bàn nào sẽ được gợi ý ưu tiên khi giao hồ sơ thuộc địa bàn đó.
                                </p>
                            </div>
                        </div>
                    </div>
                    
                    <div className="p-4 border-t bg-gray-50 flex justify-end gap-3 shrink-0">
                        <button 
                            onClick={() => setActiveTab('list')}
                            className="px-5 py-2.5 text-gray-600 hover:bg-gray-200 rounded-lg font-medium transition-colors"
                        >
                            Hủy bỏ
                        </button>
                        <button 
                            onClick={handleSave} 
                            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-md font-bold transition-transform active:scale-95"
                        >
                            <Save size={18} /> {isNew ? 'Lưu nhân viên' : 'Cập nhật'}
                        </button>
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
