
import React, { useState, useEffect } from 'react';
import { User, WorkSchedule } from '../types';
import { fetchWorkSchedules, saveWorkSchedule, deleteWorkSchedule } from '../services/apiWorkSchedule';
import ScheduleForm from './work-schedule/ScheduleForm';
import ScheduleList from './work-schedule/ScheduleList';
import ScheduleSummary from './work-schedule/ScheduleSummary';
import { Calendar, Plus } from 'lucide-react';

interface WorkScheduleViewProps {
    currentUser: User;
}

const WorkScheduleView: React.FC<WorkScheduleViewProps> = ({ currentUser }) => {
    const [schedules, setSchedules] = useState<WorkSchedule[]>([]);
    const [editingSchedule, setEditingSchedule] = useState<WorkSchedule | null>(null);
    const [isFormOpen, setIsFormOpen] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const data = await fetchWorkSchedules();
        setSchedules(data);
    };

    const handleSave = async (data: Partial<WorkSchedule>) => {
        const success = await saveWorkSchedule(data);
        if (success) {
            await loadData();
            setIsFormOpen(false);
            setEditingSchedule(null);
        }
        return success;
    };

    const handleDelete = async (id: string) => {
        const success = await deleteWorkSchedule(id);
        if (success) {
            setSchedules(prev => prev.filter(s => s.id !== id));
        }
    };

    const handleEdit = (schedule: WorkSchedule) => {
        setEditingSchedule(schedule);
        setIsFormOpen(true);
    };

    return (
        <div className="flex h-full w-full gap-4 md:gap-6 animate-fade-in overflow-hidden">
            {/* Left Column: Form (Full width on mobile when open, max-w-sm on desktop) */}
            <div className={`w-full ${isFormOpen ? 'block fixed inset-0 z-50 bg-white p-4 overflow-y-auto' : 'hidden md:block md:w-80 md:max-w-sm flex-none overflow-y-auto pr-2'}`}>
                <div className="flex flex-col gap-4 max-w-lg mx-auto md:max-w-none">
                    <ScheduleForm 
                        initialData={editingSchedule}
                        currentUser={currentUser}
                        onSave={handleSave}
                        onCancel={() => { setIsFormOpen(false); setEditingSchedule(null); }}
                    />

                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-sm text-blue-800 hidden md:block">
                        <h4 className="font-bold flex items-center gap-2 mb-2"><Calendar size={16}/> Hướng dẫn</h4>
                        <ul className="list-disc list-inside space-y-1 text-xs">
                            <li>Nhập đầy đủ ngày và nội dung công việc.</li>
                            <li>Có thể thêm nhiều người phối hợp.</li>
                            <li>Sử dụng bộ lọc bên phải để xuất báo cáo.</li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Right Column: List & Summary (Expands to fill full container height) */}
            <div className={`flex-1 min-w-0 transition-all duration-300 flex flex-col gap-4 md:gap-6 overflow-y-auto pr-1 md:pr-2 h-full ${isFormOpen ? 'hidden md:flex' : 'flex'}`}>
                <div className="flex-1 min-h-[420px] md:min-h-[500px] flex flex-col">
                    <ScheduleList 
                        schedules={schedules}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                    />
                </div>
                
                <div className="flex-shrink-0 pb-6">
                    <ScheduleSummary schedules={schedules} />
                </div>
            </div>

            {/* Floating Green Plus Button for Mobile Schedule Tab */}
            {!isFormOpen && (
                <button 
                    onClick={() => { setEditingSchedule(null); setIsFormOpen(true); }}
                    className="fixed bottom-20 right-4 w-14 h-14 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-full shadow-2xl border-2 border-white flex items-center justify-center transition-all z-40 md:hidden cursor-pointer"
                    title="Đăng ký lịch công tác mới"
                >
                    <Plus size={28} className="stroke-[3]" />
                </button>
            )}
        </div>
    );
};

export default WorkScheduleView;
