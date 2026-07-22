import React, { useState } from 'react';
import { X, CheckCircle, AlertCircle, FileSignature } from 'lucide-react';
import { RecordFile, UserRole, User, Employee } from '../../types';

interface SubmitModalProps {
    isOpen: boolean;
    onClose: () => void;
    records: RecordFile[];
    onConfirm: (directorId: string) => void;
    users: User[];
    employees: Employee[];
    isCheckMode?: boolean; // MỚI: Chế độ trình kiểm tra
}

const SubmitModal: React.FC<SubmitModalProps> = ({ isOpen, onClose, records, onConfirm, users, employees, isCheckMode }) => {
    const [selectedDirector, setSelectedDirector] = useState<string>('');

    // Lọc ra các user phù hợp
    let targetUsers = users.filter((u: User) => {
        if (!u.employeeId) return false;
        const emp = employees.find(e => e.id === u.employeeId);
        if (!emp) return false;
        
        if (isCheckMode) {
            // Chế độ trình kiểm tra: CHỈ Tổ trưởng, Tổ phó của Tổ đo đạc
            const dept = emp.department?.toLowerCase() || '';
            const pos = emp.position?.toLowerCase() || '';
            
            const isDoDac = dept.includes('đo đạc');
            const isLeader = pos.includes('tổ trưởng') || pos.includes('tổ phó');
            
            return isDoDac && isLeader;
        } else {
            // Chế độ trình ký: CHỈ Giám đốc, Phó giám đốc
            const pos = emp.position?.toLowerCase() || '';
            const dept = emp.department?.toLowerCase() || '';
            
            const isDirectorPos = pos.includes('giám đốc') || pos.includes('phó giám đốc');
            const isDirectorDept = dept.includes('ban giám đốc') || dept.includes('ban lãnh đạo');
            
            return isDirectorPos || isDirectorDept;
        }
    });

    if (!isOpen) return null;

    const handleSubmit = () => {
        if (!selectedDirector) {
            alert(isCheckMode ? 'Vui lòng chọn người kiểm tra.' : 'Vui lòng chọn người được trình ký.');
            return;
        }
        onConfirm(selectedDirector);
        setSelectedDirector('');
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all animate-fade-in-up">
                <div className={`${isCheckMode ? 'bg-orange-600' : 'bg-indigo-600'} p-4 flex justify-between items-center text-white`}>
                    <h2 className="text-lg font-bold flex items-center gap-2">
                        <FileSignature size={20} />
                        {isCheckMode ? 'Trình Kiểm Tra' : 'Trình Ký Duyệt'}
                    </h2>
                    <button onClick={onClose} className={`${isCheckMode ? 'text-orange-200' : 'text-indigo-200'} hover:text-white transition-colors`}>
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6">
                    <div className="mb-6">
                        <p className="text-gray-700 mb-2 font-medium">
                            Bạn đang {isCheckMode ? 'trình kiểm tra' : 'trình ký'} <span className={`font-bold ${isCheckMode ? 'text-orange-600' : 'text-indigo-600'}`}>{records.length}</span> hồ sơ.
                        </p>
                        <p className="text-sm text-gray-500 mb-4">
                            Vui lòng chọn {isCheckMode ? 'Tổ trưởng/Tổ phó' : 'Giám đốc/Phó giám đốc'} để {isCheckMode ? 'trình kiểm tra' : 'trình ký'}:
                        </p>
                        
                        <div className="space-y-2">
                            {targetUsers.map((director: User) => (
                                <label 
                                    key={director.employeeId} 
                                    className={`flex items-center p-3 border rounded-xl cursor-pointer transition-all ${selectedDirector === director.employeeId ? (isCheckMode ? 'border-orange-500 bg-orange-50 shadow-sm' : 'border-indigo-500 bg-indigo-50 shadow-sm') : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}
                                >
                                    <input 
                                        type="radio" 
                                        name="director" 
                                        value={director.employeeId} 
                                        checked={selectedDirector === director.employeeId}
                                        onChange={(e) => setSelectedDirector(e.target.value)}
                                        className={`w-4 h-4 ${isCheckMode ? 'text-orange-600 focus:ring-orange-500' : 'text-indigo-600 focus:ring-indigo-500'} border-gray-300`}
                                    />
                                    <div className="ml-3">
                                        <span className="block text-sm font-medium text-gray-900">{director.name}</span>
                                        <span className="block text-xs text-gray-500">
                                            {employees.find(e => e.id === director.employeeId)?.position || (director.role === UserRole.ADMIN ? 'Giám đốc' : 'Phó giám đốc')}
                                        </span>
                                    </div>
                                </label>
                            ))}
                            {targetUsers.length === 0 && (
                                <div className="text-sm text-red-500 flex items-center gap-1 p-2 bg-red-50 rounded-lg">
                                    <AlertCircle size={14} /> Không tìm thấy user {isCheckMode ? 'Tổ trưởng/Tổ phó' : 'Ban giám đốc'} nào.
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                        <button 
                            onClick={onClose} 
                            className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium transition-colors"
                        >
                            Hủy
                        </button>
                        <button 
                            onClick={handleSubmit} 
                            disabled={!selectedDirector}
                            className={`flex items-center gap-2 px-5 py-2 rounded-xl font-bold text-white transition-all shadow-md ${selectedDirector ? (isCheckMode ? 'bg-orange-600 hover:bg-orange-700' : 'bg-indigo-600 hover:bg-indigo-700') : 'bg-gray-300 cursor-not-allowed'}`}
                        >
                            <CheckCircle size={18} />
                            Xác nhận {isCheckMode ? 'trình kiểm tra' : 'trình ký'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SubmitModal;