
import React, { useState, useEffect, useRef } from 'react';
import { WorkSchedule, User } from '../../types';
import { Calendar, User as UserIcon, FileText, Building, Save, X, Plus, Check } from 'lucide-react';

interface ScheduleFormProps {
    initialData?: WorkSchedule | null;
    currentUser: User;
    onSave: (data: Partial<WorkSchedule>) => Promise<boolean>;
    onCancel: () => void;
}

const ScheduleForm: React.FC<ScheduleFormProps> = ({ initialData, currentUser, onSave, onCancel }) => {
    const [formData, setFormData] = useState<Partial<WorkSchedule>>({
        date: new Date().toISOString(),
        executors: currentUser.name,
        content: '',
        partner: ''
    });
    const [isSaving, setIsSaving] = useState(false);

    // State cho việc thêm người (Thay thế prompt)
    const [isAddingPerson, setIsAddingPerson] = useState(false);
    const [tempPersonName, setTempPersonName] = useState('');
    const tempInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (initialData) {
            setFormData(initialData);
        } else {
            // Reset khi tạo mới
            setFormData({
                date: new Date().toISOString(),
                executors: currentUser.name,
                content: '',
                partner: ''
            });
        }
    }, [initialData, currentUser]);

    // Tự động focus khi bấm thêm người
    useEffect(() => {
        if (isAddingPerson && tempInputRef.current) {
            tempInputRef.current.focus();
        }
    }, [isAddingPerson]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.date || !formData.executors || !formData.content) {
            alert('Vui lòng nhập đầy đủ Ngày, Người thực hiện và Nội dung công việc.');
            return;
        }

        setIsSaving(true);
        const success = await onSave({
            ...formData,
            created_by: initialData ? initialData.created_by : currentUser.username
        });
        setIsSaving(false);
        
        if (!success) {
            alert('Lỗi khi lưu lịch công tác.');
        }
    };

    const confirmAddPerson = () => {
        if (tempPersonName.trim()) {
            setFormData(prev => ({
                ...prev,
                executors: prev.executors ? `${prev.executors}, ${tempPersonName.trim()}` : tempPersonName.trim()
            }));
            setTempPersonName('');
            setIsAddingPerson(false);
        } else {
            setIsAddingPerson(false); // Nếu rỗng thì hủy
        }
    };

    const cancelAddPerson = () => {
        setTempPersonName('');
        setIsAddingPerson(false);
    };

    const handleKeyDownTemp = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault(); // Ngăn submit form chính
            confirmAddPerson();
        } else if (e.key === 'Escape') {
            cancelAddPerson();
        }
    };

    return (
        <div className="bg-white p-6 rounded-xl border border-blue-200 shadow-sm">
            <h3 className="text-lg font-bold text-blue-800 mb-4 flex items-center gap-2 border-b pb-2">
                {initialData ? 'Chỉnh sửa Lịch Công Tác' : 'Thêm Lịch Công Tác Mới'}
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Ngày công tác <span className="text-red-500">*</span></label>
                    <div className="relative">
                        <Calendar size={16} className="absolute left-3 top-3 text-gray-400" />
                        <input 
                            type="date" 
                            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            value={formData.date}
                            onChange={e => setFormData({...formData, date: e.target.value})}
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Người thực hiện <span className="text-red-500">*</span></label>
                    <div className="flex gap-2 items-start">
                        <div className="relative flex-1">
                            <UserIcon size={16} className="absolute left-3 top-3 text-gray-400" />
                            <input 
                                type="text" 
                                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                                value={formData.executors}
                                onChange={e => setFormData({...formData, executors: e.target.value})}
                                placeholder="Nhập tên người thực hiện..."
                            />
                        </div>
                        
                        {/* Giao diện Thêm người mới (Thay thế prompt) */}
                        {isAddingPerson ? (
                            <div className="flex items-center gap-1 animate-fade-in">
                                <input 
                                    ref={tempInputRef}
                                    type="text" 
                                    className="w-32 px-2 py-2 border border-blue-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Tên..."
                                    value={tempPersonName}
                                    onChange={e => setTempPersonName(e.target.value)}
                                    onKeyDown={handleKeyDownTemp}
                                />
                                <button 
                                    type="button" 
                                    onClick={confirmAddPerson}
                                    className="p-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200"
                                    title="Đồng ý"
                                >
                                    <Check size={16} />
                                </button>
                                <button 
                                    type="button" 
                                    onClick={cancelAddPerson}
                                    className="p-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
                                    title="Hủy"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        ) : (
                            <button 
                                type="button" 
                                onClick={() => setIsAddingPerson(true)}
                                className="px-3 py-2 bg-blue-50 text-blue-600 rounded-lg border border-blue-200 hover:bg-blue-100 flex items-center gap-1 text-xs font-bold whitespace-nowrap h-[38px]"
                            >
                                <Plus size={14} /> Thêm người
                            </button>
                        )}
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Văn bản / Nội dung công việc <span className="text-red-500">*</span></label>
                    <div className="relative">
                        <FileText size={16} className="absolute left-3 top-3 text-gray-400" />
                        <textarea 
                            rows={3}
                            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                            value={formData.content}
                            onChange={e => setFormData({...formData, content: e.target.value})}
                            placeholder="Nhập nội dung chi tiết..."
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Cơ quan phối hợp</label>
                    <div className="relative">
                        <Building size={16} className="absolute left-3 top-3 text-gray-400" />
                        <input 
                            type="text" 
                            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            value={formData.partner}
                            onChange={e => setFormData({...formData, partner: e.target.value})}
                            placeholder="VD: UBND xã, Phòng TNMT..."
                        />
                    </div>
                </div>

                <div className="pt-4 border-t flex justify-end gap-3">
                    <button 
                        type="button" 
                        onClick={onCancel}
                        className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium"
                    >
                        Hủy
                    </button>
                    <button 
                        type="submit" 
                        disabled={isSaving}
                        className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-md font-bold text-sm transition-all"
                    >
                        <Save size={16} /> {initialData ? 'Cập nhật' : 'Lưu lịch'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default ScheduleForm;
